(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const route = document.body.dataset.v2Route || "";
  document.documentElement.dataset.motion = reduced.matches ? "reduced" : "full";

  function initReveal() {
    const nodes = [...document.querySelectorAll("[data-v2-reveal]")];
    if (!nodes.length) return;
    if (reduced.matches || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.dataset.revealed = "true");
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
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || destination.pathname === location.pathname) return;
      document.body.dataset.leaving = "true";
    });
  }

  function initCanvas() {
    const canvas = document.querySelector("[data-v2-canvas]");
    if (!canvas || reduced.matches) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    let width = 0;
    let height = 0;
    let frame = 0;
    const nodes = Array.from({ length: 26 }, (_, index) => ({
      x: ((index * 47) % 101) / 100,
      y: ((index * 73) % 97) / 96,
      radius: 0.6 + (index % 4) * 0.32,
      phase: index * 0.71,
    }));
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
    function draw(now) {
      if (document.hidden) {
        frame = requestAnimationFrame(draw);
        return;
      }
      context.clearRect(0, 0, width, height);
      nodes.forEach((node, index) => {
        const drift = Math.sin(now * 0.00016 + node.phase) * 12;
        const x = node.x * width + drift;
        const y = node.y * height + Math.cos(now * 0.00012 + node.phase) * 8;
        context.beginPath();
        context.fillStyle = index % 5 === 0 ? "rgba(239,195,118,.20)" : "rgba(114,227,250,.16)";
        context.arc(x, y, node.radius, 0, Math.PI * 2);
        context.fill();
      });
      frame = requestAnimationFrame(draw);
    }
    resize();
    addEventListener("resize", resize, { passive: true });
    frame = requestAnimationFrame(draw);
    addEventListener("pagehide", () => cancelAnimationFrame(frame), { once: true });
  }

  function animateGate(action) {
    const gate = document.getElementById("live-gate");
    if (!gate) return;
    const steps = [...gate.querySelectorAll("[data-machine-step]")];
    steps.forEach((step) => step.classList.remove("is-active"));
    if (action === "IDLE") return;
    steps.forEach((step, index) => {
      if (reduced.matches) step.classList.add("is-active");
      else setTimeout(() => step.classList.add("is-active"), index * 115);
    });
    document.body.dataset.gateState = action.toLowerCase();
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
      const action = event.detail?.action || "ERROR";
      animateGate(action);
      if (action === "WORKING") witness("TASK_STARTED", { source: "public-gate" }, action);
      else if (action === "ERROR") witness("REQUEST_FAILED", { source: "public-gate" }, action);
      else witness("GATE_DECISION", { action, receipt_id: event.detail?.receiptId || null }, action);
      window.dispatchEvent(new CustomEvent("semeai:axiom-context", {
        detail: { source: "gate", state: action === "WORKING" ? "WORKING" : "RESULT", decision: action },
      }));
    });
  }

  function initBenchmarkWorld() {
    const result = document.getElementById("benchmark-result");
    const blocked = document.getElementById("blocked-result");
    if (!result || !blocked) return;
    document.body.dataset.v2Route = "lab";
    const sync = () => {
      const state = !result.hidden ? (result.dataset.gate || "show").toLowerCase() : !blocked.hidden ? "block" : "idle";
      document.body.dataset.evidenceState = state;
      if (!result.hidden) result.querySelectorAll(".category-card").forEach((card, index) => card.style.setProperty("--arrival-index", index));
    };
    new MutationObserver(sync).observe(result, { attributes: true, attributeFilter: ["hidden", "data-gate"] });
    new MutationObserver(sync).observe(blocked, { attributes: true, attributeFilter: ["hidden", "data-gate"] });
    sync();
  }

  function initGenesisWorld() {
    if (!document.body.classList.contains("genesis-v04")) return;
    document.body.dataset.v2Route = "genesis";
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-era-control], [data-trace-stage]")) return;
      document.body.dataset.genesisState = "traversed";
    });
  }

  initReveal();
  initTransitions();
  initCanvas();
  initGate();
  initBenchmarkWorld();
  initGenesisWorld();
})();
