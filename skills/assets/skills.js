(() => {
  "use strict";

  const registryNode = document.getElementById("skill-registry");
  const casesNode = document.getElementById("case-ledger");
  const countsNode = document.getElementById("registry-counts");
  const statusNode = document.getElementById("skills-status");
  const forgeTrace = document.querySelector(".forge-trace");
  const forgeEvidenceState = document.getElementById("forge-evidence-state");
  const forgeCandidateState = document.getElementById("forge-candidate-state");
  const forgeReviewState = document.getElementById("forge-review-state");
  const forgeRegistryState = document.getElementById("forge-registry-state");

  function element(name, className, text) {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  async function load(path) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Skill evidence request failed (${response.status}).`);
    return response.json();
  }

  function definition(list, term, value) {
    const row = element("div");
    row.append(element("dt", "", term), element("dd", "", value ?? "NOT CAPTURED"));
    list.append(row);
  }

  function renderMethodImprint(skill) {
    const figure = element("figure", "method-imprint");
    const caption = element("figcaption");
    caption.append(
      element("span", "", "METHOD FINGERPRINT"),
      element("small", "", "VISUAL INDEX · NOT ADMISSION"),
    );
    figure.append(caption);

    const bars = element("div", "method-imprint__bars");
    bars.setAttribute("aria-hidden", "true");
    const sourceHash = String(skill.source_skill_sha256 || "").toLowerCase();
    [...sourceHash.slice(0, 32)].forEach((character) => {
      const level = Number.parseInt(character, 16);
      const bar = element("span", "method-imprint__bar");
      bar.dataset.level = Number.isFinite(level) ? String(level) : "0";
      bars.append(bar);
    });
    figure.append(bars);
    figure.append(
      element(
        "p",
        "",
        "Derived from the retained method SHA-256. It does not express admission, quality, or trust.",
      ),
    );
    return figure;
  }

  function renderSkill(skill) {
    const article = element("article", "skill-record");
    const status = element("div", "skill-record__status");
    status.append(element("span", "", skill.name), element("strong", "", skill.status));

    const identity = element("div", "skill-record__identity");
    const identityCopy = element("div");
    identityCopy.append(
      element("h3", "", `${skill.name} / ${skill.version}`),
      element("p", "", skill.compatibility?.evidence || "Compatibility evidence not captured."),
    );
    identity.append(identityCopy, renderMethodImprint(skill));
    article.append(status, identity);

    const facts = element("dl", "skill-facts");
    definition(facts, "METHOD SHA-256", skill.source_skill_sha256);
    definition(facts, "ADMISSION", skill.admission_decision ? skill.admission_decision.decision : "NO DECISION");
    definition(facts, "DISTRIBUTION", skill.distribution?.available ? "AVAILABLE" : "NOT AVAILABLE");
    definition(facts, "STATISTICAL CLAIM", skill.compatibility?.statistical_claim);
    article.append(facts);

    const capabilityList = element("ul", "capability-list");
    (skill.capabilities || []).forEach((capability) => capabilityList.append(element("li", "", capability)));
    article.append(capabilityList);
    return article;
  }

  function caseSignal(label, value, state) {
    const signal = element("div", `case-record__signal is-${state}`);
    signal.append(element("span", "", label), element("strong", "", value));
    return signal;
  }

  function renderCase(item, index) {
    const article = element("article", "case-record");
    const head = element("div", "case-record__head");
    const caseLabel = element("span", "", item.case_id.toUpperCase());
    const caseKey = String(item.case_id || `case-${index + 1}`).replace(/[^a-z0-9_-]/gi, "-");
    const labelId = `${caseKey}-label`;
    const toggleId = `${caseKey}-toggle`;
    const panelId = `${caseKey}-panel`;
    caseLabel.id = labelId;
    head.append(caseLabel, element("strong", "", item.mode));
    article.append(head, element("p", "case-record__observation", item.observation));

    const artifacts = item.source_artifacts || [];
    const tests = item.tests || [];
    const deployment = item.deployment;
    const signals = element("div", "case-record__signals");
    signals.append(
      caseSignal("ARTIFACTS", `${artifacts.length} RETAINED`, artifacts.length ? "captured" : "missing"),
      caseSignal(
        "EXECUTION",
        item.final_head ? "HEAD CAPTURED" : "NOT CAPTURED",
        item.final_head ? "captured" : "missing",
      ),
      caseSignal(
        "TESTS",
        tests.length ? `${tests.length} RETAINED` : "NOT RETAINED",
        tests.length ? "captured" : "missing",
      ),
      caseSignal(
        "DEPLOYMENT",
        deployment === null ? "NOT CAPTURED" : deployment ? "LIVE VERIFIED" : "NOT DEPLOYED",
        deployment === null ? "missing" : deployment ? "captured" : "held",
      ),
    );
    article.append(signals);

    const toggle = element("button", "case-record__toggle");
    toggle.type = "button";
    toggle.id = toggleId;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", panelId);
    toggle.append(
      element("span", "case-record__toggle-label", "INSPECT PRESERVED EVIDENCE"),
      element("span", "case-record__toggle-mark", "+"),
    );
    article.append(toggle);

    const panel = element("div", "case-record__panel");
    panel.id = panelId;
    panel.hidden = true;
    panel.setAttribute("aria-labelledby", `${labelId} ${toggleId}`);

    const facts = element("dl", "case-facts");
    definition(facts, "STARTING HEAD", item.starting_head);
    definition(facts, "FINAL HEAD", item.final_head);
    definition(facts, "DURATION", item.duration);
    definition(facts, "TOKEN OBSERVATION", item.token_observation);
    definition(facts, "HUMAN INTERVENTION", item.human_intervention);
    definition(facts, "DEPLOYMENT", item.deployment === null ? null : item.deployment ? "YES" : "NO");
    panel.append(facts);

    const artifactList = element("ul", "artifact-list");
    artifacts.forEach((artifact) => {
      const row = element("li");
      row.append(
        element("strong", "", artifact.name),
        element("code", "", artifact.sha256 || "HASH NOT CAPTURED"),
      );
      artifactList.append(row);
    });
    panel.append(artifactList);

    if (tests.length) {
      panel.append(element("p", "case-tests", `TEST EVIDENCE · ${tests.map((test) => test.result).join(" · ")}`));
    }
    article.append(panel);

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      toggle.querySelector(".case-record__toggle-label").textContent =
        expanded ? "INSPECT PRESERVED EVIDENCE" : "CLOSE PRESERVED EVIDENCE";
      toggle.querySelector(".case-record__toggle-mark").textContent = expanded ? "+" : "−";
      panel.hidden = expanded;
    });
    return article;
  }

  function renderForgeState(registry, evidence) {
    const candidate = registry.skills[0] || {};
    const decision = candidate.admission_decision?.decision || "NO DECISION";
    forgeEvidenceState.textContent = `${evidence.cases.length} CASES RETAINED`;
    forgeCandidateState.textContent =
      `${registry.counts.candidates} CANDIDATE · ${registry.counts.in_review} REVIEW`;
    forgeReviewState.textContent = decision;
    forgeRegistryState.textContent =
      `${registry.counts.admitted} ADMITTED · ${candidate.distribution?.available ? "AVAILABLE" : "NOT AVAILABLE"}`;
    forgeTrace.dataset.state = "ready";
    forgeTrace.querySelector('[data-forge-stage="review"]')?.classList.toggle("is-current", decision === "NO DECISION");
    forgeTrace.querySelector('[data-forge-stage="registry"]')?.classList.toggle(
      "is-held",
      !candidate.distribution?.available,
    );
  }

  async function boot() {
    try {
      const [registry, evidence] = await Promise.all([
        load("/skills/data/registry.json"),
        load("/skills/data/get-job-evidence.json"),
      ]);
      registryNode.replaceChildren(...registry.skills.map(renderSkill));
      casesNode.replaceChildren(...evidence.cases.map(renderCase));
      countsNode.textContent = `${registry.counts.in_review} REVIEW · ${registry.counts.admitted} ADMITTED`;
      renderForgeState(registry, evidence);
      statusNode.textContent =
        `STRUCTURED SKILL EVIDENCE LOADED · ${evidence.cases.length} CASES · ADMISSION UNDECIDED`;
      statusNode.dataset.state = "ready";
    } catch (error) {
      console.error(error);
      statusNode.textContent =
        "Structured evidence could not be attached. The static review boundary remains available.";
      statusNode.dataset.state = "error";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
