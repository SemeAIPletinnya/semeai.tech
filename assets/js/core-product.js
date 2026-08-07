(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = window.matchMedia("(pointer: coarse)");
  const body = document.body;
  const route = body.dataset.v2Route || "";
  const isCore = document.documentElement.classList.contains("core-product");
  if (!isCore) return;

  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function mountLayers() {
    if (document.querySelector(".cp-canvas")) return;
    const canvas = document.createElement("canvas");
    canvas.className = "cp-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const grain = document.createElement("div");
    grain.className = "cp-grain";
    grain.setAttribute("aria-hidden", "true");
    const vignette = document.createElement("div");
    vignette.className = "cp-vignette";
    vignette.setAttribute("aria-hidden", "true");
    body.prepend(vignette);
    body.prepend(grain);
    body.prepend(canvas);
    return canvas;
  }

  function initFieldTelemetry() {
    const forceEl = document.querySelector("[data-cp-force]");
    const stateEl = document.querySelector("[data-cp-state]");
    if (!forceEl) return { setForce() {}, setState() {} };
    return {
      setForce(v) { forceEl.textContent = Number(v).toFixed(2); },
      setState(s) { if (stateEl) stateEl.textContent = s; },
    };
  }

  function initCanvas(canvas) {
    if (!canvas || reduced.matches) return { setPointer() {}, setGateState() {}, setForce() {} };
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return { setPointer() {}, setGateState() {}, setForce() {} };

    let w = 0;
    let h = 0;
    let frame = 0;
    let last = 0;
    let stopped = false;
    let pointer = { x: 0.42, y: 0.5 };
    let force = 0.38;
    let gateState = "idle";
    const nodes = Array.from({ length: coarse.matches ? 16 : 30 }, (_, i) => ({
      x: ((i * 47) % 101) / 100,
      y: ((i * 73) % 97) / 96,
      s: 0.000012 + (i % 5) * 0.000002,
      p: i * 0.71,
      r: 0.7 + (i % 4) * 0.34,
    }));

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = innerWidth;
      h = innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function bg(rgb, intensity = 1) {
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.985)`;
      ctx.fillRect(0, 0, w, h);
      const px = (pointer.x - 0.5) * 0.08 * w;
      const py = (pointer.y - 0.5) * 0.05 * h;
      const g = ctx.createRadialGradient(w * 0.58 + px, h * 0.5 + py, 0, w * 0.58 + px, h * 0.5 + py, Math.max(w, h) * 0.66);
      g.addColorStop(0, `rgba(71,177,195,${0.09 * intensity})`);
      g.addColorStop(0.4, `rgba(32,84,98,${0.045 * intensity})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    function grid(accent, alpha = 0.1) {
      const horizonY = h * 0.53 + (pointer.y - 0.5) * 8;
      const vanishX = w * 0.58 + (pointer.x - 0.5) * 24;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizonY, w, h - horizonY);
      ctx.clip();
      for (let i = -9; i <= 9; i += 1) {
        ctx.beginPath();
        ctx.moveTo(vanishX + i * 7, horizonY);
        ctx.lineTo(vanishX + i * (w / 9), h);
        ctx.strokeStyle = `rgba(${accent},${alpha * (1 - Math.abs(i) / 24)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawField(now) {
      bg([6, 16, 21], 0.9 + force * 0.2);
      grid("102,221,242", 0.09 + force * 0.05);
      const boundary = w * 0.58;
      // authority membrane
      ctx.fillStyle = "rgba(216,183,110,0.55)";
      ctx.fillRect(boundary, h * 0.14, 1.4, h * 0.62);
      ctx.fillStyle = "rgba(216,183,110,0.08)";
      ctx.fillRect(boundary + 3, h * 0.18, 1, h * 0.54);
      // rings on boundary
      [[h * 0.28, 34], [h * 0.72, 28]].forEach(([cy, r]) => {
        ctx.beginPath();
        ctx.arc(boundary, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(216,183,110,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      // candidate mass
      const approach = clamp(force);
      const cx = lerp(w * 0.22, boundary - 28, approach * 0.72 + (pointer.x < 0.58 ? pointer.x * 0.15 : 0));
      const cy = lerp(h * 0.48, h * 0.46, pointer.y);
      const radius = 10 + approach * 8;
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 5);
      halo.addColorStop(0, `rgba(102,221,242,${0.18 + approach * 0.2})`);
      halo.addColorStop(1, "rgba(102,221,242,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#66ddf2";
      ctx.shadowColor = "#66ddf2";
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2.1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(102,221,242,0.35)";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 3.1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(102,221,242,0.16)";
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      // field streams that stop at boundary
      nodes.forEach((n, i) => {
        const t = (now * n.s + n.x) % 1;
        const eased = 1 - Math.pow(1 - t, 2.4);
        const x = Math.min(w * 0.08 + eased * (boundary - w * 0.12), boundary - 6);
        const y = n.y * h * 0.7 + h * 0.15 + Math.sin(now * 0.0002 + n.p) * 10;
        ctx.beginPath();
        ctx.fillStyle = i % 5 === 0 ? "rgba(216,183,110,0.28)" : "rgba(102,221,242,0.2)";
        ctx.arc(x, y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawGate(now) {
      const color = gateState === "review" ? [232, 185, 94]
        : (gateState === "block" || gateState === "error") ? [231, 116, 111]
        : gateState === "show" ? [105, 221, 162]
        : [102, 221, 242];
      bg([7, 10, 14], 1);
      grid(`${color[0]},${color[1]},${color[2]}`, 0.07);
      const axis = w * 0.5;
      const cy = h * 0.46;
      const R = Math.min(w, h) * 0.16;
      for (let ring = 1; ring <= 5; ring += 1) {
        ctx.beginPath();
        ctx.ellipse(axis, cy, R * ring * 0.55, R * ring * 0.22, now * 0.00001 * (ring % 2 ? 1 : -1), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${0.08 + ring * 0.015})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // hexagon authority mark
      const hr = R * 0.55;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = -Math.PI / 2 + (i / 6) * Math.PI * 2 + now * 0.00005;
        const x = axis + Math.cos(a) * hr;
        const y = cy + Math.sin(a) * hr * 0.9;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},0.45)`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // candidate fates
      nodes.slice(0, 18).forEach((n, i) => {
        let progress = (now * n.s * 1.3 + n.x) % 1;
        let x = w * 0.08 + progress * w * 0.84;
        if (gateState === "review") x = axis - 50 + Math.sin(now * 0.0008 + n.p) * 36;
        if (gateState === "block" || gateState === "error") x = Math.min(x, axis - 24 - (i % 4) * 6);
        if (gateState === "show") x = w * 0.08 + progress * w * 0.84;
        if (gateState === "idle" || gateState === "working") x = Math.min(x, axis - 18);
        if (gateState !== "show") x = Math.min(x, axis - 8);
        const y = cy + Math.sin(now * 0.00025 + n.p) * R * 0.85;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${gateState === "idle" ? 0.12 : 0.28})`;
        ctx.arc(x, y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (gateState === "error") {
        ctx.fillStyle = "rgba(231,116,111,0.04)";
        ctx.fillRect(0, 0, w, h);
      }
    }

    function drawLab(now) {
      bg([12, 12, 15], 0.95);
      grid("185,160,255", 0.06);
      const cols = 7;
      const base = h * 0.72;
      for (let i = 0; i < cols; i += 1) {
        const ratio = 0.28 + ((i * 17) % 7) * 0.08;
        const x = w * (0.18 + i * (0.64 / (cols - 1)));
        const bar = h * 0.22 * ratio + Math.sin(now * 0.0003 + i) * 4;
        ctx.fillStyle = "rgba(102,221,242,0.08)";
        ctx.fillRect(x - 1, base - bar, 2, bar);
        ctx.beginPath();
        ctx.fillStyle = "rgba(102,221,242,0.35)";
        ctx.arc(x, base - bar, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function render(now) {
      if (stopped) return;
      frame = requestAnimationFrame(render);
      if (document.hidden || now - last < 33) return;
      last = now;
      ctx.clearRect(0, 0, w, h);
      if (route === "field") drawField(now);
      else if (route === "gate") drawGate(now);
      else if (route === "lab") drawLab(now);
    }

    resize();
    addEventListener("resize", resize, { passive: true });
    frame = requestAnimationFrame(render);
    addEventListener("pagehide", () => { stopped = true; cancelAnimationFrame(frame); }, { once: true });

    return {
      setPointer(x, y) { pointer = { x: clamp(x), y: clamp(y) }; },
      setForce(v) { force = clamp(v, 0.1, 1); },
      setGateState(s) { gateState = String(s || "idle").toLowerCase(); },
    };
  }

  function initField(api, telemetry) {
    if (route !== "field") return;
    const stage = document.querySelector(".cp-world") || body;
    let target = 0.38;
    let current = 0.38;
    let raf = 0;

    const tick = () => {
      current = lerp(current, target, 0.08);
      api.setForce?.(current);
      telemetry.setForce(current);
      if (Math.abs(target - current) > 0.004) raf = requestAnimationFrame(tick);
      else raf = 0;
    };

    const onMove = (e) => {
      if (reduced.matches || coarse.matches) return;
      const x = e.clientX / innerWidth;
      const y = e.clientY / innerHeight;
      api.setPointer?.(x, y);
      const boundary = 0.58;
      target = clamp(0.22 + (1 - Math.abs(x - boundary)) * 0.7, 0.18, 0.96);
      telemetry.setState(x > boundary - 0.08 ? "TENSION" : "BOUND");
      if (!raf) raf = requestAnimationFrame(tick);
    };

    stage.addEventListener("pointermove", onMove, { passive: true });
    stage.addEventListener("pointerleave", () => {
      target = 0.38;
      telemetry.setState("BOUND");
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });

    document.querySelectorAll("a[href*='gate.html']").forEach((link) => {
      link.addEventListener("pointerenter", () => {
        target = 0.84;
        telemetry.setState("TENSION");
        document.querySelector("[data-field-scene]")?.setAttribute("data-field-motion", "tension");
        if (!raf) raf = requestAnimationFrame(tick);
      }, { passive: true });
      link.addEventListener("focus", () => {
        target = 0.84;
        telemetry.setState("TENSION");
        document.querySelector("[data-field-scene]")?.setAttribute("data-field-motion", "tension");
        if (!raf) raf = requestAnimationFrame(tick);
      });
      link.addEventListener("pointerleave", () => {
        target = 0.38;
        telemetry.setState("BOUND");
        document.querySelector("[data-field-scene]")?.setAttribute("data-field-motion", "ambient");
      }, { passive: true });
      link.addEventListener("blur", () => {
        target = 0.38;
        telemetry.setState("BOUND");
        document.querySelector("[data-field-scene]")?.setAttribute("data-field-motion", "ambient");
      });
    });
  }

  function initGateBridge(api) {
    if (route !== "gate") return;
    const terminal = document.querySelector("[data-cp-terminal]") || document.getElementById("commercial-demo-result");
    const live = document.getElementById("live-gate");

    const sync = () => {
      const decision = (live?.dataset.decision || "IDLE").toLowerCase();
      api.setGateState?.(decision);
      if (terminal) terminal.dataset.decision = (live?.dataset.decision || "IDLE");
      body.dataset.gateState = decision;
    };

    if (live) {
      new MutationObserver(sync).observe(live, { attributes: true, attributeFilter: ["data-decision"] });
    }
    window.addEventListener("semeai:gate-decision", (event) => {
      const action = String(event.detail?.action || "ERROR").toLowerCase();
      api.setGateState?.(action);
      if (terminal) terminal.dataset.decision = String(event.detail?.action || "ERROR");
    });
    sync();
  }

  function initAxiomStrip() {
    const strip = document.querySelector("[data-cp-axiom]");
    if (!strip) return;
    const stateEl = strip.querySelector("[data-cp-axiom-state]");
    const msgEl = strip.querySelector("[data-cp-axiom-msg]");
    const map = {
      field: ["IDLE", "Witnessing possibility. No release authority."],
      gate: ["ATTENTIVE", "Facing the boundary. Never deciding."],
      lab: ["ATTENTIVE", "Observing evidence assembly. Not scoring."],
    };
    const [state, msg] = map[route] || ["IDLE", "Witnessing continuity."];
    if (stateEl) stateEl.textContent = state;
    if (msgEl) msgEl.textContent = msg;

    window.addEventListener("semeai:gate-decision", (event) => {
      const action = String(event.detail?.action || "").toUpperCase();
      const next = {
        WORKING: ["WORKING", "Observing the request. No state inferred before the response."],
        SHOW: ["RESULT", "Exact candidate verified. Witnessing release and receipt."],
        REVIEW: ["REVIEW", "Candidate suspended before the boundary."],
        BLOCK: ["HELD", "Release withheld. Audit preserved."],
        ERROR: ["ERROR", "No authority response. Fail-closed boundary."],
      }[action];
      if (!next) return;
      if (stateEl) stateEl.textContent = next[0];
      if (msgEl) msgEl.textContent = next[1];
    });
  }

  function boot() {
    const canvas = mountLayers();
    const api = initCanvas(canvas);
    const telemetry = initFieldTelemetry();
    initField(api, telemetry);
    initGateBridge(api);
    initAxiomStrip();
    window.dispatchEvent(new CustomEvent("semeai:axiom-context", {
      detail: {
        source: route || "core",
        state: route === "gate" || route === "lab" ? "ATTENTIVE" : "IDLE",
      },
    }));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
