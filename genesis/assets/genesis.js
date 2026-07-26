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
  let storyVisible = true;

  // Cinematic profiles tuned to D:\render style: volumetric gold light,
  // slow living-space drift, and non-flat depth motion (not flat slides).
  const sceneProfiles = {
    "first-impulse": {
      period: 21.5,
      phase: 0.4,
      scale: 0.0045,
      x: 0.055,
      y: 0.04,
      rotate: 0.35,
      entryDelay: 120,
      entryDuration: 3400,
      entryAttack: 0.1,
      entryStrength: 0.16,
      brightness: 0.08,
    },
    emergence: {
      period: 16.4,
      phase: 1.3,
      scale: 0.0065,
      x: 0.09,
      y: 0.07,
      rotate: 0.55,
      entryDelay: 90,
      entryDuration: 3900,
      entryAttack: 0.18,
      entryStrength: 0.12,
      brightness: 0.1,
    },
    "first-continuity": {
      period: 19.2,
      phase: 2.1,
      scale: 0.005,
      x: 0.05,
      y: 0.14,
      rotate: 0.28,
      entryDelay: 180,
      entryDuration: 4200,
      entryAttack: 0.16,
      entryStrength: 0.1,
      brightness: 0.07,
    },
    "living-space": {
      period: 22.8,
      phase: 0.8,
      scale: 0.007,
      x: 0.16,
      y: 0.07,
      rotate: 0.42,
      entryDelay: 140,
      entryDuration: 4600,
      entryAttack: 0.2,
      entryStrength: 0.1,
      brightness: 0.09,
    },
    "space-responds": {
      period: 17.6,
      phase: 2.7,
      scale: 0.006,
      x: 0.14,
      y: 0.055,
      rotate: 0.5,
      entryDelay: 480,
      entryDuration: 5000,
      entryAttack: 0.17,
      entryStrength: 0.1,
      brightness: 0.1,
    },
    "first-horizon": {
      period: 26.4,
      phase: 1.8,
      scale: 0.0042,
      x: 0.07,
      y: 0.05,
      rotate: 0.22,
      entryDelay: 260,
      entryDuration: 5400,
      entryAttack: 0.24,
      entryStrength: 0.07,
      brightness: 0.06,
    },
    "hidden-current": {
      period: 20.1,
      phase: 3.2,
      scale: 0.0062,
      x: 0.18,
      y: 0.06,
      rotate: 0.6,
      entryDelay: 200,
      entryDuration: 4700,
      entryAttack: 0.18,
      entryStrength: 0.1,
      brightness: 0.09,
    },
    "field-awakens": {
      period: 15.2,
      phase: 0.15,
      scale: 0.0075,
      x: 0.12,
      y: 0.08,
      rotate: 0.65,
      entryDelay: 100,
      entryDuration: 4500,
      entryAttack: 0.15,
      entryStrength: 0.12,
      brightness: 0.12,
    },
    "living-continuum": {
      period: 28.5,
      phase: 2.45,
      scale: 0.0068,
      x: 0.1,
      y: 0.07,
      rotate: 0.48,
      entryDelay: 280,
      entryDuration: 6000,
      entryAttack: 0.22,
      entryStrength: 0.09,
      brightness: 0.11,
    },
  };

  const sceneState = new WeakMap();
  let smoothedProgress = new WeakMap();

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
    if (portrait.matches) return 0.38;
    if (shortViewport.matches) return 0.42;
    if (narrow.matches) return 0.62;
    return 1.15;
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
    const profile = sceneProfiles[scene.dataset.scene] || sceneProfiles.emergence;
    const wave = irregularWave(context.timeSeconds, profile);
    const tertiary = 0.5 + 0.5 * Math.sin(context.timeSeconds * 0.31 + profile.phase * 1.7);
    const distance = Math.abs(context.index - context.activeIndex);
    const proximity = distance === 0 ? 1 : distance === 1 ? 0.42 : 0.08;
    const elapsed = context.isActive ? context.now - context.enteredAt : -1;
    const semantic = semanticValues(scene.dataset.scene, elapsed, context.timeSeconds, wave, context.progress, proximity);
    const entry = context.isActive
      ? eventEnvelope(elapsed, profile.entryDelay, profile.entryDuration, profile.entryAttack) * profile.entryStrength * semantic.damping
      : 0;
    const ambientStrength = proximity * context.amplitude * semantic.damping;
    // Multi-frequency living motion (render-style volumetric breathe).
    const breathe = 0.55 + 0.45 * wave;
    const swirl = Math.sin(context.timeSeconds * 0.17 + profile.phase);
    const lift = Math.sin(context.timeSeconds * 0.11 + profile.phase * 0.4);
    const ambientScale = 1 + profile.scale * (0.55 + 0.9 * breathe + 0.25 * tertiary) * ambientStrength + entry * 0.35;
    const ambientX =
      (Math.sin((context.timeSeconds / profile.period) * Math.PI * 2 + profile.phase) * profile.x +
        swirl * profile.x * 0.35) *
      ambientStrength;
    const ambientY =
      (Math.sin((context.timeSeconds / (profile.period * 1.39)) * Math.PI * 2 + profile.phase * 0.63) * profile.y +
        lift * profile.y * 0.4) *
      ambientStrength;
    const rotateZ = swirl * (profile.rotate || 0.3) * ambientStrength;
    const rotateX = lift * (profile.rotate || 0.3) * 0.45 * ambientStrength;
    const brightness = 0.86 + (profile.brightness || 0.08) * (0.25 + 0.55 * wave) * proximity + entry * 0.22;
    const contrast = 1.05 + 0.035 * proximity * wave;
    const saturate = 0.86 + 0.055 * proximity * (0.4 + 0.6 * wave);
    const bloom = (0.04 + 0.12 * wave + entry * 0.5) * proximity * semantic.damping;
    const grain = (0.028 + 0.02 * tertiary) * proximity;

    // Smooth opacity to avoid flat hard cuts between stacked scenes.
    let state = sceneState.get(scene);
    if (!state) {
      state = { opacity: values.opacity, copy: values.copyOpacity };
      sceneState.set(scene, state);
    }
    const ease = context.isActive ? 0.14 : 0.09;
    state.opacity += (values.opacity - state.opacity) * ease;
    state.copy += (values.copyOpacity - state.copy) * ease;

    scene.style.setProperty("--scene-opacity", state.opacity.toFixed(4));
    scene.style.setProperty("--copy-opacity", state.copy.toFixed(4));
    scene.style.setProperty("--image-scale", values.scale.toFixed(5));
    scene.style.setProperty("--image-x", `${values.x.toFixed(3)}%`);
    scene.style.setProperty("--image-y", `${values.y.toFixed(3)}%`);
    scene.style.setProperty("--copy-x", `${values.copyX.toFixed(3)}rem`);
    scene.style.setProperty("--copy-y", `${values.copyY.toFixed(3)}rem`);
    scene.style.setProperty("--ambient-scale", ambientScale.toFixed(6));
    scene.style.setProperty("--ambient-x", `${ambientX.toFixed(4)}%`);
    scene.style.setProperty("--ambient-y", `${ambientY.toFixed(4)}%`);
    scene.style.setProperty("--ambient-rotate", `${rotateZ.toFixed(4)}deg`);
    scene.style.setProperty("--ambient-tilt", `${rotateX.toFixed(4)}deg`);
    scene.style.setProperty("--image-brightness", brightness.toFixed(4));
    scene.style.setProperty("--image-contrast", contrast.toFixed(4));
    scene.style.setProperty("--image-saturate", saturate.toFixed(4));
    scene.style.setProperty("--bloom-opacity", bloom.toFixed(4));
    scene.style.setProperty("--grain-opacity", grain.toFixed(4));
    scene.style.setProperty("--semantic-primary-opacity", semantic.primary.toFixed(4));
    scene.style.setProperty("--semantic-secondary-opacity", semantic.secondary.toFixed(4));
    scene.style.setProperty("--entry-opacity", entry.toFixed(4));
    scene.style.setProperty("--field-position-x", `${semantic.positionX.toFixed(2)}%`);
    scene.style.setProperty("--field-position-y", `${semantic.positionY.toFixed(2)}%`);
    scene.style.setProperty("--field-x", `${(semantic.fieldX * context.amplitude).toFixed(3)}%`);
    scene.style.setProperty("--field-y", `${(semantic.fieldY * context.amplitude).toFixed(3)}%`);
    scene.style.setProperty("--field-scale", semantic.fieldScale.toFixed(5));
    scene.style.setProperty("--volume-opacity", (0.08 + 0.16 * wave * proximity).toFixed(4));
    scene.style.setProperty("--structure-opacity", (0.08 + 0.17 * wave * proximity).toFixed(4));
    scene.style.setProperty("--residue-opacity", (distance === 1 ? 0.18 : distance === 0 ? 0.11 : 0.025).toFixed(4));
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
      scene.dataset.sceneState = "latent";
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
    const rawProgress = clamp(-rect.top / range);
    // Smooth scroll progress for cinematic non-flat transitions.
    let prev = smoothedProgress.get(act);
    if (prev == null) prev = rawProgress;
    const progress = prev + (rawProgress - prev) * 0.12;
    smoothedProgress.set(act, progress);
    const amplitude = viewportAmplitude() * 1.15;
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
      root.dataset.genesisAct = act.dataset.act || "";
      root.dataset.genesisScene = scenes[activeIndex]?.dataset.scene || "";
      scenes.forEach((scene, index) => {
        scene.dataset.sceneState = index === activeIndex ? "active" : index === activeIndex - 1 ? "residue" : "latent";
      });
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
    if (!motionActive || document.hidden || !storyVisible) return;

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
    if (!motionActive || document.hidden || !storyVisible || animationFrame) return;
    animationFrame = window.requestAnimationFrame(render);
  }

  function clearMotionStyles() {
    activeAct = null;
    acts.forEach((act) => {
      const identity = act.querySelector(".act__identity");
      identity?.removeAttribute("style");
      act.querySelectorAll("[data-scene]").forEach((scene) => {
        scene.removeAttribute("style");
        delete scene.dataset.sceneState;
      });
      const runtime = actRuntime.get(act);
      if (runtime) runtime.activeIndex = -1;
    });
    delete root.dataset.genesisAct;
    delete root.dataset.genesisScene;
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

  window.SemeAIMotion?.watch(
    document.querySelector(".genesis-transition"),
    (state) => {
      storyVisible = state !== "running";
      if (!storyVisible && animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else if (storyVisible) {
        requestRender();
      }
    },
    { threshold: 0.02, rootMargin: "-18% 0px" }
  );

  applyMotionPreference();
})();
