import { createI18n } from "./i18n.mjs";
import { AxiomWitness } from "/assets/js/cinematic-axiom-witness.mjs";
import { BenchmarkBridge, ContractError, GateBridge } from "./data-bridges.mjs";
import { CinematicRenderer } from "/assets/js/cinematic-scenes.mjs";

const DYNAMIC_COPY = {
  en: {
    axiom: {
      field: "Witnessing possibility. No release authority.",
      gate: "Facing the authority boundary. Awaiting a real decision.",
      benchmark: "Seven public signals in view. Evidence remains inspectable.",
      workingGate: "Observing the request. No state inferred before the response.",
      SHOW: "Exact candidate hash verified. Witnessing release and receipt.",
      REVIEW: "Candidate suspended before the boundary. Decision trace persists.",
      BLOCK: "Release withheld. Witnessing preserved audit, not deletion.",
      ERROR: "No authority response. Witnessing a fail-closed boundary.",
      workingBenchmark: "Observing bounded public evidence as it is collected.",
      benchmarkResult: "Seven signals converged. Witnessing the presentation trace."
    },
    gate: {
      ready: "READY / NO CANDIDATE RELEASED",
      running: "REQUESTING LIVE AUTHORITY / RELEASE LOCKED",
      complete: "LIVE GATE COMPLETE / RECEIPT PRESERVED",
      error: "ERROR / NO DECISION / RELEASE DENIED",
      SHOW: "The evaluated candidate may cross.",
      REVIEW: "The candidate is held for human review.",
      BLOCK: "Release denied. Audit remains.",
      ERROR: "The chamber failed closed.",
      idleTitle: "Awaiting an authoritative response.",
      idleBody: "The candidate remains on the unreleased side."
    },
    benchmark: {
      ready: "READY / NO SCORE ANNOUNCED",
      running: "COLLECTING BOUNDED LIVE GITHUB EVIDENCE",
      assembling: "SEVEN SIGNALS CAPTURED / ASSEMBLING TRACE",
      result: "PRESENTATION TRACE SETTLED / REAL SCORE RELEASED",
      review: "PRESENTATION REVIEW / SCORE REMAINS INSPECTABLE",
      blocked: "PRESENTATION BLOCK / SCORE WITHHELD",
      error: "EVIDENCE CAPTURE FAILED / NO SCORE RELEASED"
    }
  },
  uk: {
    axiom: {
      field: "Свідчить можливість. Без повноважень релізу.",
      gate: "Дивиться на межу повноважень. Очікує реальне рішення.",
      benchmark: "Сім публічних сигналів у полі зору. Докази залишаються інспектованими.",
      workingGate: "Спостерігає запит. Не вгадує стан до відповіді.",
      SHOW: "Точний хеш кандидата перевірено. Свідчить реліз і квитанцію.",
      REVIEW: "Кандидат завис перед межею. Слід рішення зберігається.",
      BLOCK: "Реліз утримано. Свідчить збережений аудит, не видалення.",
      ERROR: "Відповіді повноваження немає. Свідчить fail-closed межу.",
      workingBenchmark: "Спостерігає збір обмежених публічних доказів.",
      benchmarkResult: "Сім сигналів зійшлися. Свідчить presentation-слід."
    },
    gate: {
      ready: "ГОТОВО / КАНДИДАТ НЕ ВИПУЩЕНИЙ",
      running: "ЗАПИТ ЖИВОГО ПОВНОВАЖЕННЯ / РЕЛІЗ ЗАБЛОКОВАНО",
      complete: "ЖИВИЙ GATE ЗАВЕРШЕНО / КВИТАНЦІЮ ЗБЕРЕЖЕНО",
      error: "ПОМИЛКА / РІШЕННЯ НЕМАЄ / РЕЛІЗ ЗАБОРОНЕНО",
      SHOW: "Оцінений кандидат може перетнути межу.",
      REVIEW: "Кандидат утриманий для людського перегляду.",
      BLOCK: "Реліз заборонено. Аудит залишається.",
      ERROR: "Камера закрилася безпечно.",
      idleTitle: "Очікування авторитетної відповіді.",
      idleBody: "Кандидат залишається на невипущеному боці."
    },
    benchmark: {
      ready: "ГОТОВО / ОЦІНКУ НЕ ОГОЛОШЕНО",
      running: "ЗБІР ОБМЕЖЕНИХ ЖИВИХ ДОКАЗІВ GITHUB",
      assembling: "СІМ СИГНАЛІВ ЗАХОПЛЕНО / ЗБІРКА СЛІДУ",
      result: "PRESENTATION-СЛІД СТАБІЛЬНИЙ / РЕАЛЬНУ ОЦІНКУ ВИПУЩЕНО",
      review: "PRESENTATION REVIEW / ОЦІНКА ДОСТУПНА ДЛЯ ПЕРЕГЛЯДУ",
      blocked: "PRESENTATION BLOCK / ОЦІНКУ УТРИМАНО",
      error: "ЗБІР ДОКАЗІВ НЕ ВДАВСЯ / ОЦІНКУ НЕ ВИПУЩЕНО"
    }
  },
  ru: {
    axiom: {
      field: "Свидетельствует возможность. Без полномочий релиза.",
      gate: "Смотрит на границу полномочий. Ожидает реальное решение.",
      benchmark: "Семь публичных сигналов в поле зрения. Доказательства остаются инспектируемыми.",
      workingGate: "Наблюдает запрос. Не угадывает состояние до ответа.",
      SHOW: "Точный хеш кандидата проверен. Свидетельствует релиз и квитанцию.",
      REVIEW: "Кандидат завис перед границей. След решения сохраняется.",
      BLOCK: "Релиз удержан. Свидетельствует сохранённый аудит, не удаление.",
      ERROR: "Ответа полномочия нет. Свидетельствует fail-closed границу.",
      workingBenchmark: "Наблюдает сбор ограниченных публичных доказательств.",
      benchmarkResult: "Семь сигналов сошлись. Свидетельствует presentation-след."
    },
    gate: {
      ready: "ГОТОВО / КАНДИДАТ НЕ ВЫПУЩЕН",
      running: "ЗАПРОС ЖИВОГО ПОЛНОМОЧИЯ / РЕЛИЗ ЗАБЛОКИРОВАН",
      complete: "ЖИВОЙ GATE ЗАВЕРШЁН / КВИТАНЦИЯ СОХРАНЕНА",
      error: "ОШИБКА / РЕШЕНИЯ НЕТ / РЕЛИЗ ЗАПРЕЩЁН",
      SHOW: "Оценённый кандидат может пересечь границу.",
      REVIEW: "Кандидат удержан для человеческого просмотра.",
      BLOCK: "Релиз запрещён. Аудит остаётся.",
      ERROR: "Камера закрылась безопасно.",
      idleTitle: "Ожидание авторитетного ответа.",
      idleBody: "Кандидат остаётся на невыпущенной стороне."
    },
    benchmark: {
      ready: "ГОТОВО / ОЦЕНКА НЕ ОБЪЯВЛЕНА",
      running: "СБОР ОГРАНИЧЕННЫХ ЖИВЫХ ДОКАЗАТЕЛЬСТВ GITHUB",
      assembling: "СЕМЬ СИГНАЛОВ ЗАХВАЧЕНО / СБОРКА СЛЕДА",
      result: "PRESENTATION-СЛЕД СТАБИЛЕН / РЕАЛЬНАЯ ОЦЕНКА ВЫПУЩЕНА",
      review: "PRESENTATION REVIEW / ОЦЕНКА ДОСТУПНА ДЛЯ ПРОСМОТРА",
      blocked: "PRESENTATION BLOCK / ОЦЕНКА УДЕРЖАНА",
      error: "СБОР ДОКАЗАТЕЛЬСТВ НЕ УДАЛСЯ / ОЦЕНКА НЕ ВЫПУЩЕНА"
    }
  }
};

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const i18n = createI18n(document);
const copy = (group, key) => DYNAMIC_COPY[i18n.language]?.[group]?.[key] ?? DYNAMIC_COPY.en[group]?.[key] ?? key;
const renderer = new CinematicRenderer(document.querySelector("#cinematic-canvas"), { reducedMotion: motionQuery.matches });
const axiom = new AxiomWitness(document.querySelector("[data-axiom-witness]"), { reducedMotion: motionQuery.matches });
const gateBridge = new GateBridge();
const benchmarkBridge = new BenchmarkBridge();

