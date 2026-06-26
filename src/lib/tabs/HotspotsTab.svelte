<script>
  import CirclePacking from "../visualizations/CirclePacking.svelte";
  import TopList from "../viz/TopList.svelte";
  import { fmtLoc } from "../viz/util.js";

  let { data } = $props();
  let showList = $state(false);
  $effect(() => { data; showList = false; }); // reset on new analysis

  const splitPath = (p) => {
    const i = p.lastIndexOf("/");
    return { file: i >= 0 ? p.slice(i + 1) : p, dir: i >= 0 ? p.slice(0, i + 1) : "" };
  };

  let topItems = $derived.by(() => {
    if (!data) return [];
    return data
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((f) => ({
        path: f.path,
        ...splitPath(f.path),
        value: f.score.toFixed(1),
        meta: `${fmtLoc(f.code)} · ${f.changes}×`,
      }));
  });
</script>

<div class="tab">
  <header>
    <div>
      <h2>Hotspots</h2>
      <p>Circle size is lines of code, color is change frequency — redder is riskier. The 10 riskiest pulse; click any file for details, scroll to zoom.</p>
    </div>
    {#if data}
      <div class="head-right">
        <span class="meta">{data.length} files · top 10 riskiest pulsing</span>
        <button class="list-btn" class:active={showList} onclick={() => (showList = !showList)}>
          ☰ Top 20
        </button>
      </div>
    {/if}
  </header>
  <div class="body">
    {#if data && data.length}
      <CirclePacking {data} />
      <TopList open={showList} title="Top 20 by risk" items={topItems} onclose={() => (showList = false)} />
    {:else}
      <p class="empty">No data — is this a git repository?</p>
    {/if}
  </div>
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
