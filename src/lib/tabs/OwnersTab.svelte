<script>
  import TeamTreemap from "../visualizations/TeamTreemap.svelte";
  let { data } = $props();
</script>

<div class="tab">
  <header>
    <div>
      <h2>The Team</h2>
      <p>Who's behind this project — each author sized by their share of the codebase (lines contributed). Click an author to copy their handle.</p>
    </div>
    {#if data}<span class="meta">{data.length} contributors</span>{/if}
  </header>
  <div class="body">
    {#if data && data.length}
      <TeamTreemap {data} />
    {:else}
      <p class="empty">No authored history — is this a git repository?</p>
    {/if}
  </div>
</div>

<style>
  .tab { display: flex; flex-direction: column; height: 100%; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0.8rem 1.2rem 0.6rem; flex-shrink: 0; }
  header h2 { font-size: 1rem; }
  header p { margin: 0.22rem 0 0; color: var(--text-dim); font-size: 0.8rem; max-width: 70ch; }
  .meta { color: var(--text-dim); font-family: var(--mono); font-size: 0.72rem; text-align: right; white-space: nowrap; }
  .body { flex: 1; min-height: 0; padding: 0 0.7rem 0.7rem; }
</style>
