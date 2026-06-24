<script>
  import Treemap from "../visualizations/Treemap.svelte";
  import { locColor, locExtsByLoc } from "../viz/util.js";

  let { data } = $props();
  const LOC_TOP = 120;

  let filter = $state(null);
  $effect(() => { data; filter = null; }); // reset on new analysis

  let color = $derived(data ? locColor(data) : null);
  let exts = $derived(
    data ? locExtsByLoc(data).map(([ext]) => ({ ext, n: data.filter((f) => f.extension === ext).length })) : []
  );
  let meta = $derived.by(() => {
    if (!data) return "";
    const pool = filter ? data.filter((f) => f.extension === filter) : data;
    const n = Math.min(LOC_TOP, pool.length);
    const total = pool.reduce((s, f) => s + f.code, 0);
    return `${filter ? "." + filter + " · " : ""}top ${n} of ${pool.length} files · ${total.toLocaleString()} LOC`;
  });
</script>

<div class="tab">
  <header>
    <div>
      <h2>Lines of Code</h2>
      <p>The largest files by lines of code — area is size, color is file type. The 10 biggest are ranked. Click a file to copy its path.</p>
    </div>
    {#if data}<span class="meta">{meta}</span>{/if}
  </header>

  {#if data && data.length}
    <div class="viz-filter">
      <button class="chip" class:active={filter === null} onclick={() => (filter = null)}>
        All types <span class="n">{data.length}</span>
      </button>
      {#each exts as e}
        <button class="chip" class:active={filter === e.ext} onclick={() => (filter = e.ext)}>
          <span class="sw" style="background:{color(e.ext)}"></span>.{e.ext} <span class="n">{e.n}</span>
        </button>
      {/each}
    </div>
    <div class="body"><Treemap {data} {filter} /></div>
  {:else}
    <p class="empty">No source files found in this directory.</p>
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
