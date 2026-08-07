(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = window.matchMedia("(pointer: coarse)");
  const body = document.body;
  const route = body.dataset.v2Route || "";

  function mountAtmosphere() {
    if (document.querySelector(".pc-atmosphere")) return;
    const stack = document.createDocumentFragment();
    ["pc-atmosphere", "pc-grain", "pc-vignette"].forEach((name) => {
      const el = document.createElement("div");
      el.className = name;
      el.setAttribute("aria-hidden", "true");
      stack.appendChild(el);
    });
    body.prepend(stack);
  }

  function initFieldWeight() {
    const field = document.querySelector("[data-field-scene]");
    if (!field || route !== "field") return;

    if (!field.querySelector(".field-weight-glow")) {
      const glow = document.createElement("div");
      glow.className = "field-weight-glow";
      glow.setAttribute("aria-hidden", "true");
      field.appendChild(glow);
    }

    if (!field.querySelector("[data-pc-telemetry]")) {
      const panel = document.createElement("aside");
      panel.className = "pc-field-telemetry";
      panel.dataset.pcTelemetry = "";
      panel.setAttribute("aria-hidden", "true");
      panel.innerHTML = `
        <p><span>OBJECT</span><strong>CANDIDATE</strong></p>
        <p><span>FIELD FORCE</span><strong data-pc-force>0.38</strong></p>
        <p><span>AUTHORITY</span><strong data-pc-authority>EXTERNAL / GATE</strong></p>
        <p><span>STATE</span><strong data-pc-state>BOUND</strong></p>`;
      field.appendChild(panel);
    }

    const forceEl = field.querySelector("[data-pc-force]");
    const stateEl = field.querySelector("[data-pc-state]");
    const orbit = field.querySelector(".candidate-orbit");
    let force = 0.38;
    let targetForce = 0.38;
    let frame = 0;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const tick = () => {
      force += (targetForce - force) * 0.08;
      field.style.setProperty("--pc-force", force.toFixed(3));
      if (forceEl) forceEl.textContent = force.toFixed(2);
      if (Math.abs(targetForce - force) > 0.004) frame = requestAnimationFrame(tick);
      else frame = 0;
    };

    const setWeighted = (active) => {
      // Keep the established production token "tension" so motion contracts remain stable.
      field.dataset.fieldMotion = active ? "tension" : "ambient";
      if (stateEl) stateEl.textContent = active ? "TENSION" : "BOUND";
    };

    const onMove = (event) => {
      if (reduced.matches || coarse.matches) return;
      const rect = field.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      // Boundary sits near 52%; force rises as the pointer approaches it from the candidate side.
      const boundary = 0.52;
      const distance = Math.abs(x - boundary);
      targetForce = clamp(0.22 + (1 - distance) * 0.72, 0.18, 0.96);
      field.style.setProperty("--pc-pointer-x", `${(x * 100).toFixed(2)}%`);
      field.style.setProperty("--pc-pointer-y", `${(y * 100).toFixed(2)}%`);
      if (orbit && x < boundary) {
        const approach = clamp(x / boundary, 0.15, 0.95);
        orbit.style.left = `${(12 + approach * 36).toFixed(2)}%`;
        orbit.style.top = `${(38 + y * 18).toFixed(2)}%`;
      }
      setWeighted(true);
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const reset = () => {
      targetForce = 0.38;
      setWeighted(false);
      if (orbit) {
        orbit.style.left = "";
        orbit.style.top = "";
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };

    field.addEventListener("pointermove", onMove, { passive: true });
    field.addEventListener("pointerleave", reset, { passive: true });
    field.addEventListener("pointerenter", () => setWeighted(true), { passive: true });

    // Semantic: Gate links increase field tension without simulating a decision.
    document.querySelectorAll("a[href*='gate.html']").forEach((link) => {
      link.addEventListener("pointerenter", () => {
        targetForce = 0.82;
        setWeighted(true);
        if (!frame) frame = requestAnimationFrame(tick);
      }, { passive: true });
      link.addEventListener("pointerleave", reset, { passive: true });
      link.addEventListener("focus", () => {
        targetForce = 0.82;
        setWeighted(true);
        if (!frame) frame = requestAnimationFrame(tick);
      });
      link.addEventListener("blur", reset);
    });
  }

  function initGateFateSurface() {
    if (route !== "gate") return;
    // Place after the live machine so the threshold aperture remains in the first viewport.
    const host = document.querySelector(".gate-contract") || document.querySelector("#live-gate");
    if (!host || document.querySelector(".pc-fate-legend")) return;

    const legend = document.createElement("div");
    legend.className = "pc-fate-legend";
    legend.setAttribute("aria-label", "Four physical Gate fates");
    legend.innerHTML = `
      <article><b>SHOW</b><p data-i18n="v2.gate.fateShow">Candidate may cross. Exact evaluated content only.</p></article>
      <article><b>REVIEW</b><p data-i18n="v2.gate.fateReview">Approach suspends. Candidate content stays hidden.</p></article>
      <article><b>BLOCK</b><p data-i18n="v2.gate.fateBlock">Boundary withholds release. Audit remains.</p></article>
      <article><b>ERROR</b><p data-i18n="v2.gate.fateError">Transport failure. Fail closed. No fake receipt.</p></article>`;
    if (host.classList.contains("gate-contract")) host.prepend(legend);
    else host.insertAdjacentElement("afterend", legend);

    if (window.SemeAI_I18n?.apply) {
      try { window.SemeAI_I18n.apply(legend); } catch (_) { /* progressive */ }
    }
  }

  function expandRouteTransitions() {
    // Include research, book, roadmap, skills in continuity set without SPA conversion.
    const extra = ["/research.html", "/book/", "/book/index.html", "/roadmap/", "/roadmap/index.html", "/skills/", "/skills/index.html", "/pilots/support.html"];
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link || reduced.matches || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      let destination;
      try { destination = new URL(link.href, location.href); } catch { return; }
      if (destination.origin !== location.origin) return;
      const same = destination.pathname === location.pathname && destination.search === location.search;
      if (same || !extra.includes(destination.pathname)) return;
      // Only enhance leave animation; v2-production already handles major routes.
      if (body.dataset.leaving === "true") return;
      event.preventDefault();
      body.dataset.leaving = "true";
      try {
        sessionStorage.setItem("semeai:v2-arrival", JSON.stringify({
          path: destination.pathname,
          at: Date.now(),
          from: route || "extended",
        }));
      } catch (_) { /* storage optional */ }
      window.setTimeout(() => location.assign(destination.href), 240);
    }, true);
  }

  function initAxiomRouteContext() {
    const map = {
      field: { source: "field", state: "IDLE", message: "Witnessing possibility. No release authority." },
      gate: { source: "gate", state: "ATTENTIVE", message: "Watching the boundary. Never deciding." },
      lab: { source: "lab", state: "ATTENTIVE", message: "Observing evidence assembly. Not scoring." },
      genesis: { source: "genesis", state: "IDLE", message: "Holding admitted continuity." },
    };
    const context = map[route];
    if (!context) return;
    window.dispatchEvent(new CustomEvent("semeai:axiom-context", { detail: context }));
  }

  function boot() {
    mountAtmosphere();
    initFieldWeight();
    initGateFateSurface();
    expandRouteTransitions();
    // Delay Axiom context until presence may have registered.
    window.setTimeout(initAxiomRouteContext, 120);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