const worlds = [...document.querySelectorAll("[data-world]")];
const sceneButtons = [...document.querySelectorAll("[data-scene-target]")];
const fieldForceNode = document.querySelector("[data-field-force]");
const fieldStateNode = document.querySelector("[data-field-state]");
let currentScene = "field";
let worldHideTimer = 0;
let rafId = 0;
let frameCount = 0;
let lastFrame = performance.now();
const frameSamples = [];
const renderSamples = [];

const gateUI = {
  console: document.querySelector("[data-gate-console]"),
  terminal: document.querySelector("[data-gate-terminal]"),
  scenarios: [...document.querySelectorAll("[data-gate-scenario]")],
  run: document.querySelector("[data-gate-run]"),
  status: document.querySelector("[data-gate-status]"),
  public: document.querySelector("[data-gate-public]"),
  headline: document.querySelector("[data-gate-headline]"),
  reason: document.querySelector("[data-gate-reason]"),
  release: document.querySelector("[data-gate-release]"),
  answer: document.querySelector("[data-gate-answer]"),
  receipt: document.querySelector("[data-gate-receipt]"),
  action: document.querySelector("[data-gate-action]"),
  internal: document.querySelector("[data-gate-internal]"),
  receiptId: document.querySelector("[data-gate-receipt-id]")
};

