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

  let project = $state(""); // name of the project being / last analyzed

  let loc = $state(null);
  let hotspots = $state(null);
  let churn = $state(null);
  let coupling = $state(null);

  const baseName = (p) => {
    const s = p.replace(/[/\\]+$/, "");
    const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
    return i >= 0 ? s.slice(i + 1) : s;
  };

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
    activeTab = "loc"; // always start a fresh analysis on the first tab
    project = baseName(path);
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
      <div class="title">
        <h1>Xray</h1>
        <span class="author">by @carlogilmar</span>
      </div>
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
          disabled={loading}
        >
          {t.label}
        </button>
      {/each}
      {#if project}
        <span class="project" title={path}>
          <span class="dot" class:busy={loading}></span>{project}
        </span>
      {/if}
    </nav>

    <section class="stage">
      {#if loading}
        <div class="loading">
          <div class="spinner"></div>
          <p>Analyzing <b>{project}</b>…</p>
          <span class="sub">running four analyses in parallel</span>
        </div>
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
        <span class="welcome-author">made by @carlogilmar</span>
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
  .title {
    display: flex;
    flex-direction: column;
    line-height: 1.05;
  }
  h1 {
    font-size: 1.15rem;
    letter-spacing: 0.04em;
  }
  .author {
    font-size: 0.62rem;
    letter-spacing: 0.04em;
    color: var(--text-faint);
    font-family: var(--mono);
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
  .tab:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .project {
    margin-left: auto;
    align-self: center;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-family: var(--mono);
    font-size: 0.78rem;
    color: var(--text);
    max-width: 40ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .project .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }
  .project .dot.busy {
    animation: dotPulse 1s ease-in-out infinite;
  }
  @keyframes dotPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }

  .stage {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .loading {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.7rem;
  }
  .loading p {
    margin: 0;
    color: var(--text);
    font-size: 1rem;
  }
  .loading .sub {
    color: var(--text-dim);
    font-size: 0.8rem;
  }
  .spinner {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .spinner { animation-duration: 2s; }
    .project .dot.busy { animation: none; opacity: 0.7; }
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
  .welcome-author {
    margin-top: 0.4rem;
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--text-faint);
    letter-spacing: 0.04em;
  }
</style>
