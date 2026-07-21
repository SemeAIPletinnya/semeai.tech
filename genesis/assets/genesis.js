(() => {
  "use strict";

  const root = document.documentElement;
  const acts = Array.from(document.querySelectorAll("[data-act]"));
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const portrait = window.matchMedia("(max-aspect-ratio: 3 / 4)");
  const narrow = window.matchMedia("(max-width: 700px)");
  const shortViewport = window.matchMedia("(max-height: 520px)");
  const actRuntime = new WeakMap();
  let animationFrame = 0;
  let motionActive = false;
  let activeAct = null;

  const sceneProfiles = {
    "first-impulse": {
      period: 27.3,
      phase: 0.4,
      scale: 0.0008,
      x: 0.025,
      y: 0.018,
      entryDelay: 160,
      entryDuration: 3100,
      entryAttack: 0.12,
      entryStrength: 0.11,
    },
    emergence: {
      period: 19.7,
      phase: 1.3,
      scale: 0.0025,
      x: 0.055,
      y: 0.045,
      entryDelay: 110,
      entryDuration: 3600,
      entryAttack: 0.2,
      entryStrength: 0.075,
    },
    "first-continuity": {
      period: 22.9,
      phase: 2.1,
      scale: 0.0015,
      x: 0.025,
      y: 0.1,
      entryDelay: 240,
      entryDuration: 3900,
      entryAttack: 0.18,
      entryStrength: 0.065,
    },
    "living-space": {
      period: 25.7,
      phase: 0.8,
      scale: 0.0022,
      x: 0.11,
      y: 0.045,
      entryDelay: 180,
      entryDuration: 4300,
      entryAttack: 0.23,
      entryStrength: 0.055,
    },
    "space-responds": {
      period: 21.1,
      phase: 2.7,
      scale: 0.0017,
      x: 0.085,
      y: 0.03,
      entryDelay: 620,
      entryDuration: 4700,
      entryAttack: 0.19,
      entryStrength: 0.055,
    },
    "first-horizon": {
      period: 31.3,
      phase: 1.8,
      scale: 0.0012,
      x: 0.04,
      y: 0.025,
      entryDelay: 320,
      entryDuration: 5200,
      entryAttack: 0.28,
      entryStrength: 0.03,
    },
    "hidden-current": {
      period: 26.3,
      phase: 3.2,
      scale: 0.0016,
      x: 0.13,
      y: 0.035,
      entryDelay: 260,
      entryDuration: 4400,
      entryAttack: 0.2,
      entryStrength: 0.055,
    },
    "field-awakens": {
      period: 18.7,
      phase: 0.15,
      scale: 0.002,
      x: 0.075,
      y: 0.05,
      entryDelay: 120,
      entryDuration: 4200,
      entryAttack: 0.17,
      entryStrength: 0.07,
    },
    "living-continuum": {
      period: 33.7,
      phase: 2.45,
      scale: 0.0018,
      x: 0.055,
      y: 0.04,
      entryDelay: 340,
      entryDuration: 5600,
      entryAttack: 0.24,
      entryStrength: 0.04,
    },
  };

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const mix = (from, to, progress) => from + (to - from) * progress;

  function smoothstep(from, to, value) {
    if (from === to) return value < from ? 0 : 1;
    const progress = clamp((value - from) / (to - from));
    return progress * progress * (3 - 2 * progress);
  }

  function eventEnvelope(elapsed, delay, duration, attack = 0.2) {
    const progress = (elapsed - delay) / duration;
    if (progress <= 0 || progress >= 1) return 0;
    if (progress < attack) return smoothstep(0, attack, progress);
    return 1 - smoothstep(attack, 1, progress);
  }

  function irregularWave(timeSeconds, profile) {
    const primary = 0.5 + 0.5 * Math.sin((timeSeconds / profile.period) * Math.PI * 2 + profile.phase);
    const secondary = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin((timeSeconds / (profile.period * 1.71)) * Math.PI * 2 + profile.phase * 2.13));
    return primary * secondary;
  }

  function viewportAmplitude() {
    if (portrait.matches) return 0.26;
    if (shortViewport.matches) return 0.3;
    if (narrow.matches) return 0.48;
    return 1;
  }

  function originValues(progress, amplitude) {
    const firstOut = smoothstep(0.2, 0.38, progress);
    const secondIn = smoothstep(0.2, 0.36, progress);
    const secondOut = smoothstep(0.55, 0.72, progress);
    const thirdIn = smoothstep(0.58, 0.74, progress);

    return [
      {
        opacity: 1 - firstOut,
        copyOpacity: 1 - smoothstep(0.12, 0.28, progress),
        scale: mix(1, 1.055, smoothstep(0, 0.4, progress)),
        x: 0,
        y: mix(0, -0.3 * amplitude, firstOut),
        copyX: 0,
        copyY: 0,
      },
      {
        opacity: secondIn * (1 - secondOut),
        copyOpacity: smoothstep(0.3, 0.4, progress) * (1 - smoothstep(0.51, 0.64, progress)),
        scale: mix(1.07, 1.018, smoothstep(0.2, 0.72, progress)),
        x: mix(0.7 * amplitude, -0.25 * amplitude, smoothstep(0.2, 0.72, progress)),
        y: mix(0.35 * amplitude, -0.2 * amplitude, smoothstep(0.2, 0.72, progress)),
        copyX: mix(0.8 * amplitude, 0, smoothstep(0.28, 0.42, progress)),
        copyY: 0,
      },
      {
        opacity: thirdIn,
        copyOpacity: smoothstep(0.66, 0.79, progress),
        scale: mix(1.035, 1.005, smoothstep(0.58, 1, progress)),
        x: 0,
        y: mix(0.8 * amplitude, 0, smoothstep(0.58, 0.94, progress)),
        copyX: mix(-0.7 * amplitude, 0, smoothstep(0.64, 0.8, progress)),
        copyY: 0,
      },
    ];
  }

  function discoveryValues(progress, amplitude) {
    const travel = smoothstep(0, 1, progress);
    const firstOut = smoothstep(0.27, 0.46, progress);
    const secondIn = smoothstep(0.24, 0.42, progress);
    const secondOut = smoothstep(0.57, 0.76, progress);
    const thirdIn = smoothstep(0.62, 0.8, progress);

    return [
      {
        opacity: 1 - firstOut,
        copyOpacity: 1 - smoothstep(0.18, 0.34, progress),
        scale: mix(1.025, 1.045, travel),
        x: mix(-0.9 * amplitude, 0.8 * amplitude, travel),
        y: mix(0.2 * amplitude, -0.15 * amplitude, travel),
        copyX: mix(0, -0.45 * amplitude, firstOut),
        copyY: 0,
      },
      {
        opacity: secondIn * (1 - secondOut),
        copyOpacity: smoothstep(0.32, 0.44, progress) * (1 - smoothstep(0.55, 0.68, progress)),
        scale: mix(1.035, 1.02, smoothstep(0.24, 0.76, progress)),
        x: mix(-1.1 * amplitude, 0.85 * amplitude, smoothstep(0.24, 0.76, progress)),
        y: 0,
        copyX: mix(0.7 * amplitude, -0.25 * amplitude, smoothstep(0.3, 0.68, progress)),
        copyY: 0,
      },
      {
        opacity: thirdIn,
        copyOpacity: smoothstep(0.71, 0.83, progress),
        scale: mix(1.035, 1.012, smoothstep(0.62, 1, progress)),
        x: mix(-0.75 * amplitude, 0.15 * amplitude, smoothstep(0.62, 1, progress)),
        y: mix(0.18 * amplitude, 0, smoothstep(0.62, 0.95, progress)),
        copyX: mix(-0.6 * amplitude, 0, smoothstep(0.68, 0.84, progress)),
        copyY: 0,
      },
    ];
  }

  function awakeningValues(progress, amplitude) {
    const firstOut = smoothstep(0.3, 0.5, progress);
    const secondIn = smoothstep(0.24, 0.44, progress);
    const secondOut = smoothstep(0.62, 0.81, progress);
    const finalIn = smoothstep(0.66, 0.84, progress);
    const settle = smoothstep(0.66, 0.9, progress);

    return [
      {
        opacity: 1 - firstOut,
        copyOpacity: 1 - smoothstep(0.19, 0.37, progress),
        scale: mix(1.018, 1.048, smoothstep(0, 0.5, progress)),
        x: mix(-0.35 * amplitude, 0.45 * amplitude, smoothstep(0, 0.5, progress)),
        y: mix(0.15 * amplitude, -0.15 * amplitude, smoothstep(0, 0.5, progress)),
        copyX: mix(0, -0.4 * amplitude, firstOut),
        copyY: 0,
      },
      {
        opacity: secondIn * (1 - secondOut),
        copyOpacity: smoothstep(0.34, 0.47, progress) * (1 - smoothstep(0.6, 0.73, progress)),
        scale: mix(1.045, 1.018, smoothstep(0.24, 0.81, progress)),
        x: mix(0.7 * amplitude, -0.45 * amplitude, smoothstep(0.24, 0.81, progress)),
        y: mix(-0.2 * amplitude, 0.15 * amplitude, smoothstep(0.24, 0.81, progress)),
        copyX: mix(0.65 * amplitude, -0.2 * amplitude, smoothstep(0.31, 0.72, progress)),
        copyY: 0,
      },
      {
        opacity: finalIn,
        copyOpacity: smoothstep(0.76, 0.87, progress),
        scale: mix(1.05, 1, settle),
        x: mix(-0.55 * amplitude, 0, settle),
        y: mix(0.3 * amplitude, 0, settle),
        copyX: 0,
        copyY: mix(0.35 * amplitude, 0, smoothstep(0.75, 0.88, progress)),
      },
    ];
  }

  function semanticValues(sceneId, elapsed, timeSeconds, wave, progress, proximity) {
    let primary = 0;
    let secondary = 0;
    let positionX = 50;
    let positionY = 50;
    let fieldX = 0;
    let fieldY = 0;
    let fieldScale = 1;
    const damping = sceneId === "living-continuum" ? 1 - smoothstep(0.78, 0.98, progress) : 1;

    if (sceneId === "first-impulse") {
      const signal = eventEnvelope(elapsed, 220, 3400, 0.13);
      const afterglow = eventEnvelope(elapsed, 1050, 4800, 0.18);
      primary = (0.012 * wave + 0.19 * signal) * proximity;
      secondary = 0.1 * afterglow * proximity;
      fieldScale = 1 + 0.018 * signal;
      fieldX = 0.1 * signal;
      fieldY = -0.06 * signal;
    } else if (sceneId === "emergence") {
      const pressure = eventEnvelope(elapsed, 260, 4700, 0.26);
      const darknessResponse = eventEnvelope(elapsed, 1150, 5900, 0.22);
      primary = (0.035 + 0.055 * wave + 0.1 * pressure) * proximity;
      secondary = (0.025 * wave + 0.075 * darknessResponse) * proximity;
      fieldScale = 1 + 0.024 * pressure + 0.006 * wave;
    } else if (sceneId === "first-continuity") {
      const activation = Math.pow(0.5 + 0.5 * Math.sin(timeSeconds * 0.37 + 1.2), 8);
      primary = (0.035 + 0.065 * wave) * proximity;
      secondary = (0.018 + 0.08 * activation) * proximity;
      positionY = 67 - 31 * (0.5 + 0.5 * Math.sin(timeSeconds * 0.22));
      fieldY = -0.14 * wave;
    } else if (sceneId === "living-space") {
      const pathResponse = eventEnvelope(elapsed, 360, 5600, 0.24);
      primary = (0.035 + 0.055 * wave) * proximity;
      secondary = 0.08 * pathResponse * proximity;
      fieldScale = 1 + 0.008 * wave;
      positionX = 51 + 2 * Math.sin(timeSeconds * 0.11);
    } else if (sceneId === "space-responds") {
      const delay = 980;
      const duration = 6200;
      const response = eventEnvelope(elapsed, delay, duration, 0.2);
      const travel = smoothstep(0, 1, clamp((elapsed - delay) / duration));
      primary = (0.018 * wave + 0.15 * response) * proximity;
      secondary = 0.065 * eventEnvelope(elapsed, 1850, 6900, 0.24) * proximity;
      positionX = mix(12, 88, travel);
      fieldScale = 1 + 0.004 * response;
    } else if (sceneId === "first-horizon") {
      primary = (0.018 + 0.035 * wave) * proximity;
      secondary = 0.028 * eventEnvelope(elapsed, 850, 6800, 0.32) * proximity;
      positionY = 52 + 1.4 * Math.sin(timeSeconds * 0.09);
      fieldScale = 1 + 0.0025 * wave;
    } else if (sceneId === "hidden-current") {
      const stagger = 0.5 + 0.5 * Math.sin(timeSeconds * 0.19 + 2.4);
      primary = (0.035 + 0.075 * wave) * proximity;
      secondary = (0.025 + 0.07 * stagger) * proximity;
      fieldX = 0.22 * Math.sin(timeSeconds * 0.14);
      positionX = 50 + 4 * Math.sin(timeSeconds * 0.1 + 0.7);
    } else if (sceneId === "field-awakens") {
      const first = eventEnvelope(elapsed, 220, 4200, 0.18);
      const second = eventEnvelope(elapsed, 1350, 5200, 0.21);
      const third = eventEnvelope(elapsed, 2650, 6100, 0.19);
      primary = (0.045 + 0.045 * wave + 0.08 * first + 0.065 * third) * proximity;
      secondary = (0.025 + 0.095 * second + 0.045 * third) * proximity;
      positionX = mix(38, 62, smoothstep(0, 1, clamp((elapsed - 400) / 7200)));
      fieldScale = 1 + 0.008 * first + 0.006 * second;
    } else if (sceneId === "living-continuum") {
      primary = (0.035 + 0.09 * wave) * proximity * damping;
      secondary = (0.018 + 0.04 * (1 - wave)) * proximity * damping;
      fieldX = 0.08 * Math.sin(timeSeconds * 0.1) * damping;
      fieldY = 0.05 * Math.sin(timeSeconds * 0.07 + 1.1) * damping;
      fieldScale = 1 + 0.006 * wave * damping;
    }

    return { primary, secondary, positionX, positionY, fieldX, fieldY, fieldScale, damping };
  }

  function writeScene(scene, values, context) {
    const profile = sceneProfiles[scene.dataset.scene];
    const wave = irregularWave(context.timeSeconds, profile);
    const distance = Math.abs(context.index - context.activeIndex);
    const proximity = distance === 0 ? 1 : distance === 1 ? 0.32 : 0;
    const elapsed = context.isActive ? context.now - context.enteredAt : -1;
    const semantic = semanticValues(scene.dataset.scene, elapsed, context.timeSeconds, wave, context.progress, proximity);
    const entry = context.isActive
      ? eventEnvelope(elapsed, profile.entryDelay, profile.entryDuration, profile.entryAttack) * profile.entryStrength * semantic.damping
      : 0;
    const ambientStrength = proximity * context.amplitude * semantic.damping;
    const ambientScale = 1 + profile.scale * (0.3 + 0.7 * wave) * ambientStrength;
    const ambientX = Math.sin((context.timeSeconds / profile.period) * Math.PI * 2 + profile.phase) * profile.x * ambientStrength;
    const ambientY = Math.sin((context.timeSeconds / (profile.period * 1.39)) * Math.PI * 2 + profile.phase * 0.63) * profile.y * ambientStrength;

    scene.style.setProperty("--scene-opacity", values.opacity.toFixed(4));
    scene.style.setProperty("--copy-opacity", values.copyOpacity.toFixed(4));
    scene.style.setProperty("--image-scale", values.scale.toFixed(5));
    scene.style.setProperty("--image-x", `${values.x.toFixed(3)}%`);
    scene.style.setProperty("--image-y", `${values.y.toFixed(3)}%`);
    scene.style.setProperty("--copy-x", `${values.copyX.toFixed(3)}rem`);
    scene.style.setProperty("--copy-y", `${values.copyY.toFixed(3)}rem`);
    scene.style.setProperty("--ambient-scale", ambientScale.toFixed(6));
    scene.style.setProperty("--ambient-x", `${ambientX.toFixed(4)}%`);
    scene.style.setProperty("--ambient-y", `${ambientY.toFixed(4)}%`);
    scene.style.setProperty("--semantic-primary-opacity", semantic.primary.toFixed(4));
    scene.style.setProperty("--semantic-secondary-opacity", semantic.secondary.toFixed(4));
    scene.style.setProperty("--entry-opacity", entry.toFixed(4));
    scene.style.setProperty("--field-position-x", `${semantic.positionX.toFixed(2)}%`);
    scene.style.setProperty("--field-position-y", `${semantic.positionY.toFixed(2)}%`);
    scene.style.setProperty("--field-x", `${(semantic.fieldX * context.amplitude).toFixed(3)}%`);
    scene.style.setProperty("--field-y", `${(semantic.fieldY * context.amplitude).toFixed(3)}%`);
    scene.style.setProperty("--field-scale", semantic.fieldScale.toFixed(5));
  }

  function rhythmValues(act, progress, amplitude) {
    if (act.dataset.act === "origin") return originValues(progress, amplitude);
    if (act.dataset.act === "discovery") return discoveryValues(progress, amplitude);
    return awakeningValues(progress, amplitude);
  }

  function selectActiveAct(viewportHeight) {
    const center = viewportHeight * 0.5;
    let selected = null;
    let selectedDistance = Number.POSITIVE_INFINITY;

    acts.forEach((act) => {
      const rect = act.getBoundingClientRect();
      const distance = rect.top <= center && rect.bottom >= center
        ? 0
        : Math.min(Math.abs(rect.top - center), Math.abs(rect.bottom - center));
      if (distance < selectedDistance) {
        selected = { act, rect };
        selectedDistance = distance;
      }
    });

    return selected;
  }

  function quietAct(act) {
    if (!act) return;
    act.querySelectorAll("[data-scene]").forEach((scene) => {
      scene.style.setProperty("--ambient-scale", "1");
      scene.style.setProperty("--ambient-x", "0%");
      scene.style.setProperty("--ambient-y", "0%");
      scene.style.setProperty("--semantic-primary-opacity", "0");
      scene.style.setProperty("--semantic-secondary-opacity", "0");
      scene.style.setProperty("--entry-opacity", "0");
    });
  }

  function paintAct(act, rect, now, viewportHeight) {
    const range = Math.max(rect.height - viewportHeight, 1);
    const progress = clamp(-rect.top / range);
    const amplitude = viewportAmplitude();
    const values = rhythmValues(act, progress, amplitude);
    const scenes = Array.from(act.querySelectorAll("[data-scene]"));
    const identity = act.querySelector(".act__identity");
    const activeIndex = values.reduce((best, value, index, list) => value.opacity > list[best].opacity ? index : best, 0);
    let runtime = actRuntime.get(act);

    if (!runtime) {
      runtime = { activeIndex: -1, enteredAt: now };
      actRuntime.set(act, runtime);
    }

    if (runtime.activeIndex !== activeIndex) {
      runtime.activeIndex = activeIndex;
      runtime.enteredAt = now;
    }

    identity?.style.setProperty("--act-label-opacity", (1 - smoothstep(0.08, 0.2, progress)).toFixed(4));
    identity?.style.setProperty("--act-label-x", `${mix(0, -0.45 * amplitude, smoothstep(0.08, 0.2, progress)).toFixed(3)}rem`);

    scenes.forEach((scene, index) => {
      writeScene(scene, values[index], {
        activeIndex,
        amplitude,
        enteredAt: runtime.enteredAt,
        index,
        isActive: index === activeIndex,
        now,
        progress,
        timeSeconds: now / 1000,
      });
    });
  }

  function render(now) {
    animationFrame = 0;
    if (!motionActive || document.hidden) return;

    const viewportHeight = Math.max(window.innerHeight, 1);
    const selected = selectActiveAct(viewportHeight);
    if (!selected) return;

    if (activeAct !== selected.act) {
      quietAct(activeAct);
      activeAct = selected.act;
      const runtime = actRuntime.get(activeAct);
      if (runtime) runtime.activeIndex = -1;
    }

    paintAct(selected.act, selected.rect, now, viewportHeight);
    animationFrame = window.requestAnimationFrame(render);
  }

  function requestRender() {
    if (!motionActive || document.hidden || animationFrame) return;
    animationFrame = window.requestAnimationFrame(render);
  }

  function clearMotionStyles() {
    activeAct = null;
    acts.forEach((act) => {
      const identity = act.querySelector(".act__identity");
      identity?.removeAttribute("style");
      act.querySelectorAll("[data-scene]").forEach((scene) => scene.removeAttribute("style"));
      const runtime = actRuntime.get(act);
      if (runtime) runtime.activeIndex = -1;
    });
  }

  function enableMotion() {
    if (motionActive || motionPreference.matches) return;
    motionActive = true;
    root.classList.add("motion-enabled");
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender, { passive: true });
    window.addEventListener("orientationchange", requestRender, { passive: true });
    requestRender();
  }

  function disableMotion() {
    motionActive = false;
    root.classList.remove("motion-enabled");
    window.removeEventListener("scroll", requestRender);
    window.removeEventListener("resize", requestRender);
    window.removeEventListener("orientationchange", requestRender);
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    clearMotionStyles();
  }

  function applyMotionPreference() {
    if (motionPreference.matches) disableMotion();
    else enableMotion();
  }

  if (typeof motionPreference.addEventListener === "function") {
    motionPreference.addEventListener("change", applyMotionPreference);
  } else {
    motionPreference.addListener(applyMotionPreference);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else {
      requestRender();
    }
  });

  window.addEventListener("pagehide", () => {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  });
  window.addEventListener("pageshow", requestRender, { passive: true });

  applyMotionPreference();
})();
