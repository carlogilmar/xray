<script>
  import * as d3 from "d3";
  import { buildHierarchy, copyPath } from "../viz/util.js";

  let { data } = $props();

  const TOP_RANK = 10; // riskiest files get a pulsing ring

  let el;
  let w = $state(0);
  let h = $state(0);
  let selected = null; // selected file path, persists across resize redraws

  $effect(() => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      w = r.width;
      h = r.height;
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  $effect(() => {
    data; w; h;
    draw();
  });

  function draw() {
    if (!el) return;
    d3.select(el).selectAll("svg").remove();
    el.querySelectorAll(".inspector").forEach((e) => e.remove());
    if (!data || !data.length || w < 10 || h < 10) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const s = Math.min(w, h);

    const root = d3
      .hierarchy(buildHierarchy(data, (f) => ({ score: f.score, changes: f.changes, code: f.code, path: f.path })))
      .sum((d) => d.value || 0)
      .sort((a, b) => b.value - a.value);
    d3.pack().size([s, s]).padding(3)(root);

    const maxScore = d3.max(data, (d) => d.score) || 1;
    const maxChanges = d3.max(data, (d) => d.changes) || 1;
    const maxLoc = d3.max(data, (d) => d.code) || 1;
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxScore]);

    const risky = data.slice().sort((a, b) => b.score - a.score).slice(0, TOP_RANK).map((d) => d.path);
    const riskyRank = new Map(risky.map((p, i) => [p, i]));

    const svg = d3.select(el).append("svg").attr("width", w).attr("height", h).attr("viewBox", `0 0 ${w} ${h}`).style("cursor", "grab");
    const zoomG = svg.append("g"); // pan/zoom transform applies here
    const g = zoomG.append("g").attr("transform", `translate(${(w - s) / 2},${(h - s) / 2})`);

    let zt = d3.zoomIdentity; // current zoom transform (for inspector positioning)
    svg.call(d3.zoom().scaleExtent([0.5, 8]).on("zoom", (e) => { zt = e.transform; zoomG.attr("transform", e.transform); }));

    const node = g.selectAll("g.node").data(root.descendants()).join("g")
      .attr("class", "node").attr("transform", (d) => `translate(${d.x},${d.y})`);

    node.filter((d) => d.children).append("circle")
      .attr("r", (d) => d.r).attr("fill", "rgba(255,255,255,0.03)")
      .attr("stroke", "var(--border)").attr("stroke-width", 1)
      .append("title").text((d) => d.data.name);

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

    leaves.filter((d) => riskyRank.has(d.data.path)).append("circle")
      .attr("class", "hot-pulse").attr("r", (d) => d.r)
      .style("animation-delay", (d) => `${riskyRank.get(d.data.path) * 0.09}s`);

    function showInspector(d) {
      let card = el.querySelector(".inspector");
      if (!card) { card = document.createElement("div"); card.className = "inspector"; el.appendChild(card); }
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

      const elRect = el.getBoundingClientRect();
      const svgRect = svg.node().getBoundingClientRect();
      const [px, py] = zt.apply([(w - s) / 2 + d.x, (h - s) / 2 + d.y]); // account for zoom/pan
      const cx = svgRect.left - elRect.left + px;
      const cy = svgRect.top - elRect.top + py;
      const r = d.r * zt.k;
      const cw = card.offsetWidth, ch = card.offsetHeight;
      let left, side;
      if (cx + r + 14 + cw <= elRect.width - 6) { left = cx + r + 14; side = "right"; }
      else { left = Math.max(6, cx - r - 14 - cw); side = "left"; }
      const top = Math.max(6, Math.min(cy - ch / 2, elRect.height - ch - 6));
      card.className = "inspector " + side;
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      card.style.setProperty("--cy", `${Math.max(12, Math.min(cy - top, ch - 12))}px`);
    }
    function select(d, gEl) {
      selected = d.data.path;
      g.selectAll("circle.hot-selected").remove();
      d3.select(gEl).append("circle").attr("class", "hot-selected").attr("r", d.r);
      showInspector(d);
    }
    function deselect() {
      selected = null;
      g.selectAll("circle.hot-selected").remove();
      const c = el.querySelector(".inspector"); if (c) c.remove();
    }
    fileCircle.on("click", function (e, d) { e.stopPropagation(); select(d, this.parentNode); });
    svg.on("click", deselect);
    if (selected) leaves.filter((d) => d.data.path === selected).each(function (d) { select(d, this); });

    // legend
    const lw = 140, lx = w - lw - 16, ly = 16;
    const grad = svg.append("defs").append("linearGradient").attr("id", "hot-grad").attr("x1", "0%").attr("x2", "100%");
    for (let i = 0; i <= 10; i++) grad.append("stop").attr("offset", `${i * 10}%`).attr("stop-color", color((i / 10) * maxScore));
    const lg = svg.append("g").attr("transform", `translate(${lx},${ly})`);
    lg.append("rect").attr("width", lw).attr("height", 8).attr("rx", 4).attr("fill", "url(#hot-grad)");
    lg.append("text").attr("y", 22).attr("class", "legend-label").text("rarely changed");
    lg.append("text").attr("x", lw).attr("y", 22).attr("text-anchor", "end").attr("class", "legend-label").text("hot");
  }
</script>

<div class="viz" bind:this={el}></div>
