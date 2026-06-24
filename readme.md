# Xray

A desktop app that reads any git project as a *crime scene* — four interactive
D3 visualizations of its structure and history, inspired by Adam Tornhill's
*Your Code as a Crime Scene* and the data-visualization style of David
McCandless's *Information is Beautiful*.

Point it at a directory, click **Analyze**, and get four views:

| Tab | Question | Visualization |
|---|---|---|
| **LOC** | Which files are largest? | Treemap |
| **Hotspots** | Which files are large **and** churn-heavy? | Circle packing |
| **Churn** | What's being rewritten, and when? | Heatmap |
| **Coupling** | Which files always change together? | Force-directed graph |
| **Owners** | Who's behind the project, and how much do they own? | Treemap by author |

Built with **Tauri 2 + Svelte 5 + D3 v7** (frontend) and **Rust** (analysis).
Only `git` is required at runtime — churn and coupling shell out to `git log`;
LOC and hotspots are pure filesystem.

---

## Prerequisites

Toolchain versions are pinned in `.tool-versions` (managed with [asdf](https://asdf-vm.com)):

| Tool | Version |
|---|---|
| Rust | 1.95.0 |
| Node.js | 25.9.0 |
| pnpm | 9.15.0 |

With asdf installed:

```bash
asdf install        # installs the pinned rust / nodejs / pnpm
```

You also need the platform prerequisites for Tauri 2 (on macOS: Xcode Command
Line Tools). See the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/).

---

## Install

```bash
pnpm install
```

## Run in development

Launches the app with hot-reload (Vite for the frontend, `cargo` watch for Rust):

```bash
pnpm tauri dev
```

## Build the desktop app

Produces an optimized native binary and platform installers under
`src-tauri/target/release/bundle/`:

```bash
pnpm tauri build
```

On macOS this yields a `.app` and a `.dmg`; on Windows an `.msi`/`.exe`; on
Linux `.deb`/`.AppImage`.

### App icons (only if you change the icon)

Icons are generated from a source PNG and committed under `src-tauri/icons/`.
To regenerate them:

```bash
node scripts/generate-icon.mjs      # writes app-icon.png (1024×1024)
pnpm tauri icon app-icon.png        # generates every platform icon
```

---

## Design mock

`mockup/` is a standalone, dependency-free HTML prototype of all four views
(D3 and the Oswald font are inlined, so it runs offline with no build). It's
where visualization/UX changes are prototyped before being ported into the
Svelte components.

```bash
open mockup/index.html        # view the current prototype

# after editing mockup/src/*:
./mockup/build.sh             # regenerate mockup/index.html
```

---

## Verifying the backend without the GUI

`src-tauri/examples/smoke.rs` runs all four analyses against a path and prints a
summary:

```bash
cargo run --manifest-path src-tauri/Cargo.toml --example smoke -- /path/to/repo
```
