use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

use super::util;
use crate::models::CouplingPair;

/// Commits touching more than this many files are skipped — they're usually
/// mass refactors/formatting and would create O(n^2) noise in the graph.
const MAX_FILES_PER_COMMIT: usize = 30;

/// Find pairs of files that change together in the same commit.
#[tauri::command]
pub async fn analyze_coupling(path: String) -> Result<Vec<CouplingPair>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["log", "--name-only", "--pretty=format:__C__"])
        .output()
        .map_err(|e| format!("git failed: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut pairs: HashMap<(String, String), usize> = HashMap::new();
    let mut commit_files: Vec<String> = Vec::new();

    let flush = |files: &mut Vec<String>, pairs: &mut HashMap<(String, String), usize>| {
        files.sort();
        files.dedup();
        if files.len() >= 2 && files.len() <= MAX_FILES_PER_COMMIT {
            for i in 0..files.len() {
                for j in (i + 1)..files.len() {
                    let key = (files[i].clone(), files[j].clone());
                    *pairs.entry(key).or_insert(0) += 1;
                }
            }
        }
        files.clear();
    };

    for line in text.lines() {
        if line.starts_with("__C__") {
            flush(&mut commit_files, &mut pairs);
            continue;
        }
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let ext = Path::new(line)
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("");
        if !util::included_extension(ext) {
            continue;
        }
        commit_files.push(line.replace('\\', "/"));
    }
    flush(&mut commit_files, &mut pairs);

    let mut result: Vec<CouplingPair> = pairs
        .into_iter()
        .filter(|(_, c)| *c >= 2)
        .map(|((a, b), count)| CouplingPair {
            file_a: a,
            file_b: b,
            count,
        })
        .collect();

    result.sort_by(|a, b| b.count.cmp(&a.count));
    result.truncate(200);
    Ok(result)
}
