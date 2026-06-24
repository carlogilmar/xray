<script>
  import Heatmap from "../visualizations/Heatmap.svelte";
  let { data } = $props();
</script>

<div class="tab">
  <header>
    <div>
      <h2>Churn</h2>
      <p>Rows are files, columns are weeks. Brighter cells = more lines added + deleted that week. Hover a row to focus its history, click it to copy the path.</p>
    </div>
    {#if data}<span class="meta">{data.length} file·weeks</span>{/if}
  </header>
  <div class="body">
    {#if data && data.length}
      <Heatmap {data} />
    {:else}
      <p class="empty">No commits in the selected churn window.</p>
    {/if}
  </div>
</div>

<style>
  .tab { display: flex; flex-direction: column; height: 100%; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0.8rem 1.2rem 0.6rem; flex-shrink: 0; }
  header h2 { font-size: 1rem; }
  header p { margin: 0.22rem 0 0; color: var(--text-dim); font-size: 0.8rem; max-width: 70ch; }
  .meta { color: var(--text-dim); font-family: var(--mono); font-size: 0.72rem; text-align: right; white-space: nowrap; }
  .body { flex: 1; min-height: 0; overflow: auto; padding: 0 0.7rem 0.7rem; }
</style>
