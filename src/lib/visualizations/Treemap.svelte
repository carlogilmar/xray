<script>
  import * as d3 from "d3";
  import { fmtLoc, locColor, copyPath } from "../viz/util.js";

  // `filter` is the selected extension, or null for all types
  let { data, filter = null } = $props();

  const LOC_TOP = 120; // largest files to draw
  const TOP_RANK = 10; // emphasized with white labels + pulse

  let el;
  let w = $state(0);
  let h = $state(0);

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

  // largest condensed name + LOC label that fits a cell; null if too small
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
    const showSub = bh > fs + subFs + 9 && bw > 34;
    return { text: t, fs, subFs, showSub };
  }

  $effect(() => {
    data; filter; w; h;
    draw();
  });

  function draw() {
    if (!el) return;
    d3.select(el).selectAll("*").remove();
    if (!data || !data.length || w < 10 || h < 10) return;

    const color = locColor(data); // stable across filtering
    const pool = filter ? data.filter((f) => f.extension === filter) : data;
    const items = pool.slice(0, LOC_TOP); // data arrives sorted by code desc
    if (!items.length) return;

    const root = d3
      .hierarchy({
        name: "root",
        children: items.map((f, i) => ({
          name: f.path.split("/").pop(),
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

    const svg = d3.select(el).append("svg").attr("class", "treemap")
      .attr("width", w).attr("height", h).attr("viewBox", `0 0 ${w} ${h}`);

    const isTop = (d) => d.data.rank <= TOP_RANK;
    const leaf = svg.selectAll("g.leaf").data(root.leaves()).join("g")
      .attr("class", "leaf")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      .on("click", (e, d) => copyPath(d.data.path));

    leaf.append("rect")
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("rx", 5).attr("ry", 5)
      .attr("fill", (d) => color(d.data.ext))
      .attr("stroke", "var(--bg)")
      .attr("stroke-width", 0.5)
      .append("title")
      .text((d) => `${d.data.path}\n${d.data.code.toLocaleString()} LOC` + (isTop(d) ? `\n#${d.data.rank} largest` : ""));

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

    // pulsing outline on the top 10, staggered by rank
    leaf.filter(isTop).append("rect")
      .attr("class", "tm-pulse")
      .attr("x", 1).attr("y", 1)
      .attr("width", (d) => Math.max(0, d.x1 - d.x0 - 2))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0 - 2))
      .attr("rx", 4).attr("ry", 4)
      .style("animation-delay", (d) => `${(d.data.rank - 1) * 0.09}s`);
  }
</script>

<div class="viz" bind:this={el}></div>
