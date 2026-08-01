(() => {
  "use strict";

  const stage = document.querySelector(".commercial-stage");
  const replay = document.getElementById("home-motion-replay");
  const pause = document.getElementById("home-motion-pause");
  const outcomeButtons = [...document.querySelectorAll("[data-home-outcome]")];
  if (!stage) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const phases = ["candidate", "inputs", "gate", "decision", "receipt"];
  const phaseDelay = 1100;
  let phaseIndex = 0;
  let timer = 0;
  let paused = false;
  let hasPlayed = false;
  let visible = false;

  window.SemeAIHomeMotion = Object.freeze({ version: "commercial-release-flow-v1" });

  function translated(key, fallback) {
    const value = window.SemeAI_I18n?.t?.(key);
    return value && value !== key ? value : fallback;
  }

  function clearTimer() {
    if (timer) window.clearTimeout(timer);
    timer = 0;
  }

  function announce(phase) {
    stage.dataset.motionPhase = phase;
    stage.setAttribute("aria-live", phase === "receipt" ? "polite" : "off");
    if (phase === "receipt") {
      const outcome = String(stage.dataset.motionOutcome || "show").toUpperCase();
      stage.setAttribute("aria-label", `${translated("commercial.motion.aria", "Candidate, Gate, release decision, and receipt diagram")}. ${outcome}.`);
    }
  }

  function schedule() {
    clearTimer();
    if (paused || !visible || document.hidden || reducedMotion.matches || phaseIndex >= phases.length - 1) return;
    timer = window.setTimeout(() => {
      phaseIndex += 1;
      announce(phases[phaseIndex]);
      schedule();
    }, phaseDelay);
  }

  function start({ force = false } = {}) {
    if (reducedMotion.matches) {
      phaseIndex = phases.length - 1;
      paused = true;
      announce("receipt");
      if (pause) pause.textContent = translated("commercial.motion.pause", "Pause");
      return;
    }
    if (hasPlayed && !force) return;
    hasPlayed = true;
    paused = false;
    stage.dataset.motionState = "running";
    phaseIndex = 0;
    announce(phases[phaseIndex]);
    if (pause) pause.textContent = translated("commercial.motion.pause", "Pause");
    schedule();
  }

  function togglePause() {
    if (reducedMotion.matches) return;
    paused = !paused;
    stage.dataset.motionState = paused ? "paused" : "running";
    if (pause) {
      pause.textContent = paused
        ? translated("commercial.motion.resume", "Resume")
        : translated("commercial.motion.pause", "Pause");
    }
    if (paused) clearTimer();
    else schedule();
  }

  function setOutcome(outcome) {
    if (!["show", "review", "block"].includes(outcome)) return;
    stage.dataset.motionOutcome = outcome;
    outcomeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.homeOutcome === outcome)));
    start({ force: true });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) {
        stage.dataset.motionState = paused ? "paused" : "running";
        start();
        schedule();
      } else {
        stage.dataset.motionState = "paused";
        clearTimer();
      }
    },
    { threshold: 0.2 },
  );
  observer.observe(stage);

  replay?.addEventListener("click", () => start({ force: true }));
  pause?.addEventListener("click", togglePause);
  outcomeButtons.forEach((button) => button.addEventListener("click", () => setOutcome(button.dataset.homeOutcome)));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stage.dataset.motionState = "paused";
      clearTimer();
    } else {
      stage.dataset.motionState = paused ? "paused" : "running";
      schedule();
    }
  });
  reducedMotion.addEventListener?.("change", () => start({ force: true }));
})();
