<script>
  import ForceGraph from "../visualizations/ForceGraph.svelte";
  import { couplingColor, cpDirOf } from "../viz/util.js";

  let { data } = $props();

  let min = $state(2);
  $effect(() => { data; min = 2; }); // reset on new analysis

  let maxCount = $derived(data && data.length ? Math.max(...data.map((d) => d.count)) : 2);
  let color = $derived(data ? couplingColor(data) : null);
  let visible = $derived.by(() => {
    if (!data) return { links: 0, files: 0, dirs: [] };
    const pairs = data.filter((p) => p.count >= min);
    const ns = new Set();
    pairs.forEach((p) => { ns.add(p.file_a); ns.add(p.file_b); });
    const dirs = Array.from(new Set([...ns].map(cpDirOf))).sort();
    return { links: pairs.length, files: ns.size, dirs };
  });
</script>

<div class="tab">
  <header>
    <div>
      <h2>Coupling</h2>
      <p>Files that change together are linked — thicker = stronger, color = top-level folder. Raise the threshold to cut the hairball; hover a file to isolate its couplings, click it to copy the path.</p>
    </div>
    {#if data}<span class="meta">{data.length} coupled pairs</span>{/if}
  </header>

  {#if data && data.length}
    <div class="viz-filter">
      <div class="cp-control">
        <span>min co-changes</span>
        <input type="range" min="2" max={maxCount} bind:value={min} />
        <span class="cp-val">≥ {min}</span>
        <span class="cp-count">· {visible.links} links, {visible.files} files</span>
      </div>
      <div class="cp-legend">
        {#each visible.dirs as dir}
          <span class="item"><span class="sw" style="background:{color(dir)}"></span>{dir}</span>
        {/each}
      </div>
    </div>
    <div class="body"><ForceGraph {data} minCount={min} /></div>
  {:else}
    <p class="empty">No files co-changed often enough to couple.</p>
  {/if}
</div>

<style>
  .tab { display: flex; flex-direction: column; height: 100%; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0.8rem 1.2rem 0.6rem; flex-shrink: 0; }
  header h2 { font-size: 1rem; }
  header p { margin: 0.22rem 0 0; color: var(--text-dim); font-size: 0.8rem; max-width: 70ch; }
  .meta { color: var(--text-dim); font-family: var(--mono); font-size: 0.72rem; text-align: right; white-space: nowrap; }
  .body { flex: 1; min-height: 0; padding: 0 0.7rem 0.7rem; }
</style>
