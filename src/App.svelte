<script>
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";

  import LocTab from "./lib/tabs/LocTab.svelte";
  import HotspotsTab from "./lib/tabs/HotspotsTab.svelte";
  import ChurnTab from "./lib/tabs/ChurnTab.svelte";
  import CouplingTab from "./lib/tabs/CouplingTab.svelte";

  let path = $state("");
  let days = $state(365);
  let loading = $state(false);
  let error = $state("");
  let analyzed = $state(false);
  let activeTab = $state("loc");

  let loc = $state(null);
  let hotspots = $state(null);
  let churn = $state(null);
  let coupling = $state(null);

  const tabs = [
    { id: "loc", label: "LOC" },
    { id: "hotspots", label: "Hotspots" },
    { id: "churn", label: "Churn" },
    { id: "coupling", label: "Coupling" },
  ];

  async function pickDirectory() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") path = selected;
    } catch (e) {
      error = String(e);
    }
  }

  async function analyze() {
    if (!path.trim() || loading) return;
    loading = true;
    error = "";
    loc = hotspots = churn = coupling = null;

    try {
      const [l, h, c, cp] = await Promise.all([
        invoke("analyze_loc", { path }),
        invoke("analyze_hotspots", { path }),
        invoke("analyze_churn", { path, days }),
        invoke("analyze_coupling", { path }),
      ]);
      loc = l;
      hotspots = h;
      churn = c;
      coupling = cp;
      analyzed = true;
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  function onKey(e) {
    if (e.key === "Enter") analyze();
  }
</script>

<main>
  <header class="topbar">
    <div class="brand">
      <span class="logo">⌖</span>
      <h1>Xray</h1>
    </div>

    <div class="controls">
      <input
        class="path"
        type="text"
        placeholder="/path/to/project"
        bind:value={path}
        onkeydown={onKey}
        spellcheck="false"
      />
      <button class="ghost" onclick={pickDirectory} disabled={loading}>
        Browse…
      </button>
      <label class="days">
        <span>churn window</span>
        <select bind:value={days} disabled={loading}>
          <option value={90}>90d</option>
          <option value={180}>180d</option>
          <option value={365}>1y</option>
          <option value={730}>2y</option>
          <option value={3650}>all</option>
        </select>
      </label>
      <button class="primary" onclick={analyze} disabled={loading || !path.trim()}>
        {loading ? "Analyzing…" : "Analyze"}
      </button>
    </div>
  </header>

  {#if error}
    <div class="error">⚠ {error}</div>
  {/if}

  {#if analyzed || loading}
    <nav class="tabs">
      {#each tabs as t}
        <button
          class="tab"
          class:active={activeTab === t.id}
          onclick={() => (activeTab = t.id)}
        >
          {t.label}
        </button>
      {/each}
    </nav>

    <section class="stage">
      {#if loading}
        <p class="empty">Running four analyses in parallel…</p>
      {:else if activeTab === "loc"}
        <LocTab data={loc} />
      {:else if activeTab === "hotspots"}
        <HotspotsTab data={hotspots} />
      {:else if activeTab === "churn"}
        <ChurnTab data={churn} />
      {:else if activeTab === "coupling"}
        <CouplingTab data={coupling} />
      {/if}
    </section>
  {:else}
    <section class="welcome">
      <div class="welcome-card">
        <span class="logo big">⌖</span>
        <h2>Read your codebase as a crime scene</h2>
        <p>
          Point Xray at a git project to see four views of its structure and
          history — size, hotspots, churn over time, and hidden coupling.
        </p>
        <button class="primary" onclick={pickDirectory}>Choose a directory…</button>
      </div>
    </section>
  {/if}
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .logo {
    color: var(--accent);
    font-size: 1.4rem;
    line-height: 1;
  }
  .logo.big {
    font-size: 3rem;
  }
  h1 {
    font-size: 1.15rem;
    letter-spacing: 0.04em;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex: 1;
  }

  .path {
    flex: 1;
    min-width: 0;
    background: var(--bg-input);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 0.85rem;
  }
  .path:focus {
    outline: none;
    border-color: var(--accent);
  }

  .days {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--text-dim);
    font-size: 0.75rem;
    white-space: nowrap;
  }
  select {
    background: var(--bg-input);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.35rem 0.4rem;
  }

  button.primary {
    background: var(--accent);
    color: #04211d;
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1.1rem;
    font-weight: 650;
  }
  button.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button.ghost {
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.5rem 0.85rem;
  }
  button.ghost:hover {
    color: var(--text);
    border-color: var(--text-dim);
  }

  .error {
    background: rgba(248, 81, 73, 0.12);
    color: var(--danger);
    padding: 0.6rem 1.25rem;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 0.8rem;
    border-bottom: 1px solid var(--border);
  }

  .tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0 1.25rem;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tab {
    background: transparent;
    border: none;
    color: var(--text-dim);
    padding: 0.7rem 1rem;
    font-size: 0.85rem;
    border-bottom: 2px solid transparent;
  }
  .tab:hover {
    color: var(--text);
  }
  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .stage {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .welcome {
    flex: 1;
    display: grid;
    place-items: center;
  }
  .welcome-card {
    max-width: 460px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
  }
  .welcome-card h2 {
    font-size: 1.5rem;
  }
  .welcome-card p {
    color: var(--text-dim);
    line-height: 1.5;
    margin: 0;
  }
</style>
