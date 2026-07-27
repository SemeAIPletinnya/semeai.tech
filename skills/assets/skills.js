(() => {
  "use strict";

  const registryNode = document.getElementById("skill-registry");
  const casesNode = document.getElementById("case-ledger");
  const countsNode = document.getElementById("registry-counts");
  const statusNode = document.getElementById("skills-status");

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

  function renderSkill(skill) {
    const article = element("article", "skill-record");
    const status = element("div", "skill-record__status");
    status.append(element("span", "", skill.name), element("strong", "", skill.status));
    article.append(status, element("h3", "", `${skill.name} / ${skill.version}`));
    article.append(element("p", "", skill.compatibility?.evidence || "Compatibility evidence not captured."));
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

  function renderCase(item) {
    const article = element("article", "case-record");
    const head = element("div", "case-record__head");
    head.append(element("span", "", item.case_id.toUpperCase()), element("strong", "", item.mode));
    article.append(head, element("p", "", item.observation));
    const facts = element("dl", "case-facts");
    definition(facts, "STARTING HEAD", item.starting_head);
    definition(facts, "FINAL HEAD", item.final_head);
    definition(facts, "DURATION", item.duration);
    definition(facts, "TOKEN OBSERVATION", item.token_observation);
    definition(facts, "HUMAN INTERVENTION", item.human_intervention);
    definition(facts, "DEPLOYMENT", item.deployment === null ? null : item.deployment ? "YES" : "NO");
    article.append(facts);
    const artifactList = element("ul", "artifact-list");
    (item.source_artifacts || []).forEach((artifact) => {
      const row = element("li");
      row.append(
        element("strong", "", artifact.name),
        element("code", "", artifact.sha256 || "HASH NOT CAPTURED"),
      );
      artifactList.append(row);
    });
    article.append(artifactList);
    if (item.tests?.length) {
      const tests = element("p", "case-tests", `TEST EVIDENCE · ${item.tests.map((test) => test.result).join(" · ")}`);
      article.append(tests);
    }
    return article;
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
      statusNode.textContent = `STRUCTURED SKILL EVIDENCE LOADED · ${evidence.cases.length} CASES · ADMISSION UNDECIDED`;
      statusNode.dataset.state = "ready";
    } catch (error) {
      console.error(error);
      statusNode.textContent = "Structured evidence could not be attached. The static review boundary remains available.";
      statusNode.dataset.state = "error";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
