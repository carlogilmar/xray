<script>
  import * as d3 from "d3";
  import { copyPath } from "../viz/util.js";

  let { data } = $props();

  const TOP = 45; // most-churned files to show
  const CELL = 15;
  const M = { top: 54, left: 260, right: 20, bottom: 16 };

  let el;

  $effect(() => {
    data;
    draw();
  });

  function draw() {
    if (!el) return;
    d3.select(el).selectAll("*").remove();
    if (!data || !data.length) return;

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

    const svg = d3.select(el).append("svg").attr("class", "heatmap").attr("width", width).attr("height", height);
    const x = (i) => M.left + i * CELL, y = (i) => M.top + i * CELL;

    svg.append("g").selectAll("text").data(weeks).join("text")
      .attr("transform", (_, i) => `translate(${x(i) + CELL / 2},${M.top - 8}) rotate(-60)`)
      .attr("class", "col-label").attr("display", (_, i) => (i % 4 === 0 ? null : "none")).text((wk) => wk);

    const rowsG = svg.append("g");
    files.forEach((f, ri) => {
      const row = rowsG.append("g").attr("class", "hm-row");

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
        if (d) c.style("animation-delay", `${ci * 0.045}s`);
        c.append("title").text(d ? `${f}\n${wk}: +${d.added} / -${d.deleted} (${d.churn} churn)` : `${f}\n${wk}: no activity`);
      });

      row.on("mouseenter", () => { svg.classed("row-hover", true); row.classed("active", true); })
         .on("mouseleave", () => { svg.classed("row-hover", false); row.classed("active", false); })
         .on("click", () => copyPath(f));
    });
  }
</script>

<div bind:this={el}></div>
