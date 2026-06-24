# Xray — Claude Code Context

A desktop app built with **Tauri + Svelte + Rust** that analyzes any project directory and displays interactive D3 visualizations across five tabs.

---

## What it does

The user picks a directory, clicks Analyze, and gets five visual analyses of the codebase — each in its own tab with a D3 visualization designed to make the insight immediately visible.

| Tab | Analysis | Visualization |
|---|---|---|
| **LOC** | Which files are the largest? | Treemap |
| **Hotspots** | Which files are large AND frequently changed? | Circle Packing |
| **Churn** | Which files are being rewritten the most, and when? | Heatmap |
| **Coupling** | Which files always change together? | Force-directed graph |
| **Owners** | Who is behind this project, and how much do they own? | Treemap (by author) |

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

A **flat** treemap (no directory nesting) of the **top 120 files** by lines of code — area = LOC, color = file extension. Filenames are centered and scaled to fill each cell in a condensed display face (Oswald). The **10 largest** are emphasized with white labels and a staggered pulsing outline; the rest use black labels. A **file-type filter** (category chips at the top) narrows the view to one extension. Click any cell to copy its path.

### Tab 2 — Hotspots: Circle Packing

Files as circles nested inside their parent directory circles. Circle size = LOC, color = risk score (cool → hot red). **Risk = (changes / maxChanges) × (LOC / maxLOC) × 100** — the Tornhill *intersection*, so a file scores high only when it's both large and frequently changed. Circles grow in on load; the **10 riskiest** carry a pulsing ring. Click a circle for an inspector popover (anchored beside it) showing the full path, the score with its change/size breakdown, and a **copy path** button.

### Tab 3 — Churn: Heatmap

Files (top 45 by total churn) on the Y axis, active weeks on the X axis, cell color = churn intensity (additions + deletions) that week. Reveals when files were actively rewritten vs stable. **Hover a row** for Excel-style focus — the rest dim out and the row's activity cells pulse left-to-right through time. Click a row to copy its path.

### Tab 4 — Coupling: Force-directed graph

Files as nodes, edges between files that co-changed in the same commit. Edge thickness = coupling count, node size = total coupling, **node color = top-level directory** (shown in a legend). A **strength slider** raises the minimum co-change count to cut the hairball down to meaningful couplings. **Hover a node** to isolate it + its coupled partners (everything else fades). Drag to reposition, scroll to zoom, click a node to copy its path.

### Tab 5 — Owners: Team treemap

The team behind the project: a treemap where **each rectangle is a contributor**, sized by their share of the codebase. Ownership = churn contribution (added + deleted lines); a file's owner is the author who contributed the most to it, and a contributor's share is the total LOC of the files they own. Each cell is colored per author and labeled with `@author` and their `% · N files`. Hover for `% · files · commits`; click an author to copy their handle. Deliberately simple — it answers "who do I ask about this?", not per-file ownership.

---

## Architecture

### Frontend (Svelte)

```
src/
  main.js                 # mounts App; imports oswald.css then app.css
  app.css                 # tokens + ALL global D3/viz styles (see note below)
  oswald.css              # @font-face for Oswald, inlined as a base64 data URI
  App.svelte              # directory input, analyze button, tab shell
  lib/
    viz/
      util.js             # shared helpers: copyPath/toast, fmtLoc,
                          #   buildHierarchy, locColor, couplingColor, cpDirOf
    tabs/
      LocTab.svelte       # treemap + file-type filter chips
      HotspotsTab.svelte  # circle packing
      ChurnTab.svelte     # heatmap
      CouplingTab.svelte  # force graph + strength slider + dir legend
      OwnersTab.svelte    # team treemap
    visualizations/
      Treemap.svelte      # D3 treemap component
      CirclePacking.svelte
      Heatmap.svelte
      ForceGraph.svelte
      TeamTreemap.svelte  # contributors sized by ownership
```

