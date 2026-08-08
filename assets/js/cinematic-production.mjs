import { AxiomWitness } from "/assets/js/cinematic-axiom-witness.mjs";
import { CinematicRenderer } from "/assets/js/cinematic-scenes.mjs";

const html = document.documentElement;
const body = document.body;

if (!html.classList.contains("cinematic-production")) {
  throw new Error("The production cinematic runtime requires the cinematic-production root class.");
}

const route = body.dataset.v2Route || "field";
const scene = route === "lab" ? "benchmark" : route;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointer = window.matchMedia("(pointer: coarse)");
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (from, to, amount) => from + (to - from) * amount;

html.dataset.cinematicScene = scene;

function t(key, fallback) {
  const value = window.SemeAI_I18n?.t?.(key);
  return value && value !== key ? value : fallback;
}

function mountCanvas() {
  let canvas = document.getElementById("cinematic-canvas");
  if (canvas) return canvas;
  canvas = document.createElement("canvas");
  canvas.id = "cinematic-canvas";
  canvas.className = "cinematic-canvas";
  canvas.setAttribute("aria-hidden", "true");
  body.prepend(canvas);
  return canvas;
}

const renderer = new CinematicRenderer(mountCanvas(), { reducedMotion: reducedMotion.matches });
renderer.scene = scene;
renderer.previousScene = scene;
renderer.sceneStartedAt = performance.now() / 1000;

const axiomElement = document.querySelector("[data-axiom-witness]");
const axiom = new AxiomWitness(axiomElement, { reducedMotion: reducedMotion.matches });
let semanticState = scene === "field" ? "IDLE" : "ATTENTIVE";
let semanticMessageKey = scene;
let pendingAgentWitness = null;

function flushAgentWitness() {
  if (!pendingAgentWitness) return;
  const agent = window.SemeAI_Axiom;
  const agentRoot = document.querySelector("[data-axiom-agent]");
  if (!agent?.dispatch || agentRoot?.dataset.semanticState === pendingAgentWitness.expected) return;
  agent.dispatch(pendingAgentWitness.type, pendingAgentWitness.payload);
}

function witnessWithAgent(type, payload, expected) {
  pendingAgentWitness = { type, payload, expected };
  flushAgentWitness();
}

new MutationObserver(flushAgentWitness).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-asset-state", "data-semantic-state"],
  childList: true,
  subtree: true
});
window.addEventListener("semeai:axiom-presence-ready", flushAgentWitness);

const AXIOM_COPY = Object.freeze({
  field: ["v2.axiom.field", "Witnessing possibility. No release authority."],
  gate: ["v2.axiom.gate", "Facing the authority boundary. Never deciding."],
  benchmark: ["v2.axiom.benchmark", "Observing evidence assembly. Not scoring."],
  WORKING_GATE: ["v2.axiom.workingGate", "Observing the request. No terminal state inferred."],
  SHOW: ["v2.axiom.show", "Exact candidate verified. Witnessing release and receipt."],
  REVIEW: ["v2.axiom.review", "Candidate suspended before authority. Audit remains."],
  BLOCK: ["v2.axiom.block", "Release withheld. Audit preserved."],
  ERROR: ["v2.axiom.error", "No valid authority response. The chamber failed closed."],
  WORKING_BENCHMARK: ["v2.axiom.workingBenchmark", "Witnessing seven signals assemble. Not scoring."],
  BENCHMARK_RESULT: ["v2.axiom.benchmarkResult", "Seven signals converged. Witnessing the presentation trace."],
  BENCHMARK_BLOCK: ["v2.axiom.benchmarkBlock", "Presentation withheld. No score candidate exposed."]
});

function axiomMessage(key) {
  const entry = AXIOM_COPY[key] || AXIOM_COPY[scene] || AXIOM_COPY.field;
  return t(entry[0], entry[1]);
}

function setAxiom(state, messageKey = scene) {
  semanticState = state;
  semanticMessageKey = messageKey;
  axiom.setState(state, axiomMessage(messageKey));
  window.dispatchEvent(new CustomEvent("semeai:axiom-context", {
    detail: { source: scene, state }
  }));
}

setAxiom(semanticState, scene);

let animationFrame = 0;
let lastFrame = 0;

