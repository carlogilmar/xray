<script>
  import * as d3 from "d3";

  let { data } = $props();

  // how many of the most-churned files to show
  const TOP_FILES = 45;
  const CELL = 15;
  const MARGIN = { top: 54, left: 260, right: 20, bottom: 16 };

  let el;

  $effect(() => {
    data;
    draw();
  });

  function draw() {
    if (!el) return;
    d3.select(el).selectAll("*").remove();
    if (!data || !data.length) return;

    // total churn per file -> keep the top N
    const byFile = d3.rollup(
      data,
      (v) => d3.sum(v, (d) => d.churn),
      (d) => d.path
    );
    const files = Array.from(byFile.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_FILES)
      .map((d) => d[0]);
    const fileSet = new Set(files);

    // active weeks (sorted) among the kept files
    const weeks = Array.from(
      new Set(data.filter((d) => fileSet.has(d.path)).map((d) => d.week))
    ).sort();

    // lookup (path|week) -> churn
    const cell = new Map();
    for (const d of data) {
      if (fileSet.has(d.path)) cell.set(`${d.path}|${d.week}`, d);
    }

    const width = MARGIN.left + weeks.length * CELL + MARGIN.right;
    const height = MARGIN.top + files.length * CELL + MARGIN.bottom;

    const maxChurn = d3.max(data, (d) => d.churn) || 1;
    const color = d3
      .scaleSequential(d3.interpolateInferno)
      .domain([0, Math.sqrt(maxChurn)]);

    const svg = d3
      .select(el)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const x = (i) => MARGIN.left + i * CELL;
    const y = (i) => MARGIN.top + i * CELL;

    // file (row) labels — truncate from the left to keep the basename visible
    svg
      .append("g")
      .selectAll("text")
      .data(files)
      .join("text")
      .attr("x", MARGIN.left - 8)
      .attr("y", (_, i) => y(i) + CELL / 2)
      .attr("text-anchor", "end")
      .attr("dy", "0.32em")
      .attr("class", "row-label")
      .text((f) => (f.length > 40 ? "…" + f.slice(-39) : f))
      .append("title")
      .text((f) => f);

    // week (column) labels — every 4th to avoid clutter
    svg
      .append("g")
      .selectAll("text")
      .data(weeks)
      .join("text")
      .attr("transform", (_, i) => `translate(${x(i) + CELL / 2},${MARGIN.top - 8}) rotate(-60)`)
      .attr("class", "col-label")
      .attr("display", (_, i) => (i % 4 === 0 ? null : "none"))
      .text((wk) => wk);

    // cells
    const rows = svg.append("g");
    files.forEach((f, ri) => {
      weeks.forEach((wk, ci) => {
        const d = cell.get(`${f}|${wk}`);
        rows
          .append("rect")
          .attr("x", x(ci))
          .attr("y", y(ri))
          .attr("width", CELL - 1)
          .attr("height", CELL - 1)
          .attr("rx", 2)
          .attr("fill", d ? color(Math.sqrt(d.churn)) : "rgba(255,255,255,0.025)")
          .append("title")
          .text(
            d
              ? `${f}\n${wk}: +${d.added} / -${d.deleted} (${d.churn} churn)`
              : `${f}\n${wk}: no activity`
          );
      });
    });
  }
</script>

<div bind:this={el}></div>

<style>
  div :global(.row-label) {
    font-size: 10px;
    fill: var(--text-dim);
  }
  div :global(.col-label) {
    font-size: 9px;
    fill: var(--text-dim);
    text-anchor: start;
  }
</style>
