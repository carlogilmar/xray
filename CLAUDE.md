# Xray — Claude Code Context

A desktop app built with **Tauri + Svelte + Rust** that analyzes any project directory and displays interactive D3 visualizations across four tabs.

---

## What it does

The user picks a directory, clicks Analyze, and gets four visual analyses of the codebase — each in its own tab with a D3 visualization designed to make the insight immediately visible.

| Tab | Analysis | Visualization |
|---|---|---|
| **LOC** | Which files are the largest? | Treemap |
| **Hotspots** | Which files are large AND frequently changed? | Circle Packing |
| **Churn** | Which files are being rewritten the most, and when? | Heatmap |
| **Coupling** | Which files always change together? | Force-directed graph |

---

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 |
| Frontend | Svelte 5 |
| Visualizations | D3.js v7 |
| Backend / analysis | Rust (Tauri commands) |

---

## User flow

1. App opens to a single screen with a directory input and an Analyze button
2. User types or picks a directory path (Tauri file dialog)
3. User clicks Analyze — all four analyses run in parallel via Tauri commands
4. Four tabs appear; each tab renders its D3 visualization as data arrives
5. User can switch tabs freely and re-run analysis on a different directory

---

## Visualizations

### Tab 1 — LOC: Treemap

Files as rectangles, area = lines of code, grouped and nested by directory hierarchy. Color by file extension. The shape of the codebase becomes immediately visible — which folders dominate, which files are outliers.

### Tab 2 — Hotspots: Circle Packing

Files as circles nested inside their parent directory circles. Circle size = LOC. Color intensity = change frequency (cool/neutral = rarely changed, hot red = frequently changed). The riskiest files glow; safe files recede.

### Tab 3 — Churn: Heatmap

Files on the Y axis, weeks on the X axis, cell color = churn intensity (additions + deletions) during that week. Similar to GitHub's contribution graph but per file. Reveals when files were actively rewritten vs stable — bursts of activity, periods of calm.

### Tab 4 — Coupling: Force-directed graph

Files as nodes, edges drawn between files that co-changed in the same commit. Edge thickness = coupling count. Tightly coupled clusters pull together naturally; isolated files float away. The hidden dependency structure of the codebase becomes a visible map.

---

## Architecture

### Frontend (Svelte)

```
src/
  App.svelte              # directory input, analyze button, tab shell
  lib/
    tabs/
      LocTab.svelte       # treemap
      HotspotsTab.svelte  # circle packing
      ChurnTab.svelte     # heatmap
      CouplingTab.svelte  # force-directed graph
    visualizations/
      Treemap.svelte      # D3 treemap component
      CirclePacking.svelte
      Heatmap.svelte
      ForceGraph.svelte
```

Each visualization component receives its data as a prop and owns its D3 lifecycle (create on mount, update on data change, destroy on unmount).

### Backend (Rust / Tauri commands)

```
src-tauri/src/
  main.rs
  commands/
    loc.rs        # walk directory, count lines natively
    hotspots.rs   # git log + loc join, normalize score
    churn.rs      # git log --numstat --since, aggregate by file + week
    coupling.rs   # git log --name-only, find co-changed pairs
  models.rs       # shared structs + serde types
```

### Tauri commands

```rust
#[tauri::command]
fn analyze_loc(path: String) -> Vec<FileStat>

#[tauri::command]
fn analyze_hotspots(path: String) -> Vec<HotspotStat>

#[tauri::command]
fn analyze_churn(path: String, days: u32) -> Vec<ChurnWeekStat>

#[tauri::command]
fn analyze_coupling(path: String) -> Vec<CouplingPair>
```

### Key types

```rust
struct FileStat {
    path: String,
    directory: String,
    extension: String,
    code: usize,
    blank: usize,
    comment: usize,
}

struct HotspotStat {
    path: String,
    score: f64,       // normalized: (churn + loc) / 2 * 100
    changes: usize,
    code: usize,
}

struct ChurnWeekStat {
    path: String,
    week: String,     // ISO week, e.g. "2025-W12"
    added: usize,
    deleted: usize,
    churn: usize,
}

struct CouplingPair {
    file_a: String,
    file_b: String,
    count: usize,
}
```

---

## File filtering

Always excluded: `node_modules`, `.git`, `_build`, `deps`, `priv/static`, `target`, `dist`, binary files.

Default extensions included:

```
.ex .exs .heex        # Elixir
.rb .erb              # Ruby
.js .ts .jsx .tsx     # JavaScript / TypeScript
.vue .svelte          # UI frameworks
.go                   # Go
.rs                   # Rust
.py                   # Python
.css .scss            # Styles
```

---

## Design decisions

- **Four tabs** over a single dashboard — each visualization needs space to breathe, especially the force graph and heatmap.
- **Native line counting** in Rust — no dependency on `cloc`.
- **Only `git` required** at runtime — churn and coupling shell out to `git log`; everything else is pure filesystem.
- **All four analyses run in parallel** on click — Tauri commands are async; frontend renders each tab as its data resolves.
- **D3 owned by Svelte components** — each visualization component manages its own D3 instance; no shared global D3 state.

---

## Build & run

```bash
npm install
npm run tauri dev     # development
npm run tauri build   # production binary
```