function renderOnce(now = performance.now()) {
  renderer.render(now);
  axiom.tick(now);
}

function frame(now) {
  animationFrame = window.requestAnimationFrame(frame);
  if (document.hidden || now - lastFrame < 16) return;
  lastFrame = now;
  renderOnce(now);
}

function startRendering() {
  if (animationFrame) window.cancelAnimationFrame(animationFrame);
  renderer.reducedMotion = reducedMotion.matches;
  axiom.reducedMotion = reducedMotion.matches;
  if (reducedMotion.matches) {
    animationFrame = 0;
    renderOnce();
    return;
  }
  animationFrame = window.requestAnimationFrame(frame);
}

function setPointer(event) {
  if (reducedMotion.matches || coarsePointer.matches) return;
  renderer.setPointer(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
  axiom.look((event.clientX / window.innerWidth - 0.5) * 2);
}

function initField() {
  if (scene !== "field") return;
  const world = document.querySelector("[data-field-scene]");
  const forceNode = document.querySelector("[data-field-force]");
  const stateNode = document.querySelector("[data-field-state]");
  const gateLinks = [...document.querySelectorAll("a[href^='/gate.html']")];
  let targetForce = 0.38;
  let currentForce = 0.38;
  let forceFrame = 0;

  function paintForce() {
    currentForce = lerp(currentForce, targetForce, reducedMotion.matches ? 1 : 0.075);
    renderer.state.fieldForce = currentForce;
    if (forceNode) forceNode.textContent = currentForce.toFixed(2);
    renderOnce();
    if (Math.abs(currentForce - targetForce) > 0.003) forceFrame = window.requestAnimationFrame(paintForce);
    else forceFrame = 0;
  }

  function setForce(next, state = "BOUND") {
    targetForce = clamp(next, 0.18, 0.96);
    if (stateNode) stateNode.textContent = state;
    if (world) world.dataset.fieldMotion = state === "TENSION" ? "tension" : "ambient";
    if (!forceFrame) forceFrame = window.requestAnimationFrame(paintForce);
  }

  world?.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || coarsePointer.matches) return;
    const x = event.clientX / window.innerWidth;
    const authority = 0.64;
    const force = 0.24 + (1 - Math.min(1, Math.abs(x - authority) * 1.8)) * 0.68;
    setForce(force, x > authority - 0.13 ? "TENSION" : "BOUND");
  }, { passive: true });
  world?.addEventListener("pointerleave", () => setForce(0.38, "BOUND"), { passive: true });

  for (const link of gateLinks) {
    link.addEventListener("pointerenter", () => setForce(0.9, "TENSION"), { passive: true });
    link.addEventListener("focus", () => setForce(0.9, "TENSION"));
    link.addEventListener("pointerleave", () => setForce(0.38, "BOUND"), { passive: true });
    link.addEventListener("blur", () => setForce(0.38, "BOUND"));
  }
}

function initGate() {
  if (scene !== "gate") return;
  const liveGate = document.getElementById("live-gate");
  const terminal = document.querySelector("[data-gate-terminal]");
  const stateMap = Object.freeze({
    IDLE: ["IDLE", "ATTENTIVE", "gate"],
    WORKING: ["WORKING", "WORKING", "WORKING_GATE"],
    SHOW: ["SHOW", "RESULT", "SHOW"],
    REVIEW: ["REVIEW", "REVIEW", "REVIEW"],
    BLOCK: ["BLOCK", "HELD", "BLOCK"],
    ERROR: ["ERROR", "ERROR", "ERROR"]
  });
  let lastGateReceiptId = null;

  function resolveState(rawState, receiptId = lastGateReceiptId) {
    const state = Object.hasOwn(stateMap, rawState) ? rawState : "ERROR";
    const [physical, witness, message] = stateMap[state];
    renderer.setGateState(physical);
    body.dataset.gateState = state.toLowerCase();
    if (terminal) terminal.dataset.decision = state;
    setAxiom(witness, message);
    if (state === "WORKING") witnessWithAgent("TASK_STARTED", { source: "public-gate" }, witness);
    else if (state === "ERROR") witnessWithAgent("REQUEST_FAILED", { source: "public-gate" }, witness);
    else if (state !== "IDLE") witnessWithAgent("GATE_DECISION", { action: state, receipt_id: receiptId || null }, witness);
    renderOnce();
  }

  window.addEventListener("semeai:gate-decision", (event) => {
    const nextState = String(event.detail?.action || "ERROR").toUpperCase();
    lastGateReceiptId = ["SHOW", "REVIEW", "BLOCK"].includes(nextState) ? event.detail?.receiptId || null : null;
    resolveState(nextState, lastGateReceiptId);
  });

  if (liveGate) {
    new MutationObserver(() => resolveState(String(liveGate.dataset.decision || "IDLE").toUpperCase()))
      .observe(liveGate, { attributes: true, attributeFilter: ["data-decision"] });
    resolveState(String(liveGate.dataset.decision || "IDLE").toUpperCase());
  }
}

