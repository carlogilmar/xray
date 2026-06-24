<script>
  import * as d3 from "d3";
  import { cpDirOf, couplingColor, copyPath } from "../viz/util.js";

  // `minCount` is the strength threshold from the slider in the tab
  let { data, minCount = 2 } = $props();

  let el;
  let w = $state(0);
  let h = $state(0);
  let sim = null;

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
    data; minCount; w; h;
    draw();
    return () => { if (sim) sim.stop(); };
  });

  function draw() {
    if (!el) return;
    d3.select(el).selectAll("*").remove();
    if (sim) sim.stop();
    if (!data || !data.length || w < 10 || h < 10) return;

    const color = couplingColor(data);
    const pairs = data.filter((p) => p.count >= minCount);
    if (!pairs.length) {
      el.innerHTML = `<p class="empty">No couplings at ≥ ${minCount} co-changes. Lower the threshold.</p>`;
      return;
    }

    const nodeMap = new Map();
    const bump = (id, c) => { const n = nodeMap.get(id) || { id, weight: 0 }; n.weight += c; nodeMap.set(id, n); };
    for (const p of pairs) { bump(p.file_a, p.count); bump(p.file_b, p.count); }
    const nodes = Array.from(nodeMap.values());
    const links = pairs.map((p) => ({ source: p.file_a, target: p.file_b, count: p.count }));

    const adj = new Map(nodes.map((n) => [n.id, new Set([n.id])]));
    for (const p of pairs) { adj.get(p.file_a).add(p.file_b); adj.get(p.file_b).add(p.file_a); }

    const maxCount = d3.max(pairs, (d) => d.count) || 1;
    const maxWeight = d3.max(nodes, (d) => d.weight) || 1;
    const radius = d3.scaleSqrt().domain([0, maxWeight]).range([3, 22]);
    const thickness = d3.scaleLinear().domain([1, maxCount]).range([0.5, 5]);

    const svg = d3.select(el).append("svg").attr("class", "force").attr("width", w).attr("height", h).attr("viewBox", `0 0 ${w} ${h}`);
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
      return d3.drag().clickDistance(5)
        .on("start", (e) => { if (!e.active) sim.alphaTarget(0.3).restart(); e.subject.fx = e.subject.x; e.subject.fy = e.subject.y; })
        .on("drag", (e) => { e.subject.fx = e.x; e.subject.fy = e.y; })
        .on("end", (e) => { if (!e.active) sim.alphaTarget(0); e.subject.fx = null; e.subject.fy = null; });
    }
  }
</script>

<div class="viz" bind:this={el}></div>
