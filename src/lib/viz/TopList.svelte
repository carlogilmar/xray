<script>
  import { copyPath } from "./util.js";

  // A simple slide-in panel listing the top files of an analysis.
  // items: [{ path, file, dir, value, meta }]
  let { open = false, title = "Top files", items = [], onclose } = $props();
</script>

{#if open}
  <aside class="toplist">
    <header class="tl-head">
      <span>{title}</span>
      <button class="tl-close" onclick={onclose} aria-label="Close list">×</button>
    </header>
    <ol class="tl-rows">
      {#each items as it, i}
        <li>
          <button class="tl-row" onclick={() => copyPath(it.path)} title="Copy {it.path}">
            <span class="tl-rank">{i + 1}</span>
            <span class="tl-name">
              <span class="tl-file">{it.file}</span>
              <span class="tl-dir">{it.dir}</span>
            </span>
            <span class="tl-val">
              <b>{it.value}</b>
              {#if it.meta}<span class="tl-meta">{it.meta}</span>{/if}
            </span>
          </button>
        </li>
      {/each}
    </ol>
  </aside>
{/if}

<style>
  .toplist {
    position: absolute;
    top: 0.4rem;
    right: 0.7rem;
    bottom: 0.4rem;
    width: 320px;
    max-width: calc(100% - 1.4rem);
    background: rgba(15, 20, 27, 0.97);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 14px 44px rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    z-index: 6;
    overflow: hidden;
    animation: tlIn 0.16s ease-out;
  }
  @keyframes tlIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: none; } }

  .tl-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.8rem;
    border-bottom: 1px solid var(--border);
    font-family: var(--mono);
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    color: var(--text-dim);
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .tl-close { background: none; border: none; color: var(--text-faint); font-size: 1.2rem; line-height: 1; cursor: pointer; }
  .tl-close:hover { color: var(--text); }

  .tl-rows { list-style: none; margin: 0; padding: 0.3rem; overflow-y: auto; flex: 1; min-height: 0; }
  .tl-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-radius: 8px;
    padding: 0.4rem 0.5rem;
    cursor: pointer;
    color: var(--text);
  }
  .tl-row:hover { background: var(--bg-input); }
  .tl-rank {
    flex-shrink: 0;
    width: 1.6rem;
    text-align: right;
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
  .tl-name { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.15; }
  .tl-file { font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tl-dir { font-family: var(--mono); font-size: 0.62rem; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left; }
  .tl-val { flex-shrink: 0; text-align: right; display: flex; flex-direction: column; line-height: 1.15; }
  .tl-val b { font-family: var(--mono); font-size: 0.8rem; font-variant-numeric: tabular-nums; }
  .tl-meta { font-size: 0.6rem; color: var(--text-faint); font-family: var(--mono); }
</style>
