/**
 * Browser registration side-effect for the Presence Engine core.
 * Loads before axiom-agent.js so the classic agent can consume the API.
 */
import * as Presence from "./axiom-presence.mjs";

window.SemeAI_AxiomPresence = Object.freeze({
  AXIOM_CONTEXT_SCHEMA: Presence.AXIOM_CONTEXT_SCHEMA,
  SUPPORTED_ROUTES: Presence.SUPPORTED_ROUTES,
  SEMANTIC_STATES: Presence.SEMANTIC_STATES,
  EVENT_TYPES: Presence.EVENT_TYPES,
  DEFAULT_ANIMATION_MAP: Presence.DEFAULT_ANIMATION_MAP,
  buildAxiomContext: Presence.buildAxiomContext,
  reduceSemanticState: Presence.reduceSemanticState,
  mapSemanticToAnimation: Presence.mapSemanticToAnimation,
  createEventBus: Presence.createEventBus,
  createPresenceRuntime: Presence.createPresenceRuntime,
  assertNoSecretLeak: Presence.assertNoSecretLeak,
});

window.dispatchEvent(new Event("semeai:axiom-presence-ready"));