function initialCategories() {
  const policy = window.SemeAIBenchmarkCore?.SCORING_POLICY || [];
  return policy.map((category) => ({
    key: category.key,
    name: category.name,
    score: 0,
    max: Number(category.max) || 1,
    ratio: 0
  }));
}

function visible(element) {
  return Boolean(element && !element.hidden && element.getClientRects().length);
}

function parseCategories() {
  return [...document.querySelectorAll("#category-grid .category-card")].slice(0, 7).map((card, index) => {
    const text = card.textContent || "";
    const match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    const score = match ? Number(match[1]) : 0;
    const max = match ? Number(match[2]) : 1;
    return {
      key: card.dataset.category || `signal-${index + 1}`,
      name: card.querySelector("h4, h3, strong")?.textContent?.trim() || `Signal ${index + 1}`,
      score,
      max,
      ratio: max ? score / max : 0
    };
  });
}

function initBenchmark() {
  if (scene !== "benchmark") return;
  const form = document.getElementById("benchmark-form");
  const result = document.getElementById("benchmark-result");
  const blocked = document.getElementById("blocked-result");
  const categoryGrid = document.getElementById("category-grid");
  const score = document.getElementById("total-score");
  const gate = document.getElementById("gate-decision");
  const source = document.getElementById("source-mode");
  const commit = document.getElementById("source-commit");
  const receipt = document.getElementById("receipt-hash");
  const scoreMirror = document.getElementById("cinematic-score");
  const gateMirror = document.getElementById("cinematic-presentation-gate");
  const sourceMirror = document.getElementById("cinematic-source");
  const commitMirror = document.getElementById("cinematic-commit");
  const receiptMirror = document.getElementById("cinematic-receipt");
  const signalSlots = [...document.querySelectorAll("[data-cinematic-signal]")];
  let currentState = "IDLE";

  function paintSignals(categories, withheld = false) {
    signalSlots.forEach((slot, index) => {
      const category = categories[index];
      slot.textContent = withheld || !category ? "—" : `${category.score}/${category.max}`;
      const item = slot.closest("li");
      item?.classList.toggle("is-resolved", !withheld && Boolean(category?.score));
      item?.style.setProperty("--signal", `${withheld || !category ? 0 : clamp(category.ratio) * 100}%`);
    });
  }

  function settle() {
    if (visible(blocked)) {
      currentState = "BLOCK";
      body.dataset.benchmarkState = "blocked";
      renderer.setBenchmarkState("IDLE", initialCategories());
      document.querySelector(".cinematic-benchmark-result")?.setAttribute("data-state", "BLOCK");
      if (scoreMirror) scoreMirror.textContent = "WITHHELD";
      if (gateMirror) gateMirror.textContent = "BLOCK";
      if (sourceMirror) sourceMirror.textContent = "BOUNDED LIVE CAPTURE";
      if (commitMirror) commitMirror.textContent = "WITHHELD";
      if (receiptMirror) receiptMirror.textContent = "NOT RELEASED";
      paintSignals([], true);
      setAxiom("HELD", "BENCHMARK_BLOCK");
      witnessWithAgent("GATE_DECISION", { action: "BLOCK", source: "public-benchmark" }, "HELD");
      renderOnce();
      return;
    }

    const scoreText = score?.textContent?.trim() || "";
    if (!visible(result) || !/^\d+(?:\.\d+)?$/.test(scoreText)) return;
    const categories = parseCategories();
    if (categories.length !== 7) return;
    currentState = "RESULT";
    body.dataset.benchmarkState = "result";
    renderer.setBenchmarkState("RESULT", categories);
    document.querySelector(".cinematic-benchmark-result")?.setAttribute("data-state", "RESULT");
    if (scoreMirror) scoreMirror.textContent = scoreText;
    if (gateMirror) gateMirror.textContent = gate?.textContent?.trim() || "SHOW";
    if (sourceMirror) sourceMirror.textContent = source?.textContent?.trim() || "LIVE SNAPSHOT";
    if (commitMirror) commitMirror.textContent = (commit?.textContent?.trim() || "—").slice(0, 12);
    if (receiptMirror) receiptMirror.textContent = (receipt?.textContent?.trim() || "—").slice(0, 14);
    paintSignals(categories);
    setAxiom("RESULT", "BENCHMARK_RESULT");
    witnessWithAgent("GATE_DECISION", { action: "SHOW", source: "public-benchmark", receipt_id: receipt?.textContent?.trim() || null }, "RESULT");
    renderOnce();
  }

  form?.addEventListener("submit", () => {
    currentState = "ASSEMBLING";
    body.dataset.benchmarkState = "assembling";
    const categories = initialCategories();
    renderer.setBenchmarkState("ASSEMBLING", categories);
    document.querySelector(".cinematic-benchmark-result")?.setAttribute("data-state", "ASSEMBLING");
    if (scoreMirror) scoreMirror.textContent = "—";
    if (gateMirror) gateMirror.textContent = "PENDING";
    if (sourceMirror) sourceMirror.textContent = "ACQUIRING EVIDENCE";
    if (commitMirror) commitMirror.textContent = "—";
    if (receiptMirror) receiptMirror.textContent = "—";
    paintSignals(categories);
    setAxiom("WORKING", "WORKING_BENCHMARK");
    witnessWithAgent("TASK_STARTED", { source: "public-benchmark" }, "WORKING");
    renderOnce();
  });

  const observer = new MutationObserver(settle);
  [result, blocked, categoryGrid, score, gate, source, commit, receipt].forEach((element) => {
    if (element) observer.observe(element, { attributes: true, childList: true, subtree: true, characterData: true });
  });
  window.addEventListener("semeai:evidence-visible", settle);
  renderer.setBenchmarkState("IDLE", initialCategories());
  paintSignals(initialCategories());
  settle();

  window.SemeAICinematicBenchmark = Object.freeze({
    get state() { return currentState; },
    settle
  });
}

