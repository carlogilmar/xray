<script>
  import * as d3 from "d3";

  let { data } = $props();

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

  function buildHierarchy(files) {
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
      node.children.push({
        name: parts[parts.length - 1],
        value: Math.max(f.code, 1),
        score: f.score,
        changes: f.changes,
        code: f.code,
        path: f.path,
      });
    }
    return root;
  }

  $effect(() => {
    data;
    w;
    h;
    draw();
  });

  function draw() {
    if (!el) return;
    d3.select(el).selectAll("*").remove();
    if (!data || !data.length || w < 10 || h < 10) return;

    const size = Math.min(w, h);
    const root = d3
      .hierarchy(buildHierarchy(data))
      .sum((d) => d.value || 0)
      .sort((a, b) => b.value - a.value);

    d3.pack().size([size, size]).padding(3)(root);

    const maxScore = d3.max(data, (d) => d.score) || 1;
    const color = d3
      .scaleSequential(d3.interpolateYlOrRd)
      .domain([0, maxScore]);

    const svg = d3
      .select(el)
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .attr("viewBox", `0 0 ${w} ${h}`);

    // center the square pack in the container
    const g = svg
      .append("g")
      .attr("transform", `translate(${(w - size) / 2},${(h - size) / 2})`);

    const node = g
      .selectAll("g.node")
      .data(root.descendants())
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    node
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", (d) =>
        d.children ? "rgba(255,255,255,0.03)" : color(d.data.score)
      )
      .attr("stroke", (d) => (d.children ? "var(--border)" : "rgba(0,0,0,0.3)"))
      .attr("stroke-width", (d) => (d.children ? 1 : 0.5))
      .append("title")
      .text((d) =>
        d.children
          ? d.data.name
          : `${d.data.path}\n${d.data.code.toLocaleString()} LOC · ${d.data.changes} changes\nhotspot score ${d.data.score.toFixed(1)}`
      );

    // label only leaves that are large enough
    node
      .filter((d) => !d.children && d.r > 16)
      .append("text")
      .attr("class", "circle-label")
      .attr("dy", "0.32em")
      .text((d) => d.data.name)
      .attr("fill", (d) => (d.data.score > 55 ? "#1a0a00" : "#1a1a1a"));

    // legend
    drawLegend(svg, color, maxScore);
  }

  function drawLegend(svg, color, maxScore) {
    const lw = 140;
    const lx = w - lw - 16;
    const ly = 16;
    const defs = svg.append("defs");
    const grad = defs
      .append("linearGradient")
      .attr("id", "hot-grad")
      .attr("x1", "0%")
      .attr("x2", "100%");
    for (let i = 0; i <= 10; i++) {
      grad
        .append("stop")
        .attr("offset", `${i * 10}%`)
        .attr("stop-color", color((i / 10) * maxScore));
    }
    const lg = svg.append("g").attr("transform", `translate(${lx},${ly})`);
    lg
      .append("rect")
      .attr("width", lw)
      .attr("height", 8)
      .attr("rx", 4)
      .attr("fill", "url(#hot-grad)");
    lg
      .append("text")
      .attr("y", 22)
      .attr("class", "legend-label")
      .text("rarely changed");
    lg
      .append("text")
      .attr("x", lw)
      .attr("y", 22)
      .attr("text-anchor", "end")
      .attr("class", "legend-label")
      .text("hot");
  }
</script>

<div class="viz" bind:this={el}></div>

<style>
  .viz :global(.circle-label) {
    font-size: 9px;
    text-anchor: middle;
    pointer-events: none;
  }
  .viz :global(.legend-label) {
    font-size: 9px;
    fill: var(--text-dim);
  }
</style>
