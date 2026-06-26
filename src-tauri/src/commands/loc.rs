use std::path::Path;

use rayon::prelude::*;

use super::util;
use crate::models::FileStat;

/// Walk the directory and count lines natively for every source file.
#[tauri::command]
pub async fn analyze_loc(path: String) -> Result<Vec<FileStat>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    let files = util::walk_source_files(root);

    let mut stats: Vec<FileStat> = files
        .par_iter()
        .map(|p| {
            let ext = p
                .extension()
                .and_then(|x| x.to_str())
                .unwrap_or("")
                .to_string();
            let (code, blank, comment) = util::count_lines(p, &ext);
            let relp = util::rel(root, p);
            let directory = match relp.rfind('/') {
                Some(i) => relp[..i].to_string(),
                None => ".".to_string(),
            };
            FileStat {
                path: relp,
                directory,
                extension: ext,
                code,
                blank,
                comment,
            }
        })
        .collect();

    stats.sort_by(|a, b| b.code.cmp(&a.code));
    Ok(stats)
}
