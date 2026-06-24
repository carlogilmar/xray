<script>
  import CirclePacking from "../visualizations/CirclePacking.svelte";
  let { data } = $props();
</script>

<div class="tab">
  <header>
    <div>
      <h2>Hotspots</h2>
      <p>Circle size is lines of code, color is change frequency — redder is riskier. The 10 riskiest pulse; click any file for details.</p>
    </div>
    {#if data}<span class="meta">{data.length} files · top 10 riskiest pulsing</span>{/if}
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
  .tab { display: flex; flex-direction: column; height: 100%; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0.8rem 1.2rem 0.6rem; flex-shrink: 0; }
  header h2 { font-size: 1rem; }
  header p { margin: 0.22rem 0 0; color: var(--text-dim); font-size: 0.8rem; max-width: 70ch; }
  .meta { color: var(--text-dim); font-family: var(--mono); font-size: 0.72rem; text-align: right; white-space: nowrap; }
  .body { flex: 1; min-height: 0; padding: 0 0.7rem 0.7rem; position: relative; }
</style>