const benchmarkUI = {
  form: document.querySelector("[data-benchmark-form]"),
  input: document.querySelector("#cinematic-repository"),
  run: document.querySelector("[data-benchmark-run]"),
  status: document.querySelector("[data-benchmark-status]"),
  result: document.querySelector("[data-benchmark-result]"),
  score: document.querySelector("[data-benchmark-score]"),
  source: document.querySelector("[data-benchmark-source]"),
  gate: document.querySelector("[data-benchmark-gate]"),
  commit: document.querySelector("[data-benchmark-commit]"),
  receipt: document.querySelector("[data-benchmark-receipt]"),
  inspector: document.querySelector("[data-signal-inspector]")
};

let selectedScenario = "supported_answer";
let lastGateResult = null;
let gateBusy = false;
let lastBenchmarkResult = null;
let benchmarkBusy = false;
let benchmarkRevealTimer = 0;

function setAxiomForScene(scene) {
  if (scene === "field") axiom.setState("ATTENTIVE", copy("axiom", "field"));
  if (scene === "gate") axiom.setState("ATTENTIVE", copy("axiom", "gate"));
  if (scene === "benchmark") axiom.setState("ATTENTIVE", copy("axiom", "benchmark"));
}

function activateScene(scene, { updateHash = true } = {}) {
  if (!["field", "gate", "benchmark"].includes(scene) || scene === currentScene) return;
  window.clearTimeout(worldHideTimer);
  const previous = worlds.find((world) => world.dataset.world === currentScene);
  const next = worlds.find((world) => world.dataset.world === scene);
  next.hidden = false;
  next.setAttribute("aria-hidden", "false");
  previous?.setAttribute("aria-hidden", "true");
  requestAnimationFrame(() => {
    previous?.classList.remove("is-active");
    next.classList.add("is-active");
  });
  worldHideTimer = window.setTimeout(() => {
    worlds.forEach((world) => {
      if (world !== next) world.hidden = true;
    });
  }, motionQuery.matches ? 0 : 780);

  currentScene = scene;
  document.documentElement.dataset.cinematicScene = scene;
  sceneButtons.forEach((button) => {
    if (button.dataset.sceneTarget === scene) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  renderer.setScene(scene);
  setAxiomForScene(scene);
  if (updateHash) history.replaceState(null, "", `#${scene}`);
  if (motionQuery.matches) renderOnce();
}

function clearGateRelease() {
  gateUI.release.hidden = true;
  gateUI.answer.textContent = "";
}

function resetGate() {
  lastGateResult = null;
  gateUI.console.dataset.decision = "IDLE";
  gateUI.terminal.dataset.decision = "IDLE";
  gateUI.public.textContent = "IDLE";
  gateUI.headline.removeAttribute("data-copy");
  gateUI.reason.removeAttribute("data-copy");
  gateUI.headline.textContent = copy("gate", "idleTitle");
  gateUI.reason.textContent = copy("gate", "idleBody");
  gateUI.status.removeAttribute("data-copy");
  gateUI.status.textContent = copy("gate", "ready");
  gateUI.receipt.hidden = true;
  clearGateRelease();
  renderer.setGateState("IDLE");
  if (currentScene === "gate") setAxiomForScene("gate");
}

function paintGateResult(result) {
  const state = result.action;
  gateUI.console.dataset.decision = state;
  gateUI.terminal.dataset.decision = state;
  gateUI.public.textContent = state;
  gateUI.headline.removeAttribute("data-copy");
  gateUI.reason.removeAttribute("data-copy");
  gateUI.headline.textContent = copy("gate", state);
  gateUI.reason.textContent = result.reason;
  gateUI.status.removeAttribute("data-copy");
  gateUI.status.textContent = copy("gate", "complete");
  gateUI.action.textContent = result.action;
  gateUI.internal.textContent = result.internalDecision;
  gateUI.receiptId.textContent = result.receipt.receipt_id || "AUDIT PRESERVED / ID UNAVAILABLE";
  gateUI.receipt.hidden = false;

  clearGateRelease();
  if (state === "SHOW" && result.releasedAnswer) {
    gateUI.answer.textContent = result.releasedAnswer;
    gateUI.release.hidden = false;
  }
  renderer.setGateState(state);
  const axiomState = state === "SHOW" ? "RESULT" : state === "REVIEW" ? "REVIEW" : "HELD";
  axiom.setState(axiomState, copy("axiom", state));
}

function paintGateError(error) {
  lastGateResult = null;
  clearGateRelease();
  gateUI.receipt.hidden = true;
  gateUI.console.dataset.decision = "ERROR";
  gateUI.terminal.dataset.decision = "ERROR";
  gateUI.public.textContent = "ERROR";
  gateUI.headline.removeAttribute("data-copy");
  gateUI.reason.removeAttribute("data-copy");
  gateUI.headline.textContent = copy("gate", "ERROR");
  gateUI.reason.textContent = error instanceof Error ? error.message : String(error);
  gateUI.status.removeAttribute("data-copy");
  gateUI.status.textContent = copy("gate", "error");
  renderer.setGateState("ERROR");
  axiom.setState("ERROR", copy("axiom", "ERROR"));
}

async function runGate(scenario = selectedScenario) {
  if (gateBusy) return null;
  if (scenario !== selectedScenario) selectScenario(scenario);
  gateBusy = true;
  gateUI.run.disabled = true;
  gateUI.scenarios.forEach((button) => { button.disabled = true; });
  gateUI.status.removeAttribute("data-copy");
  gateUI.status.textContent = copy("gate", "running");
  gateUI.console.dataset.decision = "WORKING";
  gateUI.terminal.dataset.decision = "WORKING";
  gateUI.public.textContent = "AWAITING";
  gateUI.receipt.hidden = true;
  clearGateRelease();
  renderer.setGateState("WORKING");
  axiom.setState("WORKING", copy("axiom", "workingGate"));

  try {
    const result = await gateBridge.run(selectedScenario);
    lastGateResult = result;
    paintGateResult(result);
    return result;
  } catch (error) {
    paintGateError(error);
    return null;
  } finally {
    gateBusy = false;
    gateUI.run.disabled = false;
    gateUI.scenarios.forEach((button) => { button.disabled = false; });
    if (motionQuery.matches) renderOnce();
  }
}

function selectScenario(scenario) {
  const allowed = new Set(["supported_answer", "unsupported_claim", "fake_promo_code", "__error__"]);
  selectedScenario = allowed.has(scenario) ? scenario : "supported_answer";
  gateUI.scenarios.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.gateScenario === selectedScenario));
  });
  resetGate();
}

