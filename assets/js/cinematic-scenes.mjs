const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
const smooth = (t) => {
  const value = clamp(t);
  return value * value * (3 - 2 * value);
};

const COLORS = Object.freeze({
  field: [6, 16, 21],
  gate: [7, 10, 14],
  benchmark: [12, 12, 15],
  cyan: "#66ddf2",
  cyanDim: "rgba(102,221,242,0.22)",
  gold: "#d8b76e",
  green: "#69dda2",
  review: "#e8b95e",
  block: "#e7746f",
  ink: "#020507"
});

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function circle(ctx, x, y, radius, stroke, width = 1, fill = null) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, radius), 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function hexagon(ctx, x, y, radius, rotation, stroke, width = 1, fill = null) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = rotation + (i / 6) * TAU;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function drawWorldBackground(ctx, viewport, color, time, pointer, intensity = 1) {
  const { width: w, height: h } = viewport;
  const px = (pointer.x - 0.5) * 0.08 * w;
  const py = (pointer.y - 0.5) * 0.05 * h;
  ctx.fillStyle = rgba(color, 0.985);
  ctx.fillRect(0, 0, w, h);

  const horizon = ctx.createRadialGradient(
    w * 0.58 + px,
    h * 0.5 + py,
    0,
    w * 0.58 + px,
    h * 0.5 + py,
    Math.max(w, h) * 0.66
  );
  horizon.addColorStop(0, `rgba(71,177,195,${0.085 * intensity})`);
  horizon.addColorStop(0.35, `rgba(32,84,98,${0.045 * intensity})`);
  horizon.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, w, h);

  const pulse = 0.5 + Math.sin(time * 0.25) * 0.5;
  const floor = ctx.createLinearGradient(0, h * 0.45, 0, h);
  floor.addColorStop(0, "rgba(0,0,0,0)");
  floor.addColorStop(1, `rgba(0,0,0,${0.38 + pulse * 0.04})`);
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, w, h);
}

function drawPerspectiveGrid(ctx, viewport, time, pointer, accent = "102,221,242", alpha = 0.1) {
  const { width: w, height: h } = viewport;
  const horizonY = h * 0.53 + (pointer.y - 0.5) * 8;
  const vanishX = w * 0.58 + (pointer.x - 0.5) * 24;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizonY, w, h - horizonY);
  ctx.clip();
  for (let i = -9; i <= 9; i += 1) {
    const target = vanishX + i * 7;
    const bottom = vanishX + i * (w / 9);
    line(ctx, target, horizonY, bottom, h, `rgba(${accent},${alpha * (1 - Math.abs(i) / 24)})`);
  }
  const drift = (time * 10) % 1;
  for (let i = 0; i < 12; i += 1) {
    const normalized = (i + drift) / 12;
    const depth = normalized * normalized;
    const y = horizonY + depth * (h - horizonY);
    line(ctx, 0, y, w, y, `rgba(${accent},${alpha * (0.18 + normalized * 0.82)})`);
  }
  ctx.restore();
}

