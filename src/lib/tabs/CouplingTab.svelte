<script>
  import ForceGraph from "../visualizations/ForceGraph.svelte";
  let { data } = $props();
</script>

<div class="tab">
  <header>
    <div>
      <h2>Coupling</h2>
      <p>
        Files that change together are linked. Thicker edges = stronger
        coupling. Drag nodes to explore.
      </p>
    </div>
    {#if data}
      <span class="stat">{data.length} coupled pairs</span>
    {/if}
  </header>
  <div class="body">
    {#if data && data.length}
      <ForceGraph {data} />
    {:else}
      <p class="empty">No files co-changed often enough to couple.</p>
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
  }
  .body {
    flex: 1;
    min-height: 0;
    padding: 0 0.75rem 0.75rem;
  }
</style>
