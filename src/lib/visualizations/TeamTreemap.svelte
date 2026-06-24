<script>
  import * as d3 from "d3";
  import { authorColor, textOn, copyPath } from "../viz/util.js";

  let { data } = $props(); // contributors, sorted by owned_loc desc

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

  // largest condensed label that fits a cell; null if too small
  function labelLayout(name, bw, bh) {
    if (bw < 24 || bh < 13) return null;
    let t = name.toUpperCase();
    let fs = Math.min((bw - 6) / (t.length * 0.56), bh * 0.6, 46);
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
    data; w; h;
    draw();
  });

  function draw() {
    if (!el) return;
    d3.select(el).selectAll("*").remove();
    if (!data || !data.length || w < 10 || h < 10) return;

    const color = authorColor(data);
    const totalOwned = d3.sum(data, (c) => c.owned_loc) || 1;

    // each rectangle is a contributor, area = their share of the codebase
    const root = d3
      .hierarchy({
        name: "root",
        children: data.map((c) => ({
          name: c.author,
          value: Math.max(c.owned_loc, 1),
          pct: Math.round((c.owned_loc / totalOwned) * 100),
          files: c.owned_files,
          commits: c.commits,
        })),
      })
      .sum((d) => d.value || 0)
      .sort((a, b) => b.value - a.value);

    d3.treemap().size([w, h]).paddingInner(3).round(true)(root);

    const svg = d3.select(el).append("svg").attr("class", "treemap")
      .attr("width", w).attr("height", h).attr("viewBox", `0 0 ${w} ${h}`);

    const leaf = svg.selectAll("g.leaf").data(root.leaves()).join("g")
      .attr("class", "leaf")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      .on("click", (e, d) => copyPath("@" + d.data.name)); // copy the handle to ping them

    leaf.append("rect")
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("rx", 5).attr("ry", 5)
      .attr("fill", (d) => color(d.data.name))
      .attr("stroke", "var(--bg)").attr("stroke-width", 0.5)
      .append("title")
      .text((d) => `@${d.data.name}\n${d.data.pct}% of the codebase · ${d.data.files} files · ${d.data.commits} commits`);

    leaf.each(function (d) {
      const L = labelLayout("@" + d.data.name, d.x1 - d.x0, d.y1 - d.y0);
      if (!L) return;
      const g = d3.select(this);
      const cx = (d.x1 - d.x0) / 2, cy = (d.y1 - d.y0) / 2;
      const ink = textOn(color(d.data.name));
      g.append("text").attr("class", "tm-label")
        .attr("x", cx).attr("y", L.showSub ? cy - L.subFs * 0.7 : cy)
        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("font-size", L.fs).style("fill", ink).text(L.text);
      if (L.showSub) {
        g.append("text").attr("class", "tm-label")
          .attr("x", cx).attr("y", cy + L.fs * 0.6)
          .attr("text-anchor", "middle").attr("dominant-baseline", "central")
          .attr("font-size", L.subFs * 1.1).attr("font-weight", 500)
          .style("fill", ink).style("opacity", 0.85)
          .text(`${d.data.pct}% · ${d.data.files} files`);
      }
    });
  }
</script>

<div class="viz" bind:this={el}></div>
