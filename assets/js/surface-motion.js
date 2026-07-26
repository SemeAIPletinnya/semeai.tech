(() => {
  "use strict";

  const motion = window.SemeAIMotion;
  if (!motion) return;

  function initGate() {
    const visual = document.querySelector(".gate-state-visual");
    if (!visual) return;

    const stateCycle = motion.cycle(visual, {
      phases: [
        { name: "show", duration: 4200 },
        { name: "review", duration: 4200 },
        { name: "block", duration: 4200 },
      ],
      reducedPhase: 1,
      threshold: 0.08,
      rootMargin: "100px 0px",
    });

    document.querySelectorAll("[data-gate-state]").forEach((row) => {
      const state = row.dataset.gateState;
      row.addEventListener("pointerenter", () => stateCycle.setPhase(state));
      row.addEventListener("focus", () => stateCycle.setPhase(state));
    });

    document.querySelectorAll(".architecture-flow > div").forEach((segment) => {
      motion.watch(
        segment,
        (state) => {
          if (state === "running" || state === "reduced") segment.dataset.motionAdmitted = "true";
        },
        { threshold: 0.2, rootMargin: "60px 0px" }
      );
    });
  }

  function initResearch() {
    document.querySelectorAll(".research-artifact-section, .emblem, .evidence-card, .mode-research .boundary-note").forEach((item) => {
      motion.watch(
        item,
        (state) => {
          if (state === "running" || state === "reduced") item.dataset.evidenceAdmitted = "true";
        },
        { threshold: 0.12, rootMargin: "80px 0px" }
      );
    });
  }

  if (document.body.classList.contains("mode-gate")) initGate();
  if (document.body.classList.contains("mode-research")) initResearch();
})();
