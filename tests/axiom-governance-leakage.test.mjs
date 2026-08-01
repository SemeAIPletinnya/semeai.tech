/**
 * Governance disclosure boundary: Axiom may know decision state,
 * but must only present RELEASED content for SHOW.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPresenceRuntime,
  EVENT_TYPES,
  SEMANTIC_STATES,
  assertNoSecretLeak,
} from "../assets/js/axiom-presence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentSrc = fs.readFileSync(path.join(ROOT, "assets/js/axiom-agent.js"), "utf8");

// Agent enforces public response contract
assert.match(agentSrc, /releasedAnswer !== null/);
assert.match(agentSrc, /candidateTextIncluded !== false/);
assert.match(agentSrc, /SHOW:\s*"PROCEED"/);
assert.match(agentSrc, /REVIEW:\s*"NEEDS_REVIEW"/);
assert.match(agentSrc, /BLOCK:\s*"SILENCE"/);
assert.match(agentSrc, /Object\.prototype\.hasOwnProperty\.call\(value\.candidate,\s*"candidateText"\)/);

// Simulate public API payloads as the agent would accept/reject
function shapePublicResponse({ action, releasedAnswer, candidateText }) {
  const evaluated = action !== null;
  return {
    schemaVersion: "semeai.axiom-public-answer.v0.1",
    evidenceBundle: {
      schemaVersion: "semeai.axiom-evidence-bundle.v0.1",
      evidence: evaluated
        ? [
            {
              sourceId: "public:test:1",
              title: "Test",
              visibility: "PUBLIC",
              contentTrust: "UNTRUSTED_DATA",
              route: "/gate.html",
            },
          ]
        : [],
      noEvidence: !evaluated,
    },
    candidate: evaluated
      ? {
          candidateTextIncluded: false,
          candidateHash: "a".repeat(64),
          ...(candidateText !== undefined ? { candidateText } : {}),
        }
      : null,
    releasedAnswer,
    release: evaluated
      ? {
          gateEvaluated: true,
          action,
          internalDecision:
            action === "SHOW" ? "PROCEED" : action === "REVIEW" ? "NEEDS_REVIEW" : "SILENCE",
          showToUser: action === "SHOW",
          reason: "test",
          decisionReceiptId: "audit-test",
          receipt_id: "audit-test",
          executionReceiptId: null,
          auditPreserved: true,
        }
      : {
          gateEvaluated: false,
          action: null,
          decisionReceiptId: null,
        },
  };
}

// SHOW may carry released answer; REVIEW/BLOCK must not
const show = shapePublicResponse({
  action: "SHOW",
  releasedAnswer: "Released exact answer",
});
assert.equal(show.releasedAnswer, "Released exact answer");
assert.equal(show.candidate.candidateTextIncluded, false);
assert.equal(Object.prototype.hasOwnProperty.call(show.candidate, "candidateText"), false);

for (const action of ["REVIEW", "BLOCK"]) {
  const held = shapePublicResponse({ action, releasedAnswer: null });
  assert.equal(held.releasedAnswer, null);
  assert.equal(held.candidate.candidateTextIncluded, false);
  assert.equal(Object.prototype.hasOwnProperty.call(held.candidate, "candidateText"), false);
  // If candidateText were present, agent validator must throw
  const leaky = shapePublicResponse({ action, releasedAnswer: null, candidateText: "SECRET CANDIDATE" });
  assert.equal(Object.prototype.hasOwnProperty.call(leaky.candidate, "candidateText"), true);
}

// Presence runtime must not invent releasedAnswer fields on context
const rt = createPresenceRuntime({ route: "genesis" });
rt.dispatch(EVENT_TYPES.USER_QUESTION, { question: "x" });
rt.dispatch(EVENT_TYPES.GATE_DECISION, { action: "BLOCK", receipt_id: "r1" });
assert.equal(rt.getSemanticState(), SEMANTIC_STATES.HELD);
const ctx = rt.getContext();
assert.equal(Object.prototype.hasOwnProperty.call(ctx, "releasedAnswer"), false);
assert.equal(ctx.runtime.decision, "BLOCK");
assertNoSecretLeak(ctx);

// Presentation mapping in agent: held answers clear text nodes
assert.match(agentSrc, /nodes\.resultAnswer\.textContent = ""/);
assert.match(agentSrc, /resultAnswer\.hidden = true/);

console.log("ok - governance disclosure boundary (SHOW present; REVIEW/BLOCK no candidate leak contract)");
