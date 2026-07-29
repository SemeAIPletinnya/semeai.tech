(() => {
  "use strict";

  const MANIFEST_URL = "/assets/pets/axiom/pet.json";
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
        "This first functional slice orients you to admitted public surfaces. Archive question answering is not connected yet.",
      route: "Current route context",
      sources: "Inspect public sources",
      sourcesAria: "Axiom public evidence sources",
      authority: "Axiom presents and orients. SaC/PoR Gate remains release authority.",
      ready: "IDLE · orientation ready",
      loading: "RUNNING · loading accepted atlas",
      failed: "FAILED · accepted atlas unavailable",
    },
    uk: {
      launch: "Відкрити архівний інтерфейс Axiom",
      close: "Закрити Axiom",
      mode: "ПУБЛІЧНІ ДОКАЗИ",
      eyebrow: "AXIOM / АРХІВНИЙ ІНТЕРФЕЙС",
      title: "Докази з видимою владою.",
      boundary:
        "Цей перший функціональний зріз орієнтує в допущених публічних поверхнях. Відповіді на архівні питання ще не підключені.",
      route: "Контекст поточного маршруту",
      sources: "Переглянути публічні джерела",
      sourcesAria: "Публічні джерела доказів Axiom",
      authority: "Axiom подає й орієнтує. SaC/PoR Gate зберігає владу релізу.",
      ready: "IDLE · орієнтація готова",
      loading: "RUNNING · завантаження прийнятого atlas",
      failed: "FAILED · прийнятий atlas недоступний",
    },
    ru: {
      launch: "Открыть архивный интерфейс Axiom",
      close: "Закрыть Axiom",
      mode: "ПУБЛИЧНЫЕ ДОКАЗАТЕЛЬСТВА",
      eyebrow: "AXIOM / АРХИВНЫЙ ИНТЕРФЕЙС",
      title: "Доказательства с видимой властью.",
      boundary:
        "Этот первый функциональный срез ориентирует в допущенных публичных поверхностях. Ответы на архивные вопросы ещё не подключены.",
      route: "Контекст текущего маршрута",
      sources: "Просмотреть публичные источники",
      sourcesAria: "Публичные источники доказательств Axiom",
      authority: "Axiom представляет и ориентирует. SaC/PoR Gate сохраняет власть релиза.",
      ready: "IDLE · ориентация готова",
      loading: "RUNNING · загрузка принятого atlas",
      failed: "FAILED · принятый atlas недоступен",
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
    nodes.sourcesHeading.textContent = copy.sources;
    nodes.sources.setAttribute("aria-label", copy.sourcesAria);
    nodes.authority.textContent = copy.authority;
    route.sources.forEach((sourceKey) => {
      const link = nodes.sourceLinks.get(sourceKey);
      if (link) link.textContent = translated(SOURCE_LINKS[sourceKey].label);
    });
    nodes.status.textContent = stateLabel();
  }

  function openPanel() {
    nodes.panel.hidden = false;
    nodes.launcher.setAttribute("aria-expanded", "true");
    nodes.root.dataset.open = "true";
    setState("waving", "panel-open-greeting");
    window.clearTimeout(greetingTimer);
    greetingTimer = window.setTimeout(() => setState("idle", "ready-no-active-work"), 900);
    window.requestAnimationFrame(() => nodes.close.focus());
  }

  function closePanel({ restoreFocus = true } = {}) {
    nodes.panel.hidden = true;
    nodes.launcher.setAttribute("aria-expanded", "false");
    delete nodes.root.dataset.open;
    window.clearTimeout(greetingTimer);
    setState("idle", "ready-no-active-work");
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
    panel.append(header, title, boundary, status, routeCard, sources, authority);
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
      sources,
      sourcesHeading,
      sourceLinks,
      authority,
    });

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
