<script>
  import Treemap from "../visualizations/Treemap.svelte";
  import TopList from "../viz/TopList.svelte";
  import { locColor, locExtsByLoc, fmtLoc } from "../viz/util.js";

  let { data } = $props();
  const LOC_TOP = 120;

  let filter = $state(null);
  let showList = $state(false);
  $effect(() => { data; filter = null; showList = false; }); // reset on new analysis

  const splitPath = (p) => {
    const i = p.lastIndexOf("/");
    return { file: i >= 0 ? p.slice(i + 1) : p, dir: i >= 0 ? p.slice(0, i + 1) : "" };
  };

  let topItems = $derived.by(() => {
    if (!data) return [];
    const pool = filter ? data.filter((f) => f.extension === filter) : data;
    return pool
      .slice()
      .sort((a, b) => b.code - a.code)
      .slice(0, 20)
      .map((f) => ({ path: f.path, ...splitPath(f.path), value: fmtLoc(f.code), meta: "LOC" }));
  });

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
    {#if data}
      <div class="head-right">
        <span class="meta">{meta}</span>
        <button class="list-btn" class:active={showList} onclick={() => (showList = !showList)}>
          ☰ Top 20
        </button>
      </div>
    {/if}
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
    <div class="body">
      <Treemap {data} {filter} />
      <TopList open={showList} title="Top 20 by LOC" items={topItems} onclose={() => (showList = false)} />
    </div>
  {:else}
    <p class="empty">No source files found in this directory.</p>
  {/if}
</div>

<style>
  .tab { display: flex; flex-direction: column; height: 100%; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0.8rem 1.2rem 0.6rem; flex-shrink: 0; }
  header h2 { font-size: 1rem; }
  header p { margin: 0.22rem 0 0; color: var(--text-dim); font-size: 0.8rem; max-width: 70ch; }
  .head-right { display: flex; align-items: center; gap: 0.7rem; flex-shrink: 0; }
  .meta { color: var(--text-dim); font-family: var(--mono); font-size: 0.72rem; text-align: right; white-space: nowrap; }
  .list-btn {
    background: var(--bg-input); color: var(--text-dim);
    border: 1px solid var(--border); border-radius: 7px;
    padding: 0.32rem 0.6rem; font-size: 0.74rem; white-space: nowrap; cursor: pointer;
  }
  .list-btn:hover { color: var(--text); border-color: var(--text-dim); }
  .list-btn.active { color: var(--accent); border-color: var(--accent); }
  .body { flex: 1; min-height: 0; padding: 0 0.7rem 0.7rem; position: relative; }
</style>
