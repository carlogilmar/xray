/* ============================================================
   Xray visualization mock — vanilla port of the Svelte/D3 views.
   Data comes from a seeded, simulated commit log so Hotspots,
   Churn and Coupling are mutually consistent (same as the Rust backend).
   ============================================================ */

// ---- seeded RNG (mulberry32) ----
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// ---- synthetic codebase definitions ----
const DATASETS = {
  small: { seed: 7, weeks: 30, commits: 120, features: 5, label: "cli-tool" },
  medium: { seed: 42, weeks: 52, commits: 600, features: 11, label: "aurora-web" },
  large: { seed: 99, weeks: 52, commits: 1600, features: 22, label: "monolith" },
  // poorly modularized: big commits that reach across features → spiderweb
  tangled: { seed: 123, weeks: 52, commits: 1500, features: 16, label: "legacy-mono", tangle: 0.6, big: true },
};

const AREAS = [
  { dir: "src/components", ext: ["svelte", "ts"], names: ["Button", "Modal", "Table", "Nav", "Sidebar", "Card", "Dropdown", "Toast", "Avatar", "Tabs", "Chart", "Form", "Dialog", "Tooltip", "Menu"] },
  { dir: "src/lib", ext: ["ts", "js"], names: ["api", "store", "auth", "format", "validate", "router", "http", "cache", "events", "utils", "query"] },
  { dir: "src/routes", ext: ["svelte", "ts"], names: ["home", "login", "dashboard", "settings", "profile", "billing", "search", "admin", "reports"] },
  { dir: "server/handlers", ext: ["rs", "go"], names: ["users", "sessions", "orders", "payments", "webhooks", "search", "uploads", "notify"] },
  { dir: "server/db", ext: ["rs", "sql"], names: ["schema", "migrations", "pool", "queries", "models"] },
  { dir: "server/core", ext: ["rs"], names: ["config", "server", "router", "middleware", "error", "telemetry"] },
  { dir: "tests", ext: ["ts", "rs"], names: ["api_test", "auth_test", "e2e", "smoke", "fixtures", "integration"] },
  { dir: "styles", ext: ["css", "scss"], names: ["global", "tokens", "layout", "theme"] },
];

function buildFiles(cfg, r) {
  const files = [];
  let fid = 0;
  for (const area of AREAS) {
    // larger datasets include more of each area's files
    const take = cfg.label === "cli-tool" ? 3 : area.names.length;
    for (let i = 0; i < take; i++) {
      const ext = pick(r, area.ext);
      const loc = Math.round(40 + Math.pow(r(), 2.2) * 900); // skewed: many small, few huge
      files.push({
        path: `${area.dir}/${area.names[i]}.${ext}`,
        ext,
        code: loc,
        feature: fid % cfg.features,
        activity: 0.2 + Math.pow(r(), 1.6), // some files are far more active
        changes: 0,
      });
      fid++;
    }
  }
  return files;
}

