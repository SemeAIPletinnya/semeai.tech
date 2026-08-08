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
  const SUPPORTED_ROUTES = new Set(["home", "genesis", "benchmark", "gate", "skills", "book", "research", "article", "roadmap"]);
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
    book: {
      label: { en: "Engineering Book", uk: "Інженерна книга", ru: "Инженерная книга" },
      role: { en: "Method", uk: "Метод", ru: "Метод" },
      summary: {
        en: "Architecture and release rationale",
        uk: "Архітектура й обґрунтування релізу",
        ru: "Архитектура и обоснование релиза",
      },
      sources: ["book", "gate", "benchmark"],
    },
    research: {
      label: { en: "Research", uk: "Дослідження", ru: "Исследования" },
      role: { en: "Boundary", uk: "Межа", ru: "Граница" },
      summary: {
        en: "Public evidence and claim limits",
        uk: "Публічні докази й межі тверджень",
        ru: "Публичные доказательства и границы утверждений",
      },
      sources: ["research", "book", "benchmark"],
    },
    article: {
      label: { en: "Article", uk: "Стаття", ru: "Статья" },
      role: { en: "Thesis", uk: "Теза", ru: "Тезис" },
      summary: {
        en: "Generation is not release authority",
        uk: "Генерація не є владою релізу",
        ru: "Генерация не является властью релиза",
      },
      sources: ["gate", "research", "book"],
    },
    roadmap: {
      label: { en: "Product Roadmap", uk: "Продуктова дорожня карта", ru: "Продуктовая дорожная карта" },
      role: { en: "Plan", uk: "План", ru: "План" },
      summary: {
        en: "Working, held, and future phases",
        uk: "Робочі, утримані й майбутні фази",
        ru: "Рабочие, удержанные и будущие фазы",
      },
      sources: ["gate", "skills", "benchmark"],
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
      launch: "Open Axiom",
      close: "Close Axiom",
      mode: "Public",
      eyebrow: "Axiom",
      title: "Ask about what you see.",
      boundary:
        "Answers appear only when release is allowed. Private archives stay closed.",
      route: "On this page",
      query: "Ask",
      queryLabel: "Your question",
      queryPlaceholder: "What changed here?",
      ask: "Ask",
      queryHint: "Short questions · public evidence only",
      result: "Answer",
      noEvidence: "Nothing matching was found in public evidence.",
      sourcesReturned: "Sources",
      decisionReceipt: "Receipt",
      sources: "Related pages",
      sourcesAria: "Related public pages",
      authority: "Release is decided separately from generation.",
      details: "Details",
      ready: "Ready",
      loading: "Loading…",
      failed: "Unavailable",
      queryWaiting: "Enter a question",
      queryRunning: "Looking…",
      gateShow: "Released",
      gateReview: "Held for review",
      gateBlock: "Withheld",
      queryNoEvidence: "No match",
      queryFailed: "Could not reach the archive",
    },
    uk: {
      launch: "Відкрити Axiom",
      close: "Закрити Axiom",
      mode: "Публічно",
      eyebrow: "Axiom",
      title: "Запитайте про те, що бачите.",
      boundary:
        "Відповідь з’явиться лише коли реліз дозволено. Приватні архіви закриті.",
      route: "На цій сторінці",
      query: "Запитати",
      queryLabel: "Ваше питання",
      queryPlaceholder: "Що змінилося тут?",
      ask: "Запитати",
      queryHint: "Короткі питання · лише публічні докази",
      result: "Відповідь",
      noEvidence: "У публічних доказах збігів немає.",
      sourcesReturned: "Джерела",
      decisionReceipt: "Квитанція",
      sources: "Пов’язані сторінки",
      sourcesAria: "Пов’язані публічні сторінки",
      authority: "Рішення про реліз окреме від генерації.",
      details: "Деталі",
      ready: "Готово",
      loading: "Завантаження…",
      failed: "Недоступно",
      queryWaiting: "Введіть питання",
      queryRunning: "Шукаємо…",
      gateShow: "Випущено",
      gateReview: "На перегляді",
      gateBlock: "Утримано",
      queryNoEvidence: "Без збігу",
      queryFailed: "Архів недоступний",
    },
    ru: {
      launch: "Открыть Axiom",
      close: "Закрыть Axiom",
      mode: "Публично",
      eyebrow: "Axiom",
      title: "Спросите о том, что видите.",
      boundary:
        "Ответ появится только когда релиз разрешён. Частные архивы закрыты.",
      route: "На этой странице",
      query: "Спросить",
      queryLabel: "Ваш вопрос",
      queryPlaceholder: "Что изменилось здесь?",
      ask: "Спросить",
      queryHint: "Короткие вопросы · только публичные доказательства",
      result: "Ответ",
      noEvidence: "В публичных доказательствах совпадений нет.",
      sourcesReturned: "Источники",
      decisionReceipt: "Квитанция",
      sources: "Связанные страницы",
      sourcesAria: "Связанные публичные страницы",
      authority: "Решение о релизе отдельно от генерации.",
      details: "Детали",
      ready: "Готово",
      loading: "Загрузка…",
      failed: "Недоступно",
      queryWaiting: "Введите вопрос",
      queryRunning: "Ищем…",
      gateShow: "Выпущено",
      gateReview: "На проверке",
      gateBlock: "Удержано",
      queryNoEvidence: "Без совпадения",
      queryFailed: "Архив недоступен",
    },
  });
  const GUIDED_COPY = Object.freeze({
    en: {
      cue: "New to release control? Ask Axiom using admitted public evidence.",
      cueAction: "Ask Axiom",
      prompts: "Suggested evidence questions",
      pilot: "Pilot scope is not in Axiom's evidence index. Request a Gate pilot →",
    },
    uk: {
      cue: "Вперше знайомитеся з контролем релізу? Запитайте Axiom на основі допущених публічних доказів.",
      cueAction: "Запитати Axiom",
      prompts: "Рекомендовані питання до доказів",
      pilot: "Обсяг пілоту не входить до evidence-індексу Axiom. Запросити пілот Gate →",
    },
    ru: {
      cue: "Впервые знакомитесь с контролем релиза? Спросите Axiom на основе допущенных публичных доказательств.",
      cueAction: "Спросить Axiom",
      prompts: "Рекомендуемые вопросы к доказательствам",
      pilot: "Объём пилота не входит в evidence-индекс Axiom. Запросить пилот Gate →",
    },
  });
  const PROMPTS = Object.freeze({
    home: {
      en: ["What does the Gate control?", "How does a decision receipt work?", "What does SemeAI not claim?"],
      uk: ["Що контролює Gate?", "Як працює квитанція рішення?", "Чого SemeAI не стверджує?"],
      ru: ["Что контролирует Gate?", "Как работает квитанция решения?", "Чего SemeAI не утверждает?"],
    },
    gate: {
      en: ["How do SHOW, REVIEW, and BLOCK map?", "What is withheld on BLOCK?", "Which receipt records the decision?"],
      uk: ["Як мапляться SHOW, REVIEW і BLOCK?", "Що утримується на BLOCK?", "Яка квитанція фіксує рішення?"],
      ru: ["Как сопоставляются SHOW, REVIEW и BLOCK?", "Что удерживается при BLOCK?", "Какая квитанция фиксирует решение?"],
    },
    benchmark: {
      en: ["What evidence does the Benchmark inspect?", "What does the score not prove?", "What receipt does the Benchmark create?"],
      uk: ["Які докази перевіряє Benchmark?", "Чого score не доводить?", "Яку квитанцію створює Benchmark?"],
      ru: ["Какие доказательства проверяет Benchmark?", "Чего score не доказывает?", "Какую квитанцию создаёт Benchmark?"],
    },
    genesis: {
      en: ["What chronology is admitted here?", "How is idea origin separated from implementation proof?", "What are the evidence limits?"],
      uk: ["Яка хронологія допущена тут?", "Як походження ідеї відокремлене від доказу реалізації?", "Які межі доказів?"],
      ru: ["Какая хронология допущена здесь?", "Как происхождение идеи отделено от доказательства реализации?", "Каковы границы доказательств?"],
    },
    book: {
      en: ["Why is generation not release authority?", "How are decision and execution receipts separated?", "What happens after SILENCE?"],
      uk: ["Чому генерація не є владою релізу?", "Як розділені квитанції рішення та виконання?", "Що відбувається після SILENCE?"],
      ru: ["Почему генерация не является властью релиза?", "Как разделены квитанции решения и исполнения?", "Что происходит после SILENCE?"],
    },
    research: {
      en: ["Which claims are bounded by public evidence?", "What does retrieval not prove?", "Where are the research limitations?"],
      uk: ["Які твердження обмежені публічними доказами?", "Чого retrieval не доводить?", "Де описані обмеження досліджень?"],
      ru: ["Какие утверждения ограничены публичными доказательствами?", "Чего retrieval не доказывает?", "Где описаны ограничения исследований?"],
    },
    article: {
      en: ["What is the article's release-control thesis?", "Why can fluent output still be withheld?", "Which public evidence supports the thesis?"],
      uk: ["Яка теза статті про контроль релізу?", "Чому переконливий результат може бути утриманий?", "Які публічні докази підтримують тезу?"],
      ru: ["Каков тезис статьи о контроле релиза?", "Почему убедительный результат может быть удержан?", "Какие публичные доказательства поддерживают тезис?"],
    },
    roadmap: {
      en: ["Which capabilities are working?", "Which capabilities are held?", "Does the roadmap prove implementation?"],
      uk: ["Які можливості працюють?", "Які можливості утримані?", "Чи доводить roadmap реалізацію?"],
      ru: ["Какие возможности работают?", "Какие возможности удержаны?", "Доказывает ли roadmap реализацию?"],
    },
    skills: {
      en: ["What is a candidate skill?", "What admits evidence here?", "Does metadata have release authority?"],
      uk: ["Що таке candidate skill?", "Що допускає докази тут?", "Чи мають метадані владу релізу?"],
      ru: ["Что такое candidate skill?", "Что допускает доказательства здесь?", "Имеют ли метаданные власть релиза?"],
    },
  });

  const path = (location.pathname || "/").toLowerCase();
  const routeKey = path === "/" || (path.endsWith("/index.html") && !path.includes("/genesis/") && !path.includes("/benchmark/") && !path.includes("/skills/") && !path.includes("/book/") && !path.includes("/roadmap/"))
    ? "home"
    : path.includes("/genesis/")
      ? "genesis"
      : path.includes("/benchmark/")
        ? "benchmark"
        : path.endsWith("/gate.html")
          ? "gate"
          : path.includes("/skills/")
            ? "skills"
            : path.includes("/book/")
              ? "book"
              : path.endsWith("/research.html")
                ? "research"
                : path.endsWith("/article.html")
                  ? "article"
                  : path.includes("/roadmap/")
                    ? "roadmap"
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
  let returnFocusTarget = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const nodes = {};
  let Presence = null;
  let presence = null;

  function ensurePresence() {
    if (presence) return presence;
    Presence = window.SemeAI_AxiomPresence || null;
    if (!Presence) return null;
    presence = Presence.createPresenceRuntime({ route: routeKey });
    presence.dispatch(Presence.EVENT_TYPES.ROUTE_ENTER, { route: routeKey });
    return presence;
  }

  function syncSemanticDom() {
    if (!nodes.root || !ensurePresence()) return;
    const semantic = presence.getSemanticState();
    const context = presence.getContext();
    nodes.root.dataset.semanticState = semantic;
    nodes.root.dataset.contextRoute = context.route || "";
    if (context.entity?.id) nodes.root.dataset.contextEntity = `${context.entity.type}:${context.entity.id}`;
    else delete nodes.root.dataset.contextEntity;
  }

  function dispatchPresence(type, payload) {
    if (!ensurePresence() || !type) return null;
    const result = presence.dispatch(type, payload || {});
    syncSemanticDom();
    return result;
  }

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
    if (stateName === "idle" || stateName === "waving") return copy.ready;
    if (stateName === "failed") return copy.failed;
    if (stateName === "running") return copy.queryRunning;
    if (stateName === "waiting") return copy.queryWaiting;
    if (stateName === "review") return copy.gateReview;
    return copy.ready;
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
    window.clearTimeout(greetingTimer);
    statusOverride = statusKey;
    setState(nextState, source);
  }

  function applyResultVisual(result) {
    const release = result?.release || {};
    if (ensurePresence()) {
      if (release.gateEvaluated !== true) {
        dispatchPresence(Presence.EVENT_TYPES.GATE_DECISION, { noEvidence: true, action: null });
        setOperationState("review", "queryNoEvidence", "retrieval-no-evidence");
      } else {
        dispatchPresence(Presence.EVENT_TYPES.GATE_DECISION, {
          action: release.action,
          receipt_id: release.decisionReceiptId || release.receipt_id || null,
        });
        if (release.action === "SHOW") {
          setOperationState("idle", "gateShow", "gate-show-proceed");
        } else if (release.action === "REVIEW") {
          setOperationState("review", "gateReview", "gate-review-needs-review");
        } else {
          setOperationState("review", "gateBlock", "gate-block-silence");
        }
      }
      syncSemanticDom();
      return;
    }
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
    const productAction =
      release.gateEvaluated !== true
        ? copy.queryNoEvidence
        : release.action === "SHOW"
          ? copy.gateShow
          : release.action === "REVIEW"
            ? copy.gateReview
            : copy.gateBlock;
    nodes.resultAction.textContent = productAction;
    nodes.resultAction.dataset.gateAction = String(release.action || "NONE");
    nodes.resultAction.dataset.internalDecision = String(release.internalDecision || "");
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
      const identity = createElement("small", { class: "axiom-agent__source-meta" }, String(index + 1).padStart(2, "0"));
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

    window.clearTimeout(greetingTimer);
    activeRequest?.controller.abort();
    const sequence = ++requestSequence;
    const controller = new AbortController();
    activeRequest = { controller, sequence };
    lastResult = null;
    nodes.result.hidden = true;
    nodes.root.removeAttribute("data-request-error");
    nodes.queryButton.disabled = true;
    nodes.queryInput.setAttribute("aria-busy", "true");
    dispatchPresence(Presence?.EVENT_TYPES.USER_QUESTION, {
      question,
      routeContext: routeKey,
    });
    setOperationState("running", "queryRunning", "public-archive-request");
    syncSemanticDom();
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
      dispatchPresence(Presence?.EVENT_TYPES.REQUEST_FAILED, {
        reasonClass: "archive-request",
      });
      setOperationState("failed", "queryFailed", "public-archive-request-failure");
      syncSemanticDom();
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
    const guided = GUIDED_COPY[language()];
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
    nodes.cueText.textContent = guided.cue;
    nodes.cueButton.textContent = guided.cueAction;
    nodes.promptsHeading.textContent = guided.prompts;
    nodes.pilotLink.textContent = guided.pilot;
    const prompts = PROMPTS[routeKey]?.[language()] || PROMPTS[routeKey]?.en || [];
    nodes.promptButtons.forEach((button, index) => {
      button.textContent = prompts[index] || "";
      button.hidden = !prompts[index];
    });
    if (nodes.detailsSummary) nodes.detailsSummary.textContent = copy.details || "Details";
    route.sources.forEach((sourceKey) => {
      const link = nodes.sourceLinks.get(sourceKey);
      if (link) link.textContent = translated(SOURCE_LINKS[sourceKey].label);
    });
    nodes.status.textContent = stateLabel();
    if (lastResult) renderResult(lastResult, { moveFocus: false });
  }

  function openPanel(event) {
    const trigger = event?.currentTarget;
    returnFocusTarget = trigger instanceof HTMLElement && trigger !== nodes.launcher ? trigger : nodes.launcher;
    nodes.cue.hidden = true;
    nodes.panel.hidden = false;
    nodes.launcher.setAttribute("aria-expanded", "true");
    nodes.root.dataset.open = "true";
    dispatchPresence(Presence?.EVENT_TYPES.PANEL_OPEN, {});
    if (lastResult) {
      applyResultVisual(lastResult);
    } else {
      setState("waving", "panel-open-greeting");
      window.clearTimeout(greetingTimer);
      greetingTimer = window.setTimeout(() => {
        if (stateName === "waving") setState("idle", "ready-no-active-work");
      }, 900);
    }
    window.requestAnimationFrame(() => nodes.close.focus());
  }

  function closePanel({ restoreFocus = true } = {}) {
    nodes.panel.hidden = true;
    nodes.launcher.setAttribute("aria-expanded", "false");
    delete nodes.root.dataset.open;
    dispatchPresence(Presence?.EVENT_TYPES.PANEL_CLOSE, {});
    window.clearTimeout(greetingTimer);
    if (lastResult) applyResultVisual(lastResult);
    else setState("idle", "ready-no-active-work");
    if (restoreFocus) (returnFocusTarget || nodes.launcher).focus();
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
    const cue = createElement("div", { class: "axiom-agent__cue" });
    const cueText = createElement("p");
    const cueButton = createElement("button", { type: "button" });
    cue.append(cueText, cueButton);

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
    const promptsHeading = createElement("p", { class: "axiom-agent__prompts-heading" });
    const prompts = createElement("div", { class: "axiom-agent__prompts" });
    const promptButtons = [0, 1, 2].map(() => createElement("button", { type: "button" }));
    promptButtons.forEach((button) => prompts.append(button));
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
    queryForm.append(queryHeading, promptsHeading, prompts, queryLabel, queryInput, queryFooter);

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
    const pilotLink = createElement("a", { class: "axiom-agent__pilot-link", href: "/#pilot" });
    const details = createElement("details", { class: "axiom-agent__details" });
    const detailsSummary = createElement("summary", { class: "axiom-agent__details-summary" });
    details.append(detailsSummary, sources, authority);
    panel.append(header, title, boundary, status, routeCard, queryForm, result, pilotLink, details);
    root.append(cue, panel, launcher);
    document.body.append(root);

    Object.assign(nodes, {
      root,
      cue,
      cueText,
      cueButton,
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
      promptsHeading,
      promptButtons,
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
      pilotLink,
      details,
      detailsSummary,
    });

    queryForm.addEventListener("submit", submitArchiveQuestion);
    promptButtons.forEach((button) => button.addEventListener("click", () => {
      queryInput.value = button.textContent;
      queryForm.requestSubmit();
    }));
    cueButton.addEventListener("click", openPanel);
    window.setTimeout(() => {
      if (nodes.panel?.hidden) nodes.cue.hidden = true;
    }, 10_000);
    launcher.addEventListener("click", (event) => {
      if (panel.hidden) openPanel(event);
      else closePanel();
    });
    close.addEventListener("click", () => closePanel());
    document.querySelectorAll("[data-open-axiom]").forEach((button) => button.addEventListener("click", openPanel));
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
      dispatchPresence(Presence?.EVENT_TYPES.ASSET_READY, {});
      setState("idle", "ready-no-active-work");
      syncSemanticDom();
    } catch (error) {
      assetStatus = "failed";
      nodes.root.dataset.assetState = "failed";
      nodes.root.dataset.assetError = error instanceof Error ? error.message : "accepted atlas unavailable";
      dispatchPresence(Presence?.EVENT_TYPES.ASSET_FAILED, {});
      setState("failed", "accepted-atlas-failure");
      syncSemanticDom();
    }
    updateCopy();
  }

  function boot() {
    if (document.querySelector("[data-axiom-agent]")) return;
    buildInterface();
    syncSemanticDom();
    loadAcceptedAsset();
  }

  function bootWhenReady() {
    if (window.SemeAI_AxiomPresence || !document.querySelector('script[src*="axiom-presence-register"]')) {
      boot();
      return;
    }
    const onReady = () => {
      window.clearTimeout(timer);
      boot();
    };
    window.addEventListener("semeai:axiom-presence-ready", onReady, { once: true });
    const timer = window.setTimeout(onReady, 1500);
  }

  window.SemeAI_Axiom = Object.freeze({
    setState,
    lookAtAngle,
    getState: () => ({
      state: stateName,
      assetState: assetStatus,
      route: routeKey,
      orientation: nodes.root?.dataset.orientation || null,
      semanticState: presence ? presence.getSemanticState() : null,
      context: presence ? presence.getContext() : null,
    }),
    getContext: () => (presence ? presence.getContext() : null),
    getSemanticState: () => (presence ? presence.getSemanticState() : null),
    dispatch: (type, payload) => dispatchPresence(type, payload),
  });
  window.addEventListener("semeai:lang", updateCopy);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootWhenReady);
  else bootWhenReady();
})();
