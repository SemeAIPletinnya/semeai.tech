const STATE_PAIRS = Object.freeze({ SHOW: "PROCEED", REVIEW: "NEEDS_REVIEW", BLOCK: "SILENCE" });

const GATE_SCENARIOS = Object.freeze({
  supported_answer: Object.freeze({ scenario_id: "supported_answer" }),
  unsupported_claim: Object.freeze({ scenario_id: "unsupported_claim" }),
  fake_promo_code: Object.freeze({ scenario_id: "fake_promo_code" })
});

// This is the only browser-held published candidate. It is not rendered unless
// the production Gate returns SHOW / PROCEED and its SHA-256 matches exactly.
const RELEASED_ANSWERS = Object.freeze({
  supported_answer: "Use promo code SAVE30 to get 30% off."
});

export class ContractError extends Error {
  constructor(message, code = "contract_error") {
    super(message);
    this.name = "ContractError";
    this.code = code;
  }
}

async function sha256Hex(value) {
  if (!window.crypto?.subtle || typeof TextEncoder !== "function") {
    throw new ContractError("Candidate hash verification is unavailable.", "crypto_unavailable");
  }
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validateGateResponse(data, scenario) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ContractError("The Gate response is not a JSON object.");
  }
  if (!Object.hasOwn(STATE_PAIRS, data.action)) {
    throw new ContractError(`Unknown public Gate action ${JSON.stringify(data.action)}.`);
  }
  if (STATE_PAIRS[data.action] !== data.internal_decision) {
    throw new ContractError(`Mismatched Gate state pair ${JSON.stringify(data.action)} / ${JSON.stringify(data.internal_decision)}.`);
  }
  if (typeof data.reason !== "string" || !data.reason.trim()) {
    throw new ContractError("A valid Gate response must carry a decision reason.");
  }
  if (Object.hasOwn(data, "show_to_user") && data.show_to_user !== (data.action === "SHOW")) {
    throw new ContractError(`show_to_user is inconsistent with ${data.action}.`);
  }
  if (data.action !== "SHOW" && data.audit_preserved !== true) {
    throw new ContractError(`${data.action} must preserve the decision audit.`);
  }
  if (data.action === "SHOW" && !Object.hasOwn(RELEASED_ANSWERS, scenario)) {
    throw new ContractError("No exact pre-Gate candidate is registered for this SHOW response.");
  }
}

export class GateBridge {
  get scenarios() {
    return Object.keys(GATE_SCENARIOS);
  }

  async run(scenario) {
    // Deliberate local transport fault injection proves fail-closed ERROR behavior.
    // It is never represented as a real Gate decision and carries no receipt.
    if (scenario === "__error__") {
      throw new ContractError("Proof transport fault injected. No Gate decision returned; release remains denied.", "fault_injection");
    }
    if (!Object.hasOwn(GATE_SCENARIOS, scenario)) {
      throw new ContractError("Unknown published Gate scenario.", "unknown_scenario");
    }
    const isLoopback = ["127.0.0.1", "localhost"].includes(window.location.hostname);
    let data;
    if (isLoopback) {
      const response = await fetch("/__cinematic__/gate", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(GATE_SCENARIOS[scenario])
      });
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new ContractError("The proof proxy returned invalid JSON.", "gate_unavailable");
      }
      if (!response.ok) {
        throw new ContractError(data?.error || `Production Gate returned HTTP ${response.status}.`, "gate_unavailable");
      }
    } else {
      if (!window.SemeAI || typeof window.SemeAI.demoCheck !== "function") {
        throw new ContractError("The production Gate API wrapper is unavailable.", "gate_unavailable");
      }
      data = await window.SemeAI.demoCheck(GATE_SCENARIOS[scenario]);
    }
    validateGateResponse(data, scenario);

    let releasedAnswer = null;
    if (data.action === "SHOW") {
      const exactCandidate = RELEASED_ANSWERS[scenario];
      const gateHash = data.answer_hash || data.technical_details?.answer_hash;
      if (typeof gateHash !== "string" || !/^[a-f0-9]{64}$/i.test(gateHash)) {
        throw new ContractError("SHOW did not include a valid evaluated candidate hash.");
      }
      const localHash = await sha256Hex(exactCandidate);
      if (localHash.toLowerCase() !== gateHash.toLowerCase()) {
        throw new ContractError("Gate candidate hash mismatch. Release denied.");
      }
      releasedAnswer = exactCandidate;
    }

    const receipt = Object.freeze({
      schema_version: "semeai.cinematic.gate-receipt-view.v1",
      action: data.action,
      internal_decision: data.internal_decision,
      reason: data.reason,
      show_to_user: data.action === "SHOW",
      audit_id: data.audit_id || null,
      receipt_id: data.receipt_id || data.audit_id || null,
      audit_preserved: data.audit_preserved === true,
      mapping: data.mapping || data.technical_details?.canonical_mapping || null,
      answer_hash: data.answer_hash || data.technical_details?.answer_hash || null
    });

    return Object.freeze({
      action: data.action,
      internalDecision: data.internal_decision,
      reason: data.reason,
      releasedAnswer,
      receipt
    });
  }
}

export class BenchmarkBridge {
  constructor() {
    this.core = window.SemeAIBenchmarkCore;
  }

  assertAvailable() {
    const required = [
      "normalizeRepositoryInput",
      "collectLiveSnapshot",
      "scoreSnapshot",
      "runPresentationGate",
      "computeIndicators",
      "computeVisualPhase",
      "buildReceipt"
    ];
    if (!this.core || required.some((key) => typeof this.core[key] !== "function")) {
      throw new ContractError("The real Benchmark analyzer is unavailable.", "benchmark_unavailable");
    }
  }

  async run(repository) {
    this.assertAvailable();
    const identity = this.core.normalizeRepositoryInput(repository);
    const snapshot = await this.core.collectLiveSnapshot(identity);
    const candidate = this.core.scoreSnapshot(snapshot);
    const gate = this.core.runPresentationGate(candidate);

    if (!gate || !["SHOW", "REVIEW", "BLOCK"].includes(gate.decision)) {
      throw new ContractError("The Benchmark presentation Gate returned an unknown decision.");
    }

    // A BLOCK result must not disclose the score candidate. It still returns the
    // decision reasons needed for an honest withheld-state trace.
    if (gate.decision === "BLOCK") {
      return Object.freeze({
        identity,
        gate,
        candidate: null,
        categories: [],
        receipt: null,
        withheld: true
      });
    }

    const stars = Number(snapshot.public_metadata?.stars || 0);
    const visual = this.core.computeVisualPhase(stars);
    const receipt = await this.core.buildReceipt(candidate, gate, visual);

    return Object.freeze({
      identity,
      gate,
      candidate,
      categories: candidate.categoryScores.map((category) => Object.freeze({
        key: category.key,
        name: category.name,
        score: category.score,
        max: category.max,
        ratio: category.max > 0 ? category.score / category.max : 0
      })),
      indicators: this.core.computeIndicators(candidate),
      visual,
      receipt,
      withheld: false
    });
  }
}

export { GATE_SCENARIOS, STATE_PAIRS };
