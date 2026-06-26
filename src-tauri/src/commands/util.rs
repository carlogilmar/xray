//! Shared filesystem + source-filtering helpers used across analyses.

use std::path::{Path, PathBuf};
use ignore::WalkBuilder;

/// Directory names that are never walked into.
pub const EXCLUDED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "_build",
    "deps",
    "target",
    "dist",
    "build",
    ".svelte-kit",
    "vendor",
    "__pycache__",
    ".venv",
];

/// Path fragments that disqualify a file even if the directory name alone wouldn't.
pub const EXCLUDED_FRAGMENTS: &[&str] = &["priv/static"];

/// Source extensions we analyze (see CLAUDE.md "File filtering").
pub fn included_extension(ext: &str) -> bool {
    matches!(
        ext,
        "ex" | "exs"
            | "heex"
            | "rb"
            | "erb"
            | "js"
            | "ts"
            | "jsx"
            | "tsx"
            | "vue"
            | "svelte"
            | "go"
            | "rs"
            | "py"
            | "css"
            | "scss"
    )
}

/// Walk `root` returning every analyzable source file.
///
/// Honors `.gitignore` (and `.ignore`, parent/global gitignores, git excludes)
/// when `root` is inside a git repo, so files git ignores aren't analyzed.
/// Hidden dot-files are skipped, and `EXCLUDED_DIRS` are pruned as a fallback
/// for repos that commit vendored dirs git wouldn't ignore. On a non-git
/// directory it degrades to a plain recursive walk (LOC doesn't require git).
pub fn walk_source_files(root: &Path) -> Vec<PathBuf> {
    WalkBuilder::new(root)
        .hidden(true) // skip dotfiles/dirs (incl. .git)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .parents(true)
        .filter_entry(|e| {
            // prune excluded directories before descending
            if e.file_type().map_or(false, |t| t.is_dir()) {
                let name = e.file_name().to_string_lossy();
                return !EXCLUDED_DIRS.contains(&name.as_ref());
            }
            true
        })
        .build()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().map_or(false, |t| t.is_file()))
        .map(|e| e.into_path())
        .filter(|p| {
            let s = p.to_string_lossy().replace('\\', "/");
            if EXCLUDED_FRAGMENTS.iter().any(|f| s.contains(f)) {
                return false;
            }
            match p.extension().and_then(|x| x.to_str()) {
                Some(ext) => included_extension(ext),
                None => false,
            }
        })
        .collect()
}

/// (line-comment prefixes, block-comment delimiter pairs) for an extension.
fn comment_tokens(ext: &str) -> (&'static [&'static str], &'static [(&'static str, &'static str)]) {
    match ext {
        "rs" | "js" | "ts" | "jsx" | "tsx" | "go" | "scss" | "vue" | "svelte" => {
            (&["//"], &[("/*", "*/")])
        }
        "css" => (&[], &[("/*", "*/")]),
        "ex" | "exs" => (&["#"], &[]),
        "rb" => (&["#"], &[("=begin", "=end")]),
        "py" => (&["#"], &[]),
        "heex" | "erb" => (&[], &[("<!--", "-->")]),
        _ => (&[], &[]),
    }
}

/// Count (code, blank, comment) lines with a lightweight per-language heuristic.
pub fn count_lines(path: &Path, ext: &str) -> (usize, usize, usize) {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return (0, 0, 0), // unreadable / binary
    };
    let (line_prefixes, block_pairs) = comment_tokens(ext);
    let (mut code, mut blank, mut comment) = (0usize, 0usize, 0usize);
    let mut block_end: Option<&'static str> = None;

    'lines: for raw in content.lines() {
        let line = raw.trim();

        if let Some(end) = block_end {
            comment += 1;
            if line.contains(end) {
                block_end = None;
            }
            continue;
        }
        if line.is_empty() {
            blank += 1;
            continue;
        }
        for (start, end) in block_pairs {
            if line.starts_with(start) {
                comment += 1;
                if !line[start.len()..].contains(end) {
                    block_end = Some(end);
                }
                continue 'lines;
            }
        }
        for p in line_prefixes {
            if line.starts_with(p) {
                comment += 1;
                continue 'lines;
            }
        }
        code += 1;
    }
    (code, blank, comment)
}

/// Path relative to `root`, normalized to forward slashes.
pub fn rel(root: &Path, p: &Path) -> String {
    p.strip_prefix(root)
        .unwrap_or(p)
        .to_string_lossy()
        .replace('\\', "/")
}
