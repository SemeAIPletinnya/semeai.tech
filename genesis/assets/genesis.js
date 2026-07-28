(() => {
  "use strict";

  const root = document.documentElement;
  const status = document.querySelector("[data-genesis-status]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const paths = {
    eras: "/genesis/data/eras.json",
    milestones: "/genesis/data/milestones.json",
    artifacts: "/genesis/data/artifacts.json",
    repositories: "/genesis/data/repositories.json",
    lineage: "/genesis/data/lineage.json",
    chronicle: "/genesis/data/chronicle.json",
    historicalEvidence: "/genesis/data/historical-evidence.json",
    admissionDecisions: "/genesis/data/admission-decisions.json",
    timelines: "/genesis/data/timelines.json",
    conceptLineage: "/genesis/data/concept-lineage.json",
    evidenceQuality: "/genesis/data/evidence-quality.json",
    duplicates: "/genesis/data/duplicate-representations.json",
  };

  function element(name, attributes = {}, text = "") {
    const node = document.createElement(name);
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== false) node.setAttribute(key, String(value));
    });
    if (text) node.textContent = text;
    return node;
  }

  function svgElement(name, attributes = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return "";
      if (!["github.com", "x.com"].includes(url.hostname)) return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function safeArchivePath(value) {
    if (typeof value !== "string") return "";
    if (!/^genesis\/archive\/[0-9]{4}-[0-9]{2}\/originals\/[A-Za-z0-9._-]+$/.test(value)) return "";
    return `/${value}`;
  }

  async function fetchJson(path) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Genesis manifest request failed: ${response.status} ${path}`);
    return response.json();
  }

  function setStatus(message, state) {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function evidenceCountLabel(artifactCount, repositoryCount, milestoneCount) {
    return `${artifactCount} public artifact${artifactCount === 1 ? "" : "s"} · ${repositoryCount} repositor${repositoryCount === 1 ? "y" : "ies"} · ${milestoneCount} admitted milestone${milestoneCount === 1 ? "" : "s"}`;
  }

  function renderMilestone(item) {
    const card = element("article", { class: "milestone" });
    const meta = element("div", { class: "milestone__meta" });
    meta.append(
      element("span", { class: "evidence-state" }, item.state),
      element("time", { datetime: item.date }, item.date),
    );
    card.append(
      meta,
      element("h4", {}, item.title),
      element("p", {}, item.claim),
    );
    return card;
  }

  function renderArtifact(item) {
    const card = element("article", { class: "artifact" });
    const meta = element("div", { class: "artifact__meta" });
    meta.append(
      element("span", { class: "evidence-state" }, item.state),
      element("span", { class: item.historical_framing ? "evidence-state historical-state" : "evidence-state" }, item.historical_framing ? "HISTORICAL FRAMING" : "PUBLIC TRACE"),
      element("time", { datetime: item.published_at }, item.published_at.slice(0, 10)),
    );
    card.append(meta);

    const supported = Array.isArray(item.claims_supported) ? item.claims_supported[0] : "";
    if (supported) card.append(element("h4", {}, supported));
    if (item.curation_note) card.append(element("p", {}, item.curation_note));

    const sourceUrl = safeExternalUrl(item.source_url);
    if (sourceUrl) {
      card.append(element("a", {
        class: "evidence-link",
        href: sourceUrl,
        target: "_blank",
        rel: "noopener noreferrer",
      }, "OPEN PUBLIC SOURCE ↗"));
    }

    const media = Array.isArray(item.media) ? item.media[0] : null;
    const mediaPath = media ? safeArchivePath(media.path) : "";
    if (mediaPath) {
      card.append(element("img", {
        class: "artifact-media",
        src: mediaPath,
        alt: "Preserved historical public artifact",
        loading: "lazy",
        decoding: "async",
      }));
    }
    return card;
  }

  function renderRepository(item) {
    const card = element("article", { class: "repository-trace" });
    const url = safeExternalUrl(item.html_url);
    const name = url
      ? element("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, item.full_name)
      : element("strong", {}, item.full_name);
    const head = item.current_head?.sha ? item.current_head.sha.slice(0, 10) : "no captured head";
    const created = typeof item.created_at === "string" ? item.created_at.slice(0, 10) : "date unavailable";
    card.append(
      name,
      element("p", { class: "repository-trace__facts" }, `${item.classification} · CREATED ${created} · HEAD ${head}`),
    );
    return card;
  }

  function renderEras(data) {
    const eras = data.eras.eras;
    const milestones = data.milestones.milestones.filter((item) => item.state === "ADMITTED");
    const artifacts = data.artifacts.artifacts.filter((item) => item.state === "ADMITTED");
    const repositories = data.repositories.repositories;
    const artifactMap = new Map(artifacts.map((item) => [item.id, item]));
    const repositoryMap = new Map(repositories.map((item) => [item.id, item]));

    eras.forEach((era) => {
      const section = document.querySelector(`[data-era="${CSS.escape(era.id)}"]`);
      const target = section?.querySelector("[data-era-evidence]");
      if (!section || !target) return;

      section.querySelector("h3").textContent = era.title;
      section.querySelector(".era__principle").textContent = era.principle;
      target.replaceChildren();

      const eraMilestones = milestones.filter((item) => item.era_id === era.id);
      const eraArtifacts = era.artifact_ids.map((id) => artifactMap.get(id)).filter(Boolean);
      const eraRepositories = era.repository_ids.map((id) => repositoryMap.get(id)).filter(Boolean);
      target.append(element("p", { class: "era-evidence__summary" }, evidenceCountLabel(
        eraArtifacts.length,
        eraRepositories.length,
        eraMilestones.length,
      )));

      eraMilestones.forEach((item) => target.append(renderMilestone(item)));
      eraArtifacts.forEach((item) => target.append(renderArtifact(item)));
      if (eraRepositories.length) {
        const list = element("div", { class: "repository-list" });
        eraRepositories.forEach((item) => list.append(renderRepository(item)));
        target.append(list);
      }
    });

    document.querySelector('[data-count="eras"]').textContent = String(eras.length);
    document.querySelector('[data-count="milestones"]').textContent = String(milestones.length);
    document.querySelector('[data-count="repositories"]').textContent = String(repositories.length);
  }

  function nodePosition(index, total) {
    const columns = 7;
    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowTotal = Math.min(columns, total - row * columns);
    const width = 940;
    const step = rowTotal > 1 ? width / (rowTotal - 1) : 0;
    return {
      x: rowTotal > 1 ? 90 + column * step : 560,
      y: 132 + row * 235,
    };
  }

  function shortName(value) {
    if (value.length <= 22) return value;
    return `${value.slice(0, 19)}…`;
  }

  function renderLineage(data) {
    const graph = document.querySelector("[data-lineage-graph]");
    const ledger = document.querySelector("[data-lineage-ledger]");
    if (!graph || !ledger) return;

    const allRepositories = data.repositories.repositories;
    const repositories = allRepositories
      .filter((item) => !item.fork)
      .sort((left, right) => left.created_at.localeCompare(right.created_at));
    const repositoryMap = new Map(repositories.map((item) => [item.id, item]));
    const positions = new Map(repositories.map((item, index) => [item.id, nodePosition(index, repositories.length)]));
    const title = graph.querySelector("title")?.cloneNode(true);
    const description = graph.querySelector("desc")?.cloneNode(true);
    graph.replaceChildren();
    if (title) graph.append(title);
    if (description) graph.append(description);

    data.lineage.edges.forEach((edge) => {
      const start = positions.get(edge.from);
      const end = positions.get(edge.to);
      if (!start || !end) return;
      const curve = Math.max(34, Math.abs(end.x - start.x) * 0.24);
      graph.append(svgElement("path", {
        class: "lineage-edge",
        d: `M${start.x} ${start.y} C${start.x + curve} ${start.y},${end.x - curve} ${end.y},${end.x} ${end.y}`,
      }));
    });

    repositories.forEach((item) => {
      const position = positions.get(item.id);
      const group = svgElement("g", {
        class: `lineage-node lineage-node--${item.classification.toLowerCase().replace(/_/g, "-")}`,
        transform: `translate(${position.x} ${position.y})`,
        tabindex: "0",
        role: "group",
        "aria-label": `${item.full_name}, ${item.classification}`,
      });
      const circle = svgElement("circle", { cx: "0", cy: "0", r: "10" });
      const label = svgElement("text", { x: "0", y: "29", "text-anchor": "middle" });
      label.textContent = shortName(item.id);
      const classification = svgElement("text", {
        class: "lineage-node__class",
        x: "0",
        y: "43",
        "text-anchor": "middle",
      });
      classification.textContent = item.classification.replace(/_/g, " ");
      group.append(circle, label, classification);
      graph.append(group);
    });

    ledger.replaceChildren();
    data.lineage.edges.forEach((edge) => {
      if (!repositoryMap.has(edge.from) || !repositoryMap.has(edge.to)) return;
      const row = element("li");
      row.append(
        element("span", {}, `${edge.from} → ${edge.to}`),
        element("span", { class: "lineage-ledger__relation" }, edge.relation.replace(/_/g, " ")),
        element("span", {}, edge.basis),
      );
      ledger.append(row);
    });

    Object.entries(data.repositories.summary).forEach(([key, value]) => {
      const output = document.querySelector(`[data-repository-count="${CSS.escape(key)}"]`);
      if (output) output.textContent = String(value);
    });
  }

  function renderChronicle(data) {
    const ledger = document.querySelector("[data-chronicle-ledger]");
    if (!ledger || !Array.isArray(data.chronicle.entries)) return;
    ledger.replaceChildren();
    data.chronicle.entries
      .slice()
      .reverse()
      .forEach((entry) => {
        const item = element("li");
        const article = element("article", { class: "chronicle-entry" });
        article.append(
          element("p", { class: "chronicle-entry__date" }, `${entry.date_range} · ${entry.status}`),
          element("h3", {}, entry.theme),
          element("p", { class: "chronicle-entry__change" }, entry.what_changed),
        );
        const detail = element("dl", { class: "chronicle-entry__detail" });
        [
          ["EVIDENCE", entry.evidence],
          ["VERIFICATION", entry.verification],
          ["REMAINING BLOCKER", entry.remaining_blocker],
          ["WHY IT MATTERS", entry.why_it_matters],
        ].forEach(([term, description]) => {
          const row = element("div");
          row.append(element("dt", {}, term), element("dd", {}, description));
          detail.append(row);
        });
        article.append(detail);
        const sources = element("div", { class: "chronicle-entry__sources" });
        (entry.source_references || []).forEach((value, index) => {
          const url = safeExternalUrl(value);
          if (!url) return;
          sources.append(element("a", {
            href: url,
            target: "_blank",
            rel: "noopener noreferrer",
          }, `SOURCE ${String(index + 1).padStart(2, "0")} ↗`));
        });
        article.append(sources);
        item.append(article);
        ledger.append(item);
      });
  }

  function labelFromKey(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function renderHistoricalTimelines(data) {
    const target = document.querySelector("[data-historical-timelines]");
    if (!target) return;
    target.replaceChildren();
    Object.entries(data.timelines.timelines || {}).forEach(([key, entries]) => {
      const section = element("section", { class: "historical-timeline" });
      section.append(
        element("p", { class: "historical-timeline__index" }, labelFromKey(key)),
      );
      const list = element("ol");
      (entries || []).forEach((entry) => {
        const item = element("li");
        item.append(
          element("time", { datetime: entry.date }, entry.date),
          element("h3", {}, entry.title),
          element("p", {}, entry.summary),
          element(
            "p",
            { class: "historical-timeline__refs" },
            `${entry.evidence_refs.length} ADMITTED EVIDENCE REFERENCE${entry.evidence_refs.length === 1 ? "" : "S"}`,
          ),
        );
        list.append(item);
      });
      section.append(list);
      target.append(section);
    });
  }

  function renderEvidenceQuality(data) {
    const target = document.querySelector("[data-evidence-quality]");
    if (!target) return;
    target.replaceChildren();
    (data.evidenceQuality.eras || []).forEach((era, index) => {
      const item = element("li");
      item.append(
        element("p", { class: "evidence-quality__period" }, era.period),
        element("h4", {}, era.label),
        element("p", {}, era.evidence_types.join(" · ").replace(/_/g, " ")),
        element("p", { class: "evidence-quality__limits" }, era.limitations),
      );
      item.style.setProperty("--quality-index", String(index));
      target.append(item);
    });
  }

  function renderConceptLineage(data) {
    const target = document.querySelector("[data-concept-lineage]");
    if (!target) return;
    target.replaceChildren();
    (data.conceptLineage.edges || []).forEach((edge) => {
      const item = element("li");
      item.append(
        element("span", { class: "concept-lineage__path" }, `${labelFromKey(edge.from)} → ${labelFromKey(edge.to)}`),
        element("span", { class: "concept-lineage__relation" }, edge.relation),
        element(
          "span",
          { class: "concept-lineage__basis" },
          `${edge.evidence_refs.length} EVIDENCE REFERENCE${edge.evidence_refs.length === 1 ? "" : "S"} · ${edge.causality_supported ? "CAUSAL SUPPORT RECORDED" : "NO CAUSALITY CLAIM"}`,
        ),
      );
      target.append(item);
    });
  }

  function renderHistoricalEvidence(data) {
    const target = document.querySelector("[data-historical-evidence]");
    if (!target) return;
    target.replaceChildren();
    (data.historicalEvidence.artifacts || []).forEach((artifact) => {
      const detail = element("details", { class: "historical-claim" });
      const summary = element("summary");
      const label = artifact.supports?.[0] || artifact.artifact_id;
      summary.append(
        element("span", { class: "historical-claim__date" }, artifact.timestamp?.slice(0, 10) || "DATE REVIEW"),
        element("span", { class: "historical-claim__title" }, label),
        element("span", { class: "historical-claim__class" }, artifact.claim_type.replace(/_/g, " ")),
      );
      detail.append(summary);
      const body = element("div", { class: "historical-claim__body" });
      body.append(
        element("p", {}, `PROVENANCE · ${artifact.provenance_class.replace(/_/g, " ")}`),
        element("p", {}, `SUPPORTS · ${(artifact.supports || []).join(" · ")}`),
        element("p", {}, `DOES NOT SUPPORT · ${(artifact.does_not_support || []).join(" · ")}`),
      );
      const url = safeExternalUrl(artifact.source_url);
      if (url) {
        body.append(
          element(
            "a",
            {
              class: "evidence-link",
              href: url,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            "OPEN PUBLIC SOURCE →",
          ),
        );
      }
      detail.append(body);
      target.append(detail);
    });
  }

  function renderAdmissionDecisions(data) {
    const target = document.querySelector("[data-admission-ledger]");
    if (!target) return;
    target.replaceChildren();
    const held = (data.admissionDecisions.decisions || []).filter(
      (decision) => decision.state !== "ADMIT",
    );
    held.forEach((decision) => {
      const item = element("li");
      item.append(
        element("span", { class: `admission-state admission-state--${decision.state.toLowerCase()}` }, decision.state),
        element("span", {}, decision.artifact_id),
        element("span", {}, decision.reasons.map(labelFromKey).join(" · ")),
      );
      target.append(item);
    });
    const counts = data.admissionDecisions.summary || {};
    ["admit", "review", "withhold"].forEach((key) => {
      const output = document.querySelector(`[data-historical-count="${key}"]`);
      if (output) output.textContent = String(counts[key] || 0);
    });
    const duplicateOutput = document.querySelector('[data-historical-count="duplicates"]');
    if (duplicateOutput) duplicateOutput.textContent = String(data.duplicates.groups?.length || 0);
  }

  function renderHistoricalFoundation(data) {
    renderHistoricalTimelines(data);
    renderEvidenceQuality(data);
    renderConceptLineage(data);
    renderHistoricalEvidence(data);
    renderAdmissionDecisions(data);
  }

  function bindEraNavigation() {
    const controls = Array.from(document.querySelectorAll("[data-era-control]"));
    const eras = Array.from(document.querySelectorAll("[data-era]"));

    function activate(id) {
      controls.forEach((control) => {
        if (control.dataset.eraControl === id) control.setAttribute("aria-current", "step");
        else control.removeAttribute("aria-current");
      });
      eras.forEach((era) => era.classList.toggle("is-active", era.dataset.era === id));
      document.dispatchEvent(new CustomEvent("genesis:era-change", {
        detail: {
          id,
          label: controls.find((control) => control.dataset.eraControl === id)?.textContent.trim() || "",
        },
      }));
    }

    controls.forEach((control, index) => {
      control.addEventListener("click", () => {
        const era = document.getElementById(control.dataset.eraControl);
        if (!era) return;
        era.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
        era.focus({ preventScroll: true });
        activate(control.dataset.eraControl);
      });
      control.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(controls.length - 1, index + 1);
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = controls.length - 1;
        controls[next].focus();
      });
    });

    activate(eras[0]?.dataset.era || "");
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (visible?.target?.dataset.era) activate(visible.target.dataset.era);
    }, {
      rootMargin: "-20% 0px -55% 0px",
      threshold: [0.08, 0.25, 0.5],
    });
    eras.forEach((era) => observer.observe(era));
  }

  function bindTraceSpine() {
    const spine = document.querySelector("[data-trace-spine]");
    if (!spine) return;
    const controls = Array.from(spine.querySelectorAll("[data-trace-stage]"));
    const current = spine.querySelector("[data-trace-current]");
    const sequence = spine.querySelector(".trace-spine__sequence");
    const stages = controls
      .map((control) => ({
        control,
        target: document.getElementById(control.dataset.traceStage),
      }))
      .filter((stage) => stage.target);
    const labels = {
      chronology: "EVOLUTION TRACE",
      lineage: "REPOSITORY FORMATION",
      "historical-provenance": "HISTORICAL EVIDENCE GATE",
      "claim-boundaries": "ADMITTED CLAIM BOUNDARIES",
      chronicle: "CONTINUING PUBLIC MEMORY",
      "current-boundary": "CURRENT BOUNDARY",
    };
    let activeEra = "Before Code";

    function activate(id) {
      const index = stages.findIndex((stage) => stage.target.id === id);
      if (index < 0) return;
      controls.forEach((control) => {
        if (control.dataset.traceStage === id) control.setAttribute("aria-current", "step");
        else control.removeAttribute("aria-current");
      });
      const denominator = Math.max(1, stages.length - 1);
      spine.style.setProperty("--trace-progress", `${(index / denominator) * 100}%`);
      spine.dataset.activeTraceStage = id;
      if (current) {
        if (id === "chronology") {
          const railEdge = (Number.parseFloat(getComputedStyle(spine).top) || 0) + spine.offsetHeight;
          const nearestEra = Array.from(document.querySelectorAll("[data-era]"))
            .find((era) => era.getBoundingClientRect().bottom >= railEdge);
          activeEra = nearestEra?.querySelector("h3")?.textContent.trim() || activeEra;
        }
        current.textContent = id === "chronology"
          ? `${labels[id]} · ${activeEra}`
          : labels[id];
      }
      const control = controls[index];
      if (sequence && control && sequence.scrollWidth > sequence.clientWidth) {
        const left = control.offsetLeft - ((sequence.clientWidth - control.offsetWidth) / 2);
        sequence.scrollTo({
          left: Math.max(0, left),
          behavior: reducedMotion.matches ? "auto" : "smooth",
        });
      }
    }

    controls.forEach((control) => {
      control.addEventListener("click", (event) => {
        const target = document.getElementById(control.dataset.traceStage);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({
          behavior: reducedMotion.matches ? "auto" : "smooth",
          block: "start",
        });
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        window.history.replaceState(null, "", `#${target.id}`);
        activate(target.id);
      });
    });

    sequence?.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      const index = controls.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowRight") next = Math.min(controls.length - 1, index + 1);
      if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = controls.length - 1;
      controls[next].focus();
    });

    document.addEventListener("genesis:era-change", (event) => {
      const era = document.getElementById(String(event.detail?.id || ""));
      const bounds = era?.getBoundingClientRect();
      const railEdge = (Number.parseFloat(getComputedStyle(spine).top) || 0) + spine.offsetHeight;
      if (!bounds || bounds.bottom < railEdge || bounds.top > window.innerHeight * 0.75) return;
      activeEra = String(event.detail?.label || "Before Code").replace(/^\d{2}\s*/, "");
      if (spine.dataset.activeTraceStage === "chronology" && current) {
        current.textContent = `${labels.chronology} · ${activeEra}`;
      }
    });

    activate(stages[0]?.target.id || "");
    if (!("IntersectionObserver" in window)) return;
    const stickyTop = Number.parseFloat(getComputedStyle(spine).top) || 0;
    const probe = Math.min(window.innerHeight - 2, Math.ceil(stickyTop + spine.offsetHeight + 18));
    const observer = new IntersectionObserver(() => {
      const visible = stages.filter((stage) => {
        const bounds = stage.target.getBoundingClientRect();
        return bounds.top <= probe + 2 && bounds.bottom >= probe - 2;
      });
      if (visible.length) activate(visible[visible.length - 1].target.id);
    }, {
      rootMargin: `-${probe}px 0px -${Math.max(0, window.innerHeight - probe - 2)}px 0px`,
      threshold: 0,
    });
    stages.forEach((stage) => observer.observe(stage.target));
  }

  function bindLineageVisibility() {
    const figure = document.querySelector(".lineage-figure");
    if (!figure || reducedMotion.matches || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      figure.classList.add("is-visible");
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(figure);
  }

  function bindLifecycle() {
    function applyMotionPreference() {
      root.classList.toggle("motion-enabled", !reducedMotion.matches && !document.hidden);
      root.classList.toggle("motion-paused", document.hidden);
    }
    applyMotionPreference();
    document.addEventListener("visibilitychange", applyMotionPreference);
    reducedMotion.addEventListener?.("change", applyMotionPreference);
  }

  async function boot() {
    bindLifecycle();
    bindEraNavigation();
    bindTraceSpine();
    try {
      const [
        eras,
        milestones,
        artifacts,
        repositories,
        lineage,
        chronicle,
        historicalEvidence,
        admissionDecisions,
        timelines,
        conceptLineage,
        evidenceQuality,
        duplicates,
      ] = await Promise.all(
        Object.values(paths).map(fetchJson),
      );
      const data = {
        eras,
        milestones,
        artifacts,
        repositories,
        lineage,
        chronicle,
        historicalEvidence,
        admissionDecisions,
        timelines,
        conceptLineage,
        evidenceQuality,
        duplicates,
      };
      renderEras(data);
      renderLineage(data);
      renderChronicle(data);
      renderHistoricalFoundation(data);
      bindLineageVisibility();
      setStatus(
        `STRUCTURED PROVENANCE LOADED · ${historicalEvidence.artifacts.length} ADMITTED CLAIM BOUNDARIES · ${admissionDecisions.summary.review} REVIEW · ${admissionDecisions.summary.withhold} WITHHOLD · ${chronicle.entries.length} CHRONICLE ENTRIES`,
        "ready",
      );
    } catch (error) {
      console.error(error);
      setStatus("Structured provenance could not be attached. The bounded static chronology remains available.", "error");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
