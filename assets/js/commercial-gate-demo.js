(() => {
  "use strict";

  const root = document.getElementById("live-gate");
  const runButton = document.getElementById("commercial-demo-run");
  if (!root || !runButton) return;

  const STATE_PAIRS = Object.freeze({ SHOW: "PROCEED", REVIEW: "NEEDS_REVIEW", BLOCK: "SILENCE" });
  const SCENARIOS = Object.freeze({
    supported_answer: Object.freeze({ scenario_id: "supported_answer" }),
    unsupported_claim: Object.freeze({ scenario_id: "unsupported_claim" }),
    fake_promo_code: Object.freeze({ scenario_id: "fake_promo_code" }),
    unsafe_action: Object.freeze({ scenario_id: "unsafe_action" }),
    context_drift: Object.freeze({ scenario_id: "context_drift" }),
  });
  // The only browser-held candidate is the published supported fixture. It is
  // exposed verbatim only after the production Gate returns SHOW / PROCEED.
  const RELEASED_ANSWERS = Object.freeze({
    supported_answer: "Use promo code SAVE30 to get 30% off.",
  });

  const result = document.getElementById("commercial-demo-result");
  const state = root.querySelector(".commercial-demo__state");
  const title = document.getElementById("commercial-demo-result-title");
  const fields = root.querySelector(".commercial-demo__fields");
  const action = document.getElementById("commercial-demo-action");
  const internal = document.getElementById("commercial-demo-internal");
  const reason = document.getElementById("commercial-demo-reason");
  const boundary = document.getElementById("commercial-demo-boundary");
  const receipt = document.getElementById("commercial-demo-receipt");
  const receiptJson = document.getElementById("commercial-demo-json");
  const inputJson = document.getElementById("commercial-demo-inputs");
  const status = document.getElementById("commercial-demo-status");
  const release = document.getElementById("commercial-demo-release");
  const releasedAnswer = document.getElementById("commercial-demo-answer");
  const machineDecision = root.querySelector("[data-machine-decision]");
  const machineOutcome = root.querySelector("[data-machine-outcome]");
  const scenarioButtons = [...root.querySelectorAll("[data-commercial-scenario]")];
  let selected = "supported_answer";
  let runCount = 0;

  const t = (key, fallback) => {
    const value = window.SemeAI_I18n?.t?.(key);
    return value && value !== key ? value : fallback;
  };

  function validateResponse(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return "The API response is not a JSON object.";
    if (!Object.hasOwn(STATE_PAIRS, data.action)) return `Unknown business action ${JSON.stringify(data.action)}.`;
    if (STATE_PAIRS[data.action] !== data.internal_decision) return `Mismatched state pair ${JSON.stringify(data.action)} / ${JSON.stringify(data.internal_decision)}.`;
    if (typeof data.reason !== "string" || !data.reason.trim()) return "A valid Gate response must include a reason.";
    if (Object.hasOwn(data, "show_to_user") && data.show_to_user !== (data.action === "SHOW")) return `show_to_user is inconsistent with ${data.action}.`;
    if (data.action === "BLOCK" && data.audit_preserved !== true) return "BLOCK / SILENCE must preserve audit evidence.";
    if (data.action === "SHOW" && !Object.hasOwn(RELEASED_ANSWERS, selected)) return "No exact pre-gate candidate is registered for this SHOW response.";
    return "";
  }

  async function validateShowCandidate(data) {
    if (data.action !== "SHOW") return "";
    const expected = RELEASED_ANSWERS[selected];
    const gateHash = data.answer_hash || data.technical_details?.answer_hash;
    if (typeof gateHash !== "string" || !/^[a-f0-9]{64}$/i.test(gateHash)) return "SHOW must include the evaluated candidate hash.";
    if (!window.crypto?.subtle || typeof TextEncoder !== "function") return "Candidate hash verification is unavailable.";
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected));
    const localHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return localHash === gateHash.toLowerCase() ? "" : "The SHOW candidate hash does not match the exact pre-gate candidate.";
  }

  function receiptView(data) {
    return {
      action: data.action,
      internal_decision: data.internal_decision,
      reason: data.reason,
      show_to_user: data.action === "SHOW",
      audit_id: data.audit_id || null,
      receipt_id: data.receipt_id || data.audit_id || null,
      audit_preserved: data.audit_preserved === true,
      mapping: data.mapping || data.technical_details?.canonical_mapping || null,
      answer_hash: data.answer_hash || data.technical_details?.answer_hash || null,
    };
  }

  function clearRelease() {
    releasedAnswer.textContent = "";
    release.hidden = true;
  }

  function emitDecision(publicAction, canonicalState, receiptId = null) {
    window.dispatchEvent(new CustomEvent("semeai:gate-decision", {
      detail: { action: publicAction, internalDecision: canonicalState, receiptId },
    }));
  }

  function resetResult() {
    clearRelease();
    root.dataset.decision = "IDLE";
    result.dataset.decision = "IDLE";
    state.textContent = "IDLE";
    title.textContent = t("commercial.demo.resultIdle", "Choose a scenario, then run the Gate.");
    boundary.textContent = t("commercial.demo.resultIdleBody", "A candidate remains a candidate until a valid Gate decision permits release.");
    fields.hidden = true;
    receipt.hidden = true;
    receipt.open = false;
    receiptJson.textContent = "";
    machineDecision.textContent = t("v2.gate.pending", "Decision pending");
    machineOutcome.textContent = t("v2.gate.noOutcome", "No outcome yet");
  }

  function paintScenario(id) {
    selected = Object.hasOwn(SCENARIOS, id) ? id : "supported_answer";
    scenarioButtons.forEach((button) => {
      const active = button.dataset.commercialScenario === selected;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    inputJson.textContent = JSON.stringify(SCENARIOS[selected], null, 2);
    status.textContent = t("commercial.demo.ready", "Ready. No candidate has been released.");
    resetResult();
  }

  function paintWorking() {
    clearRelease();
    root.dataset.decision = "WORKING";
    result.dataset.decision = "WORKING";
    state.textContent = "WORKING";
    title.textContent = t("commercial.demo.working", "Checking the published candidate…");
    fields.hidden = true;
    receipt.hidden = true;
    receipt.open = false;
    boundary.textContent = t("commercial.demo.workingBody", "The candidate remains withheld while the Gate evaluates it.");
    status.textContent = title.textContent;
    machineDecision.textContent = "GATE WORKING";
    machineOutcome.textContent = "candidate withheld";
    emitDecision("WORKING", "NO TERMINAL DECISION");
  }

  function paintDecision(data) {
    const messages = {
      SHOW: t("commercial.demo.show", "Candidate eligible for host release."),
      REVIEW: t("commercial.demo.review", "Candidate withheld for review."),
      BLOCK: t("commercial.demo.block", "Release denied; candidate withheld."),
    };
    root.dataset.decision = data.action;
    result.dataset.decision = data.action;
    state.textContent = data.action;
    title.textContent = `${data.action} · ${messages[data.action]}`;
    action.textContent = data.action;
    internal.textContent = data.internal_decision;
    reason.textContent = data.reason;
    fields.hidden = false;
    machineDecision.textContent = data.internal_decision;
    machineOutcome.textContent = data.action === "SHOW" ? "release permitted" : "release withheld";

    if (data.action === "SHOW") {
      releasedAnswer.textContent = RELEASED_ANSWERS[selected];
      release.hidden = false;
      boundary.textContent = t("commercial.demo.showBoundary", "Only the exact evaluated candidate may cross the host release boundary.");
    } else {
      clearRelease();
      boundary.textContent = t("commercial.demo.withheldBoundary", "No candidate is released. The decision remains available out of band.");
    }

    const publicReceipt = receiptView(data);
    receiptJson.textContent = JSON.stringify(publicReceipt, null, 2);
    receipt.hidden = false;
    receipt.open = false;
    status.textContent = t("commercial.demo.complete", "Gate check complete.");
    emitDecision(data.action, data.internal_decision, publicReceipt.receipt_id);
    title.focus({ preventScroll: true });
  }

  function paintError(message) {
    clearRelease();
    root.dataset.decision = "ERROR";
    result.dataset.decision = "ERROR";
    state.textContent = "ERROR";
    title.textContent = t("commercial.demo.error", "ERROR · No valid Gate decision.");
    action.textContent = "ERROR";
    internal.textContent = "NO VALID DECISION";
    reason.textContent = message;
    fields.hidden = false;
    boundary.textContent = t("commercial.demo.errorBoundary", "Fail closed. No candidate or replacement text is released.");
    receiptJson.textContent = "";
    receipt.hidden = true;
    machineDecision.textContent = "ERROR";
    machineOutcome.textContent = "fail closed";
    status.textContent = t("commercial.demo.failed", "The check failed closed.");
    emitDecision("ERROR", "NO VALID DECISION");
    title.focus({ preventScroll: true });
  }

  async function runGate() {
    if (runCount >= 5) return;
    runButton.disabled = true;
    paintWorking();
    try {
      if (!window.SemeAI || typeof window.SemeAI.demoCheck !== "function") throw new Error("The existing SemeAI demo API wrapper is unavailable.");
      const data = await window.SemeAI.demoCheck({ scenario_id: SCENARIOS[selected].scenario_id });
      const contractError = validateResponse(data);
      if (contractError) throw new Error(contractError);
      const candidateError = await validateShowCandidate(data);
      if (candidateError) throw new Error(candidateError);
      runCount += 1;
      paintDecision(data);
    } catch (error) {
      paintError(error?.message || String(error));
    } finally {
      if (runCount >= 5) status.textContent = t("commercial.demo.limit", "Five bounded checks completed. Reload to restart this non-persistent demo allowance.");
      else runButton.disabled = false;
    }
  }

  scenarioButtons.forEach((button) => button.addEventListener("click", () => paintScenario(button.dataset.commercialScenario)));
  runButton.addEventListener("click", runGate);
  window.addEventListener("semeai:lang", () => paintScenario(selected));
  paintScenario(selected);
})();
