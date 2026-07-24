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

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function point(center, angle, radius) {
    return {
      x: round(center + Math.cos(angle) * radius),
      y: round(center + Math.sin(angle) * radius),
    };
  }

  function createSvgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes || {}).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    return element;
  }

  /* ------------------------------------------------------------------ */
  /*  Hero preview: compact crystalline relic (seed + phase only)       */
  /* ------------------------------------------------------------------ */

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
    const sides = visualSeed > 0 ? 6 : 5;
    const yaw = random() * Math.PI * 2;
    const radius = visualSeed > 0 ? 78 : 68;
    const height = visualSeed > 0 ? 96 : 108;
    const taper = visualSeed > 0 ? 0.42 : 0.58;
    const breathingAmplitude = round(0.01 + random() * 0.006);
    const periodSeconds = round(14 + random() * 4);

    const project = (x, y, z) => ({
      x: round(center + (x - z) * 0.86),
      y: round(center + (x + z) * 0.34 - y),
    });

    const ring = (y, scale) => {
      const points = [];
      for (let index = 0; index < sides; index += 1) {
        const angle = yaw + (index / sides) * Math.PI * 2;
        points.push(project(Math.cos(angle) * radius * scale, y, Math.sin(angle) * radius * scale));
      }
      return points;
    };

    const base = ring(-height * 0.42, 1);
    const mid = ring(height * 0.08, 0.78 + taper * 0.08);
    const crown = ring(height * 0.38, taper);
    const apex = project(0, height * 0.58, 0);
    const facets = [];
    const edges = [];

    for (let index = 0; index < sides; index += 1) {
      const next = (index + 1) % sides;
      const color = index % 2 === 0 ? "gold" : "violet";
      facets.push({
        id: `facet-base-${index + 1}`,
        points: [base[index], base[next], mid[next], mid[index]],
        color,
        opacity: 0.08 + (index % 3) * 0.02,
      });
      facets.push({
        id: `facet-mid-${index + 1}`,
        points: [mid[index], mid[next], crown[next], crown[index]],
        color: color === "gold" ? "violet" : "gold",
        opacity: 0.1 + (index % 2) * 0.03,
      });
      facets.push({
        id: `facet-crown-${index + 1}`,
        points: [crown[index], crown[next], apex],
        color,
        opacity: 0.14 + (index % 3) * 0.03,
      });
      edges.push(
        { id: `edge-base-${index + 1}`, a: base[index], b: base[next], color, width: 0.85, opacity: 0.42 },
        { id: `edge-up-${index + 1}`, a: base[index], b: mid[index], color, width: 0.9, opacity: 0.5 },
        { id: `edge-mid-${index + 1}`, a: mid[index], b: mid[next], color: color === "gold" ? "violet" : "gold", width: 0.75, opacity: 0.38 },
        { id: `edge-crown-${index + 1}`, a: mid[index], b: crown[index], color, width: 0.8, opacity: 0.48 },
        { id: `edge-apex-${index + 1}`, a: crown[index], b: apex, color, width: 0.95, opacity: 0.55 },
      );
    }

    return {
      schema: "semeai.repository-sigil.v2",
      canonicalInput,
      repository,
      commitSha,
      policyVersion,
      visualSeed,
      phase,
      sides,
      goldRatio: visualSeed > 0 ? 0.62 : 0.48,
      breathingAmplitude,
      periodSeconds,
      facets,
      edges,
      apex,
      paths: edges.map((edge) => ({
        id: edge.id,
        d: `M ${edge.a.x} ${edge.a.y} L ${edge.b.x} ${edge.b.y}`,
        color: edge.color,
        width: edge.width,
        opacity: edge.opacity,
      })),
    };
  }

  function renderSigil(container, input) {
    if (!container || typeof document === "undefined") {
      return buildSigilModel(input);
    }

    const model = buildSigilModel(input);
    const svg = createSvgElement("svg", {
      viewBox: "0 0 320 320",
      role: "img",
      "aria-label": `${model.repository} deterministic repository artifact, ${model.phase.toLowerCase()} phase`,
      focusable: "false",
    });
    const defs = createSvgElement("defs");
    const goldGlow = createSvgElement("filter", { id: "sigil-gold-glow", x: "-70%", y: "-70%", width: "240%", height: "240%" });
    goldGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "2.1", result: "blur" }));
    const violetGlow = createSvgElement("filter", { id: "sigil-violet-glow", x: "-70%", y: "-70%", width: "240%", height: "240%" });
    violetGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "1.8", result: "blur" }));
    defs.append(goldGlow, violetGlow);
    svg.appendChild(defs);

    const breath = createSvgElement("g", { class: "sigil-breath" });
    breath.style.setProperty("--sigil-period", `${model.periodSeconds}s`);

    breath.appendChild(
      createSvgElement("ellipse", {
        cx: 160,
        cy: 248,
        rx: 72,
        ry: 14,
        fill: "rgba(8, 8, 12, 0.55)",
        opacity: 0.9,
      }),
    );

    const body = createSvgElement("g", { class: "sigil-body" });
    model.facets.forEach((facet) => {
      const fill = facet.color === "gold" ? "rgba(215,182,111,0.14)" : "rgba(120,101,142,0.12)";
      body.appendChild(
        createSvgElement("polygon", {
          points: facet.points.map((vertex) => `${vertex.x},${vertex.y}`).join(" "),
          fill,
          stroke: "none",
          opacity: facet.opacity,
        }),
      );
    });
    model.paths.forEach((pathModel, index) => {
      const color = pathModel.color === "gold" ? "#d7b66f" : "#78658e";
      const glow = createSvgElement("path", {
        d: pathModel.d,
        fill: "none",
        stroke: color,
        "stroke-width": pathModel.width * 2.8,
        "stroke-linecap": "round",
        opacity: pathModel.opacity * 0.16,
        filter: pathModel.color === "gold" ? "url(#sigil-gold-glow)" : "url(#sigil-violet-glow)",
      });
      const path = createSvgElement("path", {
        d: pathModel.d,
        fill: "none",
        stroke: color,
        "stroke-width": pathModel.width,
        "stroke-linecap": "round",
        opacity: pathModel.opacity,
        class: index % 4 === 0 ? "sigil-trace" : "",
      });
      body.append(glow, path);
    });
    body.appendChild(
      createSvgElement("circle", {
        cx: model.apex.x,
        cy: model.apex.y,
        r: 2.8,
        fill: "#efd79a",
        opacity: 0.9,
      }),
    );
    breath.appendChild(body);
    svg.appendChild(breath);
    container.replaceChildren(svg);
    return model;
  }

  function canonicalSigil(input) {
    return JSON.stringify(buildSigilModel(input));
  }

  /* ------------------------------------------------------------------ */
  /*  Result artifact: evidence-shaped isometric crystalline monolith   */
  /* ------------------------------------------------------------------ */

  const EVIDENCE_CATEGORIES = Object.freeze([
    "implementation",
    "tests",
    "evidence",
    "continuity",
    "release_control",
    "research",
    "external",
  ]);

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

  function projectIso(x, y, z, originX, originY, yaw) {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const rx = x * cos - z * sin;
    const rz = x * sin + z * cos;
    return {
      x: round(originX + (rx - rz) * 0.9),
      y: round(originY + (rx + rz) * 0.32 - y),
    };
  }

  function polygonPath(points) {
    if (!points.length) return "";
    return `M ${points.map((vertex) => `${vertex.x} ${vertex.y}`).join(" L ")} Z`;
  }

  function linePath(a, b) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
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

    function coverageOf(key) {
      return categories.find((category) => category.key === key).coverage;
    }

    const implementation = coverageOf("implementation");
    const tests = coverageOf("tests");
    const evidence = coverageOf("evidence");
    const continuity = coverageOf("continuity");
    const releaseControl = coverageOf("release_control");
    const research = coverageOf("research");
    const external = coverageOf("external");

    const totalScore = categories.reduce((sum, category) => sum + category.score, 0);
    const totalMax = categories.reduce((sum, category) => sum + category.maximum, 0) || 100;
    const totalCoverage = clamp(totalScore / totalMax, 0, 1);
    const repositorySignal = clamp((implementation + continuity + external) / 3, 0, 1);
    const evidenceDepth = clamp((tests + evidence + research) / 3, 0, 1);
    const gateDiscipline = clamp(releaseControl, 0, 1);

    const originX = 180;
    const originY = 198;
    const sides = visualPhase === "EXPANSION" || visualSeed > 0 ? 6 : 5;
    const layerCount = 3 + Math.floor(evidenceDepth * 5);
    const baseRadius = 52 + repositorySignal * 48;
    const height = 88 + totalCoverage * 112;
    const taper = 0.34 + gateDiscipline * 0.4;
    const yaw = (visualSeed > 0 ? 0.42 : -0.38) + random() * 0.22;
    const ridgeSharpness = 0.55 + gateDiscipline * 0.45;
    const gateIntensity = gateDecision === "SHOW" ? 1 : gateDecision === "REVIEW" ? 0.72 : 0.38;
    const completeness = gateDecision === "BLOCK" ? 0.42 : gateDecision === "REVIEW" ? 0.78 : 1;

    const layers = [];
    for (let level = 0; level <= layerCount; level += 1) {
      const t = level / layerCount;
      const y = -height * 0.5 + t * height;
      const radiusScale = 1 - t * (1 - taper);
      const wobble = (1 - gateDiscipline) * 0.08 * Math.sin(level * 1.7 + random() * 0.4);
      layers.push({
        level,
        y: round(y),
        scale: round(clamp(radiusScale + wobble, 0.18, 1.05)),
        density: round(0.35 + evidenceDepth * 0.55 + (level / layerCount) * 0.15),
      });
    }

    const apex = projectIso(0, height * 0.58, 0, originX, originY, yaw);
    const ringPoints = layers.map((layer) => {
      const points = [];
      for (let index = 0; index < sides; index += 1) {
        const angle = (index / sides) * Math.PI * 2;
        const radialBoost = 1 + repositorySignal * 0.08 * Math.cos(angle * 2 + yaw);
        const radius = baseRadius * layer.scale * radialBoost;
        points.push(projectIso(Math.cos(angle) * radius, layer.y, Math.sin(angle) * radius, originX, originY, yaw));
      }
      return points;
    });

    const facets = [];
    const edges = [];
    const anchors = [];
    const lattices = [];

    for (let side = 0; side < sides; side += 1) {
      const category = categories[side % categories.length];
      const next = (side + 1) % sides;
      const color = side % 2 === 0 ? "gold" : "violet";
      const faceOpacity = round((0.05 + category.coverage * 0.16) * gateIntensity);

      for (let level = 0; level < layerCount; level += 1) {
        const a = ringPoints[level][side];
        const b = ringPoints[level][next];
        const c = ringPoints[level + 1][next];
        const d = ringPoints[level + 1][side];
        const includeFace = completeness >= 0.5 || (side + level) % 2 === 0;
        if (includeFace) {
          facets.push({
            id: `facet-${category.key}-${level + 1}-${side + 1}`,
            category: category.key,
            categoryIndex: EVIDENCE_CATEGORIES.indexOf(category.key),
            points: [a, b, c, d],
            color,
            opacity: faceOpacity * (0.7 + (level / layerCount) * 0.5),
            coverage: category.coverage,
          });
        }

        const edgeOpacity = round((0.18 + category.coverage * 0.55 + ridgeSharpness * 0.2) * gateIntensity);
        const edgeWidth = round(0.55 + gateDiscipline * 0.85 + category.coverage * 0.45);
        edges.push({
          id: `ring-${category.key}-${level + 1}-${side + 1}`,
          category: category.key,
          categoryIndex: EVIDENCE_CATEGORIES.indexOf(category.key),
          d: linePath(a, b),
          color,
          width: edgeWidth * 0.72,
          opacity: edgeOpacity * 0.75,
          dash: category.coverage === 0 ? "2 10" : category.coverage < 0.4 ? "6 8" : "",
        });
        edges.push({
          id: `rise-${category.key}-${level + 1}-${side + 1}`,
          category: category.key,
          categoryIndex: EVIDENCE_CATEGORIES.indexOf(category.key),
          d: linePath(a, d),
          color: color === "gold" ? "violet" : "gold",
          width: edgeWidth,
          opacity: edgeOpacity,
          dash: gateDecision === "REVIEW" && category.key === "release_control" ? "10 5" : category.coverage === 0 ? "2 11" : "",
        });
      }

      const crown = ringPoints[layerCount][side];
      const crownNext = ringPoints[layerCount][next];
      facets.push({
        id: `crown-${category.key}-${side + 1}`,
        category: category.key,
        categoryIndex: EVIDENCE_CATEGORIES.indexOf(category.key),
        points: [crown, crownNext, apex],
        color,
        opacity: round((0.08 + category.coverage * 0.18) * gateIntensity),
        coverage: category.coverage,
      });
      edges.push({
        id: `apex-${category.key}-${side + 1}`,
        category: category.key,
        categoryIndex: EVIDENCE_CATEGORIES.indexOf(category.key),
        d: linePath(crown, apex),
        color,
        width: round(0.7 + ridgeSharpness * 0.9),
        opacity: round((0.28 + category.coverage * 0.5) * gateIntensity),
        dash: gateDecision === "BLOCK" ? "3 9" : "",
      });
    }

    // Category-owned lattice filaments inside the crystal (evidence density).
    categories.forEach((category, categoryIndex) => {
      const filaments = category.coverage === 0 ? 0 : 1 + Math.floor(category.coverage * 3 * evidenceDepth);
      for (let index = 0; index < filaments; index += 1) {
        const angle = (categoryIndex / categories.length) * Math.PI * 2 + (index - filaments / 2) * 0.18;
        const inner = 0.18 + category.coverage * 0.35;
        const outer = 0.55 + category.coverage * 0.35;
        const y0 = -height * 0.28 + index * (height * 0.12);
        const y1 = y0 + height * (0.18 + evidenceDepth * 0.16);
        const a = projectIso(Math.cos(angle) * baseRadius * inner, y0, Math.sin(angle) * baseRadius * inner, originX, originY, yaw);
        const b = projectIso(Math.cos(angle) * baseRadius * outer, y1, Math.sin(angle) * baseRadius * outer, originX, originY, yaw);
        lattices.push({
          id: `lattice-${category.key}-${index + 1}`,
          category: category.key,
          categoryIndex,
          d: linePath(a, b),
          color: categoryIndex % 2 === 0 ? "gold" : "violet",
          width: round(0.35 + category.coverage * 0.45),
          opacity: round((0.1 + category.coverage * 0.42) * gateIntensity),
          dash: category.coverage < 0.35 ? "4 7" : "",
        });
      }

      // Anchors: crystalline nodes on the outer ridge for this category sector.
      const sector = categoryIndex % sides;
      const nodeLayer = Math.min(layerCount, 1 + Math.floor(category.coverage * (layerCount - 1)));
      const node = ringPoints[nodeLayer][sector];
      anchors.push({
        id: `node-${category.key}`,
        category: category.key,
        categoryIndex,
        x: node.x,
        y: node.y,
        radius: round(1.2 + category.coverage * 2.4 + evidenceDepth * 0.8),
        opacity: round((0.16 + category.coverage * 0.7) * gateIntensity),
      });
    });

    // Core spine: governed continuity axis.
    const spineBottom = projectIso(0, -height * 0.48, 0, originX, originY, yaw);
    const spineMid = projectIso(0, 0, 0, originX, originY, yaw);
    edges.push({
      id: "spine-core",
      category: "continuity",
      categoryIndex: EVIDENCE_CATEGORIES.indexOf("continuity"),
      d: linePath(spineBottom, apex),
      color: "gold",
      width: round(0.9 + continuity * 1.1),
      opacity: round((0.2 + continuity * 0.55) * gateIntensity),
      dash: continuity < 0.3 ? "3 8" : "",
    });
    anchors.push({
      id: "core-anchor",
      category: "evidence",
      categoryIndex: EVIDENCE_CATEGORIES.indexOf("evidence"),
      x: spineMid.x,
      y: spineMid.y,
      radius: round(2 + evidence * 2.5),
      opacity: round((0.35 + evidence * 0.5) * gateIntensity),
    });

    // External orbit ring — public signal envelope.
    if (external > 0 || gateDecision !== "BLOCK") {
      const orbitR = baseRadius * (1.18 + external * 0.35);
      const orbit = [];
      const orbitSteps = 24;
      for (let index = 0; index <= orbitSteps; index += 1) {
        const angle = (index / orbitSteps) * Math.PI * 2;
        orbit.push(projectIso(Math.cos(angle) * orbitR, -height * 0.42, Math.sin(angle) * orbitR * 0.62, originX, originY, yaw));
      }
      lattices.push({
        id: "external-orbit",
        category: "external",
        categoryIndex: EVIDENCE_CATEGORIES.indexOf("external"),
        d: `M ${orbit.map((vertex) => `${vertex.x} ${vertex.y}`).join(" L ")}`,
        color: "violet",
        width: round(0.4 + external * 0.55),
        opacity: round((0.08 + external * 0.4) * gateIntensity),
        dash: external < 0.4 ? "5 8" : "",
      });
    }

    const paths = edges.concat(lattices);

    return {
      schema: "semeai.repository-evidence-artifact.v1",
      canonicalInput,
      repository,
      commitSha,
      policyVersion,
      visualSeed,
      visualPhase,
      gateDecision,
      categories,
      metrics: {
        totalCoverage: round(totalCoverage),
        repositorySignal: round(repositorySignal),
        evidenceDepth: round(evidenceDepth),
        gateDiscipline: round(gateDiscipline),
        sides,
        layerCount,
        height: round(height),
        baseRadius: round(baseRadius),
        taper: round(taper),
        yaw: round(yaw),
        gateIntensity: round(gateIntensity),
      },
      facets,
      paths,
      anchors,
      apex,
      origin: { x: originX, y: originY },
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
      "aria-label": `Evidence artifact for ${model.repository}. Crystallized from seven category traces; presentation Gate ${model.gateDecision}.`,
      focusable: "false",
      class: "evidence-artifact-svg",
    });
    const filterPrefix = `evidence-artifact-${String(container.id || "render").replace(/[^A-Za-z0-9_-]+/g, "-")}`;
    const defs = createSvgElement("defs");
    const goldGlow = createSvgElement("filter", { id: `${filterPrefix}-gold-glow`, x: "-80%", y: "-80%", width: "260%", height: "260%" });
    goldGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "2.0", result: "blur" }));
    const violetGlow = createSvgElement("filter", { id: `${filterPrefix}-violet-glow`, x: "-80%", y: "-80%", width: "260%", height: "260%" });
    violetGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "1.7", result: "blur" }));
    const softShadow = createSvgElement("filter", { id: `${filterPrefix}-shadow`, x: "-40%", y: "-40%", width: "180%", height: "180%" });
    softShadow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "6", result: "blur" }));
    defs.append(goldGlow, violetGlow, softShadow);
    svg.appendChild(defs);

    const stage = createSvgElement("g", { class: "evidence-artifact__stage" });
    stage.appendChild(
      createSvgElement("ellipse", {
        class: "evidence-artifact__plinth",
        cx: model.origin.x,
        cy: model.origin.y + 78,
        rx: 88 + model.metrics.repositorySignal * 28,
        ry: 16,
        fill: "rgba(0,0,0,0.55)",
        filter: `url(#${filterPrefix}-shadow)`,
        opacity: 0.85,
      }),
    );
    stage.appendChild(
      createSvgElement("ellipse", {
        class: "evidence-artifact__halo",
        cx: model.origin.x,
        cy: model.origin.y - 8,
        rx: 96 + model.metrics.repositorySignal * 20,
        ry: 118 + model.metrics.totalCoverage * 18,
        fill: "none",
        stroke: model.gateDecision === "SHOW" ? "rgba(215,182,111,0.16)" : "rgba(120,101,142,0.14)",
        "stroke-width": 0.7,
      }),
    );

    const body = createSvgElement("g", {
      class: "evidence-artifact__body",
      "data-gate": model.gateDecision,
      "data-phase": model.visualPhase,
    });
    body.style.setProperty("--artifact-period", `${round(16 + model.metrics.gateDiscipline * 6)}s`);
    body.style.setProperty("--artifact-yaw", `${model.metrics.yaw}rad`);

    // Category groups preserve highlight API used by benchmark.js / workspace.
    model.categories.forEach((category, categoryIndex) => {
      const group = createSvgElement("g", {
        class: `evidence-sigil__group evidence-sigil__group--${category.key} evidence-artifact__group`,
        "data-category": category.key,
        "data-coverage": category.coverage,
      });
      group.style.setProperty("--category-index", String(categoryIndex));

      model.facets
        .filter((facet) => facet.category === category.key)
        .forEach((facet, facetIndex) => {
          const fill = facet.color === "gold" ? "rgba(215,182,111,0.13)" : "rgba(139,120,160,0.11)";
          const stroke = facet.color === "gold" ? "rgba(215,182,111,0.22)" : "rgba(139,120,160,0.2)";
          const polygon = createSvgElement("path", {
            d: polygonPath(facet.points),
            class: "evidence-artifact__facet",
            fill,
            stroke,
            "stroke-width": 0.35,
            "data-facet-index": facetIndex,
          });
          polygon.style.setProperty("--trace-opacity", String(facet.opacity));
          polygon.style.setProperty("--trace-delay", `${categoryIndex * 48 + facetIndex * 18}ms`);
          group.appendChild(polygon);
        });

      model.paths
        .filter((path) => path.category === category.key)
        .forEach((path, pathIndex) => {
          const color = path.color === "gold" ? "#d7b66f" : "#8b78a0";
          const sharedAttributes = {
            d: path.d,
            fill: "none",
            stroke: color,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            pathLength: 100,
          };
          const glow = createSvgElement("path", {
            ...sharedAttributes,
            class: "evidence-sigil__glow evidence-artifact__glow",
            "stroke-width": round(path.width * 3.4),
            filter: path.color === "gold" ? `url(#${filterPrefix}-gold-glow)` : `url(#${filterPrefix}-violet-glow)`,
          });
          glow.style.setProperty("--trace-opacity", String(round(path.opacity * 0.18)));
          const trace = createSvgElement("path", {
            ...sharedAttributes,
            class: "evidence-sigil__trace evidence-artifact__edge",
            "stroke-width": path.width,
            "data-trace-index": pathIndex,
          });
          trace.style.setProperty("--trace-opacity", String(path.opacity));
          trace.style.setProperty("--trace-delay", `${categoryIndex * 52 + pathIndex * 20}ms`);
          if (path.dash) trace.style.setProperty("--final-dash", path.dash);
          group.append(glow, trace);
        });

      model.anchors
        .filter((anchor) => anchor.category === category.key)
        .forEach((anchor) => {
          const pointElement = createSvgElement("circle", {
            class: "evidence-sigil__anchor evidence-artifact__node",
            cx: anchor.x,
            cy: anchor.y,
            r: anchor.radius,
            fill: "#efd79a",
          });
          pointElement.style.setProperty("--trace-opacity", String(anchor.opacity));
          group.appendChild(pointElement);
        });

      body.appendChild(group);
    });

    // Apex core — shared focal point (not category-bound for highlight isolation).
    const apexGroup = createSvgElement("g", { class: "evidence-artifact__apex", "aria-hidden": "true" });
    apexGroup.appendChild(
      createSvgElement("circle", {
        cx: model.apex.x,
        cy: model.apex.y,
        r: 3.2,
        fill: "#efd79a",
        opacity: model.gateDecision === "BLOCK" ? 0.35 : 0.92,
      }),
    );
    apexGroup.appendChild(
      createSvgElement("circle", {
        cx: model.apex.x,
        cy: model.apex.y,
        r: 9,
        fill: "none",
        stroke: "rgba(239,215,154,0.28)",
        "stroke-width": 0.7,
      }),
    );
    body.appendChild(apexGroup);
    stage.appendChild(body);
    svg.appendChild(stage);

    container.dataset.gate = model.gateDecision;
    container.dataset.artifact = "crystalline-v1";
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