Each visualization component receives its data (and any control state, e.g.
`filter`, `minCount`) as props and owns its D3 lifecycle: a `$effect` redraws on
data/prop/size change, and a `ResizeObserver` tracks the container.

**CSS gotcha:** Svelte scopes component `<style>` by adding a hash class to
elements and selectors, but D3-created SVG elements never get that class — so
component-scoped rules won't match them. All visualization styling (treemap
labels, pulses, inspector, heatmap row focus, force-graph focus, chips, legend,
toast) therefore lives **globally in `app.css`**, not in component `<style>`
blocks. Component `<style>` is used only for Svelte-rendered layout (tab
headers/bodies).

**Fill via `style`, not `attr`:** the shared `svg text { fill }` rule outranks a
presentation attribute, so per-element text colors are set with `.style("fill", …)`
(which wins) rather than `.attr("fill", …)`.

### Backend (Rust / Tauri commands)

```
src-tauri/src/
  main.rs
  commands/
    loc.rs        # walk directory, count lines natively
    hotspots.rs   # git log + loc join, risk = changeFrac * sizeFrac * 100
    churn.rs      # git log --numstat --since, aggregate by file + week
    coupling.rs   # git log --name-only, find co-changed pairs
    ownership.rs  # git log --numstat --pretty=%an, ownership per author
    util.rs       # shared file walking, filtering, line counting
  models.rs       # shared structs + serde types
```

`src-tauri/examples/smoke.rs` is a throwaway runner (`cargo run --example smoke -- <path>`)
that prints a summary of all five analyses — handy for verifying the backend without the GUI.

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

#[tauri::command]
fn analyze_ownership(path: String) -> Vec<Contributor>
```

All commands actually return `Result<Vec<T>, String>` so analysis errors surface in the UI.

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
    score: f64,       // Tornhill intersection: (changes/maxChanges) * (loc/maxLoc) * 100
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

struct Contributor {
    author: String,
    owned_files: usize,
    owned_loc: usize,
    commits: usize,
    share: f64,       // owned_loc / total owned LOC
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
- **All five analyses run in parallel** on click — Tauri commands are async; frontend renders each tab as its data resolves.
- **D3 owned by Svelte components** — each visualization component manages its own D3 instance; no shared global D3 state.
- **Risk is a product, not an average** — `changeFrac × sizeFrac`, so only files high on *both* axes (Tornhill's intersection) score as hotspots.
- **Copy-to-editor everywhere** — the call to action is "open this file," so every view lets the dev click a file to copy its path (toast confirms). In the desktop build this uses the webview clipboard.
- **Oswald, self-hosted** — the condensed display face is inlined as a base64 data URI in `oswald.css` so it works offline in the bundled app (no font CDN).

### Design mock

`mockup/` is a standalone, dependency-free HTML prototype of all four views,
driven by seeded synthetic data (a simulated commit log, so Hotspots/Churn/
Coupling are mutually consistent). It's the fast iteration surface — design
changes are proven there first, then ported into the Svelte components.

```
mockup/
  index.html        # generated, self-contained (D3 + Oswald inlined) — open directly
  build.sh          # regenerates index.html (inlines D3 + the font)
  src/top.html      # styles + app chrome
  src/app.js        # mock data + the four D3 views
  src/oswald-face.css
```

Edit `src/*`, run `./mockup/build.sh`, open `mockup/index.html`. Datasets
include a `tangled` repo that reproduces the coupling "hairball" for testing.

---

## Build & run

```bash
pnpm install
pnpm tauri dev     # development
pnpm tauri build   # production binary
```

> Toolchain is pinned in `.tool-versions` (asdf): rust 1.95.0, nodejs 25.9.0, pnpm 9.15.0.
> Tauri commands return `Result<Vec<T>, String>` so the frontend surfaces analysis errors.
> App icons are generated from `scripts/generate-icon.mjs` → `pnpm tauri icon app-icon.png`.