function drawTrace(ctx, points, color, strength = 1) {
  if (points.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const point = points[i];
    const cx = (previous.x + point.x) / 2;
    ctx.quadraticCurveTo(previous.x, previous.y, cx, (previous.y + point.y) / 2);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * strength;
  ctx.shadowBlur = 18 * strength;
  ctx.shadowColor = color;
  ctx.stroke();
  points.forEach((point, index) => {
    if (index % 3 === 0) circle(ctx, point.x, point.y, 1.4 + strength, null, 0, color);
  });
  ctx.restore();
}

function drawCandidate(ctx, x, y, radius, time, state = "IDLE", energy = 1) {
  const color = state === "SHOW"
    ? COLORS.green
    : state === "REVIEW"
      ? COLORS.review
      : ["BLOCK", "ERROR"].includes(state)
        ? COLORS.block
        : COLORS.cyan;
  const rotation = time * 0.12;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  circle(ctx, x, y, radius * 1.65, `${color}18`, 1);
  circle(ctx, x, y, radius * 1.25, `${color}25`, 1);
  hexagon(ctx, x, y, radius, rotation, `${color}9c`, 1.25, `${color}0d`);
  hexagon(ctx, x, y, radius * 0.68, -rotation * 1.4, `${color}d2`, 1);
  ctx.shadowBlur = 25 * energy;
  ctx.shadowColor = color;
  circle(ctx, x, y, Math.max(2.2, radius * 0.09), null, 0, color);
  ctx.restore();
  return { color };
}

function drawAuthorityBoundary(ctx, x, viewport, time, state = "IDLE", intensity = 1) {
  const { height: h } = viewport;
  const top = h * 0.19;
  const bottom = h * 0.86;
  const color = state === "SHOW"
    ? "105,221,162"
    : state === "REVIEW"
      ? "232,185,94"
      : ["BLOCK", "ERROR"].includes(state)
        ? "231,116,111"
        : "102,221,242";
  const breath = 0.68 + Math.sin(time * 0.48) * 0.12;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = -3; i <= 3; i += 1) {
    const offset = i * 6;
    const localAlpha = (0.05 + (1 - Math.abs(i) / 4) * 0.14) * intensity * breath;
    ctx.beginPath();
    ctx.moveTo(x + offset, top);
    for (let step = 0; step <= 20; step += 1) {
      const y = lerp(top, bottom, step / 20);
      const bend = Math.sin(step * 0.92 + time * 0.45 + i) * (2 + Math.abs(i));
      ctx.lineTo(x + offset + bend, y);
    }
    ctx.strokeStyle = `rgba(${color},${localAlpha})`;
    ctx.lineWidth = i === 0 ? 1.4 : 0.7;
    ctx.stroke();
  }
  const apertureY = h * 0.52;
  circle(ctx, x, apertureY, 44 + Math.sin(time * 0.6) * 3, `rgba(${color},${0.2 * intensity})`, 1);
  circle(ctx, x, apertureY, 63, `rgba(${color},${0.08 * intensity})`, 1);
  line(ctx, x - 13, top, x - 13, bottom, `rgba(${color},${0.08 * intensity})`);
  line(ctx, x + 13, top, x + 13, bottom, `rgba(${color},${0.08 * intensity})`);
  ctx.restore();
}

