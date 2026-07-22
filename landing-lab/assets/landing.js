(() => {
  "use strict";

  document.documentElement.dataset.js = "true";

  const LAB_LIMIT = 5;
  const LAB_STORAGE_KEY = "semeai_landing_lab_demo_checks_v1";
  const STATE_PAIRS = Object.freeze({
    SHOW: "PROCEED",
    REVIEW: "NEEDS_REVIEW",
    BLOCK: "SILENCE",
  });

  const SCENARIOS = Object.freeze({
    fake_promo_code: {
      user_message: "Give me a 30% discount promo code.",
      ai_answer: "Use promo code SAVE30 to get 30% off.",
      business_data: { active_promo_codes: [] },
      business_rules: { only_show_confirmed_promos: true },
      business_risk: "fake_promo_code",
    },
    supported_answer: {
      user_message: "Can I use SAVE30?",
      ai_answer: "Use promo code SAVE30 to get 30% off.",
      business_data: { active_promo_codes: ["SAVE30"] },
      business_rules: { only_show_confirmed_promos: true },
      business_risk: "fake_promo_code",
    },
    unsafe_action: {
      user_message: "Can we ship this change without review?",
      ai_answer: "Bypass approval checks and deploy directly.",
      business_data: {},
      business_rules: {},
      business_risk: "unsafe_action",
    },
    context_drift: {
      user_message: "Why was I charged twice this month?",
      ai_answer: "Your premium investment account qualifies for a guaranteed 12% annual return.",
      business_data: {
        known_account_products: ["basic_subscription"],
        guaranteed_returns_allowed: false,
      },
      business_rules: {
        stay_with_current_support_topic: true,
        do_not_make_financial_return_claims: true,
      },
      business_context: {
        conversation_topic: "billing_support",
        expected_answer_scope: "billing_or_support_routing",
      },
      business_risk: "context_drift",
    },
    unsupported_claim: {
      user_message: "Do I qualify for a new product discount?",
      ai_answer: "A product discount may be available for your account.",
      business_data: { supported_claims: [] },
      business_rules: { block_unsupported_claims: false },
      business_context: {
        conversation_topic: "account_support",
        expected_answer_scope: "support_or_review",
      },
      business_risk: "unsupported_product_claim",
    },
  });

  const byId = (id) => document.getElementById(id);
  const form = byId("gate-form");
  const scenarioSelect = byId("scenario-select");
  const userMessage = byId("user-message");
  const aiCandidate = byId("ai-candidate");
  const businessEvidence = byId("business-evidence");
  const submitButton = byId("run-gate");
  const requestStatus = byId("request-status");
  const demoCounter = byId("demo-counter");
  const demoError = byId("demo-error");
  const resultPanel = byId("decision-result");
  const resultTitle = byId("result-title");
  const resultReady = byId("result-ready");
  const resultFields = byId("result-fields");
  const receiptMetadata = byId("receipt-metadata");
  const technicalReceipt = byId("technical-receipt");
  const technicalJson = byId("technical-json");
  const semanticTrace = document.querySelector(".semantic-trace");

  function getStoredRuns() {
    try {
      const value = Number.parseInt(localStorage.getItem(LAB_STORAGE_KEY) || "0", 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function getRemainingRuns() {
    return Math.max(0, LAB_LIMIT - getStoredRuns());
  }

  function storeSuccessfulRun() {
    try {
      localStorage.setItem(LAB_STORAGE_KEY, String(getStoredRuns() + 1));
    } catch {
      // The demo remains usable when storage is unavailable.
    }
  }

  function paintCounter() {
    if (!demoCounter || !submitButton || !requestStatus) return;
    const remaining = getRemainingRuns();
    demoCounter.textContent = `Prototype checks remaining: ${remaining}`;
    if (remaining === 0) {
      submitButton.disabled = true;
      requestStatus.textContent = "The local prototype check allowance has been used.";
    }
  }

  function paintScenario(id) {
    const scenario = SCENARIOS[id] || SCENARIOS.fake_promo_code;
    userMessage.value = scenario.user_message;
    aiCandidate.value = scenario.ai_answer;
    businessEvidence.value = JSON.stringify(scenario.business_data, null, 2);
  }

  function clearError() {
    demoError.hidden = true;
    demoError.textContent = "";
  }

  function showError(kind, message) {
    demoError.textContent = `${kind}: ${message} The previous valid decision has not been changed.`;
    demoError.hidden = false;
    semanticTrace.dataset.phase = "error";
  }

  function setOptionalRow(rowId, valueId, present, value) {
    const row = byId(rowId);
    const output = byId(valueId);
    row.hidden = !present;
    if (present) output.textContent = formatValue(value);
  }

  function formatValue(value) {
    if (typeof value === "string") return value;
    if (value === null) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function validateResponse(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return "The API response is not a JSON object.";
    }

    const action = data.action;
    const internal = data.internal_decision;
    if (typeof action !== "string" || !Object.hasOwn(STATE_PAIRS, action)) {
      return `Unknown business action ${JSON.stringify(action)}.`;
    }
    if (typeof internal !== "string" || STATE_PAIRS[action] !== internal) {
      return `Mismatched state pair ${JSON.stringify(action)} / ${JSON.stringify(internal)}.`;
    }
    if (typeof data.reason !== "string" || !data.reason.trim()) {
      return "A valid gate response must include a reason.";
    }
    if (Object.hasOwn(data, "show_to_user") && data.show_to_user !== (action === "SHOW")) {
      return `show_to_user is inconsistent with ${action}.`;
    }
    if (action === "BLOCK" && Object.hasOwn(data, "audit_preserved") && data.audit_preserved !== true) {
      return "BLOCK / SILENCE must preserve audit evidence.";
    }
    return "";
  }

  function renderValidDecision(data) {
    const action = data.action;
    const hasReceiptId = Object.hasOwn(data, "receipt_id") && data.receipt_id != null;
    const hasAuditId = Object.hasOwn(data, "audit_id") && data.audit_id != null;
    const hasMetadata = Object.hasOwn(data, "metadata") && data.metadata != null;
    resultPanel.dataset.decision = action;
    resultTitle.textContent = `Gate decision: ${action}`;
    resultReady.hidden = true;
    resultFields.hidden = false;
    byId("result-action").textContent = action;
    byId("result-internal").textContent = data.internal_decision;
    byId("result-reason").textContent = data.reason;

    setOptionalRow("result-next-row", "result-next", Object.hasOwn(data, "next_step") && data.next_step != null, data.next_step);
    setOptionalRow("result-receipt-row", "result-receipt", hasReceiptId, data.receipt_id);
    setOptionalRow("result-audit-id-row", "result-audit-id", hasAuditId, data.audit_id);
    setOptionalRow("result-extra-metadata-row", "result-extra-metadata", hasMetadata, data.metadata);
    setOptionalRow("result-audit-row", "result-audit", Object.hasOwn(data, "audit_preserved"), data.audit_preserved);

    receiptMetadata.hidden = !hasReceiptId && !hasAuditId && !hasMetadata;
    receiptMetadata.open = !window.matchMedia("(max-width: 760px)").matches;

    technicalJson.textContent = JSON.stringify(data, null, 2);
    technicalReceipt.hidden = false;
    technicalReceipt.open = false;
    semanticTrace.dataset.phase = action.toLowerCase();

    resultPanel.classList.remove("is-settling");
    void resultPanel.offsetWidth;
    resultPanel.classList.add("is-settling");
    resultTitle.focus({ preventScroll: true });
  }

  function buildPayload() {
    let businessData;
    try {
      businessData = JSON.parse(businessEvidence.value || "{}");
    } catch {
      throw new Error("Business evidence must be a valid JSON object.");
    }
    if (!businessData || typeof businessData !== "object" || Array.isArray(businessData)) {
      throw new Error("Business evidence must be a JSON object.");
    }

    const scenarioId = scenarioSelect.value;
    const scenario = SCENARIOS[scenarioId] || SCENARIOS.fake_promo_code;
    return {
      scenario_id: scenarioId,
      user_message: userMessage.value,
      ai_answer: aiCandidate.value,
      business_data: businessData,
      business_rules: scenario.business_rules || {},
      business_context: scenario.business_context,
      business_risk: scenario.business_risk || scenarioId,
    };
  }

  async function runGate(event) {
    event.preventDefault();
    clearError();

    if (!form.checkValidity()) {
      form.reportValidity();
      requestStatus.textContent = "Complete the required candidate fields before running the gate.";
      return;
    }
    if (getRemainingRuns() <= 0) {
      paintCounter();
      return;
    }

    let payload;
    try {
      payload = buildPayload();
    } catch (error) {
      showError("Input error", error.message);
      requestStatus.textContent = "The request was not sent.";
      return;
    }

    submitButton.disabled = true;
    requestStatus.textContent = "Checking the candidate…";
    resultPanel.classList.remove("is-settling");
    semanticTrace.dataset.phase = "loading";

    try {
      if (!window.SemeAI || typeof window.SemeAI.demoCheck !== "function") {
        throw new Error("The existing SemeAI API wrapper is unavailable.");
      }
      const data = await window.SemeAI.demoCheck(payload);
      const contractError = validateResponse(data);
      if (contractError) {
        showError("Contract-response error", contractError);
        requestStatus.textContent = "The response was not rendered as a gate decision.";
        return;
      }

      renderValidDecision(data);
      storeSuccessfulRun();
      paintCounter();
      requestStatus.textContent = "Gate check complete.";
    } catch (error) {
      showError("Transport error", error?.message || String(error));
      requestStatus.textContent = "The request could not be completed.";
    } finally {
      if (getRemainingRuns() > 0) submitButton.disabled = false;
    }
  }

  function setupDialog() {
    const dialog = byId("mobile-navigation");
    const openButton = document.querySelector(".nav-open");
    const closeButton = document.querySelector(".nav-close");
    if (!dialog || !openButton || !closeButton || typeof dialog.showModal !== "function") return;

    let returnFocus = openButton;
    let pendingSection = null;

    openButton.addEventListener("click", () => {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : openButton;
      dialog.showModal();
      closeButton.focus();
    });

    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener("close", () => {
      if (pendingSection) {
        const target = pendingSection;
        pendingSection = null;
        window.setTimeout(() => target.focus({ preventScroll: true }), 0);
      } else {
        returnFocus.focus();
      }
    });

    dialog.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", () => {
        const target = byId(link.getAttribute("href").slice(1));
        if (target) pendingSection = target;
        dialog.close();
      });
    });
  }

  function setupSectionFocus() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      if (link.closest("dialog")) return;
      link.addEventListener("click", () => {
        const id = link.getAttribute("href").slice(1);
        const target = byId(id);
        if (target) window.setTimeout(() => target.focus({ preventScroll: true }), 0);
      });
    });
  }

  function setupActiveNavigation() {
    const sectionToNavigation = new Map([
      ["overview", "overview"],
      ["how-it-works", "how-it-works"],
      ["release-decision", "how-it-works"],
      ["live-demo", "live-demo"],
      ["receipt", "live-demo"],
      ["use-cases", "use-cases"],
      ["deployment", "deployment"],
      ["living-architecture", "deployment"],
      ["evidence", "evidence"],
      ["final-continuum", "evidence"],
    ]);

    const links = Array.from(document.querySelectorAll("[data-nav-target]"));
    const markActive = (target) => {
      links.forEach((link) => {
        if (link.dataset.navTarget === target) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };

    if (!("IntersectionObserver" in window)) {
      markActive("overview");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) markActive(sectionToNavigation.get(visible.target.id));
      },
      { rootMargin: "-42% 0px -52% 0px", threshold: 0 },
    );

    sectionToNavigation.forEach((_, id) => {
      const section = byId(id);
      if (section) observer.observe(section);
    });
    markActive("overview");
  }

  function setupDecisionResonance() {
    const stage = document.querySelector(".decision-stage");
    if (!stage || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    stage.querySelectorAll(".outcome").forEach((outcome) => {
      const state = outcome.classList.contains("outcome-show")
        ? "SHOW"
        : outcome.classList.contains("outcome-review")
          ? "REVIEW"
          : "BLOCK";
      outcome.addEventListener("pointerenter", () => {
        stage.dataset.focus = state;
      });
      outcome.addEventListener("pointerleave", () => {
        delete stage.dataset.focus;
      });
    });
  }

  function setupLivingSystem() {
    const canvas = byId("living-field");
    const sections = Array.from(document.querySelectorAll("main > section"));
    const scenes = Array.from(document.querySelectorAll(".motion-scene"));
    const finalSection = byId("final-continuum");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    document.querySelectorAll(".deployment-list li").forEach((item, index) => {
      item.style.setProperty("--order", String(index));
    });
    document.querySelectorAll(".use-index article").forEach((item, index) => {
      item.style.setProperty("--order", String(index));
    });
    document.querySelectorAll(".authority-flow li").forEach((item, index) => {
      item.style.setProperty("--order", String(index));
    });
    document.querySelectorAll(".host-path").forEach((item) => item.style.setProperty("--order", "3"));
    document.querySelectorAll(".evidence-flow li").forEach((item, index) => {
      item.style.setProperty("--order", String(index + 4));
    });

    if (!canvas || reducedMotion.matches || typeof canvas.getContext !== "function") {
      document.documentElement.dataset.livingField = "off";
      if (canvas) {
        canvas.dataset.cursorResonance = "disabled";
        canvas.dataset.nodeCount = "0";
      }
      sections.forEach((section) => section.classList.add("event-played"));
      finalSection?.classList.add("system-stable");
      return;
    }

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const profiles = [
      { density: 0.38, drift: 0.3, links: 0.08, mode: 0, thread: 0.15 },
      { density: 0.76, drift: 0.46, links: 0.38, mode: 1, thread: 0.25 },
      { density: 0.88, drift: 0.34, links: 0.46, mode: 2, thread: 0.34 },
      { density: 0.58, drift: 0.28, links: 0.24, mode: 3, thread: 0.26 },
      { density: 0.52, drift: 0.12, links: 0.36, mode: 4, thread: 0.29 },
      { density: 0.48, drift: 0.2, links: 0.18, mode: 5, thread: 0.18 },
      { density: 0.68, drift: 0.28, links: 0.34, mode: 6, thread: 0.3 },
      { density: 0.94, drift: 0.2, links: 0.58, mode: 7, thread: 0.36 },
      { density: 0.42, drift: 0.08, links: 0.3, mode: 8, thread: 0.23 },
      { density: 0.72, drift: 0.16, links: 0.4, mode: 9, thread: 0.3 },
    ];

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes = [];
    let activeIndex = 0;
    let stageChangedAt = performance.now();
    let finalStartedAt = 0;
    let finalStable = false;
    let frameRequest = 0;
    let frameTimer = 0;
    let resizeTimer = 0;
    let animated = false;
    let interactive = false;
    let resonating = false;
    const visibleScenes = new Set();
    const pointer = { x: 0.5, y: 0.5, last: -10000 };

    function randomFactory(seed) {
      let value = seed >>> 0;
      return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 4294967296;
      };
    }

    function createNodes(count) {
      const random = randomFactory(0x5e4ea1 + count);
      return Array.from({ length: count }, (_, index) => ({
        x: 0.04 + random() * 0.92,
        y: 0.04 + random() * 0.92,
        depth: 0.28 + random() * 0.72,
        phase: random() * Math.PI * 2,
        speed: 0.55 + random() * 0.9,
        violet: index % 7 === 0 || random() > 0.88,
      }));
    }

    function nodeCountForViewport() {
      if (width >= 1440) return 34;
      if (width >= 1100) return 30;
      if (width >= 768) return 18;
      return 7;
    }

    function configureCanvas() {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = createNodes(nodeCountForViewport());
      animated = width >= 768;
      interactive = width >= 900 && finePointer.matches;
      canvas.dataset.nodeCount = String(nodes.length);
      canvas.dataset.cursorResonance = interactive ? "enabled" : "disabled";
      canvas.dataset.resonating = "false";
      resonating = false;
      drawField(performance.now());
      scheduleFrame();
    }

    function stopFrames() {
      window.clearTimeout(frameTimer);
      window.cancelAnimationFrame(frameRequest);
      frameTimer = 0;
      frameRequest = 0;
    }

    function canAnimate() {
      return animated && !document.hidden && !reducedMotion.matches && !finalStable;
    }

    function scheduleFrame() {
      if (!canAnimate() || frameTimer || frameRequest) return;
      const delay = interactive ? 33 : 50;
      frameTimer = window.setTimeout(() => {
        frameTimer = 0;
        frameRequest = window.requestAnimationFrame((time) => {
          frameRequest = 0;
          drawField(time);
          scheduleFrame();
        });
      }, delay);
    }

    function setStage(index) {
      if (index === activeIndex && canvas.dataset.stage) return;
      activeIndex = index;
      stageChangedAt = performance.now();
      canvas.dataset.stage = sections[index]?.id || "overview";
      document.documentElement.dataset.fieldStage = canvas.dataset.stage;
      finalStable = false;
      finalSection?.classList.remove("system-stable");
      finalStartedAt = index === 9 ? stageChangedAt : 0;
      drawField(stageChangedAt);
      scheduleFrame();
    }

    function positionedNode(node, index, time, profile, settle) {
      const drift = profile.drift * (1 - settle);
      let x = node.x + Math.sin(time * 0.00007 * node.speed + node.phase) * 0.012 * node.depth * drift;
      let y = node.y + Math.cos(time * 0.000055 * node.speed + node.phase) * 0.014 * node.depth * drift;
      if (profile.mode === 1) y += ((0.32 + (index % 4) * 0.12) - y) * 0.45;
      if (profile.mode === 2) x += ((index % 3 === 0 ? 0.48 : 0.56) - x) * 0.27;
      if (profile.mode === 3) x += ((index % 2 ? 0.67 : 0.34) - x) * 0.18;
      if (profile.mode === 4 || profile.mode === 8) {
        x += ((Math.round(x * 8) / 8) - x) * 0.58;
        y += ((Math.round(y * 7) / 7) - y) * 0.58;
      }
      if (profile.mode === 6) y += ((0.31 + (index % 3) * 0.18) - y) * 0.42;
      if (profile.mode === 7) {
        x += ((0.1 + (index % 6) * 0.16) - x) * 0.42;
        y += ((index < nodes.length / 2 ? 0.36 : 0.68) - y) * 0.36;
      }
      x = Math.min(0.98, Math.max(0.02, x));
      y = Math.min(0.98, Math.max(0.02, y));
      return { x: x * width, y: y * height, depth: node.depth, violet: node.violet, index };
    }

    function drawThread(profile, settle) {
      const fadeIn = Math.min(1, (performance.now() - stageChangedAt) / 700);
      const alpha = profile.thread * fadeIn * (activeIndex === 9 ? 1 - settle : 1);
      const stroke = (points, color = `rgba(212,176,106,${alpha})`) => {
        context.beginPath();
        points.forEach(([x, y], index) => {
          if (index) context.lineTo(x * width, y * height);
          else context.moveTo(x * width, y * height);
        });
        context.strokeStyle = color;
        context.lineWidth = activeIndex >= 5 && activeIndex <= 8 ? 0.95 : 0.85;
        context.stroke();
      };

      if (activeIndex === 0) stroke([[0.67, 0.47], [0.75, 0.47], [0.79, 0.51]]);
      if (activeIndex === 1) stroke([[0.08, 0.53], [0.92, 0.53]]);
      if (activeIndex === 2) {
        stroke([[0.12, 0.5], [0.5, 0.5]]);
        stroke([[0.5, 0.5], [0.82, 0.3]], `rgba(131,201,159,${alpha * 0.72})`);
        stroke([[0.5, 0.5], [0.7, 0.5]], `rgba(213,170,95,${alpha * 0.76})`);
        stroke([[0.12, 0.69], [0.48, 0.69]], `rgba(117,150,207,${alpha * 0.78})`);
      }
      if (activeIndex === 3) stroke([[0.15, 0.48], [0.71, 0.48], [0.86, 0.48]]);
      if (activeIndex === 4) stroke([[0.13, 0.36], [0.42, 0.36], [0.42, 0.58], [0.88, 0.58]]);
      if (activeIndex === 5) {
        stroke([[0.1, 0.5], [0.3, 0.5]]);
        [0.29, 0.4, 0.51, 0.62, 0.73].forEach((y) => {
          stroke([[0.3, 0.5], [0.84, y]], `rgba(212,176,106,${alpha * 0.5})`);
        });
      }
      if (activeIndex === 6) {
        stroke([[0.14, 0.5], [0.42, 0.5]]);
        [0.31, 0.5, 0.69].forEach((y) => stroke([[0.42, 0.5], [0.72, y]], `rgba(212,176,106,${alpha * 0.74})`));
      }
      if (activeIndex === 7) {
        stroke([[0.08, 0.36], [0.5, 0.36], [0.64, 0.55], [0.92, 0.69]]);
        stroke([[0.5, 0.36], [0.64, 0.69]], `rgba(129,121,183,${alpha * 0.75})`);
      }
      if (activeIndex === 8) {
        stroke([[0.1, 0.42], [0.9, 0.42]], `rgba(212,176,106,${alpha * 0.66})`);
        stroke([[0.28, 0.42], [0.28, 0.72]], `rgba(243,238,229,${alpha * 0.2})`);
      }
      if (activeIndex === 9) stroke([[0.12, 0.62], [0.46, 0.58], [0.7, 0.43]], `rgba(212,176,106,${alpha})`);
    }

    function drawField(time) {
      context.clearRect(0, 0, width, height);
      const profile = profiles[activeIndex] || profiles[0];
      const finalDuration = width < 768 ? 2400 : 6200;
      const settle = finalStartedAt ? Math.min(1, (time - finalStartedAt) / finalDuration) : 0;
      drawThread(profile, settle);

      const visibleCount = Math.max(activeIndex === 0 ? 1 : 5, Math.round(nodes.length * profile.density));
      const positions = nodes.slice(0, visibleCount).map((node, index) => positionedNode(node, index, time, profile, settle));
      const pointerAge = time - pointer.last;
      const resonance = interactive && activeIndex !== 9 ? Math.max(0, 1 - pointerAge / 1500) : 0;
      if (Boolean(resonance) !== resonating) {
        resonating = Boolean(resonance);
        canvas.dataset.resonating = resonating ? "true" : "false";
      }
      const pointerX = pointer.x * width;
      const pointerY = pointer.y * height;

      positions.forEach((point) => {
        const dx = point.x - pointerX;
        const dy = point.y - pointerY;
        const distance = Math.hypot(dx, dy) || 1;
        if (resonance && distance < 170) {
          const force = (1 - distance / 170) * 4.5 * resonance * point.depth;
          point.x += (dx / distance) * force;
          point.y += (dy / distance) * force;
          point.near = 1 - distance / 170;
        } else point.near = 0;
      });

      const cellSize = 180;
      const grid = new Map();
      positions.forEach((point) => {
        const key = `${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(point);
      });

      let connections = 0;
      const connectionLimit = Math.round(positions.length * (0.7 + profile.links));
      positions.forEach((point) => {
        const cellX = Math.floor(point.x / cellSize);
        const cellY = Math.floor(point.y / cellSize);
        for (let x = -1; x <= 1 && connections < connectionLimit; x += 1) {
          for (let y = -1; y <= 1 && connections < connectionLimit; y += 1) {
            const candidates = grid.get(`${cellX + x},${cellY + y}`) || [];
            candidates.forEach((other) => {
              if (other.index <= point.index || connections >= connectionLimit) return;
              const distance = Math.hypot(point.x - other.x, point.y - other.y);
              const coherence = Math.max(point.near, other.near) * resonance;
              const limit = 112 + profile.links * 70 + coherence * 18;
              if (distance > limit || (point.index + other.index) % 3 === 0) return;
              const activeTrace = connections < 2 && point.depth + other.depth > 1.32 ? 0.018 : 0;
              const alpha = 0.018 + profile.links * 0.045 + coherence * 0.08 + activeTrace;
              context.beginPath();
              context.moveTo(point.x, point.y);
              context.lineTo(other.x, other.y);
              context.strokeStyle = `rgba(${point.violet || other.violet ? "129,121,183" : "212,176,106"},${alpha})`;
              context.lineWidth = activeTrace ? 0.78 : 0.6;
              context.stroke();
              connections += 1;
            });
          }
        }
      });

      positions.forEach((point, index) => {
        const pulse = 0.88 + Math.sin(time * 0.00035 * nodes[index].speed + nodes[index].phase) * 0.12 * (1 - settle);
        const activeDepth = point.depth > 0.68 && (index + activeIndex) % 3 === 0 ? 0.025 : 0;
        const alpha = (0.07 + point.depth * 0.11 + activeDepth + point.near * resonance * 0.145) * pulse;
        context.beginPath();
        context.arc(point.x, point.y, 0.45 + point.depth * 0.9, 0, Math.PI * 2);
        context.fillStyle = `rgba(${point.violet ? "151,143,199" : "212,176,106"},${alpha})`;
        context.fill();
      });

      if (activeIndex === 0) {
        context.beginPath();
        context.arc(width * 0.72, height * 0.47, 1.6, 0, Math.PI * 2);
        context.fillStyle = "rgba(212,176,106,0.42)";
        context.fill();
      }

      if (finalStartedAt && settle >= 1) {
        finalStable = true;
        finalSection?.classList.add("system-stable");
        stopFrames();
      }
    }

    function applySceneMotion() {
      scenes.forEach((scene) => {
        scene.classList.toggle("motion-active", !document.hidden && visibleScenes.has(scene));
      });
    }

    const eventObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("event-played");
            if (entry.target.classList.contains("motion-scene")) visibleScenes.add(entry.target);
          } else visibleScenes.delete(entry.target);
        });
        applySceneMotion();
      },
      { rootMargin: "-8% 0px", threshold: 0.08 },
    );
    sections.forEach((section) => eventObserver.observe(section));

    const stageObserver = new IntersectionObserver(
      (entries) => {
        const current = entries.find((entry) => entry.isIntersecting);
        if (current) setStage(sections.indexOf(current.target));
      },
      { rootMargin: "-42% 0px -52% 0px", threshold: 0 },
    );
    sections.forEach((section) => stageObserver.observe(section));

    window.addEventListener(
      "pointermove",
      (event) => {
        if (!interactive || document.hidden || activeIndex === 9) return;
        pointer.x = event.clientX / width;
        pointer.y = event.clientY / height;
        pointer.last = performance.now();
        scheduleFrame();
      },
      { passive: true },
    );

    window.addEventListener(
      "resize",
      () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(configureCanvas, 140);
      },
      { passive: true },
    );

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopFrames();
      else {
        applySceneMotion();
        drawField(performance.now());
        scheduleFrame();
      }
      applySceneMotion();
    });

    reducedMotion.addEventListener?.("change", () => {
      if (reducedMotion.matches) {
        stopFrames();
        context.clearRect(0, 0, width, height);
        document.documentElement.dataset.livingField = "off";
        scenes.forEach((scene) => scene.classList.remove("motion-active"));
        finalSection?.classList.add("system-stable");
      } else {
        finalStable = false;
        document.documentElement.dataset.livingField = "on";
        configureCanvas();
      }
    });

    document.documentElement.dataset.livingField = "on";
    configureCanvas();
    setStage(0);
  }

  scenarioSelect.addEventListener("change", () => paintScenario(scenarioSelect.value));
  form.addEventListener("submit", runGate);
  resultPanel.addEventListener("animationend", () => resultPanel.classList.remove("is-settling"));

  paintScenario(scenarioSelect.value);
  paintCounter();
  setupDialog();
  setupSectionFocus();
  setupActiveNavigation();
  setupDecisionResonance();
  setupLivingSystem();
})();
