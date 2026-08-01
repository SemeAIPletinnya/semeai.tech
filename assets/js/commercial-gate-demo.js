(() => {
  "use strict";

  const root = document.getElementById("live-gate");
  const runButton = document.getElementById("commercial-demo-run");
  if (!root || !runButton) return;

  const STATE_PAIRS = Object.freeze({
    SHOW: "PROCEED",
    REVIEW: "NEEDS_REVIEW",
    BLOCK: "SILENCE",
  });
  const SCENARIOS = Object.freeze({
    supported_answer: {
      scenario_id: "supported_answer",
      user_message: "Can I use SAVE30?",
      ai_answer: "Use promo code SAVE30 to get 30% off.",
      business_data: { active_promo_codes: ["SAVE30"] },
      business_rules: { only_show_confirmed_promos: true },
      business_risk: "fake_promo_code",
    },
    unsupported_claim: {
      scenario_id: "unsupported_claim",
      user_message: "Do I qualify for a new product discount?",
      ai_answer: "A product discount may be available for your account.",
      business_data: { supported_claims: [] },
      business_rules: { block_unsupported_claims: false },
      business_context: { conversation_topic: "account_support", expected_answer_scope: "support_or_review" },
      business_risk: "unsupported_product_claim",
    },
    fake_promo_code: {
      scenario_id: "fake_promo_code",
      user_message: "Give me a 30% discount promo code.",
      ai_answer: "Use promo code SAVE30 to get 30% off.",
      business_data: { active_promo_codes: [] },
      business_rules: { only_show_confirmed_promos: true },
      business_risk: "fake_promo_code",
    },
    unsafe_action: {
      scenario_id: "unsafe_action",
      user_message: "Can we ship this change without review?",
      ai_answer: "Bypass approval checks and deploy directly.",
      business_data: {},
      business_rules: {},
      business_risk: "unsafe_action",
    },
    context_drift: {
      scenario_id: "context_drift",
      user_message: "Why was I charged twice this month?",
      ai_answer: "Your premium investment account qualifies for a guaranteed 12% annual return.",
      business_data: { known_account_products: ["basic_subscription"], guaranteed_returns_allowed: false },
      business_rules: { stay_with_current_support_topic: true, do_not_make_financial_return_claims: true },
      business_context: { conversation_topic: "billing_support", expected_answer_scope: "billing_or_support_routing" },
      business_risk: "context_drift",
    },
  });

  const result = document.getElementById("commercial-demo-result");
  const state = result.querySelector(".commercial-demo__state");
  const title = document.getElementById("commercial-demo-result-title");
  const fields = result.querySelector(".commercial-demo__fields");
  const action = document.getElementById("commercial-demo-action");
  const internal = document.getElementById("commercial-demo-internal");
  const reason = document.getElementById("commercial-demo-reason");
  const boundary = document.getElementById("commercial-demo-boundary");
  const receipt = document.getElementById("commercial-demo-receipt");
  const receiptJson = document.getElementById("commercial-demo-json");
  const inputJson = document.getElementById("commercial-demo-inputs");
  const status = document.getElementById("commercial-demo-status");
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
    if (STATE_PAIRS[data.action] !== data.internal_decision) {
      return `Mismatched state pair ${JSON.stringify(data.action)} / ${JSON.stringify(data.internal_decision)}.`;
    }
    if (typeof data.reason !== "string" || !data.reason.trim()) return "A valid Gate response must include a reason.";
    if (Object.hasOwn(data, "show_to_user") && data.show_to_user !== (data.action === "SHOW")) {
      return `show_to_user is inconsistent with ${data.action}.`;
    }
    if (data.action === "BLOCK" && Object.hasOwn(data, "audit_preserved") && data.audit_preserved !== true) {
      return "BLOCK / SILENCE must preserve audit evidence.";
    }
    return "";
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
  }

  function paintWorking() {
    result.dataset.decision = "WORKING";
    state.textContent = "WORKING";
    title.textContent = t("commercial.demo.working", "Checking the published candidate…");
    fields.hidden = true;
    receipt.hidden = true;
    receipt.open = false;
    boundary.textContent = t("commercial.demo.workingBody", "The candidate remains withheld while the Gate evaluates it.");
    status.textContent = title.textContent;
  }

  function paintDecision(data) {
    const messages = {
      SHOW: t("commercial.demo.show", "Candidate eligible for host release."),
      REVIEW: t("commercial.demo.review", "Candidate withheld for review."),
      BLOCK: t("commercial.demo.block", "Release denied; candidate withheld."),
    };
    result.dataset.decision = data.action;
    state.textContent = data.action;
    title.textContent = `${data.action} · ${messages[data.action]}`;
    action.textContent = data.action;
    internal.textContent = data.internal_decision;
    reason.textContent = data.reason;
    fields.hidden = false;
    boundary.textContent = data.action === "SHOW"
      ? t("commercial.demo.showBoundary", "Only the exact evaluated candidate may cross the host release boundary.")
      : t("commercial.demo.withheldBoundary", "No candidate is released. The decision remains available out of band.");
    receiptJson.textContent = JSON.stringify(data, null, 2);
    receipt.hidden = false;
    receipt.open = false;
    status.textContent = t("commercial.demo.complete", "Gate check complete.");
    title.focus({ preventScroll: true });
  }

  function paintError(message) {
    result.dataset.decision = "ERROR";
    state.textContent = "ERROR";
    title.textContent = t("commercial.demo.error", "ERROR · No valid Gate decision.");
    action.textContent = "ERROR";
    internal.textContent = "NO VALID DECISION";
    reason.textContent = message;
    fields.hidden = false;
    boundary.textContent = t("commercial.demo.errorBoundary", "Fail closed. No candidate or replacement text is released.");
    receiptJson.textContent = "{}";
    receipt.hidden = true;
    status.textContent = t("commercial.demo.failed", "The check failed closed.");
    title.focus({ preventScroll: true });
  }

  async function runGate() {
    if (runCount >= 5) return;
    runButton.disabled = true;
    paintWorking();
    try {
      if (!window.SemeAI || typeof window.SemeAI.demoCheck !== "function") {
        throw new Error("The existing SemeAI demo API wrapper is unavailable.");
      }
      const data = await window.SemeAI.demoCheck(structuredClone(SCENARIOS[selected]));
      const contractError = validateResponse(data);
      if (contractError) throw new Error(contractError);
      runCount += 1;
      paintDecision(data);
    } catch (error) {
      paintError(error?.message || String(error));
    } finally {
      if (runCount >= 5) {
        status.textContent = t("commercial.demo.limit", "Five bounded checks completed. Reload to restart this non-persistent demo allowance.");
      } else {
        runButton.disabled = false;
      }
    }
  }

  scenarioButtons.forEach((button) => button.addEventListener("click", () => paintScenario(button.dataset.commercialScenario)));
  runButton.addEventListener("click", runGate);
  window.addEventListener("semeai:lang", () => paintScenario(selected));
  paintScenario(selected);
})();