// Simulate commits → per-file changes, weekly churn, co-change pairs.
function simulate(cfg) {
  const r = rng(cfg.seed);
  const files = buildFiles(cfg, r);
  const byFeature = {};
  files.forEach((f) => (byFeature[f.feature] ||= []).push(f));

  const churn = new Map(); // "path|week" -> {added,deleted}
  const pairs = new Map(); // "a|b" -> count
  const isoWeek = (w) => `2025-W${String((w % 52) + 1).padStart(2, "0")}`;

  for (let c = 0; c < cfg.commits; c++) {
    const week = Math.floor(r() * cfg.weeks);
    const feat = Math.floor(r() * cfg.features);
    const pool = byFeature[feat] || files;
    // commit touches a few files, mostly from one feature (coupling), weighted by activity
    const maxFiles = cfg.big ? 8 : 5;
    const n = 1 + Math.floor(r() * Math.min(maxFiles, pool.length));
    const touched = [];
    for (let k = 0; k < n; k++) {
      // activity-weighted pick
      let best = pool[0], bestW = -1;
      for (let s = 0; s < 3; s++) {
        const cand = pool[Math.floor(r() * pool.length)];
        const w = cand.activity * r();
        if (w > bestW) { bestW = w; best = cand; }
      }
      if (!touched.includes(best)) touched.push(best);
    }
    // cross-feature files create inter-cluster edges; high `tangle` = spiderweb
    const crossProb = cfg.tangle ?? 0.15;
    let crosses = 0;
    while (r() < crossProb && crosses < 4) {
      const x = files[Math.floor(r() * files.length)];
      if (!touched.includes(x)) touched.push(x);
      crosses++;
    }
    for (const f of touched) {
      f.changes++;
      const key = `${f.path}|${isoWeek(week)}`;
      const cur = churn.get(key) || { added: 0, deleted: 0 };
      const mag = Math.round(3 + r() * 60);
      cur.added += mag;
      cur.deleted += Math.round(mag * (0.2 + r() * 0.7));
      churn.set(key, cur);
    }
    // coupling pairs
    touched.sort((a, b) => a.path.localeCompare(b.path));
    for (let i = 0; i < touched.length; i++)
      for (let j = i + 1; j < touched.length; j++) {
        const k = `${touched[i].path}|${touched[j].path}`;
        pairs.set(k, (pairs.get(k) || 0) + 1);
      }
  }

  // ---- assemble the four datasets (mirrors models.rs) ----
  const loc = files
    .map((f) => ({
      path: f.path,
      directory: f.path.slice(0, f.path.lastIndexOf("/")),
      extension: f.ext,
      code: f.code,
    }))
    .sort((a, b) => b.code - a.code);

  const maxCh = Math.max(1, ...files.map((f) => f.changes));
  const maxLoc = Math.max(1, ...files.map((f) => f.code));
  const hotspots = files
    .map((f) => ({
      path: f.path,
      changes: f.changes,
      code: f.code,
      // Tornhill intersection: high only when BOTH churned and large
      score: (f.changes / maxCh) * (f.code / maxLoc) * 100,
    }))
    .sort((a, b) => b.score - a.score);

  const churnArr = [];
  for (const [key, v] of churn) {
    const [path, week] = key.split("|");
    churnArr.push({ path, week, added: v.added, deleted: v.deleted, churn: v.added + v.deleted });
  }
  churnArr.sort((a, b) => a.week.localeCompare(b.week));

  const coupling = [];
  for (const [key, count] of pairs) {
    if (count >= 2) {
      const [file_a, file_b] = key.split("|");
      coupling.push({ file_a, file_b, count });
    }
  }
  coupling.sort((a, b) => b.count - a.count);
  coupling.splice(200);

  return { loc, hotspots, churn: churnArr, coupling };
}

// ---- hierarchy helper shared by treemap + circle packing ----
function buildHierarchy(files, extra) {
  const root = { name: "root", children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      let child = node.children.find((c) => c.name === seg && c.children);
      if (!child) { child = { name: seg, children: [] }; node.children.push(child); }
      node = child;
    }
    node.children.push({ name: parts[parts.length - 1], value: Math.max(f.code, 1), ...extra(f) });
  }
  return root;
}

// =====================================================================
//  VISUALIZATIONS (faithful baseline ports of the Svelte components)
// =====================================================================
const el = () => document.getElementById("viz");
const size = () => {
  const b = document.getElementById("viz-body").getBoundingClientRect();
  return [b.width, b.height];
};

// ---- copy-to-editor: copy a file path, with a brief toast ----
function copyPath(path) {
  const ok = () => toast(`Copied  ${path}`);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(path).then(ok).catch(() => fallbackCopy(path, ok));
  } else {
    fallbackCopy(path, ok);
  }
}
function fallbackCopy(text, ok) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); ok(); } catch (_) { toast("Copy failed — select the path manually"); }
  ta.remove();
}
function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1700);
}

// how many of the largest files to draw — no point rendering 1000 slivers
const LOC_TOP = 120;
const TOP_RANK = 10; // largest files, emphasized with white labels

let locFilter = null; // null = all types; otherwise an extension string

const fmtLoc = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : "" + n);

// extensions ordered by total LOC across the WHOLE project (stable, filter-independent)
function locExtsByLoc(all) {
  return Array.from(d3.rollup(all, (v) => d3.sum(v, (d) => d.code), (d) => d.extension))
    .sort((a, b) => b[1] - a[1]);
}
// one color per extension; domain order is stable so colors never shift on filtering
function locColor(all) {
  const exts = locExtsByLoc(all).map((d) => d[0]);
  return d3.scaleOrdinal(exts, d3.schemeTableau10.concat(d3.schemeSet2, d3.schemePaired));
}