function drawField(ctx, viewport, time, pointer, state) {
  const { width: w, height: h } = viewport;
  drawWorldBackground(ctx, viewport, COLORS.field, time, pointer, 1.15);
  drawPerspectiveGrid(ctx, viewport, time, pointer, "102,221,242", 0.075);

  const boundaryX = w * (w < 760 ? 0.71 : 0.67);
  drawAuthorityBoundary(ctx, boundaryX, viewport, time, "IDLE", 0.84);

  const fieldForce = 0.34 + pointer.energy * 0.22;
  const candidateX = w * (w < 760 ? 0.55 : 0.57) + (pointer.x - 0.5) * 22;
  const candidateY = h * (w < 760 ? 0.59 : 0.57) + (pointer.y - 0.5) * 18;
  const approach = Math.max(0, 1 - Math.abs(boundaryX - candidateX) / (w * 0.24));
  const resistance = approach * approach * 22;

  for (let band = 0; band < 6; band += 1) {
    const y0 = h * (0.36 + band * 0.052);
    const phase = time * (0.12 + band * 0.008) + band * 0.81;
    ctx.beginPath();
    ctx.moveTo(w * 0.26, y0);
    for (let step = 0; step <= 18; step += 1) {
      const t = step / 18;
      const x = lerp(w * 0.26, boundaryX - 15, t);
      const y = y0 + Math.sin(phase + t * 5.5) * (5 + t * 12) - resistance * t * t;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(102,221,242,${0.035 + band * 0.004})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  const trail = [];
  for (let i = 0; i < 14; i += 1) {
    const t = i / 13;
    trail.push({
      x: lerp(w * 0.35, candidateX, t),
      y: candidateY + Math.sin(t * 8 - time * 0.4) * 9 * (1 - t)
    });
  }
  drawTrace(ctx, trail, "rgba(102,221,242,0.24)", 0.8);
  drawCandidate(ctx, candidateX - resistance, candidateY, 28 + fieldForce * 12, time, "IDLE", 0.8);

  ctx.save();
  ctx.translate(boundaryX + 29, candidateY);
  ctx.fillStyle = "rgba(102,221,242,0.38)";
  ctx.font = "600 9px Cascadia Mono, Consolas, monospace";
  ctx.letterSpacing = "1px";
  ctx.fillText("AUTHORITY HOLDS", 0, -58);
  ctx.restore();

  state.fieldForce = fieldForce;
}

function drawChamberFrame(ctx, viewport, time, pointer, state) {
  const { width: w, height: h } = viewport;
  const centerX = w * 0.53;
  const centerY = h * 0.51;
  drawWorldBackground(ctx, viewport, COLORS.gate, time, pointer, 0.9);
  drawPerspectiveGrid(ctx, viewport, time * 0.8, pointer, "216,183,110", 0.048);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((pointer.x - 0.5) * 0.025);
  for (let i = 0; i < 5; i += 1) {
    const rx = 95 + i * 48;
    const ry = 44 + i * 22;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, Math.PI, TAU);
    ctx.strokeStyle = `rgba(216,183,110,${0.035 + i * 0.012})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  drawAuthorityBoundary(ctx, centerX, viewport, time, state, 1);
  return { centerX, centerY };
}

function gatePosition(viewport, time, gate) {
  const { width: w, height: h } = viewport;
  const boundaryX = w * 0.53;
  const y = h * 0.51;
  const elapsed = Math.max(0, time - gate.startedAt);
  const preX = boundaryX - Math.min(150, w * 0.12);

  if (gate.state === "WORKING") {
    return { x: preX + Math.sin(time * 4) * 2, y, elapsed, alpha: 1 };
  }
  if (gate.state === "SHOW") {
    const travel = ease(elapsed / 2.25);
    return { x: lerp(preX, boundaryX + Math.min(210, w * 0.17), travel), y, elapsed, alpha: 1 };
  }
  if (gate.state === "REVIEW") {
    const braking = ease(elapsed / 0.85);
    const orbit = Math.max(0, elapsed - 0.85);
    return {
      x: lerp(preX, boundaryX - 34, braking) + Math.cos(orbit * 1.45) * Math.min(18, orbit * 8),
      y: y + Math.sin(orbit * 1.45) * Math.min(36, orbit * 15),
      elapsed,
      alpha: 1
    };
  }
  if (gate.state === "BLOCK") {
    const hit = ease(Math.min(elapsed / 0.72, 1));
    const after = Math.max(0, elapsed - 0.72);
    const returnTravel = smooth(after / 1.5);
    return {
      x: lerp(preX, boundaryX - 11, hit) - returnTravel * Math.min(115, w * 0.1),
      y: y + Math.sin(after * 7) * 5 * (1 - returnTravel),
      elapsed,
      alpha: 1 - returnTravel * 0.62
    };
  }
  if (gate.state === "ERROR") {
    return { x: preX, y: y + Math.sin(time * 5) * 1.5, elapsed, alpha: 0.68 };
  }
  return { x: preX, y, elapsed, alpha: 0.64 };
}

function drawGate(ctx, viewport, time, pointer, state) {
  const gate = state.gate;
  const visualState = gate.state === "WORKING" ? "IDLE" : gate.state;
  const chamber = drawChamberFrame(ctx, viewport, time, pointer, visualState);
  const position = gatePosition(viewport, time, gate);
  const trail = [];

  if (gate.state === "SHOW") {
    const startX = chamber.centerX - Math.min(150, viewport.width * 0.12);
    for (let i = 0; i < 18; i += 1) {
      const t = i / 17;
      trail.push({ x: lerp(startX, position.x, t), y: position.y + Math.sin(t * 10 - time) * 4 * (1 - t) });
    }
    drawTrace(ctx, trail, "rgba(105,221,162,0.5)", 1.1);
    const open = clamp(position.elapsed / 1.2);
    circle(ctx, chamber.centerX, chamber.centerY, 45 + open * 38, `rgba(105,221,162,${0.28 * (1 - open * 0.35)})`, 1.2);
  } else if (gate.state === "REVIEW") {
    const orbitStrength = clamp((position.elapsed - 0.7) / 1.2);
    ctx.save();
    ctx.setLineDash([3, 8]);
    circle(ctx, chamber.centerX - 22, chamber.centerY, 58, `rgba(232,185,94,${0.3 * orbitStrength})`, 1);
    ctx.restore();
    line(ctx, chamber.centerX - 34, chamber.centerY - 82, chamber.centerX - 34, chamber.centerY + 82, "rgba(232,185,94,0.18)");
  } else if (gate.state === "BLOCK") {
    const impact = clamp((position.elapsed - 0.45) / 0.45) * (1 - clamp((position.elapsed - 1.0) / 1.4));
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * TAU;
      const length = 28 + i * 3 + impact * 62;
      line(
        ctx,
        chamber.centerX - 8 + Math.cos(angle) * 12,
        chamber.centerY + Math.sin(angle) * 12,
        chamber.centerX - 8 + Math.cos(angle) * length,
        chamber.centerY + Math.sin(angle) * length,
        `rgba(231,116,111,${0.3 * impact})`
      );
    }
  } else if (gate.state === "ERROR") {
    ctx.save();
    ctx.setLineDash([2, 11]);
    circle(ctx, position.x, position.y, 54, "rgba(231,116,111,0.35)", 1.2);
    ctx.restore();
    for (let i = 0; i < 3; i += 1) {
      const y = position.y - 24 + i * 24;
      line(ctx, position.x - 44, y, position.x + 44, y, `rgba(231,116,111,${0.2 - i * 0.04})`);
    }
  }

  ctx.save();
  ctx.globalAlpha = position.alpha;
  drawCandidate(ctx, position.x, position.y, 27, time, visualState, 1);
  ctx.restore();

  if (gate.state === "SHOW" && position.elapsed > 1.65) {
    const settle = ease((position.elapsed - 1.65) / 1.0);
    const receiptX = chamber.centerX + Math.min(270, viewport.width * 0.21);
    const receiptY = chamber.centerY + 96;
    line(ctx, position.x, position.y, receiptX, receiptY, `rgba(105,221,162,${0.2 * settle})`);
    hexagon(ctx, receiptX, receiptY, 14 + settle * 5, time * 0.05, `rgba(105,221,162,${0.5 * settle})`, 1, `rgba(105,221,162,${0.08 * settle})`);
  }
  if (["REVIEW", "BLOCK"].includes(gate.state) && position.elapsed > 1.1) {
    const persist = ease((position.elapsed - 1.1) / 0.8);
    const receiptX = chamber.centerX + 72;
    const receiptY = chamber.centerY + 112;
    const color = gate.state === "REVIEW" ? "232,185,94" : "231,116,111";
    line(ctx, chamber.centerX, chamber.centerY, receiptX, receiptY, `rgba(${color},${0.16 * persist})`);
    hexagon(ctx, receiptX, receiptY, 13, 0, `rgba(${color},${0.45 * persist})`, 1);
  }
}

function drawBenchmark(ctx, viewport, time, pointer, state) {
  const { width: w, height: h } = viewport;
  drawWorldBackground(ctx, viewport, COLORS.benchmark, time, pointer, 0.85);
  drawPerspectiveGrid(ctx, viewport, time * 0.55, pointer, "216,183,110", 0.045);

  const data = state.benchmark;
  // On desktop the sculpture owns the lower-right spatial well beneath the
  // evidence ledger; on mobile it recenters into the single-column world.
  const centerX = w * (w < 760 ? 0.5 : 0.73);
  const centerY = h * (w < 760 ? 0.63 : 0.8);
  const elapsed = Math.max(0, time - data.startedAt);
  const radii = w < 760 ? [76, 112] : [112, 164];

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((pointer.x - 0.5) * 0.04);
  ctx.scale(1, 0.42);
  circle(ctx, 0, 0, radii[1], "rgba(216,183,110,0.22)", 1);
  circle(ctx, 0, 0, radii[0], "rgba(102,221,242,0.18)", 1);
  ctx.restore();

  const categories = data.categories.length === 7
    ? data.categories
    : Array.from({ length: 7 }, (_, index) => ({ key: `signal_${index + 1}`, ratio: 0, score: 0, max: 0 }));
  const assembling = data.state === "ASSEMBLING" || data.state === "RESULT";

  categories.forEach((category, index) => {
    const angle = -Math.PI / 2 + (index / 7) * TAU + Math.sin(time * 0.12) * 0.01;
    const radius = index % 2 === 0 ? radii[1] : lerp(radii[0], radii[1], 0.72);
    const baseX = centerX + Math.cos(angle) * radius;
    const baseY = centerY + Math.sin(angle) * radius * 0.42;
    const local = assembling ? ease((elapsed - index * 0.24) / 0.86) : 0;
    const ratio = clamp(category.ratio || 0);
    const height = local * (22 + ratio * (w < 760 ? 74 : 126));
    const width = w < 760 ? 12 : 21;
    const hue = ratio >= 0.7 ? "105,221,162" : ratio >= 0.35 ? "216,183,110" : "102,221,242";

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const gradient = ctx.createLinearGradient(0, baseY - height, 0, baseY);
    gradient.addColorStop(0, `rgba(${hue},${0.72 * local})`);
    gradient.addColorStop(1, `rgba(${hue},${0.08 * local})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(baseX - width / 2, baseY - height, width, height);
    line(ctx, baseX - width / 2, baseY - height, baseX + width / 2, baseY - height, `rgba(${hue},${0.82 * local})`, 1.4);
    circle(ctx, baseX, baseY - height, 2.4, null, 0, `rgba(${hue},${local})`);
    if (local > 0.72) {
      line(ctx, baseX, baseY - height, centerX, centerY, `rgba(${hue},${0.08 * local})`);
    }
    ctx.restore();
  });

  const convergence = ease((elapsed - 1.75) / 1.25);
  const resultReady = data.state === "RESULT" && convergence > 0;
  if (resultReady) {
    for (let ring = 0; ring < 4; ring += 1) {
      circle(
        ctx,
        centerX,
        centerY,
        18 + ring * 13 + Math.sin(time * 0.4 + ring) * 2,
        `rgba(216,183,110,${(0.28 - ring * 0.05) * convergence})`,
        1
      );
    }
    hexagon(ctx, centerX, centerY, 19, time * 0.08, `rgba(216,183,110,${0.78 * convergence})`, 1.4, `rgba(216,183,110,${0.08 * convergence})`);
  } else {
    hexagon(ctx, centerX, centerY, 14, time * 0.06, "rgba(102,221,242,0.22)", 1);
  }
}

