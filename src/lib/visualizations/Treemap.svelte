<script>
  import * as d3 from "d3";

  let { data } = $props();

  let el;
  let w = $state(0);
  let h = $state(0);

  // track container size
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

  // build a nested {name, children|value} tree from flat "a/b/c.rs" paths
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
        ext: f.extension,
        path: f.path,
        code: f.code,
      });
    }
    return root;
  }

  $effect(() => {
    // re-run on data / size change
    data;
    w;
    h;
    draw();
  });

  function draw() {
    if (!el) return;
    d3.select(el).selectAll("*").remove();
    if (!data || !data.length || w < 10 || h < 10) return;

    const root = d3
      .hierarchy(buildHierarchy(data))
      .sum((d) => d.value || 0)
      .sort((a, b) => b.value - a.value);

    d3
      .treemap()
      .size([w, h])
      .paddingInner(1)
      .paddingTop((d) => (d.depth > 0 && d.children ? 13 : 0))
      .round(true)(root);

    const exts = Array.from(new Set(data.map((d) => d.extension)));
    const palette = d3.schemeTableau10.concat(d3.schemeSet3, d3.schemePastel1);
    const color = d3.scaleOrdinal(exts, palette);

    const svg = d3
      .select(el)
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .attr("viewBox", `0 0 ${w} ${h}`);

    // directory frames
    svg
      .selectAll("g.dir")
      .data(root.descendants().filter((d) => d.depth > 0 && d.children))
      .join("g")
      .attr("class", "dir")
      .append("text")
      .attr("x", (d) => d.x0 + 3)
      .attr("y", (d) => d.y0 + 10)
      .attr("class", "dir-label")
      .text((d) =>
        d.x1 - d.x0 > 40 && d.y1 - d.y0 > 16 ? d.data.name : ""
      );

    // leaf rectangles
    const leaf = svg
      .selectAll("g.leaf")
      .data(root.leaves())
      .join("g")
      .attr("class", "leaf")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    leaf
      .append("rect")
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("rx", 2)
      .attr("fill", (d) => color(d.data.ext))
      .attr("fill-opacity", 0.85)
      .append("title")
      .text((d) => `${d.data.path}\n${d.data.code.toLocaleString()} LOC`);

    leaf
      .append("text")
      .attr("x", 4)
      .attr("y", 13)
      .attr("class", "leaf-label")
      .text((d) =>
        d.x1 - d.x0 > 46 && d.y1 - d.y0 > 18 ? d.data.name : ""
      );
  }
</script>

<div class="viz" bind:this={el}></div>

<style>
  .viz :global(.leaf-label) {
    font-size: 10px;
    fill: #04211d;
    pointer-events: none;
  }
  .viz :global(.dir-label) {
    font-size: 9px;
    fill: var(--text-dim);
    pointer-events: none;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .viz :global(rect) {
    stroke: var(--bg);
    stroke-width: 0.5;
  }
</style>