// Lay out a centered name + LOC label scaled to a cell. Returns null if too small.
function labelLayout(name, bw, bh) {
  if (bw < 24 || bh < 13) return null;
  let t = name.toUpperCase();
  let fs = Math.min((bw - 6) / (t.length * 0.56), bh * 0.6, 46); // Oswald ≈ 0.56·fs/char
  if (fs < 7) {
    const maxC = Math.floor((bw - 6) / (7 * 0.56));
    if (maxC < 2) return null;
    t = t.slice(0, Math.max(1, maxC - 1)) + "…";
    fs = 7;
  }
  const subFs = Math.max(6, fs * 0.5);
  const showSub = bh > fs + subFs + 9 && bw > 34; // only when there's vertical room
  return { text: t, fs, subFs, showSub };
}

function drawTreemap(all) {
  const host = el(); host.innerHTML = "";
  const [w, h] = size();
  if (!all.length || w < 10 || h < 10) return;

  // color scale spans the whole project so a type keeps its color when filtered
  const color = locColor(all);
  const pool = locFilter ? all.filter((f) => f.extension === locFilter) : all;
  const data = pool.slice(0, LOC_TOP); // already sorted by code desc
  if (!data.length) return;

  // flat treemap: one area subdivided into files, sized by LOC, no dir grouping
  const root = d3
    .hierarchy({
      name: "root",
      children: data.map((f, i) => ({
        name: f.path.split("/").pop(), // full filename, extension included
        path: f.path,
        value: Math.max(f.code, 1),
        ext: f.extension,
        code: f.code,
        rank: i + 1,
      })),
    })
    .sum((d) => d.value || 0)
    .sort((a, b) => b.value - a.value);

  d3.treemap().size([w, h]).paddingInner(2).round(true)(root);

  const svg = d3.select(host).append("svg").attr("class", "treemap")
    .attr("width", w).attr("height", h).attr("viewBox", `0 0 ${w} ${h}`);

  const isTop = (d) => d.data.rank <= TOP_RANK;
  const leaf = svg.selectAll("g.leaf").data(root.leaves()).join("g")
    .attr("class", "leaf")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
    .on("click", (e, d) => copyPath(d.data.path)); // click a file to copy its path

  // plain colored cells with rounded corners, thin separators only
  leaf.append("rect")
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("rx", 5).attr("ry", 5)
    .attr("fill", (d) => color(d.data.ext))
    .attr("stroke", "var(--bg)")
    .attr("stroke-width", 0.5)
    .append("title")
    .text((d) => `${d.data.path}\n${d.data.code.toLocaleString()} LOC` + (isTop(d) ? `\n#${d.data.rank} largest` : ""));

  // centered condensed label + LOC, scaled to the cell; top 10 white, the rest black
  // (fill via .style so it beats the shared `svg text` rule)
  leaf.each(function (d) {
    const L = labelLayout(d.data.name, d.x1 - d.x0, d.y1 - d.y0);
    if (!L) return;
    const g = d3.select(this);
    const cx = (d.x1 - d.x0) / 2, cy = (d.y1 - d.y0) / 2;
    const top = isTop(d);
    const nameY = L.showSub ? cy - L.subFs * 0.62 : cy;

    g.append("text").attr("class", "tm-label")
      .attr("x", cx).attr("y", nameY)
      .attr("text-anchor", "middle").attr("dominant-baseline", "central")
      .attr("font-size", L.fs)
      .style("fill", top ? "#ffffff" : "#0b1016")
      .text(L.text);

    if (L.showSub) {
      g.append("text").attr("class", "tm-label")
        .attr("x", cx).attr("y", cy + L.fs * 0.55)
        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("font-size", L.subFs).attr("font-weight", 500)
        .style("fill", top ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.66)")
        .text(fmtLoc(d.data.code) + " LOC");
    }
  });

  // pulsing outline on the top 10, staggered by rank so it reads as a wave
  leaf.filter(isTop).append("rect")
    .attr("class", "tm-pulse")
    .attr("x", 1).attr("y", 1)
    .attr("width", (d) => Math.max(0, d.x1 - d.x0 - 2))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0 - 2))
    .attr("rx", 4).attr("ry", 4)
    .style("animation-delay", (d) => `${(d.data.rank - 1) * 0.09}s`);
}

