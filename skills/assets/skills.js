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
  const evidencePathPattern = /^\/skills\/data\/[a-z0-9-]+-evidence\.json$/;

  function element(name, className, value) {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  }

  async function load(path) {
    if (path !== "/skills/data/registry.json" && !evidencePathPattern.test(path)) {
      throw new Error("Skill evidence reference is outside the public registry boundary.");
    }
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
    [...String(skill.source_skill_sha256 || "").toLowerCase().slice(0, 32)].forEach((character) => {
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

  function renderSkill(skill, evidence) {
    const article = element("article", "skill-record");
    article.dataset.skillId = skill.skill_id;
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
    definition(facts, "ADMISSION", skill.admission_decision?.decision || "NO DECISION");
    definition(facts, "DISTRIBUTION", skill.distribution?.available ? "AVAILABLE" : "NOT AVAILABLE");
    definition(facts, "STATISTICAL CLAIM", skill.compatibility?.statistical_claim);
    definition(facts, "EVIDENCE CASES", evidence.cases?.length || 0);
    definition(
      facts,
      "KNOWN LIMITATIONS",
      (evidence.known_failures?.length || 0) + (evidence.limitations?.length || 0),
    );
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

  function deploymentState(deployment) {
    if (deployment === null || deployment === undefined) {
      return { label: "NOT CAPTURED", state: "missing", detail: "NOT CAPTURED" };
    }
    if (typeof deployment === "object") {
      return {
        label: String(deployment.status || "").includes("LIVE VERIFIED") ? "LIVE VERIFIED" : "CAPTURED",
        state: "captured",
        detail: deployment.status || "CAPTURED",
      };
    }
    return deployment
      ? { label: "LIVE VERIFIED", state: "captured", detail: "YES" }
      : { label: "NOT DEPLOYED", state: "held", detail: "NO" };
  }

  function renderCase(item, index, skill) {
    const article = element("article", "case-record");
    article.dataset.skillId = skill.skill_id;
    const head = element("div", "case-record__head");
    const caseKey = `${skill.skill_id}-${item.case_id || `case-${index + 1}`}`.replace(/[^a-z0-9_-]/gi, "-");
    const labelId = `${caseKey}-label`;
    const toggleId = `${caseKey}-toggle`;
    const panelId = `${caseKey}-panel`;
    const caseLabel = element("span", "", `${skill.name} / ${String(item.case_id).toUpperCase()}`);
    caseLabel.id = labelId;
    head.append(caseLabel, element("strong", "", item.mode));
    article.append(head, element("p", "case-record__observation", item.observation));

    const artifacts = item.source_artifacts || [];
    const tests = item.tests || [];
    const deployment = deploymentState(item.deployment);
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
      caseSignal("DEPLOYMENT", deployment.label, deployment.state),
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
    definition(facts, "DEPLOYMENT", deployment.detail);
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

  function renderBoundaryList(title, values) {
    const section = element("section", "evaluation-boundaries__item");
    section.append(element("h4", "", title));
    const list = element("ul");
    values.forEach((value) => list.append(element("li", "", value)));
    section.append(list);
    return section;
  }

  function renderEvidenceGroup(skill, evidence) {
    const group = element("section", "case-group");
    group.dataset.skillId = skill.skill_id;
    const heading = element("header", "case-group__heading");
    const copy = element("div");
    copy.append(
      element("p", "skills-kicker", `${skill.name} / EVALUATION SET`),
      element("h3", "", `${evidence.cases?.length || 0} BOUNDED CASES`),
    );
    heading.append(copy, element("p", "", evidence.claim_boundary));
    group.append(heading);

    const boundaries = element("div", "evaluation-boundaries");
    if (evidence.known_failures?.length) {
      boundaries.append(renderBoundaryList("KNOWN FAILURES", evidence.known_failures));
    }
    if (evidence.limitations?.length) {
      boundaries.append(renderBoundaryList("LIMITATIONS", evidence.limitations));
    }
    if (boundaries.childElementCount) group.append(boundaries);

    const ledger = element("div", "case-group__ledger");
    ledger.append(...(evidence.cases || []).map((item, index) => renderCase(item, index, skill)));
    group.append(ledger);
    return group;
  }

  function renderForgeState(registry, evidenceEntries) {
    const totalCases = evidenceEntries.reduce((total, entry) => total + (entry.evidence.cases?.length || 0), 0);
    const allUnavailable = registry.skills.every((skill) => !skill.distribution?.available);
    forgeEvidenceState.textContent = `${totalCases} CASES RETAINED`;
    forgeCandidateState.textContent =
      `${registry.counts.candidates} CANDIDATES · ${registry.counts.in_review} REVIEW`;
    forgeReviewState.textContent = "NO ADMISSION DECISIONS";
    forgeRegistryState.textContent =
      `${registry.counts.admitted} ADMITTED · ${allUnavailable ? "NOT AVAILABLE" : "AVAILABILITY RECORDED"}`;
    forgeTrace.dataset.state = "ready";
    forgeTrace.querySelector('[data-forge-stage="review"]')?.classList.add("is-current");
    forgeTrace.querySelector('[data-forge-stage="registry"]')?.classList.toggle("is-held", allUnavailable);
  }

  async function boot() {
    try {
      const registry = await load("/skills/data/registry.json");
      const evidenceEntries = await Promise.all(
        registry.skills.map(async (skill) => ({
          skill,
          evidence: await load(skill.evaluation_reference),
        })),
      );
      registryNode.replaceChildren(
        ...evidenceEntries.map(({ skill, evidence }) => renderSkill(skill, evidence)),
      );
      casesNode.replaceChildren(
        ...evidenceEntries.map(({ skill, evidence }) => renderEvidenceGroup(skill, evidence)),
      );
      countsNode.textContent = `${registry.counts.in_review} REVIEW · ${registry.counts.admitted} ADMITTED`;
      renderForgeState(registry, evidenceEntries);
      const totalCases = evidenceEntries.reduce(
        (total, entry) => total + (entry.evidence.cases?.length || 0),
        0,
      );
      statusNode.textContent =
        `STRUCTURED SKILL EVIDENCE LOADED · ${totalCases} CASES · ADMISSION UNDECIDED`;
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
