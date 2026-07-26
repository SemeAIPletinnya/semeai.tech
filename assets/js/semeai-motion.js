(() => {
  "use strict";

  if (window.SemeAIMotion) return;

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const watchers = new Set();

  function reduced() {
    return motionPreference.matches;
  }

  function documentVisible() {
    return !document.hidden && document.visibilityState !== "hidden";
  }

  function seed(value) {
    const input = String(value || "semeai");
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededUnit(value, offset = 0) {
    let state = (seed(value) + Math.imul(Number(offset) || 0, 0x9e3779b1)) >>> 0;
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967295;
  }

  function inViewport(element, margin = 0) {
    if (!element?.isConnected) return false;
    const rect = element.getBoundingClientRect();
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin && rect.right >= 0 && rect.left <= window.innerWidth;
  }

  function stateFor(record) {
    if (reduced()) return "reduced";
    if (!documentVisible() || !record.intersecting) return "paused";
    return "running";
  }

  function synchronize(record, force = false) {
    if (!record.element?.isConnected) return;
    const state = stateFor(record);
    record.element.dataset.motionState = state;
    if (force || record.state !== state) {
      record.state = state;
      record.callback?.(state);
    }
  }

  function synchronizeAll() {
    watchers.forEach((record) => synchronize(record));
  }

  function watch(element, callback, options = {}) {
    if (!element) return { destroy() {}, state: () => "paused" };

    const record = {
      callback,
      element,
      intersecting: inViewport(element, 120),
      observer: null,
      state: "",
    };

    if ("IntersectionObserver" in window) {
      record.observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          record.intersecting = Boolean(entry?.isIntersecting);
          synchronize(record);
        },
        {
          root: options.root || null,
          rootMargin: options.rootMargin || "120px 0px",
          threshold: options.threshold ?? 0.02,
        }
      );
      record.observer.observe(element);
    }

    watchers.add(record);
    synchronize(record, true);

    return {
      destroy() {
        record.observer?.disconnect();
        watchers.delete(record);
        delete element.dataset.motionState;
      },
      state: () => record.state,
    };
  }

  function cycle(element, options = {}) {
    const phases = (options.phases || []).map((phase) =>
      typeof phase === "string" ? { name: phase, duration: options.duration || 3000 } : phase
    );
    if (!element || !phases.length) return { destroy() {}, phase: () => "" };

    let phaseIndex = Math.max(0, Math.min(options.startAt || 0, phases.length - 1));
    let timer = 0;
    let destroyed = false;
    let currentState = "paused";
    let lifecycle = { destroy() {}, state: () => currentState };

    function clear() {
      if (timer) window.clearTimeout(timer);
      timer = 0;
    }

    function applyPhase(index) {
      phaseIndex = index;
      const phase = phases[phaseIndex];
      element.dataset.motionPhase = phase.name;
      options.onPhase?.(phase.name, phaseIndex);
    }

    function schedule() {
      clear();
      if (destroyed || lifecycle.state() !== "running") return;
      const phase = phases[phaseIndex];
      timer = window.setTimeout(() => {
        applyPhase((phaseIndex + 1) % phases.length);
        schedule();
      }, Math.max(250, Number(phase.duration) || 3000));
    }

    lifecycle = watch(
      element,
      (state) => {
        currentState = state;
        options.onState?.(state);
        clear();
        if (state === "reduced") {
          applyPhase(options.reducedPhase ?? phases.length - 1);
          return;
        }
        if (state === "running") {
          applyPhase(phaseIndex);
          schedule();
        }
      },
      options
    );

    return {
      destroy() {
        destroyed = true;
        clear();
        lifecycle.destroy();
        delete element.dataset.motionPhase;
      },
      phase: () => phases[phaseIndex]?.name || "",
      setPhase(name) {
        const next = phases.findIndex((phase) => phase.name === name);
        if (next < 0) return;
        applyPhase(next);
        schedule();
      },
    };
  }

  function frameLoop(element, draw, options = {}) {
    if (!element || typeof draw !== "function") return { destroy() {}, request() {} };
    let animationFrame = 0;
    let destroyed = false;
    let lastFrame = 0;
    let currentState = "paused";
    let lifecycle = { destroy() {}, state: () => currentState };
    const minimumFrameTime = options.fps ? 1000 / Math.max(1, options.fps) : 0;

    function cancel() {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    function frame(time) {
      animationFrame = 0;
      if (destroyed || lifecycle.state() !== "running") return;
      if (!minimumFrameTime || time - lastFrame >= minimumFrameTime) {
        lastFrame = time;
        draw(time, { reduced: false });
      }
      animationFrame = window.requestAnimationFrame(frame);
    }

    function request() {
      if (destroyed || animationFrame || lifecycle.state() !== "running") return;
      animationFrame = window.requestAnimationFrame(frame);
    }

    lifecycle = watch(
      element,
      (state) => {
        currentState = state;
        cancel();
        if (state === "reduced") {
          draw(0, { reduced: true });
        } else if (state === "running") {
          request();
        }
      },
      options
    );

    return {
      destroy() {
        destroyed = true;
        cancel();
        lifecycle.destroy();
      },
      request,
    };
  }

  document.addEventListener("visibilitychange", synchronizeAll);
  window.addEventListener("pageshow", synchronizeAll, { passive: true });
  window.addEventListener("resize", synchronizeAll, { passive: true });
  if (typeof motionPreference.addEventListener === "function") {
    motionPreference.addEventListener("change", synchronizeAll);
  } else {
    motionPreference.addListener(synchronizeAll);
  }

  window.SemeAIMotion = Object.freeze({
    cycle,
    documentVisible,
    frameLoop,
    reduced,
    seed,
    seededUnit,
    watch,
  });
})();
