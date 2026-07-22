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

  const api = Object.freeze({ buildSigilModel, canonicalSigil, renderSigil });
  globalScope.SemeAISigil = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