// Top-of-view category chips that filter the treemap by file type.
function renderLocFilter(all) {
  const bar = document.getElementById("viz-filter");
  bar.innerHTML = "";
  const color = locColor(all);
  const mkChip = (label, ext, count, sw) => {
    const c = document.createElement("button");
    c.className = "chip" + (locFilter === ext ? " active" : "");
    c.innerHTML = (sw ? `<span class="sw" style="background:${sw}"></span>` : "") + `${label} <span class="n">${count}</span>`;
    c.onclick = () => { locFilter = ext; renderActive(); };
    bar.appendChild(c);
  };
  mkChip("All types", null, all.length, null);
  for (const [ext] of locExtsByLoc(all)) {
    const n = all.reduce((s, f) => s + (f.extension === ext ? 1 : 0), 0);
    mkChip("." + ext, ext, n, color(ext));
  }
}

let hotSelected = null; // selected file path, persists across resize redraws

function drawCirclePacking(data) {
  const host = el(); host.innerHTML = "";
  const body = document.getElementById("viz-body");
  body.querySelectorAll(".inspector").forEach((e) => e.remove());
  const [w, h] = size();
  if (!data.length || w < 10 || h < 10) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const s = Math.min(w, h);

  const root = d3.hierarchy(buildHierarchy(data, (f) => ({ score: f.score, changes: f.changes, code: f.code, path: f.path })))
    .sum((d) => d.value || 0).sort((a, b) => b.value - a.value);
  d3.pack().size([s, s]).padding(3)(root);

  const maxScore = d3.max(data, (d) => d.score) || 1;
  const maxChanges = d3.max(data, (d) => d.changes) || 1;
  const maxLoc = d3.max(data, (d) => d.code) || 1;
  const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxScore]);

  // the riskiest files (highest score), in order, get a pulsing ring
  const risky = data.slice().sort((a, b) => b.score - a.score).slice(0, TOP_RANK).map((d) => d.path);
  const riskyRank = new Map(risky.map((p, i) => [p, i]));

  const svg = d3.select(host).append("svg").attr("width", w).attr("height", h).attr("viewBox", `0 0 ${w} ${h}`);
  const g = svg.append("g").attr("transform", `translate(${(w - s) / 2},${(h - s) / 2})`);

  const node = g.selectAll("g.node").data(root.descendants()).join("g")
    .attr("class", "node").attr("transform", (d) => `translate(${d.x},${d.y})`);

  // structure: faint parent-directory circles
  node.filter((d) => d.children).append("circle")
    .attr("r", (d) => d.r).attr("fill", "rgba(255,255,255,0.03)")
    .attr("stroke", "var(--border)").attr("stroke-width", 1)
    .append("title").text((d) => d.data.name);

  // files — no text labels; grow in on load
  const leaves = node.filter((d) => !d.children);
  const fileCircle = leaves.append("circle")
    .attr("fill", (d) => color(d.data.score))
    .attr("stroke", "rgba(0,0,0,0.3)").attr("stroke-width", 0.5)
    .attr("r", reduce ? (d) => d.r : 0)
    .style("cursor", "pointer");
  fileCircle.append("title")
    .text((d) => `${d.data.path}\n${d.data.code.toLocaleString()} LOC · ${d.data.changes} changes\nhotspot score ${d.data.score.toFixed(1)}`);
  if (!reduce) {
    fileCircle.transition().duration(520).delay((d, i) => Math.min(i * 3, 450)).attr("r", (d) => d.r);
  }

  // pulsing ring on the riskiest files, staggered by risk rank
  leaves.filter((d) => riskyRank.has(d.data.path)).append("circle")
    .attr("class", "hot-pulse").attr("r", (d) => d.r)
    .style("animation-delay", (d) => `${riskyRank.get(d.data.path) * 0.09}s`);

  // ---- click to inspect ----
  function showInspector(d) {
    let card = body.querySelector(".inspector");
    if (!card) { card = document.createElement("div"); card.className = "inspector"; body.appendChild(card); }
    const chFrac = Math.round((d.data.changes / maxChanges) * 100);
    const locFrac = Math.round((d.data.code / maxLoc) * 100);
    card.innerHTML =
      `<button class="close" aria-label="Close">×</button>` +
      `<div class="ins-name">${d.data.name}</div>` +
      `<div class="ins-path">${d.data.path}</div>` +
      `<div class="ins-grid">` +
        `<div class="ins-metric"><b style="color:${color(d.data.score)}">${d.data.score.toFixed(1)}</b><span>risk</span></div>` +
        `<div class="ins-metric"><b>${d.data.code.toLocaleString()}</b><span>lines</span></div>` +
        `<div class="ins-metric"><b>${d.data.changes}</b><span>changes</span></div>` +
      `</div>` +
      `<div class="ins-formula">` +
        `<div class="ins-bar"><label>change frequency</label><div class="track"><span style="width:${chFrac}%;background:#f59e0b"></span></div><em>${chFrac}%</em></div>` +
        `<div class="ins-bar"><label>size (lines)</label><div class="track"><span style="width:${locFrac}%;background:var(--accent)"></span></div><em>${locFrac}%</em></div>` +
        `<div class="ins-note">risk = change × size = <b>${d.data.score.toFixed(1)}</b></div>` +
      `</div>` +
      `<button class="ins-copy">⧉ Copy path</button>`;
    card.querySelector(".close").onclick = deselect;
    card.querySelector(".ins-copy").onclick = () => copyPath(d.data.path);

    // anchor beside the circle, computed from data coords (robust during the grow-in)
    const bodyRect = body.getBoundingClientRect();
    const svgRect = svg.node().getBoundingClientRect();
    const cx = svgRect.left - bodyRect.left + (w - s) / 2 + d.x;
    const cy = svgRect.top - bodyRect.top + (h - s) / 2 + d.y;
    const r = d.r;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let left, side;
    if (cx + r + 14 + cw <= bodyRect.width - 6) { left = cx + r + 14; side = "right"; }
    else { left = Math.max(6, cx - r - 14 - cw); side = "left"; }
    const top = Math.max(6, Math.min(cy - ch / 2, bodyRect.height - ch - 6));
    card.className = "inspector " + side;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.setProperty("--cy", `${Math.max(12, Math.min(cy - top, ch - 12))}px`);
  }
  function select(d, gEl) {
    hotSelected = d.data.path;
    g.selectAll("circle.hot-selected").remove();
    d3.select(gEl).append("circle").attr("class", "hot-selected").attr("r", d.r);
    showInspector(d);
  }
  function deselect() {
    hotSelected = null;
    g.selectAll("circle.hot-selected").remove();
    const c = body.querySelector(".inspector"); if (c) c.remove();
  }
  fileCircle.on("click", function (e, d) { e.stopPropagation(); select(d, this.parentNode); });
  svg.on("click", deselect);
  if (hotSelected) leaves.filter((d) => d.data.path === hotSelected).each(function (d) { select(d, this); });

  // legend
  const lw = 140, lx = w - lw - 16, ly = 16;
  const grad = svg.append("defs").append("linearGradient").attr("id", "hot-grad").attr("x1", "0%").attr("x2", "100%");
  for (let i = 0; i <= 10; i++) grad.append("stop").attr("offset", `${i * 10}%`).attr("stop-color", color((i / 10) * maxScore));
  const lg = svg.append("g").attr("transform", `translate(${lx},${ly})`);
  lg.append("rect").attr("width", lw).attr("height", 8).attr("rx", 4).attr("fill", "url(#hot-grad)");
  lg.append("text").attr("y", 22).attr("class", "legend-label").text("rarely changed");
  lg.append("text").attr("x", lw).attr("y", 22).attr("text-anchor", "end").attr("class", "legend-label").text("hot");
}

