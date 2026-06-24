<script>
  import Treemap from "../visualizations/Treemap.svelte";
  let { data } = $props();

  let total = $derived(data ? data.reduce((s, d) => s + d.code, 0) : 0);
</script>

<div class="tab">
  <header>
    <div>
      <h2>Lines of Code</h2>
      <p>Each rectangle is a file — area is lines of code, color is extension.</p>
    </div>
    {#if data}
      <span class="stat">{data.length} files · {total.toLocaleString()} LOC</span>
    {/if}
  </header>
  <div class="body">
    {#if data && data.length}
      <Treemap {data} />
    {:else}
      <p class="empty">No source files found in this directory.</p>
    {/if}
  </div>
</div>

<style>
  .tab {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.85rem 1.25rem;
    flex-shrink: 0;
  }
  header h2 {
    font-size: 1rem;
  }
  header p {
    margin: 0.2rem 0 0;
    color: var(--text-dim);
    font-size: 0.8rem;
  }
  .stat {
    color: var(--text-dim);
    font-family: ui-monospace, Menlo, monospace;
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .body {
    flex: 1;
    min-height: 0;
    padding: 0 0.75rem 0.75rem;
  }
</style>
