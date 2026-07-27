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

  function bindEraNavigation() {
    const controls = Array.from(document.querySelectorAll("[data-era-control]"));
    const eras = Array.from(document.querySelectorAll("[data-era]"));

    function activate(id) {
      controls.forEach((control) => {
        if (control.dataset.eraControl === id) control.setAttribute("aria-current", "step");
        else control.removeAttribute("aria-current");
      });
      eras.forEach((era) => era.classList.toggle("is-active", era.dataset.era === id));
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
    try {
      const [eras, milestones, artifacts, repositories, lineage, chronicle] = await Promise.all(
        Object.values(paths).map(fetchJson),
      );
      const data = { eras, milestones, artifacts, repositories, lineage, chronicle };
      renderEras(data);
      renderLineage(data);
      renderChronicle(data);
      bindLineageVisibility();
      setStatus(
        `STRUCTURED PROVENANCE LOADED · ${artifacts.artifacts.length} ADMITTED PUBLIC ARTIFACTS · ${chronicle.entries.length} CHRONICLE ENTRIES · SNAPSHOT ${repositories.captured_at}`,
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
