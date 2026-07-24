(function initRepositoryWorkspace(globalScope) {
  "use strict";

  const localHost = globalScope.location.hostname === "127.0.0.1" || globalScope.location.hostname === "localhost";
  const API_ORIGIN = localHost ? `${globalScope.location.protocol}//${globalScope.location.hostname}:8787` : "https://api.semeai.tech";
  const query = new URLSearchParams(globalScope.location.search);
  const callbackNotice = query.get("auth") === "denied"
    ? "GitHub authorization was denied. No workspace session was created."
    : query.get("installation") === "connected"
      ? "GitHub App installation connected. Selected repositories are being synchronized."
      : "";
  const refreshRepositories = query.get("installation") === "connected";
  if (globalScope.location.search) {
    globalScope.history.replaceState({}, "", `${globalScope.location.pathname}${globalScope.location.hash}`);
  }

  const state = {
    overview: null,
    installations: [],
    repositories: [],
    runs: [],
    activeView: "overview",
    progressionRepository: null,
  };

  const elements = {
    signedOut: document.getElementById("signed-out"),
    authenticated: document.getElementById("authenticated-workspace"),
    notice: document.getElementById("workspace-notice"),
    error: document.getElementById("workspace-error"),
    signIn: document.getElementById("sign-in-button"),
    headerIdentity: document.getElementById("header-identity"),
    headerLogin: document.getElementById("header-login"),
    sidebarIdentity: document.getElementById("sidebar-identity"),
    overviewFacts: document.getElementById("overview-facts"),
    overviewLatest: document.getElementById("overview-latest"),
    repositoryList: document.getElementById("repository-list"),
    progressionFilter: document.getElementById("progression-filter"),
    progressionList: document.getElementById("progression-list"),
    receiptList: document.getElementById("receipt-list"),
    receiptDetail: document.getElementById("receipt-detail"),
    accountIdentity: document.getElementById("account-identity"),
    installationList: document.getElementById("installation-list"),
    connectRepositories: document.getElementById("connect-repositories"),
    accountConnect: document.getElementById("account-connect"),
    signOut: document.getElementById("sign-out-button"),
    deleteAccount: document.getElementById("delete-account-button"),
  };

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function setNotice(message) {
    elements.notice.textContent = message || "";
    elements.notice.hidden = !message;
  }

  function setError(message) {
    elements.error.textContent = message || "";
    elements.error.hidden = !message;
  }

  async function apiRequest(path, options) {
    const settings = { method: "GET", ...(options || {}), credentials: "include" };
    settings.headers = { Accept: "application/json", ...(settings.headers || {}) };
    if (settings.body && typeof settings.body !== "string") {
      settings.headers["Content-Type"] = "application/json";
      settings.body = JSON.stringify(settings.body);
    }
    const response = await fetch(`${API_ORIGIN}${path}`, settings);
    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      payload = {};
    }
    if (!response.ok) {
      const failure = new Error(String(payload.error || `Workspace request failed (${response.status}).`));
      failure.status = response.status;
      failure.code = payload.code || "workspace_error";
      throw failure;
    }
    return payload;
  }

  function setAuthLinks() {
    elements.signIn.href = `${API_ORIGIN}/v0/oauth/github/start?return_path=%2Fbenchmark%2Fworkspace%2F`;
    elements.connectRepositories.href = `${API_ORIGIN}/v0/github/install/start`;
    elements.accountConnect.href = `${API_ORIGIN}/v0/github/install/start`;
  }

  function safeAvatarUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" && url.hostname === "avatars.githubusercontent.com" ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function identityLockup(user) {
    const wrapper = createElement("div", "identity-lockup");
    const avatarUrl = safeAvatarUrl(user.avatar_url);
    if (avatarUrl) {
      const image = createElement("img");
      image.src = avatarUrl;
      image.alt = "";
      image.width = 44;
      image.height = 44;
      wrapper.appendChild(image);
    } else {
      wrapper.appendChild(createElement("span", "wordmark-mark"));
    }
    const copy = createElement("div");
    copy.append(
      createElement("strong", "", `@${user.github_login}`),
      createElement("span", "", `GITHUB ID ${user.github_user_id}`),
    );
    wrapper.appendChild(copy);
    return wrapper;
  }

  function formatDate(value) {
    const date = new Date(String(value || ""));
    if (Number.isNaN(date.getTime())) return "NOT RECORDED";
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(date);
  }

  function shortCommit(value) {
    const commit = String(value || "");
    return commit ? commit.slice(0, 12) : "NOT RECORDED";
  }

  function deltaLabel(value) {
    if (value === null || value === undefined) return "FIRST TRACE";
    const numeric = Number(value);
    if (numeric === 0) return "NO SCORE DELTA";
    return `${numeric > 0 ? "+" : ""}${numeric} SCORE DELTA`;
  }

  function latestRunFor(repositoryId) {
    return state.runs.find((run) => Number(run.github_repository_id) === Number(repositoryId)) || null;
  }

  function appendDefinition(list, term, value, className) {
    const row = createElement("div");
    row.append(createElement("dt", "", term), createElement("dd", className || "", value));
    list.appendChild(row);
  }

  function renderHeaderIdentity() {
    const user = state.overview.user;
    elements.headerIdentity.classList.add("is-connected");
    elements.headerLogin.textContent = `@${user.github_login}`;
    elements.sidebarIdentity.replaceChildren(identityLockup(user));
  }

  function emptyState(title, copy, actionLabel, action) {
    const wrapper = createElement("div", "empty-state");
    const text = createElement("div");
    text.append(createElement("h2", "", title), createElement("p", "", copy));
    wrapper.appendChild(text);
    if (actionLabel && action) {
      const button = createElement("button", "secondary-action", actionLabel);
      button.type = "button";
      button.addEventListener("click", action);
      wrapper.appendChild(button);
    }
    return wrapper;
  }

  function renderSigil(container, run) {
    if (!globalScope.SemeAISigil || !run) return;
    globalScope.SemeAISigil.renderEvidenceSigil(container, {
      repository: run.repository,
      commitSha: run.source_commit,
      policyVersion: run.scoring_policy_version,
      visualSeed: run.visual_seed,
      visualPhase: run.visual_phase,
      categoryScores: run.category_scores,
      gateDecision: run.presentation_gate_decision,
    });
  }

  function renderOverview() {
    const counts = state.overview.counts;
    elements.overviewFacts.replaceChildren();
    [
      ["GITHUB IDENTITY", `@${state.overview.user.github_login}`],
      ["CONNECTED REPOSITORIES", counts.connected_repositories],
      ["RETAINED RUNS", counts.benchmark_runs],
      ["LATEST GATE", state.overview.latest_gate || "NO TRACE"],
    ].forEach(([term, value], index) => appendDefinition(elements.overviewFacts, term, value, index === 3 ? "gate-value" : ""));

    elements.overviewLatest.replaceChildren();
    const activeInstallations = state.installations.filter((item) => item.status === "active");
    const activeRepositories = state.repositories.filter((item) => item.connection_status === "active");
    if (!activeInstallations.length) {
      elements.overviewLatest.appendChild(
        emptyState(
          "GitHub identity verified. Repository access has not been granted.",
          "Install the read-only GitHub App and explicitly choose repositories to begin preserving their evidence trace.",
          "CONNECT REPOSITORIES",
          () => { globalScope.location.href = elements.connectRepositories.href; },
        ),
      );
      return;
    }
    if (!activeRepositories.length) {
      elements.overviewLatest.appendChild(
        emptyState(
          "Your GitHub identity is connected.",
          "Choose repositories to begin preserving their evidence trace.",
          "SELECT REPOSITORIES",
          () => { globalScope.location.href = elements.connectRepositories.href; },
        ),
      );
      return;
    }
    const latest = state.runs[0];
    if (!latest) {
      elements.overviewLatest.appendChild(
        emptyState(
          "No retained benchmark runs yet.",
          "Run the instrument to create the first trace.",
          "VIEW REPOSITORIES",
          () => setView("repositories"),
        ),
      );
      return;
    }

    const trace = createElement("article", "latest-trace");
    const copy = createElement("div", "latest-copy");
    copy.append(
      createElement("p", "section-index", "LATEST RETAINED TRACE"),
      createElement("h2", "", latest.repository),
    );
    const scoreLine = createElement("div", "latest-score-line");
    scoreLine.append(createElement("strong", "", latest.total_score), createElement("span", "", "/ 100 REPOSITORY PROGRESSION INDEX"));
    copy.append(scoreLine, createElement("span", "gate-label", latest.presentation_gate_decision));
    const facts = createElement("dl", "source-facts");
    appendDefinition(facts, "SOURCE COMMIT", shortCommit(latest.source_commit));
    appendDefinition(facts, "CAPTURED", formatDate(latest.created_at));
    appendDefinition(facts, "PROGRESSION", deltaLabel(latest.score_delta));
    copy.appendChild(facts);
    const sigil = createElement("div", "workspace-sigil");
    sigil.id = "overview-repository-sigil";
    trace.append(copy, sigil);
    elements.overviewLatest.appendChild(trace);
    renderSigil(sigil, latest);
  }

  async function runRepository(repository, button, status) {
    setError("");
    button.disabled = true;
    status.textContent = "CAPTURING AUTHORIZED EVIDENCE";
    try {
      await apiRequest("/v0/benchmark/runs", {
        method: "POST",
        body: { repository_id: repository.github_repository_id },
      });
      status.textContent = "TRACE RETAINED";
      await reloadData(false);
      renderAll();
    } catch (error) {
      status.textContent = "RUN NOT RETAINED";
      setError(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function renderRepositories() {
    elements.repositoryList.replaceChildren();
    const repositories = state.repositories.filter((item) => item.connection_status === "active");
    if (!repositories.length) {
      elements.repositoryList.appendChild(
        emptyState(
          "Your GitHub identity is connected.",
          "Choose repositories to begin preserving their evidence trace.",
          "CONNECT REPOSITORIES",
          () => { globalScope.location.href = elements.connectRepositories.href; },
        ),
      );
      return;
    }

    repositories.forEach((repository) => {
      const latest = latestRunFor(repository.github_repository_id);
      const entry = createElement("article", "repository-entry");
      const identity = createElement("div");
      identity.appendChild(createElement("h2", "repository-name", repository.full_name));
      const labels = createElement("div", "repository-labels");
      labels.append(
        createElement("span", "privacy-label", repository.private ? "PRIVATE" : "PUBLIC"),
        createElement("span", "connection-label", "APP SELECTED"),
      );
      identity.appendChild(labels);

      const metadata = createElement("dl", "repository-meta");
      appendDefinition(metadata, "LATEST SCORE", latest ? `${latest.total_score} / 100` : "NO TRACE");
      appendDefinition(metadata, "SCORE DELTA", latest ? deltaLabel(latest.score_delta) : "NOT AVAILABLE");
      appendDefinition(metadata, "GATE", latest ? latest.presentation_gate_decision : "NOT RUN");
      appendDefinition(metadata, "SOURCE COMMIT", latest ? shortCommit(latest.source_commit) : "NOT CAPTURED");
      appendDefinition(metadata, "LAST RUN", latest ? formatDate(latest.created_at) : "NOT RUN");

      const actions = createElement("div", "repository-actions");
      const runButton = createElement("button", "", "RUN BENCHMARK");
      runButton.type = "button";
      const historyButton = createElement("button", "", "VIEW HISTORY");
      historyButton.type = "button";
      historyButton.disabled = !latest;
      const status = createElement("p", "run-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      runButton.addEventListener("click", () => runRepository(repository, runButton, status));
      historyButton.addEventListener("click", () => {
        state.progressionRepository = Number(repository.github_repository_id);
        setView("progression");
        renderProgression();
      });
      actions.append(runButton, historyButton, status);
      entry.append(identity, metadata, actions);
      elements.repositoryList.appendChild(entry);
    });
  }

  function renderProgression() {
    elements.progressionFilter.replaceChildren();
    elements.progressionList.replaceChildren();
    if (!state.runs.length) {
      elements.progressionFilter.hidden = true;
      elements.progressionList.appendChild(
        emptyState(
          "No retained benchmark runs yet.",
          "Run the instrument to create the first trace.",
          "VIEW REPOSITORIES",
          () => setView("repositories"),
        ),
      );
      return;
    }

    const repositories = Array.from(new Map(state.runs.map((run) => [Number(run.github_repository_id), run.repository])).entries());
    elements.progressionFilter.hidden = false;
    const filters = [[null, "ALL REPOSITORIES"], ...repositories];
    filters.forEach(([repositoryId, label]) => {
      const button = createElement("button", "filter-button", label);
      button.type = "button";
      const active = repositoryId === state.progressionRepository;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      button.addEventListener("click", () => {
        state.progressionRepository = repositoryId;
        renderProgression();
      });
      elements.progressionFilter.appendChild(button);
    });

    state.runs
      .filter((run) => state.progressionRepository === null || Number(run.github_repository_id) === state.progressionRepository)
      .forEach((run) => {
        const entry = createElement("article", "timeline-entry");
        const identity = createElement("div");
        identity.append(
          createElement("p", "section-index", formatDate(run.created_at)),
          createElement("h2", "", run.repository),
        );
        const score = createElement("p", "timeline-score");
        score.append(document.createTextNode(`${run.total_score} `), createElement("span", "", `/ 100 · ${deltaLabel(run.score_delta)}`));
        identity.append(score, createElement("span", "gate-label", run.presentation_gate_decision));

        const evidence = createElement("div");
        const facts = createElement("dl", "source-facts");
        appendDefinition(facts, "SOURCE COMMIT", run.source_commit || "NOT RECORDED");
        appendDefinition(facts, "RECEIPT HASH", run.receipt_hash || "NOT RECORDED");
        evidence.appendChild(facts);
        const deltas = createElement("ul", "delta-list");
        const categoryDeltas = Object.entries(run.category_deltas || {});
        if (!categoryDeltas.length || run.score_delta === null) {
          deltas.appendChild(createElement("li", "", "First retained trace; no prior category delta."));
        } else {
          categoryDeltas.forEach(([key, value]) => {
            const delta = Number(value);
            const item = createElement("li");
            item.append(
              createElement("code", "", key.replaceAll("_", " ").toUpperCase()),
              document.createTextNode(` · ${delta > 0 ? "+" : ""}${delta}`),
            );
            deltas.appendChild(item);
          });
        }
        evidence.appendChild(deltas);
        const changes = createElement("ul", "evidence-change-list");
        (run.newly_admitted_evidence || []).forEach((key) => {
          const item = createElement("li");
          item.append(document.createTextNode("NEWLY ADMITTED EVIDENCE · "), createElement("code", "", key));
          changes.appendChild(item);
        });
        (run.no_longer_admitted_evidence || []).forEach((key) => {
          const item = createElement("li");
          item.append(document.createTextNode("NO LONGER ADMITTED EVIDENCE · "), createElement("code", "", key));
          changes.appendChild(item);
        });
        if (!changes.childElementCount) changes.appendChild(createElement("li", "", "No admitted-evidence set change recorded."));
        evidence.appendChild(changes);
        entry.append(identity, evidence);
        elements.progressionList.appendChild(entry);
      });
  }

  function downloadReceipt(run) {
    const serialized = `${JSON.stringify(run.receipt, null, 2)}\n`;
    const url = URL.createObjectURL(new Blob([serialized], { type: "application/json" }));
    const link = createElement("a");
    link.href = url;
    link.download = `${String(run.repository).replace(/[^A-Za-z0-9._-]+/g, "-")}.${run.run_id}.presentation-receipt.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function inspectReceipt(runId) {
    setError("");
    elements.receiptDetail.hidden = false;
    elements.receiptDetail.replaceChildren(createElement("p", "run-status", "LOADING RETAINED RECEIPT"));
    try {
      const run = await apiRequest(`/v0/benchmark/runs/${encodeURIComponent(runId)}`);
      const heading = createElement("div", "receipt-detail-header");
      const copy = createElement("div");
      copy.append(createElement("p", "section-index", "INSPECTED PRESENTATION RECEIPT"), createElement("h2", "", run.repository));
      const download = createElement("button", "secondary-action", "DOWNLOAD JSON RECEIPT");
      download.type = "button";
      download.addEventListener("click", () => downloadReceipt(run));
      heading.append(copy, download);
      const metadata = createElement("dl", "receipt-meta");
      appendDefinition(metadata, "GATE", run.presentation_gate_decision);
      appendDefinition(metadata, "VISUAL PHASE", `${run.visual_seed > 0 ? "+" : ""}${run.visual_seed} ${run.visual_phase}`);
      appendDefinition(metadata, "SOURCE COMMIT", run.source_commit);
      appendDefinition(metadata, "INTEGRITY HASH", run.receipt_hash, "hash-value");
      const boundary = createElement("p", "receipt-boundary", "Integrity hash, not a signature. Presentation receipt, not SaC/PoR release authority.");
      const missingSection = createElement("section", "missing-evidence");
      missingSection.appendChild(createElement("h3", "", "MISSING EVIDENCE"));
      const missingList = createElement("ul", "evidence-change-list");
      const missingSignals = Array.isArray(run.missing_signals)
        ? run.missing_signals
        : Array.isArray(run.receipt && run.receipt.missing_signals)
          ? run.receipt.missing_signals
          : [];
      if (!missingSignals.length) {
        missingList.appendChild(createElement("li", "", "No missing evidence criteria were recorded for this trace."));
      } else {
        missingSignals.forEach((signal) => {
          const item = createElement("li");
          item.append(
            createElement("code", "", String(signal.signal || "unrecorded_signal")),
            document.createTextNode(
              ` · ${String(signal.category || "Uncategorized")} · ${Number(signal.missing_points || 0)} points not awarded`,
            ),
          );
          missingList.appendChild(item);
        });
      }
      missingSection.appendChild(missingList);
      const pre = createElement("pre", "", JSON.stringify(run.receipt, null, 2));
      elements.receiptDetail.replaceChildren(heading, metadata, missingSection, boundary, pre);
      elements.receiptDetail.scrollIntoView({ block: "nearest" });
    } catch (error) {
      elements.receiptDetail.replaceChildren();
      elements.receiptDetail.hidden = true;
      setError(error.message);
    }
  }

  function renderReceipts() {
    elements.receiptList.replaceChildren();
    elements.receiptDetail.replaceChildren();
    elements.receiptDetail.hidden = true;
    if (!state.runs.length) {
      elements.receiptList.appendChild(
        emptyState(
          "No retained presentation receipts yet.",
          "Run the instrument to preserve the first decision trace.",
          "VIEW REPOSITORIES",
          () => setView("repositories"),
        ),
      );
      return;
    }
    state.runs.forEach((run) => {
      const entry = createElement("article", "receipt-entry");
      const identity = createElement("div");
      identity.append(
        createElement("p", "section-index", formatDate(run.created_at)),
        createElement("h2", "", run.repository),
        createElement("span", "gate-label", run.presentation_gate_decision),
      );
      const details = createElement("div");
      const metadata = createElement("dl", "receipt-meta");
      appendDefinition(metadata, "SOURCE COMMIT", shortCommit(run.source_commit));
      appendDefinition(metadata, "SCORE", `${run.total_score} / 100`);
      appendDefinition(metadata, "INTEGRITY HASH", run.receipt_hash, "hash-value");
      const inspect = createElement("button", "", "INSPECT RECEIPT");
      inspect.type = "button";
      inspect.addEventListener("click", () => inspectReceipt(run.run_id));
      details.append(metadata, inspect);
      entry.append(identity, details);
      elements.receiptList.appendChild(entry);
    });
  }

  async function disconnectInstallation(installation) {
    const confirmed = globalScope.confirm(
      `Disconnect @${installation.github_account_login}? Retained benchmark history will be preserved.`,
    );
    if (!confirmed) return;
    setError("");
    try {
      await apiRequest(`/v0/github/installations/${installation.installation_id}/disconnect`, {
        method: "POST",
        body: {},
      });
      setNotice("GitHub App installation disconnected. Retained benchmark history was preserved.");
      await reloadData(false);
      renderAll();
    } catch (error) {
      setError(error.message);
    }
  }

  function renderAccount() {
    elements.accountIdentity.replaceChildren();
    elements.accountIdentity.append(createElement("h2", "", "GITHUB IDENTITY"), identityLockup(state.overview.user));
    elements.installationList.replaceChildren();
    if (!state.installations.length) {
      elements.installationList.appendChild(createElement("p", "", "GitHub identity verified. Repository access has not been granted."));
      return;
    }
    state.installations.forEach((installation) => {
      const entry = createElement("div", "installation-entry");
      const copy = createElement("div");
      copy.append(
        createElement("strong", "", installation.github_account_login || `INSTALLATION ${installation.installation_id}`),
        createElement("span", "", `${installation.status.toUpperCase()} · INSTALLATION ${installation.installation_id}`),
      );
      entry.appendChild(copy);
      if (installation.status === "active") {
        const button = createElement("button", "secondary-action", "DISCONNECT");
        button.type = "button";
        button.addEventListener("click", () => disconnectInstallation(installation));
        entry.appendChild(button);
      }
      elements.installationList.appendChild(entry);
    });
  }

  function setView(view) {
    state.activeView = view;
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.viewPanel !== view;
    });
    document.querySelectorAll(".nav-item").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const heading = document.querySelector(`[data-view-panel="${view}"] h1`);
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }

  function renderAll() {
    renderHeaderIdentity();
    renderOverview();
    renderRepositories();
    renderProgression();
    renderReceipts();
    renderAccount();
  }

  async function reloadData(refresh) {
    state.overview = await apiRequest("/v0/me");
    const [installations, repositories, runs] = await Promise.all([
      apiRequest("/v0/github/installations"),
      apiRequest(`/v0/github/repositories${refresh ? "?refresh=1" : ""}`),
      apiRequest("/v0/benchmark/runs"),
    ]);
    state.installations = installations.installations || [];
    state.repositories = repositories.repositories || [];
    state.runs = runs.runs || [];
    state.overview.counts.installations = state.installations.filter((item) => item.status === "active").length;
    state.overview.counts.connected_repositories = state.repositories.filter((item) => item.connection_status === "active").length;
    state.overview.counts.benchmark_runs = state.runs.length;
    state.overview.latest_gate = state.runs[0] ? state.runs[0].presentation_gate_decision : null;
  }

  async function initialize() {
    setAuthLinks();
    if (callbackNotice) setNotice(callbackNotice);
    try {
      try {
        await reloadData(refreshRepositories);
      } catch (refreshError) {
        if (!refreshRepositories || refreshError.status === 401) throw refreshError;
        setNotice("GitHub App installation connected. Live repository synchronization did not complete; retained records remain available.");
        await reloadData(false);
      }
      elements.signedOut.hidden = true;
      elements.authenticated.hidden = false;
      renderAll();
    } catch (error) {
      if (error.status === 401) {
        elements.signedOut.hidden = false;
        elements.authenticated.hidden = true;
        return;
      }
      elements.signedOut.hidden = false;
      elements.authenticated.hidden = true;
      setError(error.message);
    }
  }

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewTarget));
  });

  elements.signOut.addEventListener("click", async () => {
    setError("");
    try {
      await apiRequest("/v0/oauth/github/logout", { method: "POST", body: {} });
      globalScope.location.reload();
    } catch (error) {
      setError(error.message);
    }
  });

  elements.deleteAccount.addEventListener("click", async () => {
    const confirmation = globalScope.prompt(
      "Type DELETE BENCHMARK ACCOUNT to delete the SemeAI benchmark identity and all retained history.",
    );
    if (confirmation !== "DELETE BENCHMARK ACCOUNT") {
      if (confirmation !== null) setNotice("Account deletion was not confirmed.");
      return;
    }
    setError("");
    try {
      await apiRequest("/v0/benchmark/account/delete", {
        method: "POST",
        body: { confirmation },
      });
      globalScope.location.reload();
    } catch (error) {
      setError(error.message);
    }
  });

  initialize();
})(window);
