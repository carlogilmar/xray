<script>
  import Heatmap from "../visualizations/Heatmap.svelte";
  let { data } = $props();
</script>

<div class="tab">
  <header>
    <div>
      <h2>Churn</h2>
      <p>
        Rows are files, columns are weeks. Brighter cells = more lines added +
        deleted that week.
      </p>
    </div>
    {#if data}
      <span class="stat">{data.length} file·weeks</span>
    {/if}
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
    overflow: auto;
    padding: 0 0.75rem 0.75rem;
  }
</style>