function initContinuity() {
  let arrival = "";
  try {
    arrival = sessionStorage.getItem("semeai_cinematic_route") || "";
    sessionStorage.removeItem("semeai_cinematic_route");
  } catch {}
  if (arrival) {
    body.dataset.cinematicArrival = arrival;
    window.setTimeout(() => delete body.dataset.cinematicArrival, reducedMotion.matches ? 0 : 1500);
  }
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    const target = new URL(link.href, location.href);
    if (target.origin !== location.origin) return;
    const targetScene = target.pathname === "/" ? "field"
      : target.pathname.endsWith("/gate.html") ? "gate"
      : target.pathname.startsWith("/benchmark/") ? "benchmark"
      : "";
    if (!targetScene || targetScene === scene) return;
    try { sessionStorage.setItem("semeai_cinematic_route", `${scene}-to-${targetScene}`); } catch {}
  });
}

window.addEventListener("pointermove", setPointer, { passive: true });
window.addEventListener("resize", () => {
  renderer.resize();
  renderOnce();
}, { passive: true });
window.addEventListener("semeai:lang", () => setAxiom(semanticState, semanticMessageKey));
reducedMotion.addEventListener?.("change", startRendering);
window.addEventListener("pagehide", () => {
  if (animationFrame) window.cancelAnimationFrame(animationFrame);
}, { once: true });

initField();
initGate();
initBenchmark();
initContinuity();
startRendering();

window.SemeAICinematicProduction = Object.freeze({
  renderer,
  axiom,
  scene,
  renderOnce,
  get state() {
    return {
      scene,
      gate: renderer.state.gate.state,
      benchmark: renderer.state.benchmark.state,
      axiom: axiom.state,
      reducedMotion: reducedMotion.matches
    };
  }
});