function drawHeatmap(data) {
  const host = el(); host.innerHTML = "";
  if (!data.length) return;
  const TOP = 45, CELL = 15, M = { top: 54, left: 260, right: 20, bottom: 16 };

  const byFile = d3.rollup(data, (v) => d3.sum(v, (d) => d.churn), (d) => d.path);
  const files = Array.from(byFile.entries()).sort((a, b) => b[1] - a[1]).slice(0, TOP).map((d) => d[0]);
  const fileSet = new Set(files);
  const weeks = Array.from(new Set(data.filter((d) => fileSet.has(d.path)).map((d) => d.week))).sort();
  const cell = new Map();
  for (const d of data) if (fileSet.has(d.path)) cell.set(`${d.path}|${d.week}`, d);

  const width = M.left + weeks.length * CELL + M.right;
  const height = M.top + files.length * CELL + M.bottom;
  const maxChurn = d3.max(data, (d) => d.churn) || 1;
  const color = d3.scaleSequential(d3.interpolateInferno).domain([0, Math.sqrt(maxChurn)]);

  const svg = d3.select(host).append("svg").attr("class", "heatmap").attr("width", width).attr("height", height);
  const x = (i) => M.left + i * CELL, y = (i) => M.top + i * CELL;

  // week (column) labels
  svg.append("g").selectAll("text").data(weeks).join("text")
    .attr("transform", (_, i) => `translate(${x(i) + CELL / 2},${M.top - 8}) rotate(-60)`)
    .attr("class", "col-label").attr("display", (_, i) => (i % 4 === 0 ? null : "none")).text((wk) => wk);

  // one <g> per file row → enables the Excel-style row focus on hover
  const rowsG = svg.append("g");
  files.forEach((f, ri) => {
    const row = rowsG.append("g").attr("class", "hm-row");

    // full-width transparent backing: catches hover across labels, cells, and gaps
    row.append("rect").attr("class", "hm-rowbg")
      .attr("x", 6).attr("y", y(ri) - 1).attr("width", width - 12).attr("height", CELL);

    row.append("text").attr("x", M.left - 8).attr("y", y(ri) + CELL / 2)
      .attr("text-anchor", "end").attr("dy", "0.32em").attr("class", "row-label")
      .text(f.length > 40 ? "…" + f.slice(-39) : f).append("title").text(f);

    weeks.forEach((wk, ci) => {
      const d = cell.get(`${f}|${wk}`);
      const c = row.append("rect").attr("class", "hm-cell" + (d ? " act" : "")).attr("x", x(ci)).attr("y", y(ri))
        .attr("width", CELL - 1).attr("height", CELL - 1).attr("rx", 2)
        .attr("fill", d ? color(Math.sqrt(d.churn)) : "rgba(255,255,255,0.025)");
      if (d) c.style("animation-delay", `${ci * 0.045}s`); // wave runs in week order
      c.append("title").text(d ? `${f}\n${wk}: +${d.added} / -${d.deleted} (${d.churn} churn)` : `${f}\n${wk}: no activity`);
    });

    row.on("mouseenter", () => { svg.classed("row-hover", true); row.classed("active", true); })
       .on("mouseleave", () => { svg.classed("row-hover", false); row.classed("active", false); })
       .on("click", () => copyPath(f));
  });
}