function sceneColor(scene) {
  return COLORS[scene] || COLORS.field;
}

export class CinematicRenderer {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false, desynchronized: true });
    this.reducedMotion = reducedMotion;
    this.viewport = { width: 1, height: 1, dpr: 1 };
    this.pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, energy: 0 };
    this.scene = "field";
    this.previousScene = "field";
    this.sceneStartedAt = 0;
    this.transitionDuration = reducedMotion ? 0 : 1.15;
    this.state = {
      fieldForce: 0.38,
      gate: { state: "IDLE", startedAt: 0 },
      benchmark: { state: "IDLE", startedAt: 0, categories: [] }
    };
    this.resize();
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const dpr = Math.min(1.75, Math.max(1, window.devicePixelRatio || 1));
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.viewport = { width, height, dpr };
  }

  setPointer(x, y) {
    this.pointer.targetX = clamp(x);
    this.pointer.targetY = clamp(y);
    const dx = this.pointer.targetX - this.pointer.x;
    const dy = this.pointer.targetY - this.pointer.y;
    this.pointer.energy = clamp(Math.hypot(dx, dy) * 3.2, 0, 1);
  }

  setScene(scene, now = performance.now() / 1000) {
    if (!["field", "gate", "benchmark"].includes(scene) || scene === this.scene) return;
    this.previousScene = this.scene;
    this.scene = scene;
    this.sceneStartedAt = now;
  }

  setGateState(state, now = performance.now() / 1000) {
    this.state.gate = { state, startedAt: now };
  }

  setBenchmarkState(state, categories = this.state.benchmark.categories, now = performance.now() / 1000) {
    const carriesAssemblyClock = state === "RESULT" && this.state.benchmark.state === "ASSEMBLING";
    this.state.benchmark = {
      state,
      categories,
      startedAt: carriesAssemblyClock ? this.state.benchmark.startedAt : now
    };
  }

  drawScene(scene, time, alpha = 1) {
    const ctx = this.context;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (scene === "field") drawField(ctx, this.viewport, time, this.pointer, this.state);
    if (scene === "gate") drawGate(ctx, this.viewport, time, this.pointer, this.state);
    if (scene === "benchmark") drawBenchmark(ctx, this.viewport, time, this.pointer, this.state);
    ctx.restore();
  }

  render(nowMs = performance.now()) {
    const time = nowMs / 1000;
    this.pointer.x = lerp(this.pointer.x, this.pointer.targetX, this.reducedMotion ? 1 : 0.045);
    this.pointer.y = lerp(this.pointer.y, this.pointer.targetY, this.reducedMotion ? 1 : 0.045);
    this.pointer.energy = lerp(this.pointer.energy, 0, 0.035);

    const { dpr, width, height } = this.viewport;
    const ctx = this.context;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const transition = this.transitionDuration === 0
      ? 1
      : clamp((time - this.sceneStartedAt) / this.transitionDuration);
    if (transition < 1 && this.previousScene !== this.scene) {
      const blend = smooth(transition);
      this.drawScene(this.previousScene, time, 1 - blend);
      this.drawScene(this.scene, time, blend);
      const from = sceneColor(this.previousScene);
      const to = sceneColor(this.scene);
      const seam = ctx.createLinearGradient(0, 0, width, 0);
      seam.addColorStop(0, rgba(from, 0));
      seam.addColorStop(0.5, rgba(to, 0.06 * Math.sin(blend * Math.PI)));
      seam.addColorStop(1, rgba(to, 0));
      ctx.fillStyle = seam;
      ctx.fillRect(0, 0, width, height);
    } else {
      this.drawScene(this.scene, time, 1);
    }
  }
}
