# Xray — Claude Code Context

A language-agnostic CLI tool written in **Rust** that analyzes any project directory and produces a self-contained HTML report with interactive visualizations.

---

## What it does

Point it at any codebase — Elixir, Ruby, Node, Go — and it produces four analyses:

| Analysis | Question answered |
|---|---|
| **Lines of code** | Which files are the largest? |
| **Hotspots** | Which files are large AND frequently changed? |
| **Churn** | Which files are being rewritten the most? |
| **Coupling** | Which files always change together? |

Results are written to a self-contained `xray-report.html` and opened in the browser automatically.

---

## Usage

```bash
xray .                          # analyze current directory
xray /path/to/any/project       # analyze a specific directory
xray . --only src               # scope to a subdirectory
xray . --days 60                # churn window (default: 90 days)
xray . --limit 20               # top N files per analysis (default: 10)
xray . --output report.html     # custom output path (default: xray-report.html)
```

---

## Architecture

### Data pipeline

```
directory path
  └── git log (churn, coupling, hotspots)
  └── file walker (LOC — built-in, no cloc dependency)
        └── Analyzer structs
              └── HTML report generator
```

### Modules

| Module | Responsibility |
|---|---|
| `main.rs` | CLI argument parsing (`clap`) |
| `git.rs` | Shell out to `git log --numstat` and `git log --name-only` |
| `walker.rs` | Walk the directory tree, count lines per file (blank, comment, code) |
| `analyzer.rs` | Compute LOC, hotspots, churn, coupling scores |
| `report.rs` | Render the self-contained HTML report |

### Key types

```rust
struct FileStat {
    path: String,
    code: usize,
    blank: usize,
    comment: usize,
}

struct ChurnStat {
    path: String,
    added: usize,
    deleted: usize,
    churn: usize,
    commits: usize,
}

struct HotspotStat {
    path: String,
    score: f64,      // normalized: (churn + loc) / 2 * 100
    changes: usize,
    code: usize,
}

struct CouplingPair {
    file_a: String,
    file_b: String,
    count: usize,    // times co-changed in same commit
}
```

---

## HTML report

A single `.html` file with no external dependencies — all JS and CSS inlined.

### Visualizations

| Section | Chart type | Library |
|---|---|---|
| Lines of code | Horizontal bar chart | Chart.js (inlined) |
| Hotspots | Bubble chart: x=churn, y=LOC, size=score | Chart.js |
| Churn | Horizontal bar chart (added vs deleted stacked) | Chart.js |
| Coupling | Force-directed graph: nodes=files, edges=coupling pairs, thickness=co-change count | D3.js (inlined) |

The coupling graph is the primary insight — file relationships that are invisible in tables become obvious as a graph.

### Report generation

`report.rs` builds the HTML as a String using a template with JSON data blobs injected inline. Chart.js and D3.js minified sources are embedded as string constants so the report works with no internet connection.

---

## File filtering

Files are included if their extension matches the configured set. Default extensions:

```
.ex .exs .heex   # Elixir
.rb .erb         # Ruby
.js .ts .jsx .tsx .vue  # JavaScript/TypeScript
.go              # Go
.rs              # Rust
.py              # Python
.css .scss       # Styles
```

Binary files, `node_modules`, `.git`, `_build`, `deps`, `priv/static` are always excluded.

---

## Dependencies

```toml
[dependencies]
clap = { version = "4", features = ["derive"] }  # CLI argument parsing
serde = { version = "1", features = ["derive"] }  # JSON serialization for report data
serde_json = "1"
walkdir = "2"                                      # directory traversal
```

No `cloc` dependency — line counting is implemented natively in `walker.rs`.
Only external runtime requirement: `git` must be available on PATH.

---

## Build & install

```bash
cargo build --release
cargo install --path .          # installs xray to ~/.cargo/bin
```

---

## Design decisions

- **Self-contained HTML** over a local web server — simpler, shareable, works offline.
- **Native line counting** over shelling out to `cloc` — removes the only external dependency beyond `git`.
- **Chart.js + D3 inlined** — the report opens anywhere with no CDN calls.
- **No database, no config file** — stateless, runs fresh each time from git history + filesystem.
