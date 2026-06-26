use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::process::Command;

use rayon::prelude::*;

use super::util;
use crate::models::Contributor;

/// Who's behind the project: each author's share of the codebase, by the LOC of
/// the files they're the primary author of (ownership = churn contribution).
#[tauri::command]
pub async fn analyze_ownership(path: String) -> Result<Vec<Contributor>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    // LOC per source file
    let files = util::walk_source_files(root);
    let loc_map: HashMap<String, usize> = files
        .par_iter()
        .map(|p| {
            let ext = p.extension().and_then(|x| x.to_str()).unwrap_or("");
            let (code, _, _) = util::count_lines(p, ext);
            (util::rel(root, p), code)
        })
        .collect();

    // per-file author contribution (added + deleted) + commit counts per author
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["log", "--numstat", "--pretty=format:__C__%an"])
        .output()
        .map_err(|e| format!("git failed: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    let text = String::from_utf8_lossy(&output.stdout);

    let mut file_authors: HashMap<String, HashMap<String, usize>> = HashMap::new();
    let mut commits: HashMap<String, usize> = HashMap::new();
    let mut current = String::new();

    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("__C__") {
            current = rest.trim().to_string();
            *commits.entry(current.clone()).or_insert(0) += 1;
            continue;
        }
        let line = line.trim();
        if line.is_empty() || current.is_empty() {
            continue;
        }
        let mut parts = line.split('\t');
        let added = parts.next().unwrap_or("0");
        let deleted = parts.next().unwrap_or("0");
        let file = match parts.next() {
            Some(f) => f.replace('\\', "/"),
            None => continue,
        };
        if added == "-" || !loc_map.contains_key(&file) {
            continue; // binary, or not a source file we counted
        }
        let a: usize = added.parse().unwrap_or(0);
        let d: usize = deleted.parse().unwrap_or(0);
        *file_authors
            .entry(file)
            .or_default()
            .entry(current.clone())
            .or_insert(0) += a + d;
    }

    // primary author per file → owned files / owned LOC
    let mut owned_files: HashMap<String, usize> = HashMap::new();
    let mut owned_loc: HashMap<String, usize> = HashMap::new();
    for (file, authors) in &file_authors {
        if let Some((author, _)) = authors.iter().max_by_key(|(_, &c)| c) {
            *owned_files.entry(author.clone()).or_insert(0) += 1;
            *owned_loc.entry(author.clone()).or_insert(0) += loc_map.get(file).copied().unwrap_or(0);
        }
    }

    let total_owned = owned_loc.values().sum::<usize>().max(1);

    let authors: HashSet<String> = owned_loc.keys().cloned().collect();
    let mut result: Vec<Contributor> = authors
        .into_iter()
        .map(|author| {
            let ol = *owned_loc.get(&author).unwrap_or(&0);
            Contributor {
                owned_files: *owned_files.get(&author).unwrap_or(&0),
                owned_loc: ol,
                commits: *commits.get(&author).unwrap_or(&0),
                share: ol as f64 / total_owned as f64,
                author,
            }
        })
        .collect();

    result.sort_by(|a, b| b.owned_loc.cmp(&a.owned_loc));
    Ok(result)
}