let sim = null;
let couplingMin = 2; // minimum co-change count shown (the hairball cutter)

const cpDirOf = (id) => (id.includes("/") ? id.slice(0, id.indexOf("/")) : ".");
// stable top-level-directory color scale over the WHOLE coupling set
function couplingColor(all) {
  const s = new Set();
  all.forEach((p) => { s.add(cpDirOf(p.file_a)); s.add(cpDirOf(p.file_b)); });
  return d3.scaleOrdinal(Array.from(s).sort(), d3.schemeTableau10.concat(d3.schemeSet3));
}

function drawForce(all) {
  const host = el(); host.innerHTML = "";
  if (sim) sim.stop();
  const [w, h] = size();
  if (!all.length || w < 10 || h < 10) return;

  const color = couplingColor(all);
  const data = all.filter((p) => p.count >= couplingMin); // apply strength filter
  if (!data.length) {
    host.innerHTML = `<p class="empty">No couplings at ≥ ${couplingMin} co-changes. Lower the threshold.</p>`;
    return;
  }

  const nodeMap = new Map();
  const bump = (id, c) => { const n = nodeMap.get(id) || { id, weight: 0 }; n.weight += c; nodeMap.set(id, n); };
  for (const p of data) { bump(p.file_a, p.count); bump(p.file_b, p.count); }
  const nodes = Array.from(nodeMap.values());
  const links = data.map((p) => ({ source: p.file_a, target: p.file_b, count: p.count }));

  // adjacency for hover-to-isolate (built from ids, before the sim mutates links)
  const adj = new Map(nodes.map((n) => [n.id, new Set([n.id])]));
  for (const p of data) { adj.get(p.file_a).add(p.file_b); adj.get(p.file_b).add(p.file_a); }

  const maxCount = d3.max(data, (d) => d.count) || 1;
  const maxWeight = d3.max(nodes, (d) => d.weight) || 1;
  const radius = d3.scaleSqrt().domain([0, maxWeight]).range([3, 22]);
  const thickness = d3.scaleLinear().domain([1, maxCount]).range([0.5, 5]);

  const svg = d3.select(host).append("svg").attr("class", "force").attr("width", w).attr("height", h).attr("viewBox", `0 0 ${w} ${h}`);
  const container = svg.append("g");
  svg.call(d3.zoom().scaleExtent([0.2, 5]).on("zoom", (e) => container.attr("transform", e.transform)));

  const link = container.append("g").attr("stroke", "#4b5563").attr("stroke-opacity", 0.5)
    .selectAll("line").data(links).join("line").attr("stroke-width", (d) => thickness(d.count));
  link.append("title").text((d) => `${d.count}× together`);

  const node = container.append("g").selectAll("g").data(nodes).join("g").attr("class", "node").call(drag());
  node.append("circle").attr("r", (d) => radius(d.weight)).attr("fill", (d) => color(cpDirOf(d.id)))
    .attr("stroke", "var(--bg)").attr("stroke-width", 1.5)
    .append("title").text((d) => `${d.id}\ntotal coupling ${d.weight}`);
  const labels = node.append("text").attr("class", "node-label").attr("x", (d) => radius(d.weight) + 3).attr("dy", "0.32em")
    .attr("display", (d) => (radius(d.weight) > 9 ? null : "none")).text((d) => d.id.split("/").pop());

  // hover a node → isolate it + its coupled partners
  node.on("mouseover", (e, d) => {
    const keep = adj.get(d.id);
    svg.classed("focusing", true);
    node.classed("hot", (n) => keep.has(n.id));
    link.classed("hot", (l) => l.source.id === d.id || l.target.id === d.id);
    labels.attr("display", (n) => (keep.has(n.id) ? null : "none"));
  }).on("mouseout", () => {
    svg.classed("focusing", false);
    node.classed("hot", false);
    link.classed("hot", false);
    labels.attr("display", (n) => (radius(n.weight) > 9 ? null : "none"));
  }).on("click", (e, d) => copyPath(d.id));

  sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance((d) => 90 - thickness(d.count) * 6).strength(0.45))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(w / 2, h / 2))
    .force("collide", d3.forceCollide().radius((d) => radius(d.weight) + 5))
    .on("tick", () => {
      link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

  function drag() {
    return d3.drag().clickDistance(5) // tiny moves still count as a click (copy)
      .on("start", (e) => { if (!e.active) sim.alphaTarget(0.3).restart(); e.subject.fx = e.subject.x; e.subject.fy = e.subject.y; })
      .on("drag", (e) => { e.subject.fx = e.x; e.subject.fy = e.y; })
      .on("end", (e) => { if (!e.active) sim.alphaTarget(0); e.subject.fx = null; e.subject.fy = null; });
  }
}

// Coupling controls: strength slider + directory color legend.
function renderCouplingFilter(all) {
  const bar = document.getElementById("viz-filter");
  bar.innerHTML = "";
  const maxCount = d3.max(all, (d) => d.count) || 2;
  couplingMin = Math.min(Math.max(2, couplingMin), maxCount);
  const color = couplingColor(all);

  const ctrl = document.createElement("div");
  ctrl.className = "cp-control";
  ctrl.innerHTML = `<span>min co-changes</span>`;
  const range = document.createElement("input");
  range.type = "range"; range.min = 2; range.max = maxCount; range.step = 1; range.value = couplingMin;
  const val = document.createElement("span"); val.className = "cp-val";
  const count = document.createElement("span"); count.className = "cp-count";
  ctrl.append(range, val, count);

  const legend = document.createElement("div");
  legend.className = "cp-legend";
  bar.append(ctrl, legend);

  function refresh() {
    val.textContent = `≥ ${couplingMin}`;
    const pairs = all.filter((p) => p.count >= couplingMin);
    const ns = new Set();
    pairs.forEach((p) => { ns.add(p.file_a); ns.add(p.file_b); });
    count.textContent = `· ${pairs.length} links, ${ns.size} files`;
    const dirs = Array.from(new Set([...ns].map(cpDirOf))).sort();
    legend.innerHTML = dirs.map((dir) => `<span class="item"><span class="sw" style="background:${color(dir)}"></span>${dir}</span>`).join("");
  }
  range.oninput = () => { couplingMin = +range.value; refresh(); drawForce(DATA.coupling); };
  refresh();
}

// =====================================================================
//  TAB CONTROLLER
// =====================================================================
const TABS = [
  { id: "loc", label: "LOC", title: "Lines of Code", desc: "The largest files by lines of code — area is size, color is file type. The 10 biggest are ranked. Click a file to copy its path.", draw: drawTreemap, key: "loc", scroll: false,
    meta: (d) => {
      const pool = locFilter ? d.loc.filter((f) => f.extension === locFilter) : d.loc;
      const n = Math.min(LOC_TOP, pool.length);
      const total = pool.reduce((s, f) => s + f.code, 0);
      return `${locFilter ? "." + locFilter + " · " : ""}top ${n} of ${pool.length} files · ${total.toLocaleString()} LOC`;
    } },
  { id: "hotspots", label: "Hotspots", title: "Hotspots", desc: "Circle size is lines of code, color is change frequency — redder is riskier. The 10 riskiest pulse; click any file for details.", draw: drawCirclePacking, key: "hotspots", scroll: false,
    meta: (d) => `${d.hotspots.length} files · top ${TOP_RANK} riskiest pulsing` },
  { id: "churn", label: "Churn", title: "Churn", desc: "Rows are files, columns are weeks. Brighter cells = more lines added + deleted that week. Hover a row to focus its history, click it to copy the path.", draw: drawHeatmap, key: "churn", scroll: true,
    meta: (d) => `${d.churn.length} file·weeks` },
  { id: "coupling", label: "Coupling", title: "Coupling", desc: "Files that change together are linked — thicker = stronger, color = top-level folder. Raise the threshold to cut the hairball; hover a file to isolate its couplings, click it to copy the path.", draw: drawForce, key: "coupling", scroll: false,
    meta: (d) => `${d.coupling.length} coupled pairs` },
];

let DATA = null;
let active = "loc";

function renderTabs() {
  const nav = document.getElementById("tabs");
  nav.innerHTML = "";
  for (const t of TABS) {
    const b = document.createElement("button");
    b.className = "tab" + (t.id === active ? " active" : "");
    b.innerHTML = `${t.label} <span class="count">${DATA[t.key].length}</span>`;
    b.onclick = () => { active = t.id; renderTabs(); renderActive(); };
    nav.appendChild(b);
  }
}

function renderActive() {
  const t = TABS.find((x) => x.id === active);
  document.getElementById("viz-title").textContent = t.title;
  document.getElementById("viz-desc").textContent = t.desc;
  document.getElementById("viz-meta").textContent = t.meta(DATA);
  const vb = document.getElementById("viz-body");
  vb.classList.toggle("scroll", t.scroll);
  vb.querySelectorAll(".inspector").forEach((e) => e.remove()); // drop stale inspector card
  if (t.id !== "hotspots") hotSelected = null;
  // per-view controls in the filter bar
  if (t.id === "loc") renderLocFilter(DATA.loc);
  else if (t.id === "coupling") renderCouplingFilter(DATA.coupling);
  else document.getElementById("viz-filter").innerHTML = "";
  requestAnimationFrame(() => t.draw(DATA[t.key]));
}

function analyze() {
  const ds = document.getElementById("dataset").value;
  DATA = simulate(DATASETS[ds]);
  locFilter = null; // reset type filter for the new project
  hotSelected = null; // reset hotspot selection
  couplingMin = 2; // reset coupling strength filter
  renderTabs();
  renderActive();
}

document.getElementById("analyze").onclick = analyze;
document.getElementById("dataset").onchange = analyze;
let rt;
window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(renderActive, 150); });
analyze();
