import assert from "node:assert/strict";
import {
  AXIOM_CONTEXT_SCHEMA,
  SEMANTIC_STATES,
  EVENT_TYPES,
  SUPPORTED_ROUTES,
  buildAxiomContext,
  reduceSemanticState,
  mapSemanticToAnimation,
  createPresenceRuntime,
  assertNoSecretLeak,
} from "../assets/js/axiom-presence.mjs";

// Context allowlist
const genesis = buildAxiomContext({
  route: "genesis",
  surface: "epoch",
  entity: { type: "epoch", id: "epoch-08" },
});
assert.equal(genesis.schemaVersion, AXIOM_CONTEXT_SCHEMA);
assert.equal(genesis.route, "genesis");
assert.equal(genesis.user.mode, "public");
assert.deepEqual(genesis.entity, { type: "epoch", id: "epoch-08" });
assert.equal(genesis.axiom.semanticState, SEMANTIC_STATES.IDLE);
assertNoSecretLeak(genesis);

const absent = buildAxiomContext({ route: "workspace" });
assert.equal(absent.axiom.semanticState, SEMANTIC_STATES.ABSENT);
assert.equal(absent.route, null);

// Secrets must throw when injected into serializable fields
assert.throws(() => {
  assertNoSecretLeak({
    route: "home",
    evil: "api_key=sk-test",
  });
});

// State matrix
assert.equal(
  reduceSemanticState(SEMANTIC_STATES.IDLE, {
    type: EVENT_TYPES.USER_QUESTION,
    payload: {},
  }),
  SEMANTIC_STATES.WORKING,
);
assert.equal(
  reduceSemanticState(SEMANTIC_STATES.WORKING, {
    type: EVENT_TYPES.GATE_DECISION,
    payload: { action: "SHOW" },
  }),
  SEMANTIC_STATES.RESULT,
);
assert.equal(
  reduceSemanticState(SEMANTIC_STATES.WORKING, {
    type: EVENT_TYPES.GATE_DECISION,
    payload: { action: "REVIEW" },
  }),
  SEMANTIC_STATES.REVIEW,
);
assert.equal(
  reduceSemanticState(SEMANTIC_STATES.WORKING, {
    type: EVENT_TYPES.GATE_DECISION,
    payload: { action: "BLOCK" },
  }),
  SEMANTIC_STATES.HELD,
);
assert.equal(
  reduceSemanticState(SEMANTIC_STATES.WORKING, {
    type: EVENT_TYPES.REQUEST_FAILED,
    payload: {},
  }),
  SEMANTIC_STATES.ERROR,
);
assert.equal(
  reduceSemanticState(SEMANTIC_STATES.IDLE, {
    type: EVENT_TYPES.ENTITY_OPEN,
    payload: { entity: { type: "epoch", id: "epoch-01" } },
  }),
  SEMANTIC_STATES.ATTENTIVE,
);
assert.equal(
  reduceSemanticState(SEMANTIC_STATES.IDLE, {
    type: EVENT_TYPES.ROUTE_ENTER,
    payload: { route: "not-a-route" },
  }),
  SEMANTIC_STATES.ABSENT,
);

// Animation adapter: semantic != frame names
const manifest = {
  idle: { row: 0, frames: 6 },
  waiting: { row: 6, frames: 6 },
  running: { row: 7, frames: 6 },
  review: { row: 8, frames: 6 },
  failed: { row: 5, frames: 8 },
};
assert.equal(mapSemanticToAnimation(SEMANTIC_STATES.IDLE, manifest), "idle");
assert.equal(mapSemanticToAnimation(SEMANTIC_STATES.WORKING, manifest), "running");
assert.equal(mapSemanticToAnimation(SEMANTIC_STATES.REVIEW, manifest), "review");
assert.equal(mapSemanticToAnimation(SEMANTIC_STATES.HELD, manifest), "review");
assert.equal(mapSemanticToAnimation(SEMANTIC_STATES.ERROR, manifest), "failed");
assert.equal(mapSemanticToAnimation(SEMANTIC_STATES.ABSENT, manifest), null);
// Never return rejected conceptual frame ids as semantic authority
assert.notEqual(mapSemanticToAnimation(SEMANTIC_STATES.IDLE, manifest), "idle[6]");

// Runtime integration
const runtime = createPresenceRuntime({ route: "genesis" });
assert.equal(runtime.getSemanticState(), SEMANTIC_STATES.IDLE);
runtime.dispatch(EVENT_TYPES.ENTITY_OPEN, {
  entity: { type: "epoch", id: "epoch-08" },
});
assert.equal(runtime.getSemanticState(), SEMANTIC_STATES.ATTENTIVE);
runtime.dispatch(EVENT_TYPES.USER_QUESTION, { question: "What happened here?" });
assert.equal(runtime.getSemanticState(), SEMANTIC_STATES.WORKING);
runtime.dispatch(EVENT_TYPES.GATE_DECISION, {
  action: "SHOW",
  receipt_id: "audit-test-1",
});
assert.equal(runtime.getSemanticState(), SEMANTIC_STATES.RESULT);
assert.equal(runtime.getContext().runtime.decision, "SHOW");
assert.equal(runtime.getContext().runtime.internalDecision, "PROCEED");
assert.equal(runtime.getContext().runtime.receipt_id, "audit-test-1");
assert.equal(runtime.animationFor(manifest), "idle");
assertNoSecretLeak(runtime.getContext());

const telemetry = runtime.getTelemetry();
assert.ok(telemetry.events >= 3);
assert.equal(SUPPORTED_ROUTES.includes("genesis"), true);

console.log("ok - Axiom Presence Engine context/events/state/animation contracts");
