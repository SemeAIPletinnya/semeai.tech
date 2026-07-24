(function initSigil(globalScope) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  function xmur3(value) {
    let hash = 1779033703 ^ value.length;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return function nextHash() {
      hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
      hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
      return (hash ^= hash >>> 16) >>> 0;
    };
  }

  function mulberry32(seed) {
    return function nextRandom() {
      let value = (seed += 0x6d2b79f5);
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function round(value) {
    return Number(value.toFixed(3));
  }

  function point(center, angle, radius) {
    return {
      x: round(center + Math.cos(angle) * radius),
      y: round(center + Math.sin(angle) * radius),
    };
  }

  function buildSigilModel(input) {
    const repository = String(input.repository || "repository/unknown");
    const commitSha = String(input.commitSha || "pending");
    const policyVersion = String(input.policyVersion || "unknown-policy");
    const visualSeed = Number(input.visualSeed) === -3 ? -3 : 3;
    const phase = visualSeed > 0 ? "EXPANSION" : "CONSOLIDATION";
    const canonicalInput = `${repository}|${commitSha}|${policyVersion}|${visualSeed}`;
    const seedFactory = xmur3(canonicalInput);
    const random = mulberry32(seedFactory());
    const center = 160;
    const branchCount = 5 + Math.floor(random() * 4);
    const direction = visualSeed > 0 ? 1 : -1;
    const rotation = random() * Math.PI * 2;
    const goldRatio = round(0.52 + random() * 0.28);
    const breathingAmplitude = round(0.008 + random() * 0.009);
    const paths = [];

    for (let index = 0; index < branchCount; index += 1) {
      const angle = rotation + (index / branchCount) * Math.PI * 2 + (random() - 0.5) * 0.34;
      const start = point(center, angle + Math.PI + (random() - 0.5) * 0.6, 8 + random() * 12);
      const endRadius = 86 + random() * 45;
      const end = point(center, angle, endRadius);
      const tangent = angle + (Math.PI / 2) * direction;
      const controlA = point(center, angle + (random() - 0.5) * 0.7, 32 + random() * 24);
      const controlB = {
        x: round(end.x + Math.cos(tangent) * (18 + random() * 25)),
        y: round(end.y + Math.sin(tangent) * (18 + random() * 25)),
      };
      const color = random() <= goldRatio ? "gold" : "violet";
      const width = round(0.7 + random() * 1.15);
      const opacity = round(0.35 + random() * 0.48);

      paths.push({
        id: `trace-${index + 1}`,
        d: `M ${start.x} ${start.y} C ${controlA.x} ${controlA.y}, ${controlB.x} ${controlB.y}, ${end.x} ${end.y}`,
        color,
        width,
        opacity,
      });

      if (index % 2 === 0) {
        const echoEnd = point(center, angle + direction * (0.22 + random() * 0.22), endRadius * (0.62 + random() * 0.14));
        const echoControl = point(center, angle - direction * 0.3, 45 + random() * 28);
        paths.push({
          id: `echo-${index + 1}`,
          d: `M ${start.x} ${start.y} Q ${echoControl.x} ${echoControl.y}, ${echoEnd.x} ${echoEnd.y}`,
          color: color === "gold" ? "violet" : "gold",
          width: round(width * 0.58),
          opacity: round(opacity * 0.55),
        });
      }
    }

    return {
      schema: "semeai.repository-sigil.v1",
      canonicalInput,
      repository,
      commitSha,
      policyVersion,
      visualSeed,
      phase,
      branchCount,
      goldRatio,
      breathingAmplitude,
      periodSeconds: round(10.5 + random() * 4.5),
      paths,
    };
  }

  function createSvgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes || {}).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    return element;
  }

  function renderSigil(container, input) {
    if (!container || typeof document === "undefined") {
      return buildSigilModel(input);
    }

    const model = buildSigilModel(input);
    const svg = createSvgElement("svg", {
      viewBox: "0 0 320 320",
      role: "img",
      "aria-label": `${model.repository} deterministic repository sigil, ${model.phase.toLowerCase()} phase`,
      focusable: "false",
    });
    const defs = createSvgElement("defs");
    const goldGlow = createSvgElement("filter", { id: "sigil-gold-glow", x: "-70%", y: "-70%", width: "240%", height: "240%" });
    goldGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "2.4", result: "blur" }));
    const violetGlow = createSvgElement("filter", { id: "sigil-violet-glow", x: "-70%", y: "-70%", width: "240%", height: "240%" });
    violetGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "2", result: "blur" }));
    defs.append(goldGlow, violetGlow);
    svg.appendChild(defs);

    const breath = createSvgElement("g", { class: "sigil-breath" });
    breath.style.setProperty("--sigil-period", `${model.periodSeconds}s`);

    const halo = createSvgElement("circle", {
      cx: 160,
      cy: 160,
      r: 54,
      fill: "none",
      stroke: model.phase === "EXPANSION" ? "rgba(215,182,111,0.17)" : "rgba(120,101,142,0.2)",
      "stroke-width": 0.65,
    });
    breath.appendChild(halo);

    model.paths.forEach((pathModel, index) => {
      const color = pathModel.color === "gold" ? "#d7b66f" : "#78658e";
      const glow = createSvgElement("path", {
        d: pathModel.d,
        fill: "none",
        stroke: color,
        "stroke-width": pathModel.width * 3.4,
        "stroke-linecap": "round",
        opacity: pathModel.opacity * 0.18,
        filter: pathModel.color === "gold" ? "url(#sigil-gold-glow)" : "url(#sigil-violet-glow)",
      });
      const path = createSvgElement("path", {
        d: pathModel.d,
        fill: "none",
        stroke: color,
        "stroke-width": pathModel.width,
        "stroke-linecap": "round",
        opacity: pathModel.opacity,
        class: index % 3 === 0 ? "sigil-trace" : "",
        "pathLength": 20,
      });
      breath.append(glow, path);
    });

    breath.appendChild(
      createSvgElement("circle", {
        cx: 160,
        cy: 160,
        r: 3.5,
        fill: "#efd79a",
        opacity: 0.84,
      }),
    );
    breath.appendChild(
      createSvgElement("circle", {
        cx: 160,
        cy: 160,
        r: 11,
        fill: "none",
        stroke: "rgba(239,215,154,0.34)",
        "stroke-width": 0.7,
      }),
    );
    svg.appendChild(breath);
    container.replaceChildren(svg);
    return model;
  }

  function canonicalSigil(input) {
    return JSON.stringify(buildSigilModel(input));
  }

  const EVIDENCE_CATEGORIES = Object.freeze([
    "implementation",
    "tests",
    "evidence",
    "continuity",
    "release_control",
    "research",
    "external",
  ]);

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function normalizedCategoryScores(categoryScores) {
    return EVIDENCE_CATEGORIES.map((key) => {
      const source = (categoryScores || []).find((category) => category && category.key === key) || {};
      const score = Number.isFinite(Number(source.score)) ? Number(source.score) : 0;
      const maximum = Number.isFinite(Number(source.max || source.maximum))
        ? Number(source.max || source.maximum)
        : 0;
      return {
        key,
        score,
        maximum,
        coverage: maximum > 0 ? round(clamp(score / maximum, 0, 1)) : 0,
      };
    });
  }

  function buildEvidenceSigilModel(input) {
    const repository = String(input.repository || "repository/unknown");
    const commitSha = String(input.commitSha || "pending");
    const policyVersion = String(input.policyVersion || "unknown-policy");
    const visualSeed = Number(input.visualSeed) === -3 ? -3 : 3;
    const visualPhase = String(input.visualPhase || (visualSeed > 0 ? "EXPANSION" : "CONSOLIDATION"));
    const gateDecision = ["SHOW", "REVIEW", "BLOCK"].includes(String(input.gateDecision))
      ? String(input.gateDecision)
      : "REVIEW";
    const categories = normalizedCategoryScores(input.categoryScores);
    const scoreSignature = categories.map((category) => `${category.key}:${category.score}/${category.maximum}`).join("|");
    const canonicalInput = `${repository}|${commitSha}|${policyVersion}|${visualSeed}|${visualPhase}|${scoreSignature}`;
    const seedFactory = xmur3(canonicalInput);
    const random = mulberry32(seedFactory());
    const center = 180;
    const direction = visualSeed > 0 ? 1 : -1;
    const rotation = random() * Math.PI * 2;
    const paths = [];
    const anchors = [];

    function categoryCoverage(key) {
      return categories.find((category) => category.key === key).coverage;
    }

    function addPath(category, d, options) {
      const categoryIndex = EVIDENCE_CATEGORIES.indexOf(category);
      const coverage = categoryCoverage(category);
      const settings = options || {};
      paths.push({
        id: `${category}-${paths.filter((path) => path.category === category).length + 1}`,
        category,
        categoryIndex,
        d,
        color: settings.color || (categoryIndex % 3 === 1 ? "violet" : "gold"),
        width: round(settings.width || 1),
        opacity: round(settings.opacity === undefined ? 0.5 : settings.opacity),
        dash: settings.dash || (coverage === 0 ? "2 13" : coverage < 0.4 ? "7 9" : ""),
        transform: settings.transform || "",
      });
    }

    const implementation = categoryCoverage("implementation");
    const implementationCount = 2 + Math.floor(implementation * 4);
    for (let index = 0; index < implementationCount; index += 1) {
      const angle = rotation + (index / implementationCount) * Math.PI * 2 + (random() - 0.5) * 0.5;
      const start = point(center, angle + Math.PI + (random() - 0.5) * 0.5, 6 + random() * 10);
      const endRadius = 54 + implementation * 72 + random() * 18;
      const end = point(center, angle, endRadius);
      const controlA = point(center, angle + direction * (0.45 + random() * 0.35), 34 + implementation * 24);
      const controlB = point(center, angle - direction * (0.22 + random() * 0.35), endRadius * 0.72);
      addPath(
        "implementation",
        `M ${start.x} ${start.y} C ${controlA.x} ${controlA.y}, ${controlB.x} ${controlB.y}, ${end.x} ${end.y}`,
        {
          color: index % 4 === 3 ? "violet" : "gold",
          width: 0.82 + implementation * 1.15 + random() * 0.35,
          opacity: 0.16 + implementation * 0.65,
        },
      );
    }

    const tests = categoryCoverage("tests");
    const testPairs = 1 + Math.floor(tests * 3);
    for (let index = 0; index < testPairs; index += 1) {
      const angle = rotation + 0.7 + index * 0.58 * direction;
      const radius = 63 + index * 13 + tests * 18;
      const start = point(center, angle - 0.72, radius);
      const end = point(center, angle + 0.72, radius);
      const control = point(center, angle, radius * (0.54 + random() * 0.16));
      const echoStart = point(center, angle - 0.67, radius + 7);
      const echoEnd = point(center, angle + 0.67, radius + 7);
      const echoControl = point(center, angle, radius * (0.59 + random() * 0.12));
      addPath("tests", `M ${start.x} ${start.y} Q ${control.x} ${control.y}, ${end.x} ${end.y}`, {
        color: "violet",
        width: 0.62 + tests * 0.58,
        opacity: 0.12 + tests * 0.54,
      });
      addPath("tests", `M ${echoStart.x} ${echoStart.y} Q ${echoControl.x} ${echoControl.y}, ${echoEnd.x} ${echoEnd.y}`, {
        color: "gold",
        width: 0.48 + tests * 0.46,
        opacity: 0.09 + tests * 0.42,
      });
    }

    const evidence = categoryCoverage("evidence");
    const evidenceRings = 1 + Math.floor(evidence * 4);
    for (let index = 0; index < evidenceRings; index += 1) {
      const radius = 23 + index * 10 + evidence * 5;
      const offset = (random() - 0.5) * 7;
      addPath(
        "evidence",
        `M ${round(center - radius)} ${round(center + offset)} C ${round(center - radius * 0.52)} ${round(center - radius * 1.04)}, ${round(center + radius * 0.68)} ${round(center - radius * 0.78)}, ${round(center + radius)} ${round(center + offset)} C ${round(center + radius * 0.58)} ${round(center + radius * 0.83)}, ${round(center - radius * 0.44)} ${round(center + radius * 1.02)}, ${round(center - radius)} ${round(center + offset)}`,
        {
          color: index % 2 ? "violet" : "gold",
          width: 0.48 + evidence * 0.52,
          opacity: 0.12 + evidence * 0.5,
          transform: `rotate(${round((random() - 0.5) * 42)} ${center} ${center})`,
        },
      );
    }
    const anchorCount = evidence === 0 ? 1 : 2 + Math.floor(evidence * 6);
    for (let index = 0; index < anchorCount; index += 1) {
      const angle = rotation + (index / anchorCount) * Math.PI * 2 + (random() - 0.5) * 0.42;
      const anchor = point(center, angle, 27 + evidence * 45 + random() * 12);
      anchors.push({
        id: `evidence-anchor-${index + 1}`,
        category: "evidence",
        categoryIndex: 2,
        x: anchor.x,
        y: anchor.y,
        radius: round(1.1 + evidence * 1.8 + random() * 0.5),
        opacity: round(0.13 + evidence * 0.68),
      });
    }

    const continuity = categoryCoverage("continuity");
    const continuityCount = 1 + Math.floor(continuity * 4);
    for (let index = 0; index < continuityCount; index += 1) {
      const angle = rotation + 1.45 + index * (0.76 + random() * 0.18) * direction;
      const start = point(center, angle + Math.PI, 12 + random() * 13);
      const length = 73 + continuity * 86 + random() * 14;
      const end = point(center, angle, length);
      const controlA = point(center, angle - direction * (0.88 + random() * 0.34), length * 0.34);
      const controlB = point(center, angle + direction * (0.38 + random() * 0.3), length * 0.78);
      addPath("continuity", `M ${start.x} ${start.y} C ${controlA.x} ${controlA.y}, ${controlB.x} ${controlB.y}, ${end.x} ${end.y}`, {
        color: index % 2 ? "gold" : "violet",
        width: 0.55 + continuity * 0.72,
        opacity: 0.12 + continuity * 0.55,
      });
    }

    const releaseControl = categoryCoverage("release_control");
    const boundaryRadius = 30 + releaseControl * 18;
    const boundaryStart = point(center, rotation - 0.16, boundaryRadius);
    const boundaryMid = point(center, rotation + Math.PI * (releaseControl >= 0.7 ? 1.02 : 0.78), boundaryRadius * (0.92 + random() * 0.18));
    const boundaryEnd = point(center, rotation + Math.PI * (releaseControl >= 0.7 ? 1.98 : 1.38), boundaryRadius * (0.9 + random() * 0.2));
    const boundaryControlA = point(center, rotation + Math.PI * 0.48, boundaryRadius * 1.45);
    const boundaryControlB = point(center, rotation + Math.PI * 1.46, boundaryRadius * 1.42);
    addPath(
      "release_control",
      `M ${boundaryStart.x} ${boundaryStart.y} Q ${boundaryControlA.x} ${boundaryControlA.y}, ${boundaryMid.x} ${boundaryMid.y} Q ${boundaryControlB.x} ${boundaryControlB.y}, ${boundaryEnd.x} ${boundaryEnd.y}${releaseControl >= 0.7 ? " Z" : ""}`,
      {
        color: "gold",
        width: 0.8 + releaseControl * 1.05,
        opacity: 0.15 + releaseControl * 0.65,
      },
    );

    const research = categoryCoverage("research");
    const researchCount = 1 + Math.floor(research * 5);
    for (let index = 0; index < researchCount; index += 1) {
      const angle = rotation - 0.75 + index * 0.66 * direction + (random() - 0.5) * 0.3;
      const start = point(center, angle + Math.PI, 31 + random() * 18);
      const end = point(center, angle, 74 + research * 55 + random() * 16);
      const control = point(center, angle + direction * (0.55 + random() * 0.4), 58 + research * 29);
      addPath("research", `M ${start.x} ${start.y} Q ${control.x} ${control.y}, ${end.x} ${end.y}`, {
        color: index % 3 === 0 ? "gold" : "violet",
        width: 0.38 + research * 0.34,
        opacity: 0.09 + research * 0.41,
      });
    }

    const external = categoryCoverage("external");
    const orbitRadius = 112 + external * 49;
    const orbitHeight = orbitRadius * (0.58 + random() * 0.16);
    addPath(
      "external",
      `M ${round(center - orbitRadius)} ${center} C ${round(center - orbitRadius * 0.45)} ${round(center - orbitHeight * 1.28)}, ${round(center + orbitRadius * 0.57)} ${round(center - orbitHeight * 0.98)}, ${round(center + orbitRadius)} ${center} C ${round(center + orbitRadius * 0.48)} ${round(center + orbitHeight * 1.12)}, ${round(center - orbitRadius * 0.6)} ${round(center + orbitHeight)}, ${round(center - orbitRadius)} ${center}`,
      {
        color: "violet",
        width: 0.46 + external * 0.48,
        opacity: 0.08 + external * 0.38,
        transform: `rotate(${round((random() - 0.5) * 38)} ${center} ${center})`,
      },
    );

    return {
      schema: "semeai.repository-evidence-sigil.v1",
      canonicalInput,
      repository,
      commitSha,
      policyVersion,
      visualSeed,
      visualPhase,
      gateDecision,
      categories,
      paths,
      anchors,
    };
  }

  function renderEvidenceSigil(container, input) {
    if (!container || typeof document === "undefined") {
      return buildEvidenceSigilModel(input);
    }

    const model = buildEvidenceSigilModel(input);
    const svg = createSvgElement("svg", {
      viewBox: "0 0 360 360",
      role: "img",
      "aria-label": `Evidence-shaped deterministic sigil for ${model.repository}. Seven category trace groups; presentation Gate ${model.gateDecision}.`,
      focusable: "false",
    });
    const filterPrefix = `evidence-sigil-${String(container.id || "render").replace(/[^A-Za-z0-9_-]+/g, "-")}`;
    const defs = createSvgElement("defs");
    const goldGlow = createSvgElement("filter", { id: `${filterPrefix}-gold-glow`, x: "-80%", y: "-80%", width: "260%", height: "260%" });
    goldGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "2.2", result: "blur" }));
    const violetGlow = createSvgElement("filter", { id: `${filterPrefix}-violet-glow`, x: "-80%", y: "-80%", width: "260%", height: "260%" });
    violetGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "1.9", result: "blur" }));
    defs.append(goldGlow, violetGlow);
    svg.appendChild(defs);

    model.categories.forEach((category, categoryIndex) => {
      const group = createSvgElement("g", {
        class: `evidence-sigil__group evidence-sigil__group--${category.key}`,
        "data-category": category.key,
        "data-coverage": category.coverage,
      });
      group.style.setProperty("--category-index", String(categoryIndex));
      model.paths.filter((path) => path.category === category.key).forEach((path, pathIndex) => {
        const color = path.color === "gold" ? "#d7b66f" : "#8b78a0";
        const sharedAttributes = {
          d: path.d,
          fill: "none",
          stroke: color,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "pathLength": 100,
        };
        if (path.transform) sharedAttributes.transform = path.transform;
        const glow = createSvgElement("path", {
          ...sharedAttributes,
          class: "evidence-sigil__glow",
          "stroke-width": round(path.width * 4),
          filter: path.color === "gold" ? `url(#${filterPrefix}-gold-glow)` : `url(#${filterPrefix}-violet-glow)`,
        });
        glow.style.setProperty("--trace-opacity", String(round(path.opacity * 0.16)));
        const trace = createSvgElement("path", {
          ...sharedAttributes,
          class: "evidence-sigil__trace",
          "stroke-width": path.width,
          "data-trace-index": pathIndex,
        });
        trace.style.setProperty("--trace-opacity", String(path.opacity));
        trace.style.setProperty("--trace-delay", `${categoryIndex * 58 + pathIndex * 24}ms`);
        if (path.dash) trace.style.setProperty("--final-dash", path.dash);
        group.append(glow, trace);
      });
      model.anchors.filter((anchor) => anchor.category === category.key).forEach((anchor) => {
        const pointElement = createSvgElement("circle", {
          class: "evidence-sigil__anchor",
          cx: anchor.x,
          cy: anchor.y,
          r: anchor.radius,
          fill: "#efd79a",
        });
        pointElement.style.setProperty("--trace-opacity", String(anchor.opacity));
        group.appendChild(pointElement);
      });
      svg.appendChild(group);
    });

    container.dataset.gate = model.gateDecision;
    container.replaceChildren(svg);
    return model;
  }

  function highlightEvidenceCategory(container, categoryKey) {
    if (!container || !EVIDENCE_CATEGORIES.includes(categoryKey)) return;
    container.dataset.highlightCategory = categoryKey;
    container.querySelectorAll(".evidence-sigil__group").forEach((group) => {
      group.classList.toggle("is-highlighted", group.dataset.category === categoryKey);
    });
  }

  function clearEvidenceHighlight(container) {
    if (!container) return;
    delete container.dataset.highlightCategory;
    container.querySelectorAll(".evidence-sigil__group").forEach((group) => group.classList.remove("is-highlighted"));
  }

  function canonicalEvidenceSigil(input) {
    return JSON.stringify(buildEvidenceSigilModel(input));
  }

  const api = Object.freeze({
    buildSigilModel,
    canonicalSigil,
    renderSigil,
    buildEvidenceSigilModel,
    canonicalEvidenceSigil,
    renderEvidenceSigil,
    highlightEvidenceCategory,
    clearEvidenceHighlight,
  });
  globalScope.SemeAISigil = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
