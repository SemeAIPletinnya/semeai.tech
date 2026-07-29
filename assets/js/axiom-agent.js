(() => {
  "use strict";

  const MANIFEST_URL = "/assets/pets/axiom/pet.json";
  const API_BASE = String(window.SEMEAI_API_BASE || "https://api.semeai.tech").replace(/\/+$/, "");
  const ARCHIVE_ENDPOINT = `${API_BASE}/v0/archive/query`;
  const ARCHIVE_RESPONSE_SCHEMA = "semeai.axiom-public-answer.v0.1";
  const RELEASE_MAPPINGS = Object.freeze({
    SHOW: "PROCEED",
    REVIEW: "NEEDS_REVIEW",
    BLOCK: "SILENCE",
  });
  const SUPPORTED_ROUTES = new Set(["home", "genesis", "benchmark", "gate", "skills"]);
  const DEFAULT_STATES = Object.freeze({
    idle: { row: 0, frames: 6 },
    "running-right": { row: 1, frames: 8 },
    "running-left": { row: 2, frames: 8 },
    waving: { row: 3, frames: 4 },
    jumping: { row: 4, frames: 5 },
    failed: { row: 5, frames: 8 },
    waiting: { row: 6, frames: 6 },
    running: { row: 7, frames: 6 },
    review: { row: 8, frames: 6 },
  });
  const ROUTES = Object.freeze({
    home: {
      label: { en: "Home", uk: "Головна", ru: "Главная" },
      role: { en: "System", uk: "Система", ru: "Система" },
      summary: {
        en: "Release-control overview",
        uk: "Огляд контролю релізу",
        ru: "Обзор контроля релиза",
      },
      sources: ["gate", "genesis", "benchmark"],
    },
    genesis: {
      label: { en: "Genesis", uk: "Генезис", ru: "Генезис" },
      role: { en: "Trace", uk: "Слід", ru: "След" },
      summary: {
        en: "Admitted historical chronology",
        uk: "Допущена історична хронологія",
        ru: "Допущенная историческая хронология",
      },
      sources: ["genesis", "research", "book"],
    },
    benchmark: {
      label: { en: "Benchmark", uk: "Бенчмарк", ru: "Бенчмарк" },
      role: { en: "Instrument", uk: "Інструмент", ru: "Инструмент" },
      summary: {
        en: "Bounded visible repository evidence",
        uk: "Обмежені видимі докази репозиторію",
        ru: "Ограниченные видимые доказательства репозитория",
      },
      sources: ["benchmark", "gate", "research"],
    },
    gate: {
      label: { en: "Gate", uk: "Gate", ru: "Gate" },
      role: { en: "Authority", uk: "Влада", ru: "Власть" },
      summary: {
        en: "Release-decision contract",
        uk: "Контракт рішення про реліз",
        ru: "Контракт решения о релизе",
      },
      sources: ["gate", "book", "benchmark"],
    },
    skills: {
      label: { en: "Skill Forge", uk: "Кузня навичок", ru: "Кузница навыков" },
      role: { en: "Evaluation", uk: "Оцінювання", ru: "Оценка" },
      summary: {
        en: "Candidate evidence and admission boundary",
        uk: "Докази кандидата й межа допуску",
        ru: "Доказательства кандидата и граница допуска",
      },
      sources: ["skills", "gate", "research"],
    },
  });
  const SOURCE_LINKS = Object.freeze({
    gate: {
      href: "/gate.html",
      label: { en: "Gate contract", uk: "Контракт Gate", ru: "Контракт Gate" },
    },
    genesis: {
      href: "/genesis/",
      label: { en: "Genesis chronology", uk: "Хронологія Genesis", ru: "Хронология Genesis" },
    },
    benchmark: {
      href: "/benchmark/",
      label: { en: "Repository evidence", uk: "Докази репозиторію", ru: "Доказательства репозитория" },
    },
    research: {
      href: "/research.html",
      label: { en: "Research boundaries", uk: "Межі досліджень", ru: "Границы исследований" },
    },
    book: {
      href: "/book/",
      label: { en: "Engineering Book", uk: "Інженерна книга", ru: "Инженерная книга" },
    },
    skills: {
      href: "/skills/",
      label: { en: "Skill Forge evidence", uk: "Докази Skill Forge", ru: "Доказательства Skill Forge" },
    },
  });
  const COPY = Object.freeze({
    en: {
      launch: "Open Axiom archive interface",
      close: "Close Axiom",
      mode: "PUBLIC EVIDENCE",
      eyebrow: "AXIOM / ARCHIVE INTERFACE",
      title: "Evidence, with authority visible.",
      boundary:
        "Ask about admitted public evidence. An answer appears only when SaC/PoR Gate permits release.",
      route: "Current route context",
      query: "Ask the public archive",
      queryLabel: "Question",
      queryPlaceholder: "What changed here?",
      ask: "Ask Axiom",
      queryHint: "256 characters · no private archive",
      result: "Gate-mediated result",
      noEvidence: "No matching public evidence; no candidate was generated.",
      sourcesReturned: "Cited public evidence",
      decisionReceipt: "Decision receipt",
      sources: "Inspect public sources",
      sourcesAria: "Axiom public evidence sources",
      authority: "Axiom presents and orients. SaC/PoR Gate remains release authority.",
      ready: "IDLE · orientation ready",
      loading: "RUNNING · loading accepted atlas",
      failed: "FAILED · accepted atlas unavailable",
      queryWaiting: "WAITING · enter a public archive question",
      queryRunning: "RUNNING · retrieving public evidence",
      gateShow: "IDLE · SHOW / PROCEED",
      gateReview: "REVIEW · REVIEW / NEEDS_REVIEW",
      gateBlock: "REVIEW · BLOCK / SILENCE",
      queryNoEvidence: "REVIEW · no matching evidence",
      queryFailed: "FAILED · archive service unavailable",
    },
    uk: {
      launch: "Відкрити архівний інтерфейс Axiom",
      close: "Закрити Axiom",
      mode: "ПУБЛІЧНІ ДОКАЗИ",
      eyebrow: "AXIOM / АРХІВНИЙ ІНТЕРФЕЙС",
      title: "Докази з видимою владою.",
      boundary:
        "Запитайте про допущені публічні докази. Відповідь з’явиться лише тоді, коли SaC/PoR Gate дозволить реліз.",
      route: "Контекст поточного маршруту",
      query: "Запитати публічний архів",
      queryLabel: "Питання",
      queryPlaceholder: "Що змінилося тут?",
      ask: "Запитати Axiom",
      queryHint: "256 символів · без приватного архіву",
      result: "Результат через Gate",
      noEvidence: "Відповідних публічних доказів немає; кандидата не створено.",
      sourcesReturned: "Цитовані публічні докази",
      decisionReceipt: "Receipt рішення",
      sources: "Переглянути публічні джерела",
      sourcesAria: "Публічні джерела доказів Axiom",
      authority: "Axiom подає й орієнтує. SaC/PoR Gate зберігає владу релізу.",
      ready: "IDLE · орієнтація готова",
      loading: "RUNNING · завантаження прийнятого atlas",
      failed: "FAILED · прийнятий atlas недоступний",
      queryWaiting: "WAITING · введіть питання до публічного архіву",
      queryRunning: "RUNNING · пошук публічних доказів",
      gateShow: "IDLE · SHOW / PROCEED",
      gateReview: "REVIEW · REVIEW / NEEDS_REVIEW",
      gateBlock: "REVIEW · BLOCK / SILENCE",
      queryNoEvidence: "REVIEW · відповідних доказів немає",
      queryFailed: "FAILED · архівний сервіс недоступний",
    },
    ru: {
      launch: "Открыть архивный интерфейс Axiom",
      close: "Закрыть Axiom",
      mode: "ПУБЛИЧНЫЕ ДОКАЗАТЕЛЬСТВА",
      eyebrow: "AXIOM / АРХИВНЫЙ ИНТЕРФЕЙС",
      title: "Доказательства с видимой властью.",
      boundary:
        "Спросите о допущенных публичных доказательствах. Ответ появится только тогда, когда SaC/PoR Gate разрешит релиз.",
      route: "Контекст текущего маршрута",
      query: "Спросить публичный архив",
      queryLabel: "Вопрос",
      queryPlaceholder: "Что изменилось здесь?",
      ask: "Спросить Axiom",
      queryHint: "256 символов · без приватного архива",
      result: "Результат через Gate",
      noEvidence: "Подходящих публичных доказательств нет; кандидат не создан.",
      sourcesReturned: "Цитируемые публичные доказательства",
      decisionReceipt: "Receipt решения",
      sources: "Просмотреть публичные источники",
      sourcesAria: "Публичные источники доказательств Axiom",
      authority: "Axiom представляет и ориентирует. SaC/PoR Gate сохраняет власть релиза.",
      ready: "IDLE · ориентация готова",
      loading: "RUNNING · загрузка принятого atlas",
      failed: "FAILED · принятый atlas недоступен",
      queryWaiting: "WAITING · введите вопрос к публичному архиву",
      queryRunning: "RUNNING · поиск публичных доказательств",
      gateShow: "IDLE · SHOW / PROCEED",
      gateReview: "REVIEW · REVIEW / NEEDS_REVIEW",
      gateBlock: "REVIEW · BLOCK / SILENCE",
      queryNoEvidence: "REVIEW · подходящих доказательств нет",
      queryFailed: "FAILED · архивный сервис недоступен",
    },
  });

  const path = (location.pathname || "/").toLowerCase();
  const routeKey = path === "/" || path.endsWith("/index.html") && !path.includes("/genesis/") && !path.includes("/benchmark/") && !path.includes("/skills/")
    ? "home"
    : path.includes("/genesis/")
      ? "genesis"
      : path.includes("/benchmark/")
        ? "benchmark"
        : path.endsWith("/gate.html")
          ? "gate"
          : path.includes("/skills/")
            ? "skills"
            : "";

  if (!SUPPORTED_ROUTES.has(routeKey)) return;

  let manifest = null;
  let stateName = "running";
  let frameIndex = 0;
  let frameTimer = 0;
  let greetingTimer = 0;
  let orientationTimer = 0;
  let assetStatus = "loading";
  let statusOverride = "";
  let activeRequest = null;
  let requestSequence = 0;
  let lastResult = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const nodes = {};

  function language() {
    const selected = window.SemeAI_I18n?.lang || document.documentElement.lang || "en";
    return ["en", "uk", "ru"].includes(selected) ? selected : "en";
  }

  function translated(value) {
    return value?.[language()] || value?.en || "";
  }

  function createElement(name, attributes = {}, text = "") {
    const node = document.createElement(name);
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== false) {
        node.setAttribute(key, String(value));
      }
    });
    if (text) node.textContent = text;
    return node;
  }

  function stateMap() {
    return manifest?.states || DEFAULT_STATES;
  }

  function setSprite(row, column) {
    if (!nodes.sprite) return;
    const columns = manifest?.atlas?.columns || 8;
    const rows = manifest?.atlas?.rows || 11;
    const x = columns > 1 ? (column / (columns - 1)) * 100 : 0;
    const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    nodes.sprite.style.setProperty("--axiom-frame-x", `${x}%`);
    nodes.sprite.style.setProperty("--axiom-frame-y", `${y}%`);
    nodes.root.dataset.spriteRow = String(row);
    nodes.root.dataset.spriteColumn = String(column);
  }

  function stateLabel() {
    const copy = COPY[language()];
    if (assetStatus === "failed") return copy.failed;
    if (assetStatus === "loading") return copy.loading;
    if (statusOverride && copy[statusOverride]) return copy[statusOverride];
    return `${stateName.toUpperCase()} · ${stateName === "idle" ? copy.ready.split("·")[1].trim() : stateName}`;
  }

  function paintState() {
    const state = stateMap()[stateName] || DEFAULT_STATES.idle;
    if (reducedMotion.matches) frameIndex = 0;
    else frameIndex %= Math.max(1, Number(state.frames) || 1);
    setSprite(Number(state.row) || 0, frameIndex);
    if (nodes.status) nodes.status.textContent = stateLabel();
  }

  function stopAnimation() {
    if (frameTimer) window.clearInterval(frameTimer);
    frameTimer = 0;
  }

  function startAnimation() {
    stopAnimation();
    paintState();
    if (reducedMotion.matches || document.hidden || assetStatus === "failed") return;
    const state = stateMap()[stateName] || DEFAULT_STATES.idle;
    if ((Number(state.frames) || 1) < 2) return;
    frameTimer = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % state.frames;
      paintState();
    }, stateName === "idle" ? 260 : 150);
  }

  function setState(nextState, source = "explicit-application-state") {
    if (!Object.prototype.hasOwnProperty.call(stateMap(), nextState)) return false;
    window.clearTimeout(orientationTimer);
    nodes.root?.removeAttribute("data-orientation");
    stateName = nextState;
    frameIndex = 0;
    if (nodes.root) {
      nodes.root.dataset.state = nextState;
      nodes.root.dataset.stateSource = source;
    }
    startAnimation();
    return true;
  }

  function lookAtAngle(angle) {
    if (reducedMotion.matches || assetStatus !== "ready") return false;
    const normalized = ((Number(angle) % 360) + 360) % 360;
    const direction = Math.round(normalized / 22.5) % 16;
    const row = direction < 8 ? 9 : 10;
    const column = direction % 8;
    stopAnimation();
    setSprite(row, column);
    nodes.root.dataset.orientation = String(direction * 22.5).padStart(3, "0");
    window.clearTimeout(orientationTimer);
    orientationTimer = window.setTimeout(() => {
      nodes.root.removeAttribute("data-orientation");
      startAnimation();
    }, 520);
    return true;
  }

  function setOperationState(nextState, statusKey, source) {
    statusOverride = statusKey;
    setState(nextState, source);
  }

  function applyResultVisual(result) {
    const release = result?.release || {};
    if (release.gateEvaluated !== true) {
      setOperationState("review", "queryNoEvidence", "retrieval-no-evidence");
    } else if (release.action === "SHOW") {
      setOperationState("idle", "gateShow", "gate-show-proceed");
    } else if (release.action === "REVIEW") {
      setOperationState("review", "gateReview", "gate-review-needs-review");
    } else {
      setOperationState("review", "gateBlock", "gate-block-silence");
    }
  }

  function validateArchiveResponse(value) {
    if (!value || value.schemaVersion !== ARCHIVE_RESPONSE_SCHEMA) {
      throw new Error("Axiom archive response contract is invalid");
    }
    const bundle = value.evidenceBundle;
    const release = value.release;
    if (!bundle || !Array.isArray(bundle.evidence) || !release || typeof release !== "object") {
      throw new Error("Axiom archive response is incomplete");
    }
    if (
      bundle.evidence.some(
        (item) => item?.visibility !== "PUBLIC" || item?.contentTrust !== "UNTRUSTED_DATA",
      )
    ) {
      throw new Error("Axiom archive response crossed the public evidence boundary");
    }
    if (release.gateEvaluated !== true) {
      if (
        bundle.noEvidence !== true ||
        value.candidate !== null ||
        value.releasedAnswer !== null ||
        release.action !== null ||
        release.decisionReceiptId !== null
      ) {
        throw new Error("Axiom no-evidence response is inconsistent");
      }
      return value;
    }

    if (RELEASE_MAPPINGS[release.action] !== release.internalDecision) {
      throw new Error("Axiom Gate action mapping is invalid");
    }
    if (release.showToUser !== (release.action === "SHOW")) {
      throw new Error("Axiom Gate visibility mapping is invalid");
    }
    if (
      !release.decisionReceiptId ||
      release.receipt_id !== release.decisionReceiptId ||
      release.executionReceiptId !== null ||
      release.auditPreserved !== true
    ) {
      throw new Error("Axiom decision receipt contract is invalid");
    }
    if (
      !value.candidate ||
      value.candidate.candidateTextIncluded !== false ||
      Object.prototype.hasOwnProperty.call(value.candidate, "candidateText")
    ) {
      throw new Error("Axiom public response exposed the candidate contract incorrectly");
    }
    if (release.action === "SHOW") {
      if (!String(value.releasedAnswer || "").trim()) {
        throw new Error("Axiom SHOW response has no released answer");
      }
    } else if (value.releasedAnswer !== null) {
      throw new Error("Axiom held response included user-visible candidate output");
    }
    return value;
  }

  async function sha256(value) {
    if (!window.crypto?.subtle || typeof TextEncoder !== "function") {
      throw new Error("Axiom answer integrity check is unavailable");
    }
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function safeEvidenceHref(route) {
    const raw = String(route || "");
    if (!raw.startsWith("/") || raw.startsWith("//")) return null;
    try {
      const url = new URL(raw, location.origin);
      return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : null;
    } catch {
      return null;
    }
  }

  function renderResult(result, { moveFocus = true } = {}) {
    const copy = COPY[language()];
    const release = result.release;
    const evidence = result.evidenceBundle.evidence;
    nodes.result.hidden = false;
    nodes.result.dataset.action = String(release.action || "NO_EVIDENCE").toLowerCase();
    nodes.resultAction.textContent =
      release.gateEvaluated === true
        ? `${release.action} / ${release.internalDecision}`
        : "NO EVIDENCE / NOT EVALUATED";
    nodes.resultReason.textContent =
      release.gateEvaluated === true ? String(release.reason || "") : copy.noEvidence;

    if (release.action === "SHOW") {
      nodes.resultAnswer.hidden = false;
      nodes.resultAnswer.textContent = result.releasedAnswer;
    } else {
      nodes.resultAnswer.hidden = true;
      nodes.resultAnswer.textContent = "";
    }

    nodes.resultSourcesHeading.textContent = copy.sourcesReturned;
    nodes.resultSources.replaceChildren();
    evidence.forEach((item, index) => {
      const row = createElement("li");
      const href = safeEvidenceHref(item.route);
      const identity = createElement("small", {}, `${String(index + 1).padStart(2, "0")} · ${item.sourceId}`);
      const label = createElement(href ? "a" : "span", href ? { href } : {}, item.title);
      row.append(identity, label);
      nodes.resultSources.append(row);
    });
    nodes.resultSourcesWrap.hidden = evidence.length === 0;

    const receiptId = release.decisionReceiptId;
    nodes.resultReceipt.hidden = !receiptId;
    nodes.resultReceipt.textContent = receiptId ? `${copy.decisionReceipt}: ${receiptId}` : "";
    if (moveFocus) window.requestAnimationFrame(() => nodes.result.focus());
  }

  async function submitArchiveQuestion(event) {
    event.preventDefault();
    const question = nodes.queryInput.value.trim();
    if (!question) {
      setOperationState("waiting", "queryWaiting", "question-input-required");
      nodes.queryInput.focus();
      return;
    }

    activeRequest?.controller.abort();
    const sequence = ++requestSequence;
    const controller = new AbortController();
    activeRequest = { controller, sequence };
    lastResult = null;
    nodes.result.hidden = true;
    nodes.root.removeAttribute("data-request-error");
    nodes.queryButton.disabled = true;
    nodes.queryInput.setAttribute("aria-busy", "true");
    setOperationState("running", "queryRunning", "public-archive-request");
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const endpoint = new URL(ARCHIVE_ENDPOINT, location.origin);
      if (!["https:", "http:"].includes(endpoint.protocol)) {
        throw new Error("Axiom archive endpoint protocol is invalid");
      }
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          routeContext: routeKey,
          limit: 5,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Axiom archive endpoint returned ${response.status}`);
      const result = validateArchiveResponse(await response.json());
      if (sequence !== requestSequence) return;
      if (result.release.action === "SHOW") {
        const releasedHash = await sha256(result.releasedAnswer);
        if (releasedHash !== result.candidate.candidateHash) {
          throw new Error("Axiom released answer differs from the evaluated candidate");
        }
      }
      lastResult = result;
      renderResult(result);
      applyResultVisual(result);
    } catch (error) {
      if (sequence !== requestSequence) return;
      lastResult = null;
      nodes.result.hidden = true;
      nodes.root.dataset.requestError =
        error instanceof Error && error.name !== "AbortError" ? error.message : "archive request unavailable";
      setOperationState("failed", "queryFailed", "public-archive-request-failure");
    } finally {
      window.clearTimeout(timeout);
      if (sequence === requestSequence) {
        activeRequest = null;
        nodes.queryButton.disabled = false;
        nodes.queryInput.removeAttribute("aria-busy");
      }
    }
  }

  function updateCopy() {
    if (!nodes.root) return;
    const copy = COPY[language()];
    const route = ROUTES[routeKey];
    nodes.launcher.setAttribute("aria-label", copy.launch);
    nodes.close.setAttribute("aria-label", copy.close);
    nodes.mode.textContent = copy.mode;
    nodes.eyebrow.textContent = copy.eyebrow;
    nodes.title.textContent = copy.title;
    nodes.boundary.textContent = copy.boundary;
    nodes.routeHeading.textContent = copy.route;
    nodes.routeLabel.textContent = translated(route.label);
    nodes.routeRole.textContent = translated(route.role);
    nodes.routeSummary.textContent = translated(route.summary);
    nodes.queryHeading.textContent = copy.query;
    nodes.queryLabel.textContent = copy.queryLabel;
    nodes.queryInput.placeholder = copy.queryPlaceholder;
    nodes.queryButton.textContent = copy.ask;
    nodes.queryHint.textContent = copy.queryHint;
    nodes.resultHeading.textContent = copy.result;
    nodes.sourcesHeading.textContent = copy.sources;
    nodes.sources.setAttribute("aria-label", copy.sourcesAria);
    nodes.authority.textContent = copy.authority;
    route.sources.forEach((sourceKey) => {
      const link = nodes.sourceLinks.get(sourceKey);
      if (link) link.textContent = translated(SOURCE_LINKS[sourceKey].label);
    });
    nodes.status.textContent = stateLabel();
    if (lastResult) renderResult(lastResult, { moveFocus: false });
  }

  function openPanel() {
    nodes.panel.hidden = false;
    nodes.launcher.setAttribute("aria-expanded", "true");
    nodes.root.dataset.open = "true";
    if (lastResult) {
      applyResultVisual(lastResult);
    } else {
      setState("waving", "panel-open-greeting");
      window.clearTimeout(greetingTimer);
      greetingTimer = window.setTimeout(() => setState("idle", "ready-no-active-work"), 900);
    }
    window.requestAnimationFrame(() => nodes.close.focus());
  }

  function closePanel({ restoreFocus = true } = {}) {
    nodes.panel.hidden = true;
    nodes.launcher.setAttribute("aria-expanded", "false");
    delete nodes.root.dataset.open;
    window.clearTimeout(greetingTimer);
    if (lastResult) applyResultVisual(lastResult);
    else setState("idle", "ready-no-active-work");
    if (restoreFocus) nodes.launcher.focus();
  }

  function buildInterface() {
    const root = createElement("aside", {
      class: "axiom-agent",
      "data-axiom-agent": "",
      "data-state": "running",
      "data-state-source": "accepted-atlas-loading",
      "data-asset-state": "loading",
    });
    const panelId = `axiom-panel-${routeKey}`;
    const titleId = `axiom-title-${routeKey}`;

    const launcher = createElement("button", {
      class: "axiom-agent__launcher",
      type: "button",
      "aria-controls": panelId,
      "aria-expanded": "false",
    });
    const sprite = createElement("span", { class: "axiom-agent__sprite", "aria-hidden": "true" });
    const launcherLabel = createElement("span", { class: "axiom-agent__launcher-label", "aria-hidden": "true" }, "AXIOM");
    launcher.append(sprite, launcherLabel);

    const panel = createElement("section", {
      class: "axiom-agent__panel",
      id: panelId,
      role: "dialog",
      "aria-modal": "false",
      "aria-labelledby": titleId,
      hidden: "",
    });
    const header = createElement("header", { class: "axiom-agent__header" });
    const headerCopy = createElement("div");
    const mode = createElement("span", { class: "axiom-agent__mode" });
    const eyebrow = createElement("span", { class: "axiom-agent__eyebrow" });
    headerCopy.append(mode, eyebrow);
    const close = createElement("button", { class: "axiom-agent__close", type: "button" }, "×");
    header.append(headerCopy, close);

    const title = createElement("h2", { class: "axiom-agent__title", id: titleId });
    const boundary = createElement("p", { class: "axiom-agent__boundary" });
    const status = createElement("p", {
      class: "axiom-agent__status",
      role: "status",
      "aria-live": "polite",
    });

    const routeCard = createElement("section", { class: "axiom-agent__context" });
    const routeHeading = createElement("h3", { class: "axiom-agent__section-heading" });
    const routeIdentity = createElement("div", { class: "axiom-agent__route-identity" });
    const routeLabel = createElement("strong");
    const routeRole = createElement("span");
    const routeSummary = createElement("p");
    routeIdentity.append(routeLabel, routeRole);
    routeCard.append(routeHeading, routeIdentity, routeSummary);

    const queryForm = createElement("form", { class: "axiom-agent__query" });
    const queryHeading = createElement("h3", { class: "axiom-agent__section-heading" });
    const queryInputId = `axiom-query-${routeKey}`;
    const queryLabel = createElement("label", { for: queryInputId });
    const queryInput = createElement("input", {
      id: queryInputId,
      name: "question",
      type: "search",
      maxlength: "256",
      autocomplete: "off",
      spellcheck: "true",
      enterkeyhint: "send",
    });
    const queryFooter = createElement("div", { class: "axiom-agent__query-footer" });
    const queryHint = createElement("small");
    const queryButton = createElement("button", { type: "submit" });
    queryFooter.append(queryHint, queryButton);
    queryForm.append(queryHeading, queryLabel, queryInput, queryFooter);

    const result = createElement("section", {
      class: "axiom-agent__result",
      tabindex: "-1",
      "aria-live": "polite",
      hidden: "",
    });
    const resultHeader = createElement("header");
    const resultHeading = createElement("h3", { class: "axiom-agent__section-heading" });
    const resultAction = createElement("strong", { class: "axiom-agent__result-action" });
    resultHeader.append(resultHeading, resultAction);
    const resultReason = createElement("p", { class: "axiom-agent__result-reason" });
    const resultAnswer = createElement("pre", { class: "axiom-agent__result-answer", hidden: "" });
    const resultSourcesWrap = createElement("div", { class: "axiom-agent__result-sources" });
    const resultSourcesHeading = createElement("h4");
    const resultSources = createElement("ol");
    resultSourcesWrap.append(resultSourcesHeading, resultSources);
    const resultReceipt = createElement("p", { class: "axiom-agent__result-receipt", hidden: "" });
    result.append(
      resultHeader,
      resultReason,
      resultAnswer,
      resultSourcesWrap,
      resultReceipt,
    );

    const sources = createElement("nav", { class: "axiom-agent__sources" });
    const sourcesHeading = createElement("h3", { class: "axiom-agent__section-heading" });
    const sourceList = createElement("div", { class: "axiom-agent__source-list" });
    const sourceLinks = new Map();
    ROUTES[routeKey].sources.forEach((sourceKey, index) => {
      const source = SOURCE_LINKS[sourceKey];
      const link = createElement("a", { href: source.href });
      const number = createElement("small", { class: "axiom-agent__source-index", "aria-hidden": "true" }, String(index + 1).padStart(2, "0"));
      const label = createElement("span", { class: "axiom-agent__source-label" });
      const arrow = createElement("span", { "aria-hidden": "true" }, "↗");
      link.append(number, label, arrow);
      sourceLinks.set(sourceKey, label);
      sourceList.append(link);
    });
    sources.append(sourcesHeading, sourceList);

    const authority = createElement("p", { class: "axiom-agent__authority" });
    panel.append(header, title, boundary, status, routeCard, queryForm, result, sources, authority);
    root.append(panel, launcher);
    document.body.append(root);

    Object.assign(nodes, {
      root,
      panel,
      launcher,
      sprite,
      close,
      mode,
      eyebrow,
      title,
      boundary,
      status,
      routeHeading,
      routeLabel,
      routeRole,
      routeSummary,
      queryForm,
      queryHeading,
      queryLabel,
      queryInput,
      queryHint,
      queryButton,
      result,
      resultHeading,
      resultAction,
      resultReason,
      resultAnswer,
      resultSourcesWrap,
      resultSourcesHeading,
      resultSources,
      resultReceipt,
      sources,
      sourcesHeading,
      sourceLinks,
      authority,
    });

    queryForm.addEventListener("submit", submitArchiveQuestion);
    launcher.addEventListener("click", () => {
      if (panel.hidden) openPanel();
      else closePanel();
    });
    close.addEventListener("click", () => closePanel());
    panel.addEventListener("pointermove", (event) => {
      const bounds = sprite.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const angle = (Math.atan2(event.clientX - centerX, centerY - event.clientY) * 180) / Math.PI;
      lookAtAngle(angle);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        event.preventDefault();
        closePanel();
      }
    });
    document.addEventListener("visibilitychange", startAnimation);
    reducedMotion.addEventListener?.("change", startAnimation);
    updateCopy();
    startAnimation();
  }

  async function loadAcceptedAsset() {
    try {
      const response = await fetch(MANIFEST_URL, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error(`Axiom manifest returned ${response.status}`);
      const value = await response.json();
      if (
        value.spriteVersionNumber !== 2 ||
        value.atlas?.columns !== 8 ||
        value.atlas?.rows !== 11 ||
        !value.spritesheetPath
      ) {
        throw new Error("Axiom manifest does not satisfy the v2 atlas contract");
      }
      await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = reject;
        image.src = value.spritesheetPath;
      });
      manifest = value;
      nodes.sprite.style.backgroundImage = `url("${value.spritesheetPath}")`;
      assetStatus = "ready";
      nodes.root.dataset.assetState = "ready";
      setState("idle", "ready-no-active-work");
    } catch (error) {
      assetStatus = "failed";
      nodes.root.dataset.assetState = "failed";
      nodes.root.dataset.assetError = error instanceof Error ? error.message : "accepted atlas unavailable";
      setState("failed", "accepted-atlas-failure");
    }
    updateCopy();
  }

  function boot() {
    if (document.querySelector("[data-axiom-agent]")) return;
    buildInterface();
    loadAcceptedAsset();
  }

  window.SemeAI_Axiom = Object.freeze({
    setState,
    lookAtAngle,
    getState: () => ({
      state: stateName,
      assetState: assetStatus,
      route: routeKey,
      orientation: nodes.root?.dataset.orientation || null,
    }),
  });
  window.addEventListener("semeai:lang", updateCopy);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