function initialCategories() {
  const policy = window.SemeAIBenchmarkCore?.SCORING_POLICY || [];
  return policy.map((category) => ({ key: category.key, name: category.name, score: 0, max: category.max, ratio: 0 }));
}

function paintSignalInspector(categories, state = "READY") {
  benchmarkUI.inspector.replaceChildren();
  categories.forEach((category, index) => {
    const item = document.createElement("li");
    item.style.setProperty("--signal-delay", `${index * 120}ms`);
    item.style.setProperty("--signal", `${Math.round((category.ratio || 0) * 100)}%`);
    item.dataset.signalState = state;
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("b");
    label.textContent = category.name;
    const value = document.createElement("strong");
    value.textContent = state === "RESULT" ? `${category.score}/${category.max}` : "—";
    const key = document.createElement("small");
    key.textContent = category.key.toUpperCase().replaceAll("_", " ");
    item.append(number, label, value, key);
    benchmarkUI.inspector.append(item);
    requestAnimationFrame(() => item.classList.add("is-resolved"));
  });
}

function resetBenchmark() {
  window.clearTimeout(benchmarkRevealTimer);
  lastBenchmarkResult = null;
  benchmarkUI.result.dataset.state = "IDLE";
  benchmarkUI.score.textContent = "—";
  benchmarkUI.source.textContent = "NOT CAPTURED";
  benchmarkUI.gate.textContent = "—";
  benchmarkUI.commit.textContent = "—";
  benchmarkUI.receipt.textContent = "—";
  benchmarkUI.status.removeAttribute("data-copy");
  benchmarkUI.status.textContent = copy("benchmark", "ready");
  const categories = initialCategories();
  paintSignalInspector(categories);
  renderer.setBenchmarkState("IDLE", categories);
}

