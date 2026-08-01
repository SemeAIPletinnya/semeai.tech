import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEMANTIC_STATES,
  EVENT_TYPES,
  SUPPORTED_ROUTES,
  createPresenceRuntime,
  mapSemanticToAnimation,
  assertNoSecretLeak,
} from "../assets/js/axiom-presence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PUBLIC_AXIOM_PAGES = [
  "index.html",
  "gate.html",
  "genesis/index.html",
  "benchmark/index.html",
  "skills/index.html",
  "book/index.html",
  "research.html",
  "article.html",
  "roadmap/index.html",
];

for (const rel of PUBLIC_AXIOM_PAGES) {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  assert.match(html, /axiom-agent\.css/, `${rel} should include axiom CSS`);
  assert.match(html, /axiom-presence-register\.mjs/, `${rel} should register presence`);
  assert.match(html, /axiom-agent\.js/, `${rel} should mount agent`);
}

// Expanded public shell routes
for (const route of [
  "home",
  "genesis",
  "benchmark",
  "gate",
  "skills",
  "book",
  "research",
  "article",
  "roadmap",
]) {
  assert.equal(SUPPORTED_ROUTES.includes(route), true, `route ${route} supported`);
}

// End-to-end presence loop: attentive -> ask -> SHOW/REVIEW/BLOCK leakage states
const runtime = createPresenceRuntime({ route: "genesis", surface: "epoch" });
runtime.dispatch(EVENT_TYPES.ENTITY_OPEN, {
  entity: { type: "epoch", id: "epoch-08" },
});
assert.equal(runtime.getSemanticState(), SEMANTIC_STATES.ATTENTIVE);

runtime.dispatch(EVENT_TYPES.USER_QUESTION, {
  question: "What happened here?",
  routeContext: "genesis",
});
assert.equal(runtime.getSemanticState(), SEMANTIC_STATES.WORKING);

// SHOW path
runtime.dispatch(EVENT_TYPES.GATE_DECISION, {
  action: "SHOW",
  receipt_id: "decision-show-1",
});
assert.equal(runtime.getSemanticState(), SEMANTIC_STATES.RESULT);
assert.equal(runtime.getContext().runtime.decision, "SHOW");
assert.equal(runtime.getContext().runtime.internalDecision, "PROCEED");
assert.equal(runtime.getContext().runtime.receipt_id, "decision-show-1");
assertNoSecretLeak(runtime.getContext());

// REVIEW leakage: candidate never becomes runtime released answer in context
const reviewRt = createPresenceRuntime({ route: "book" });
reviewRt.dispatch(EVENT_TYPES.USER_QUESTION, { question: "Explain receipts" });
reviewRt.dispatch(EVENT_TYPES.GATE_DECISION, {
  action: "REVIEW",
  receipt_id: "decision-review-1",
});
assert.equal(reviewRt.getSemanticState(), SEMANTIC_STATES.REVIEW);
assert.equal(reviewRt.getContext().runtime.decision, "REVIEW");
assert.equal(reviewRt.getContext().runtime.internalDecision, "NEEDS_REVIEW");
// Context must not invent released text fields
assert.equal(Object.prototype.hasOwnProperty.call(reviewRt.getContext(), "releasedAnswer"), false);

// BLOCK / SILENCE embodied held state
const blockRt = createPresenceRuntime({ route: "research" });
blockRt.dispatch(EVENT_TYPES.USER_QUESTION, { question: "Private secrets?" });
blockRt.dispatch(EVENT_TYPES.GATE_DECISION, {
  action: "BLOCK",
  receipt_id: "decision-block-1",
});
assert.equal(blockRt.getSemanticState(), SEMANTIC_STATES.HELD);
assert.equal(blockRt.getContext().runtime.internalDecision, "SILENCE");

// Animation adapter never equals authority labels
const manifest = {
  idle: { row: 0, frames: 6 },
  waiting: { row: 6, frames: 6 },
  running: { row: 7, frames: 6 },
  review: { row: 8, frames: 6 },
  failed: { row: 5, frames: 8 },
};
assert.equal(mapSemanticToAnimation(SEMANTIC_STATES.RESULT, manifest), "idle");
assert.equal(mapSemanticToAnimation(SEMANTIC_STATES.HELD, manifest), "review");
assert.notEqual(mapSemanticToAnimation(SEMANTIC_STATES.HELD, manifest), "BLOCK");
assert.notEqual(mapSemanticToAnimation(SEMANTIC_STATES.RESULT, manifest), "SHOW");

// Gate mapping contract embedded in agent
const agentSource = fs.readFileSync(path.join(ROOT, "assets/js/axiom-agent.js"), "utf8");
assert.match(agentSource, /SHOW:\s*"PROCEED"/);
assert.match(agentSource, /REVIEW:\s*"NEEDS_REVIEW"/);
assert.match(agentSource, /BLOCK:\s*"SILENCE"/);
assert.match(agentSource, /releasedAnswer !== null/);
assert.match(agentSource, /candidateTextIncluded !== false/);
assert.match(agentSource, /routeContext:\s*routeKey/);

// Ecosystem bridge present in shell
const shell = fs.readFileSync(path.join(ROOT, "assets/js/site-shell.js"), "utf8");
assert.match(shell, /gate\.semeai\.tech/);
assert.match(shell, /api\.semeai\.tech/);
assert.match(shell, /site-ecosystem-bridge/);

// CSS visual binding
const css = fs.readFileSync(path.join(ROOT, "assets/css/site.css"), "utf8");
assert.match(css, /\.site-ecosystem-bridge/);
const axiomCss = fs.readFileSync(path.join(ROOT, "assets/css/axiom-agent.css"), "utf8");
assert.match(axiomCss, /data-semantic-state/);

console.log(
  `ok - Axiom E2E: ${PUBLIC_AXIOM_PAGES.length} public mounts, Gate loop, leakage states, ecosystem bridges`,
);
