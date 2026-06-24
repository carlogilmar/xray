use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

use chrono::{DateTime, Datelike};

use super::util;
use crate::models::ChurnWeekStat;

/// Aggregate additions/deletions per file per ISO week over the last `days`.
#[tauri::command]
pub fn analyze_churn(path: String, days: u32) -> Result<Vec<ChurnWeekStat>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    let since = format!("--since={days} days ago");
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["log", "--numstat", &since, "--pretty=format:__C__%aI"])
        .output()
        .map_err(|e| format!("git failed: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    // key: (path, week) -> (added, deleted)
    let mut agg: HashMap<(String, String), (usize, usize)> = HashMap::new();
    let mut current_week = String::new();

    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("__C__") {
            if let Ok(dt) = DateTime::parse_from_rfc3339(rest.trim()) {
                let iso = dt.iso_week();
                current_week = format!("{}-W{:02}", iso.year(), iso.week());
            }
            continue;
        }

        let line = line.trim();
        if line.is_empty() || current_week.is_empty() {
            continue;
        }

        let mut parts = line.split('\t');
        let added = parts.next().unwrap_or("0");
        let deleted = parts.next().unwrap_or("0");
        let file = match parts.next() {
            Some(f) => f.replace('\\', "/"),
            None => continue,
        };
        if added == "-" {
            continue; // binary file
        }

        let ext = Path::new(&file)
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("");
        if !util::included_extension(ext) {
            continue;
        }

        let a: usize = added.parse().unwrap_or(0);
        let d: usize = deleted.parse().unwrap_or(0);
        let entry = agg.entry((file, current_week.clone())).or_insert((0, 0));
        entry.0 += a;
        entry.1 += d;
    }

    let mut stats: Vec<ChurnWeekStat> = agg
        .into_iter()
        .map(|((path, week), (added, deleted))| ChurnWeekStat {
            path,
            week,
            added,
            deleted,
            churn: added + deleted,
        })
        .collect();

    stats.sort_by(|a, b| a.week.cmp(&b.week));
    Ok(stats)
}