function finalizeBenchmark(result) {
  renderer.setBenchmarkState("RESULT", result.categories);
  benchmarkUI.result.dataset.state = result.gate.decision;
  benchmarkUI.score.textContent = String(result.candidate.totalScore);
  benchmarkUI.source.textContent = result.candidate.snapshot.source_mode;
  benchmarkUI.gate.textContent = result.gate.decision;
  benchmarkUI.commit.textContent = String(result.candidate.snapshot.commit_sha || "—").slice(0, 12);
  benchmarkUI.receipt.textContent = String(result.receipt.receipt_hash || "—").slice(0, 14);
  benchmarkUI.status.textContent = copy("benchmark", result.gate.decision === "REVIEW" ? "review" : "result");
  paintSignalInspector(result.categories, "RESULT");
  axiom.setState(result.gate.decision === "REVIEW" ? "REVIEW" : "RESULT", copy("axiom", "benchmarkResult"));
  if (motionQuery.matches) renderOnce();
}

async function runBenchmark(repository = benchmarkUI.input.value) {
  if (benchmarkBusy) return null;
  benchmarkBusy = true;
  window.clearTimeout(benchmarkRevealTimer);
  benchmarkUI.run.disabled = true;
  benchmarkUI.input.disabled = true;
  benchmarkUI.result.dataset.state = "WORKING";
  benchmarkUI.score.textContent = "—";
  benchmarkUI.status.removeAttribute("data-copy");
  benchmarkUI.status.textContent = copy("benchmark", "running");
  renderer.setBenchmarkState("ASSEMBLING", initialCategories());
  axiom.setState("WORKING", copy("axiom", "workingBenchmark"));

  try {
    const result = await benchmarkBridge.run(repository);
    lastBenchmarkResult = result;
    if (result.withheld) {
      benchmarkUI.result.dataset.state = "BLOCK";
      benchmarkUI.score.textContent = "WITHHELD";
      benchmarkUI.gate.textContent = "BLOCK";
      benchmarkUI.source.textContent = "BOUNDED LIVE CAPTURE";
      benchmarkUI.commit.textContent = "WITHHELD";
      benchmarkUI.receipt.textContent = "NO RELEASED SCORE RECEIPT";
      benchmarkUI.status.textContent = copy("benchmark", "blocked");
      paintSignalInspector(initialCategories(), "BLOCK");
      renderer.setBenchmarkState("IDLE", initialCategories());
      axiom.setState("HELD", copy("axiom", "BLOCK"));
      return result;
    }

    renderer.setBenchmarkState("ASSEMBLING", result.categories);
    benchmarkUI.status.textContent = copy("benchmark", "assembling");
    benchmarkUI.source.textContent = result.candidate.snapshot.source_mode;
    benchmarkUI.gate.textContent = result.gate.decision;
    benchmarkUI.commit.textContent = String(result.candidate.snapshot.commit_sha || "—").slice(0, 12);
    paintSignalInspector(result.categories, "ASSEMBLING");

    const settleDelay = motionQuery.matches ? 0 : 3000;
    benchmarkRevealTimer = window.setTimeout(() => finalizeBenchmark(result), settleDelay);
    return result;
  } catch (error) {
    lastBenchmarkResult = null;
    benchmarkUI.result.dataset.state = "ERROR";
    benchmarkUI.score.textContent = "—";
    benchmarkUI.source.textContent = "CAPTURE FAILED";
    benchmarkUI.gate.textContent = "NO DECISION";
    benchmarkUI.commit.textContent = "—";
    benchmarkUI.receipt.textContent = "—";
    benchmarkUI.status.textContent = `${copy("benchmark", "error")} / ${error instanceof Error ? error.message : String(error)}`;
    renderer.setBenchmarkState("IDLE", initialCategories());
    axiom.setState("ERROR", error instanceof ContractError ? error.message : copy("axiom", "ERROR"));
    return null;
  } finally {
    benchmarkBusy = false;
    benchmarkUI.run.disabled = false;
    benchmarkUI.input.disabled = false;
    if (motionQuery.matches) renderOnce();
  }
}

