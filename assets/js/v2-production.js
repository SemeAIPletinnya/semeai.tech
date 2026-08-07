(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = window.matchMedia("(pointer: coarse)");
  const body = document.body;
  const route = body.dataset.v2Route || "";
  const majorRoutes = new Set([
    "/",
    "/index.html",
    "/gate.html",
    "/benchmark/",
    "/benchmark/index.html",
    "/genesis/",
    "/genesis/index.html",
    "/research.html",
    "/book/",
    "/book/index.html",
    "/roadmap/",
    "/roadmap/index.html",
    "/skills/",
    "/skills/index.html",
    "/pilots/support.html",
  ]);
  const motionTimers = new Set();

  document.documentElement.dataset.motion = reduced.matches ? "reduced" : "full";
  body.dataset.motionWorld = route;

  function after(delay, callback) {
    if (reduced.matches) {
      callback();
      return 0;
    }
    const timer = window.setTimeout(() => {
      motionTimers.delete(timer);
      callback();
    }, delay);
    motionTimers.add(timer);
    return timer;
  }

  function clearTimers() {
    motionTimers.forEach((timer) => clearTimeout(timer));
    motionTimers.clear();
  }

  function initArrival() {
    try {
      const arrival = JSON.parse(sessionStorage.getItem("semeai:v2-arrival") || "null");
      sessionStorage.removeItem("semeai:v2-arrival");
      if (arrival && arrival.path === location.pathname && Date.now() - arrival.at < 3000 && !reduced.matches) {
        document.documentElement.dataset.routeArrival = "true";
        after(760, () => delete document.documentElement.dataset.routeArrival);
      }
    } catch (_) {
      /* Route continuity is progressive enhancement. */
    }
  }

  function initReveal() {
    const nodes = [...document.querySelectorAll("[data-v2-reveal]")];
    if (!nodes.length) return;
    nodes.forEach((node, index) => node.style.setProperty("--v2-reveal-index", String(index)));
    if (reduced.matches || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => { node.dataset.revealed = "true"; });
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.dataset.revealed = "true";
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6%" });
    nodes.forEach((node) => observer.observe(node));
  }

  function initTransitions() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link || reduced.matches || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const destination = new URL(link.href, location.href);
      const sameDocument = destination.pathname === location.pathname && destination.search === location.search;
      if (destination.origin !== location.origin || sameDocument || !majorRoutes.has(destination.pathname)) return;
      event.preventDefault();
      body.dataset.leaving = "true";
      try {
        sessionStorage.setItem("semeai:v2-arrival", JSON.stringify({ path: destination.pathname, at: Date.now(), from: route }));
      } catch (_) {
        /* Navigation remains functional when storage is unavailable. */
      }
      window.setTimeout(() => location.assign(destination.href), 230);
    });
  }

  function initParallax() {
    if (reduced.matches || coarse.matches) return;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let frame = 0;

    const settle = () => {
      currentX += (targetX - currentX) * .075;
      currentY += (targetY - currentY) * .075;
      document.documentElement.style.setProperty("--v2-depth-x", `${currentX.toFixed(2)}px`);
      document.documentElement.style.setProperty("--v2-depth-y", `${currentY.toFixed(2)}px`);
      if (Math.abs(targetX - currentX) > .05 || Math.abs(targetY - currentY) > .05) frame = requestAnimationFrame(settle);
      else frame = 0;
    };

    addEventListener("pointermove", (event) => {
      targetX = (event.clientX / innerWidth - .5) * 10;
      targetY = (event.clientY / innerHeight - .5) * 8;
      if (!frame) frame = requestAnimationFrame(settle);
    }, { passive: true });
    addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
      if (!frame) frame = requestAnimationFrame(settle);
    }, { passive: true });
    addEventListener("pagehide", () => cancelAnimationFrame(frame), { once: true });
  }

  function initField() {
    const field = document.querySelector("[data-field-scene]");
    if (!field) return;
    field.insertAdjacentHTML("afterbegin", `
      <svg class="field-topology" viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true">
        <path class="field-topology__grid" d="M70 118H520M70 214H520M70 310H520M70 406H520M70 502H520M115 74V558M245 74V558M375 74V558M505 74V558" />
        <path class="field-topology__candidate" d="M82 458C180 458 176 178 295 178S384 358 492 358" />
        <path class="field-topology__candidate" d="M84 246C192 246 201 392 306 392S410 258 492 258" />
        <path class="field-topology__candidate" d="M118 518C228 518 246 490 324 472S405 438 492 438" />
        <path class="field-topology__authority" d="M525 76V558M546 110V524" />
        <path class="field-topology__authority" d="M582 320H906" />
        <circle class="field-topology__node" cx="295" cy="178" r="3" />
        <circle class="field-topology__node" cx="306" cy="392" r="3" />
        <circle class="field-topology__node" cx="324" cy="472" r="3" />
      </svg>`);
    const triggers = document.querySelectorAll("a[href^='/gate.html']");
    triggers.forEach((trigger) => {
      trigger.addEventListener("pointerenter", () => { field.dataset.fieldMotion = "tension"; });
      trigger.addEventListener("pointerleave", () => { field.dataset.fieldMotion = "ambient"; });
      trigger.addEventListener("focus", () => { field.dataset.fieldMotion = "tension"; });
      trigger.addEventListener("blur", () => { field.dataset.fieldMotion = "ambient"; });
    });
  }

  function initCanvas() {
    if (reduced.matches || !["field", "gate", "lab", "genesis"].includes(route)) return;
    let canvas = document.querySelector("[data-v2-canvas]");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "world-canvas";
      canvas.dataset.v2Canvas = "";
      canvas.setAttribute("aria-hidden", "true");
      body.prepend(canvas);
    }
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let lastDraw = 0;
    let stopped = false;
    const count = coarse.matches ? 14 : 28;
    const nodes = Array.from({ length: count }, (_, index) => ({
      x: ((index * 47) % 101) / 100,
      y: ((index * 73) % 97) / 96,
      speed: .000011 + (index % 5) * .0000022,
      phase: index * .71,
      size: .65 + (index % 4) * .36,
    }));
    let evidenceRatios = [];

    function refreshEvidence() {
      evidenceRatios = [...document.querySelectorAll("#benchmark-result .category-card")].map((card) => {
        const raw = card.dataset.score || card.textContent || "";
        const fraction = raw.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
        if (fraction) return Math.max(0, Math.min(1, Number(fraction[1]) / Math.max(1, Number(fraction[2]))));
        const percent = raw.match(/(\d+(?:\.\d+)?)\s*%/);
        return percent ? Math.max(0, Math.min(1, Number(percent[1]) / 100)) : .5;
      });
    }

    function resize() {
      const scale = Math.min(devicePixelRatio || 1, 1.5);
      width = innerWidth;
      height = innerHeight;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(scale, 0, 0, scale, 0, 0);
    }

    function curve(x1, y1, x2, y2, color, phase) {
      context.beginPath();
      context.moveTo(x1, y1);
      const bend = Math.sin(phase) * height * .035;
      context.bezierCurveTo(x1 + (x2 - x1) * .42, y1 + bend, x1 + (x2 - x1) * .66, y2 - bend, x2, y2);
      context.strokeStyle = color;
      context.lineWidth = .75;
      context.stroke();
    }

    function drawField(now) {
      const boundary = width * .62;
      // Soft depth veil behind the authority boundary.
      const veil = context.createLinearGradient(boundary - 80, 0, boundary + 120, 0);
      veil.addColorStop(0, "rgba(114,227,250,0)");
      veil.addColorStop(0.55, "rgba(114,227,250,.03)");
      veil.addColorStop(0.75, "rgba(239,195,118,.045)");
      veil.addColorStop(1, "rgba(239,195,118,0)");
      context.fillStyle = veil;
      context.fillRect(boundary - 80, height * .06, 200, height * .88);
      [0.18, 0.32, 0.46, 0.6, 0.74].forEach((y, index) => {
        curve(width * .02, height * y, boundary - 18, height * (y + Math.sin(now * .0002 + index) * .04), "rgba(114,227,250,.11)", now * .00025 + index);
      });
      context.fillStyle = "rgba(239,195,118,.22)";
      context.fillRect(boundary, height * .08, .9, height * .84);
      context.fillStyle = "rgba(239,195,118,.06)";
      context.fillRect(boundary + 4, height * .1, 1.2, height * .8);
      nodes.forEach((node, index) => {
        const progress = (now * node.speed + node.x) % 1;
        const eased = 1 - Math.pow(1 - progress, 2.6);
        const x = width * .04 + eased * (boundary - width * .07);
        const y = node.y * height + Math.sin(now * .00017 + node.phase) * 12;
        // Candidate weight gathers near the boundary; authority does not move.
        const near = Math.max(0, 1 - Math.abs((Math.min(x, boundary - 5) / boundary) - 0.92) * 4);
        context.beginPath();
        context.fillStyle = index % 6 === 0
          ? `rgba(239,195,118,${0.22 + near * 0.18})`
          : `rgba(114,227,250,${0.16 + near * 0.2})`;
        context.arc(Math.min(x, boundary - 5), y, node.size + near * 0.8, 0, Math.PI * 2);
        context.fill();
      });
    }

    function drawGate(now) {
      const state = body.dataset.gateState || "idle";
      const color = state === "review" ? "239,195,118" : ["block", "error"].includes(state) ? "255,118,95" : "114,227,250";
      const axis = width * .5;
      const centerY = height * .43;
      const radius = Math.min(width, height) * .18;
      context.strokeStyle = `rgba(${color},.11)`;
      context.lineWidth = .7;
      for (let ring = 1; ring <= 4; ring += 1) {
        context.beginPath();
        context.ellipse(axis, centerY, radius * ring * .56, radius * ring * .23, now * .000012 * (ring % 2 ? 1 : -1), 0, Math.PI * 2);
        context.stroke();
      }
      nodes.slice(0, 14).forEach((node, index) => {
        let progress = (now * node.speed * 1.2 + node.x) % 1;
        let x = width * .04 + progress * width * .9;
        if (state === "review") x = axis - 42 + Math.sin(now * .0007 + node.phase) * 40;
        if (state === "block" || state === "error") x = Math.min(x, axis - 20 - index % 4 * 5);
        if (state !== "show") x = Math.min(x, axis - 7);
        const y = centerY + Math.sin(now * .00024 + node.phase) * radius * .75;
        context.beginPath();
        context.fillStyle = `rgba(${color},${state === "idle" ? .1 : .24})`;
        context.arc(x, y, node.size, 0, Math.PI * 2);
        context.fill();
      });
    }

    function drawLab(now) {
      const columns = Math.max(7, evidenceRatios.length || 7);
      context.strokeStyle = "rgba(185,160,255,.065)";
      context.lineWidth = .65;
      for (let x = 0; x < width; x += 72) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
      }
      for (let y = 0; y < height; y += 72) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
      }
      const baseline = height * .78;
      for (let index = 0; index < columns; index += 1) {
        const ratio = evidenceRatios[index] ?? .26 + (index % 4) * .12;
        const x = width * (.12 + index * (.76 / Math.max(1, columns - 1)));
        const bar = height * .34 * ratio;
        context.fillStyle = "rgba(114,227,250,.07)";
        context.fillRect(x - 1, baseline - bar, 2, bar);
        context.beginPath();
        context.fillStyle = "rgba(114,227,250,.3)";
        context.arc(x, baseline - bar + Math.sin(now * .0003 + index) * 3, 1.5, 0, Math.PI * 2);
        context.fill();
      }
    }

    function drawGenesis(now) {
      const active = Number(body.style.getPropertyValue("--genesis-active") || 0);
      const strata = 12;
      for (let index = 0; index < strata; index += 1) {
        const y = height * (.08 + index * .075) - (active % 1) * height * .02;
        const distance = Math.abs(index - active);
        context.beginPath();
        context.moveTo(width * .04, y);
        context.bezierCurveTo(width * .3, y + Math.sin(index + now * .00005) * 5, width * .68, y - Math.cos(index + now * .00004) * 7, width * .96, y);
        context.strokeStyle = index <= active ? `rgba(239,195,118,${Math.max(.035, .18 - distance * .018)})` : "rgba(114,227,250,.045)";
        context.lineWidth = index === Math.round(active) ? 1.2 : .65;
        context.stroke();
      }
    }

    function render(now) {
      if (stopped) return;
      frame = requestAnimationFrame(render);
      if (document.hidden || now - lastDraw < 33) return;
      lastDraw = now;
      context.clearRect(0, 0, width, height);
      if (route === "field") drawField(now);
      else if (route === "gate") drawGate(now);
      else if (route === "lab") drawLab(now);
      else if (route === "genesis") drawGenesis(now);
    }

    resize();
    refreshEvidence();
    addEventListener("resize", resize, { passive: true });
    window.addEventListener("semeai:evidence-visible", refreshEvidence);
    frame = requestAnimationFrame(render);
    addEventListener("pagehide", () => {
      stopped = true;
      cancelAnimationFrame(frame);
    }, { once: true });
  }

  function animateGate(rawAction) {
    const gate = document.getElementById("live-gate");
    if (!gate) return;
    const action = String(rawAction || "ERROR").toUpperCase();
    const steps = [...gate.querySelectorAll("[data-machine-step]")];
    gateTimers.forEach((timer) => clearTimeout(timer));
    gateTimers = [];
    steps.forEach((step) => step.classList.remove("is-active"));
    body.dataset.gateState = action.toLowerCase();
    gate.dataset.motionPhase = action === "IDLE" ? "idle" : "candidate";
    if (action === "IDLE") return;

    const activate = (index, phase) => {
      steps[index]?.classList.add("is-active");
      gate.dataset.motionPhase = phase;
    };
    activate(0, "candidate");
    gateAfter(120, () => activate(1, "binding"));
    gateAfter(290, () => activate(2, "authority"));
    if (action === "WORKING") return;
    gateAfter(460, () => activate(3, "decision"));
    gateAfter(560, () => activate(4, "receipt"));
    gateAfter(920, () => { gate.dataset.motionPhase = "settled"; });
  }

  let gateTimers = [];

  function gateAfter(delay, callback) {
    if (reduced.matches) {
      callback();
      return;
    }
    const timer = window.setTimeout(callback, delay);
    gateTimers.push(timer);
  }

  function initGate() {
    if (route !== "gate") return;
    const semanticByAction = Object.freeze({
      WORKING: "WORKING",
      SHOW: "RESULT",
      REVIEW: "REVIEW",
      BLOCK: "HELD",
      ERROR: "ERROR",
    });
    let pendingWitness = null;

    function flushWitness() {
      if (!pendingWitness) return;
      const axiom = window.SemeAI_Axiom;
      const root = document.querySelector("[data-axiom-agent]");
      if (!axiom?.dispatch || root?.dataset.semanticState === pendingWitness.expected) return;
      axiom.dispatch(pendingWitness.type, pendingWitness.payload);
    }

    function witness(type, payload, action) {
      pendingWitness = { type, payload, expected: semanticByAction[action] || "ERROR" };
      flushWitness();
    }

    new MutationObserver(flushWitness).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-asset-state", "data-semantic-state"],
      childList: true,
      subtree: true,
    });
    window.addEventListener("semeai:axiom-presence-ready", flushWitness);

    window.addEventListener("semeai:gate-decision", (event) => {
      const action = String(event.detail?.action || "ERROR").toUpperCase();
      animateGate(action);
      if (action === "WORKING") witness("TASK_STARTED", { source: "public-gate" }, action);
      else if (action === "ERROR") witness("REQUEST_FAILED", { source: "public-gate" }, action);
      else witness("GATE_DECISION", { action, receipt_id: event.detail?.receiptId || null }, action);
      window.dispatchEvent(new CustomEvent("semeai:axiom-context", {
        detail: { source: "gate", state: action === "WORKING" ? "WORKING" : "RESULT", decision: action },
      }));
    });
    animateGate("IDLE");
  }

  function initBenchmarkWorld() {
    const result = document.getElementById("benchmark-result");
    const blocked = document.getElementById("blocked-result");
    if (!result || !blocked) return;
    body.dataset.v2Route = "lab";
    let evidenceTimers = [];

    function clearEvidenceTimers() {
      evidenceTimers.forEach((timer) => clearTimeout(timer));
      evidenceTimers = [];
    }

    function presentEvidence() {
      clearEvidenceTimers();
      result.querySelectorAll(".category-card").forEach((card, index) => {
        card.style.setProperty("--arrival-index", index);
        const raw = card.dataset.score || card.textContent || "";
        const fraction = raw.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
        const ratio = fraction ? Number(fraction[1]) / Math.max(1, Number(fraction[2])) : .5;
        card.style.setProperty("--evidence-ratio", String(Math.max(0, Math.min(1, ratio))));
      });
      result.querySelectorAll(".ledger-grid > *").forEach((item, index) => item.style.setProperty("--ledger-index", index));
      window.dispatchEvent(new CustomEvent("semeai:evidence-visible"));
      const phases = reduced.matches
        ? [[0, "settled"]]
        : [[0, "source"], [180, "score"], [510, "categories"], [920, "ledger"], [1320, "receipt"], [1750, "settled"]];
      phases.forEach(([delay, phase]) => {
        const timer = window.setTimeout(() => { body.dataset.evidencePhase = phase; }, delay);
        evidenceTimers.push(timer);
      });
    }

    function sync() {
      const state = !result.hidden ? (result.dataset.gate || "show").toLowerCase() : !blocked.hidden ? "block" : "idle";
      body.dataset.evidenceState = state;
      if (!result.hidden) presentEvidence();
      else {
        clearEvidenceTimers();
        body.dataset.evidencePhase = state === "block" ? "held" : "idle";
      }
    }

    new MutationObserver(sync).observe(result, { attributes: true, attributeFilter: ["hidden", "data-gate"] });
    new MutationObserver(sync).observe(blocked, { attributes: true, attributeFilter: ["hidden", "data-gate"] });
    addEventListener("pagehide", clearEvidenceTimers, { once: true });
    sync();
  }

  function initGenesisWorld() {
    if (!body.classList.contains("genesis-v04")) return;
    body.dataset.v2Route = "genesis";
    const eras = [...document.querySelectorAll("[data-era]")];
    const stages = [...document.querySelectorAll("[data-trace-stage]")];
    if (!eras.length) return;
    let scheduled = false;

    eras.forEach((era, index) => {
      era.style.setProperty("--stratum-index", index);
      era.dataset.stratumState = index === 0 ? "active" : "future";
    });

    function updateDepth() {
      scheduled = false;
      const viewportAnchor = innerHeight * .46;
      let activeIndex = 0;
      let nearest = Infinity;
      eras.forEach((era, index) => {
        const bounds = era.getBoundingClientRect();
        const distance = Math.abs(bounds.top + bounds.height * .28 - viewportAnchor);
        if (distance < nearest) {
          nearest = distance;
          activeIndex = index;
        }
      });
      const documentRange = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const depth = Math.max(0, Math.min(1, scrollY / documentRange));
      body.style.setProperty("--genesis-depth", depth.toFixed(4));
      body.style.setProperty("--genesis-active", String(activeIndex));
      eras.forEach((era, index) => {
        const distance = index - activeIndex;
        era.style.setProperty("--stratum-distance", String(distance));
        era.style.setProperty("--stratum-depth", String(Math.abs(distance)));
        era.dataset.stratumState = index < activeIndex ? "past" : index === activeIndex ? "active" : "future";
      });
      stages.forEach((stage) => {
        const section = document.getElementById(stage.dataset.traceStage);
        if (!section) return;
        const bounds = section.getBoundingClientRect();
        stage.dataset.depthState = bounds.top <= viewportAnchor && bounds.bottom > viewportAnchor ? "active" : bounds.bottom <= viewportAnchor ? "past" : "future";
      });
    }

    function requestDepth() {
      if (reduced.matches) {
        updateDepth();
        return;
      }
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(updateDepth);
    }

    addEventListener("scroll", requestDepth, { passive: true });
    addEventListener("resize", requestDepth, { passive: true });
    document.addEventListener("genesis:era-change", requestDepth);
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-era-control], [data-trace-stage]")) return;
      body.dataset.genesisState = "traversed";
      after(80, requestDepth);
    });
    updateDepth();
  }

  function initAxiomWitness() {
    let pulseTimer = 0;
    let observedRoot = null;
    let rootObserver = null;

    function acknowledge(state) {
      const normalized = String(state || "RESTING").toUpperCase();
      if (body.dataset.axiomSemantic === normalized) return;
      body.dataset.axiomSemantic = normalized;
      if (reduced.matches) return;
      body.dataset.witnessPulse = "true";
      clearTimeout(pulseTimer);
      pulseTimer = window.setTimeout(() => { delete body.dataset.witnessPulse; }, 920);
    }

    function bindRoot() {
      const root = document.querySelector("[data-axiom-agent]");
      if (!root || root === observedRoot) return;
      observedRoot = root;
      documentObserver.disconnect();
      rootObserver?.disconnect();
      acknowledge(root.dataset.semanticState || root.dataset.state);
      rootObserver = new MutationObserver(() => acknowledge(root.dataset.semanticState || root.dataset.state));
      rootObserver.observe(root, { attributes: true, attributeFilter: ["data-semantic-state", "data-state"] });
    }

    const documentObserver = new MutationObserver(bindRoot);
    documentObserver.observe(body, { childList: true, subtree: true });
    window.addEventListener("semeai:axiom-presence-ready", bindRoot);
    bindRoot();
    addEventListener("pagehide", () => {
      clearTimeout(pulseTimer);
      rootObserver?.disconnect();
      documentObserver.disconnect();
    }, { once: true });
  }

  initArrival();
  initReveal();
  initTransitions();
  initParallax();
  initField();
  initCanvas();
  initGate();
  initBenchmarkWorld();
  initGenesisWorld();
  initAxiomWitness();
  addEventListener("pagehide", clearTimers, { once: true });
})();
