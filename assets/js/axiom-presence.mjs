/**
 * Axiom Presence Engine core (Phase 1).
 * Semantic state and context only — never release authority.
 * Animation mapping is adapter-only over the accepted v2 manifest.
 */

export const AXIOM_CONTEXT_SCHEMA = "semeai.axiom-context.v1";

export const SUPPORTED_ROUTES = Object.freeze([
  "home",
  "genesis",
  "benchmark",
  "gate",
  "skills",
  "book",
  "research",
  "article",
  "roadmap",
]);

export const SEMANTIC_STATES = Object.freeze({
  ABSENT: "ABSENT",
  IDLE: "IDLE",
  ATTENTIVE: "ATTENTIVE",
  WORKING: "WORKING",
  RESULT: "RESULT",
  REVIEW: "REVIEW",
  HELD: "HELD",
  ERROR: "ERROR",
});

export const EVENT_TYPES = Object.freeze({
  ROUTE_ENTER: "ROUTE_ENTER",
  ENTITY_OPEN: "ENTITY_OPEN",
  EVIDENCE_OPEN: "EVIDENCE_OPEN",
  RECEIPT_OPEN: "RECEIPT_OPEN",
  USER_QUESTION: "USER_QUESTION",
  TASK_STARTED: "TASK_STARTED",
  TASK_COMPLETED: "TASK_COMPLETED",
  GATE_DECISION: "GATE_DECISION",
  USER_IDLE: "USER_IDLE",
  REQUEST_FAILED: "REQUEST_FAILED",
  PANEL_OPEN: "PANEL_OPEN",
  PANEL_CLOSE: "PANEL_CLOSE",
  ASSET_READY: "ASSET_READY",
  ASSET_FAILED: "ASSET_FAILED",
});

/** Semantic → accepted v2 animation state names (pet.json). */
export const DEFAULT_ANIMATION_MAP = Object.freeze({
  ABSENT: null,
  IDLE: "idle",
  ATTENTIVE: "waiting",
  WORKING: "running",
  RESULT: "idle",
  REVIEW: "review",
  HELD: "review",
  ERROR: "failed",
});

const ENTITY_TYPES = new Set([
  "artifact",
  "epoch",
  "evidence",
  "skill",
  "receipt",
  "benchmark_entry",
]);

const GATE_ACTIONS = new Set(["SHOW", "REVIEW", "BLOCK"]);

function clampString(value, max) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

/**
 * Build a bounded allowlisted AxiomContext. Never accepts secrets or raw DOM.
 */
export function buildAxiomContext(input = {}) {
  const route = String(input.route || "").trim().toLowerCase();
  if (!SUPPORTED_ROUTES.includes(route)) {
    return {
      schemaVersion: AXIOM_CONTEXT_SCHEMA,
      route: null,
      surface: null,
      entity: null,
      user: { mode: "public" },
      runtime: { decision: null, internalDecision: null, receipt_id: null },
      axiom: {
        presence: "absent",
        interaction: "passive",
        semanticState: SEMANTIC_STATES.ABSENT,
      },
      provenance: { route: "unsupported" },
    };
  }

  let entity = null;
  if (input.entity && typeof input.entity === "object") {
    const type = String(input.entity.type || "").trim();
    const id = clampString(input.entity.id, 128);
    if (ENTITY_TYPES.has(type) && id) {
      entity = { type, id };
    }
  }

  const decision = GATE_ACTIONS.has(input.decision) ? input.decision : null;
  const internalDecision =
    decision === "SHOW"
      ? "PROCEED"
      : decision === "REVIEW"
        ? "NEEDS_REVIEW"
        : decision === "BLOCK"
          ? "SILENCE"
          : null;

  const semanticState = Object.values(SEMANTIC_STATES).includes(input.semanticState)
    ? input.semanticState
    : SEMANTIC_STATES.IDLE;

  return {
    schemaVersion: AXIOM_CONTEXT_SCHEMA,
    route,
    surface: clampString(input.surface, 64),
    entity,
    user: { mode: "public" },
    runtime: {
      decision,
      internalDecision,
      receipt_id: clampString(input.receipt_id, 128),
    },
    axiom: {
      presence: input.presence === "hidden" ? "hidden" : "visible",
      interaction: ["passive", "open", "working", "result", "held"].includes(input.interaction)
        ? input.interaction
        : "passive",
      semanticState,
    },
    provenance: {
      route: "pathname",
      surface: input.surface ? "caller" : undefined,
      entity: entity ? "caller" : undefined,
    },
  };
}

/**
 * Pure semantic reducer. Animation names never appear here.
 */
