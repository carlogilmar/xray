use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

use rayon::prelude::*;

use super::util;
use crate::models::HotspotStat;

/// Count how many commits touched each file (path relative to repo root).
fn git_change_counts(root: &Path) -> HashMap<String, usize> {
    let mut counts = HashMap::new();
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["log", "--name-only", "--pretty=format:"])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                *counts.entry(line.replace('\\', "/")).or_insert(0) += 1;
            }
        }
    }
    counts
}

/// Join LOC with git change frequency to surface hotspots (big AND volatile).
#[tauri::command]
pub fn analyze_hotspots(path: String) -> Result<Vec<HotspotStat>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    let files = util::walk_source_files(root);
    let loc_map: HashMap<String, usize> = files
        .par_iter()
        .map(|p| {
            let ext = p.extension().and_then(|x| x.to_str()).unwrap_or("");
            let (code, _, _) = util::count_lines(p, ext);
            (util::rel(root, p), code)
        })
        .collect();

    let changes = git_change_counts(root);

    let max_changes = loc_map
        .keys()
        .map(|k| *changes.get(k).unwrap_or(&0))
        .max()
        .unwrap_or(0)
        .max(1);
    let max_loc = loc_map.values().copied().max().unwrap_or(0).max(1);

    let mut stats: Vec<HotspotStat> = loc_map
        .iter()
        .map(|(p, &code)| {
            let ch = *changes.get(p).unwrap_or(&0);
            let score =
                (ch as f64 / max_changes as f64 + code as f64 / max_loc as f64) / 2.0 * 100.0;
            HotspotStat {
                path: p.clone(),
                score,
                changes: ch,
                code,
            }
        })
        .collect();

    stats.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    Ok(stats)
}
