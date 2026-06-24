<script>
  import CirclePacking from "../visualizations/CirclePacking.svelte";
  let { data } = $props();
</script>

<div class="tab">
  <header>
    <div>
      <h2>Hotspots</h2>
      <p>
        Circle size is lines of code, color is change frequency. Big and red =
        risky.
      </p>
    </div>
    {#if data}
      <span class="stat">{data.length} files</span>
    {/if}
  </header>
  <div class="body">
    {#if data && data.length}
      <CirclePacking {data} />
    {:else}
      <p class="empty">No data — is this a git repository?</p>
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