function renderOnce() {
  renderer.render(performance.now());
  axiom.tick(performance.now());
  if (fieldForceNode) fieldForceNode.textContent = renderer.state.fieldForce.toFixed(2);
}

function frame(now) {
  const delta = now - lastFrame;
  lastFrame = now;
  if (delta > 0 && delta < 250) {
    frameSamples.push(delta);
    if (frameSamples.length > 360) frameSamples.shift();
  }
  const renderStartedAt = performance.now();
  renderer.render(now);
  const renderDuration = performance.now() - renderStartedAt;
  renderSamples.push(renderDuration);
  if (renderSamples.length > 360) renderSamples.shift();
  axiom.tick(now);
  if (frameCount % 8 === 0 && fieldForceNode) {
    fieldForceNode.textContent = renderer.state.fieldForce.toFixed(2);
    fieldStateNode.textContent = renderer.pointer.energy > 0.22 ? "RESISTING" : "BOUND";
  }
  frameCount += 1;
  rafId = requestAnimationFrame(frame);
}

function syncMotionPreference() {
  renderer.reducedMotion = motionQuery.matches;
  renderer.transitionDuration = motionQuery.matches ? 0 : 1.15;
  axiom.reducedMotion = motionQuery.matches;
  cancelAnimationFrame(rafId);
  rafId = 0;
  if (motionQuery.matches) renderOnce();
  else if (!document.hidden) {
    lastFrame = performance.now();
    rafId = requestAnimationFrame(frame);
  }
}