export function reduceSemanticState(currentState, event) {
  const state = Object.values(SEMANTIC_STATES).includes(currentState)
    ? currentState
    : SEMANTIC_STATES.IDLE;
  const type = event?.type;
  const payload = event?.payload || {};

  switch (type) {
    case EVENT_TYPES.ROUTE_ENTER: {
      if (!SUPPORTED_ROUTES.includes(String(payload.route || "").toLowerCase())) {
        return SEMANTIC_STATES.ABSENT;
      }
      return payload.entity ? SEMANTIC_STATES.ATTENTIVE : SEMANTIC_STATES.IDLE;
    }
    case EVENT_TYPES.ENTITY_OPEN:
    case EVENT_TYPES.EVIDENCE_OPEN:
    case EVENT_TYPES.RECEIPT_OPEN:
      if (state === SEMANTIC_STATES.ABSENT) return state;
      if (state === SEMANTIC_STATES.WORKING) return state;
      return SEMANTIC_STATES.ATTENTIVE;
    case EVENT_TYPES.USER_QUESTION:
    case EVENT_TYPES.TASK_STARTED:
      if (state === SEMANTIC_STATES.ABSENT) return state;
      return SEMANTIC_STATES.WORKING;
    case EVENT_TYPES.GATE_DECISION: {
      const action = payload.action;
      if (action === "SHOW") return SEMANTIC_STATES.RESULT;
      if (action === "REVIEW") return SEMANTIC_STATES.REVIEW;
      if (action === "BLOCK") return SEMANTIC_STATES.HELD;
      if (payload.noEvidence === true) return SEMANTIC_STATES.REVIEW;
      return SEMANTIC_STATES.REVIEW;
    }
    case EVENT_TYPES.REQUEST_FAILED:
    case EVENT_TYPES.ASSET_FAILED:
      return SEMANTIC_STATES.ERROR;
    case EVENT_TYPES.ASSET_READY:
      return state === SEMANTIC_STATES.ABSENT ? state : SEMANTIC_STATES.IDLE;
    case EVENT_TYPES.USER_IDLE:
    case EVENT_TYPES.PANEL_CLOSE:
      if (state === SEMANTIC_STATES.WORKING) return state;
      if (state === SEMANTIC_STATES.RESULT) return SEMANTIC_STATES.RESULT;
      if (state === SEMANTIC_STATES.REVIEW) return SEMANTIC_STATES.REVIEW;
      if (state === SEMANTIC_STATES.HELD) return SEMANTIC_STATES.HELD;
      if (state === SEMANTIC_STATES.ERROR) return SEMANTIC_STATES.ERROR;
      return payload.entity ? SEMANTIC_STATES.ATTENTIVE : SEMANTIC_STATES.IDLE;
    case EVENT_TYPES.PANEL_OPEN:
      if (state === SEMANTIC_STATES.ABSENT || state === SEMANTIC_STATES.WORKING) return state;
      return state;
    case EVENT_TYPES.TASK_COMPLETED:
      return state;
    default:
      return state;
  }
}

/**
 * Map semantic state to an accepted v2 animation state name.
 * Returns null for ABSENT or unknown mapping.
 */
export function mapSemanticToAnimation(semanticState, manifestStates = null, map = DEFAULT_ANIMATION_MAP) {
  const semantic = Object.values(SEMANTIC_STATES).includes(semanticState)
    ? semanticState
    : SEMANTIC_STATES.IDLE;
  const animationName = map[semantic];
  if (!animationName) return null;
  if (manifestStates && !Object.prototype.hasOwnProperty.call(manifestStates, animationName)) {
    // Fallback to idle when manifest lacks a mapped state; never invent authority.
    if (Object.prototype.hasOwnProperty.call(manifestStates, "idle")) return "idle";
    return null;
  }
  return animationName;
}

/**
 * Tiny synchronous event bus for presence (not a message broker).
 */
export function createEventBus() {
  const listeners = new Map();
  return {
    on(type, handler) {
      if (typeof handler !== "function") return () => {};
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
      return () => {
        const next = (listeners.get(type) || []).filter((item) => item !== handler);
        listeners.set(type, next);
      };
    },
    emit(type, payload = {}) {
      const event = { type, payload, at: Date.now() };
      for (const handler of listeners.get(type) || []) handler(event);
      for (const handler of listeners.get("*") || []) handler(event);
      return event;
    },
  };
}

/**
 * Presence runtime: context + semantic state + optional animation mirror.
 */
export function createPresenceRuntime(initial = {}) {
  let context = buildAxiomContext(initial);
  let semanticState = context.axiom.semanticState;
  const bus = createEventBus();
  const telemetry = { events: 0, byType: Object.create(null) };

  function applyEvent(type, payload = {}) {
    const event = bus.emit(type, payload);
    telemetry.events += 1;
    telemetry.byType[type] = (telemetry.byType[type] || 0) + 1;

    semanticState = reduceSemanticState(semanticState, event);

    const nextInput = {
      route: payload.route ?? context.route,
      surface: payload.surface !== undefined ? payload.surface : context.surface,
      entity: payload.entity !== undefined ? payload.entity : context.entity,
      decision:
        type === EVENT_TYPES.GATE_DECISION
          ? payload.action ?? null
          : context.runtime.decision,
      receipt_id:
        type === EVENT_TYPES.GATE_DECISION
          ? payload.receipt_id ?? null
          : context.runtime.receipt_id,
      presence: context.axiom.presence,
      interaction:
        semanticState === SEMANTIC_STATES.WORKING
          ? "working"
          : semanticState === SEMANTIC_STATES.RESULT
            ? "result"
            : semanticState === SEMANTIC_STATES.REVIEW || semanticState === SEMANTIC_STATES.HELD
              ? "held"
              : semanticState === SEMANTIC_STATES.ATTENTIVE
                ? "open"
                : "passive",
      semanticState,
    };
    context = buildAxiomContext(nextInput);
    context.axiom.semanticState = semanticState;
    return { event, context, semanticState };
  }

  return {
    getContext: () => context,
    getSemanticState: () => semanticState,
    getTelemetry: () => ({
      events: telemetry.events,
      byType: { ...telemetry.byType },
    }),
    on: bus.on,
    dispatch: applyEvent,
    animationFor(manifestStates) {
      return mapSemanticToAnimation(semanticState, manifestStates);
    },
  };
}

export function assertNoSecretLeak(context) {
  const serialized = JSON.stringify(context);
  const blocked =
    /session_token|api[_-]?key|authorization|cookie|password|BEGIN [A-Z ]*PRIVATE KEY|file:\/\/|[A-Za-z]:\\/i;
  if (blocked.test(serialized)) {
    throw new Error("AxiomContext contains forbidden secret or path material");
  }
  return true;
}
