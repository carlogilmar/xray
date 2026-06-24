// Shared helpers for the D3 visualizations.
import * as d3 from "d3";

// ---- copy a file path to the clipboard, with a brief toast ----
export function copyPath(path) {
  const ok = () => toast(`Copied  ${path}`);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(path).then(ok).catch(() => fallbackCopy(path, ok));
  } else {
    fallbackCopy(path, ok);
  }
}

function fallbackCopy(text, ok) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    ok();
  } catch (_) {
    toast("Copy failed — select the path manually");
  }
  ta.remove();
}

let toastTimer;
export function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1700);
}

// ---- formatting ----
export const fmtLoc = (n) =>
  n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : "" + n;

// ---- build a nested {name, children|value} tree from flat "a/b/c.rs" paths ----
export function buildHierarchy(files, extra) {
  const root = { name: "root", children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      let child = node.children.find((c) => c.name === seg && c.children);
      if (!child) {
        child = { name: seg, children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.children.push({ name: parts[parts.length - 1], value: Math.max(f.code, 1), ...extra(f) });
  }
  return root;
}

// ---- LOC: stable color-per-extension, ordered by total LOC (filter-independent) ----
export function locExtsByLoc(all) {
  return Array.from(d3.rollup(all, (v) => d3.sum(v, (d) => d.code), (d) => d.extension))
    .sort((a, b) => b[1] - a[1]);
}
export function locColor(all) {
  const exts = locExtsByLoc(all).map((d) => d[0]);
  return d3.scaleOrdinal(exts, d3.schemeTableau10.concat(d3.schemeSet2, d3.schemePaired));
}

// ---- Coupling: stable color-per-top-level-directory ----
export const cpDirOf = (id) => (id.includes("/") ? id.slice(0, id.indexOf("/")) : ".");
export function couplingColor(all) {
  const s = new Set();
  all.forEach((p) => {
    s.add(cpDirOf(p.file_a));
    s.add(cpDirOf(p.file_b));
  });
  return d3.scaleOrdinal(Array.from(s).sort(), d3.schemeTableau10.concat(d3.schemeSet3));
}