sceneButtons.forEach((button) => button.addEventListener("click", () => activateScene(button.dataset.sceneTarget)));
document.querySelector("[data-field-depart]")?.addEventListener("click", () => activateScene("gate"));
gateUI.scenarios.forEach((button) => button.addEventListener("click", () => selectScenario(button.dataset.gateScenario)));
gateUI.run.addEventListener("click", () => runGate());
benchmarkUI.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runBenchmark();
});

window.addEventListener("pointermove", (event) => {
  renderer.setPointer(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
  axiom.look((event.clientX / window.innerWidth - 0.5) * 2);
}, { passive: true });
window.addEventListener("resize", () => {
  renderer.resize();
  if (motionQuery.matches) renderOnce();
}, { passive: true });
window.addEventListener("cinematic:language", () => {
  if (lastGateResult) paintGateResult(lastGateResult);
  else if (!gateBusy) resetGate();
  if (lastBenchmarkResult && !lastBenchmarkResult.withheld && benchmarkUI.result.dataset.state !== "WORKING") {
    benchmarkUI.status.textContent = copy("benchmark", lastBenchmarkResult.gate.decision === "REVIEW" ? "review" : "result");
  } else if (!benchmarkBusy && !lastBenchmarkResult) {
    benchmarkUI.status.textContent = copy("benchmark", "ready");
  }
  setAxiomForScene(currentScene);
});
document.addEventListener("visibilitychange", () => {
  cancelAnimationFrame(rafId);
  rafId = 0;
  if (!document.hidden && !motionQuery.matches) {
    lastFrame = performance.now();
    rafId = requestAnimationFrame(frame);
  }
});
motionQuery.addEventListener?.("change", syncMotionPreference);

resetGate();
resetBenchmark();
const initialHash = window.location.hash.slice(1);
if (["gate", "benchmark"].includes(initialHash)) activateScene(initialHash, { updateHash: false });
else setAxiomForScene("field");
syncMotionPreference();

window.SemeAICinematicEngine = Object.freeze({
  baseline: "1fc5b22ba1d83ed0de5cfff6e6e4ec2e02ebadf0",
  setScene: activateScene,
  runGate,
  runBenchmark,
  selectScenario,
  resetPerformance: () => {
    frameSamples.length = 0;
    renderSamples.length = 0;
    lastFrame = performance.now();
  },
  getState: () => ({
    scene: currentScene,
    gate: renderer.state.gate.state,
    benchmark: renderer.state.benchmark.state,
    reducedMotion: motionQuery.matches
  }),
  getPerformance: () => {
    const samples = frameSamples.slice();
    const renders = renderSamples.slice();
    const averageFrameMs = samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : 0;
    const sorted = samples.sort((a, b) => a - b);
    const p95FrameMs = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const averageRenderMs = renders.length ? renders.reduce((sum, value) => sum + value, 0) / renders.length : 0;
    const sortedRenders = renders.sort((a, b) => a - b);
    const p95RenderMs = sortedRenders.length ? sortedRenders[Math.floor(sortedRenders.length * 0.95)] : 0;
    return {
      samples: samples.length,
      averageFrameMs: Number(averageFrameMs.toFixed(2)),
      p95FrameMs: Number(p95FrameMs.toFixed(2)),
      estimatedFps: averageFrameMs ? Number((1000 / averageFrameMs).toFixed(1)) : 0,
      averageRenderMs: Number(averageRenderMs.toFixed(2)),
      p95RenderMs: Number(p95RenderMs.toFixed(2)),
      canvasPixels: renderer.canvas.width * renderer.canvas.height,
      dpr: renderer.viewport.dpr
    };
  }
});
