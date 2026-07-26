(function initSigil(globalScope) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const EVIDENCE_CATEGORIES = Object.freeze([
    "implementation",
    "tests",
    "evidence",
    "continuity",
    "release_control",
    "research",
    "external",
  ]);

  const FAMILY_META = Object.freeze({
    F: { key: "F", nameKey: "bench.rank.family.F", name: "Fragment", titleKey: "bench.rank.family.F" },
    E: { key: "E", nameKey: "bench.rank.family.E", name: "Shard", titleKey: "bench.rank.family.E" },
    D: { key: "D", nameKey: "bench.rank.family.D", name: "Stone", titleKey: "bench.rank.family.D" },
    C: { key: "C", nameKey: "bench.rank.family.C", name: "Prism", titleKey: "bench.rank.family.C" },
    B: { key: "B", nameKey: "bench.rank.family.B", name: "Relic", titleKey: "bench.rank.family.B" },
    A: { key: "A", nameKey: "bench.rank.family.A", name: "Crystal", titleKey: "bench.rank.family.A" },
    S: { key: "S", nameKey: "bench.rank.family.S", name: "Monolith", titleKey: "bench.rank.family.S" },
    SS: { key: "SS", nameKey: "bench.rank.family.SS", name: "Archive Crown", titleKey: "bench.rank.family.SS" },
  });

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

  function createSvgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes || {}).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    return element;
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

  function linePath(a, b) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }

  function polygonPath(points) {
    if (!points.length) return "";
    return `M ${points.map((vertex) => `${vertex.x} ${vertex.y}`).join(" L ")} Z`;
  }

  function point(center, angle, radius) {
    return {
      x: round(center + Math.cos(angle) * radius),
      y: round(center + Math.sin(angle) * radius),
    };
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

  function sublevelInRange(score, min, max) {
    const span = max - min + 1;
    const offset = clamp(score - min, 0, span - 1);
    return Math.min(5, Math.floor((offset / span) * 5) + 1);
  }

  /**
   * Full public Evidence Rank ladder: F-1…F-5, E-1…E-5, …, SS-1…SS-5.
   * Presentation metadata only — never written into receipts.
   */
  function deriveEvidenceRank(input) {
    const categories = normalizedCategoryScores(input.categoryScores);
    const totalScore = categories.reduce((sum, category) => sum + category.score, 0);
    const indicators = input.indicators || {};
    const repositorySignal = Number(indicators.repositorySignal);
    const evidenceDepth = Number(indicators.evidenceDepth);
    const gateDiscipline = Number(indicators.gateDiscipline);
    const hasIndicators =
      Number.isFinite(repositorySignal) && Number.isFinite(evidenceDepth) && Number.isFinite(gateDiscipline);

    const completeExceptExternal =
      categories.every((category) => {
        if (category.key === "external") return category.score >= Math.min(4, category.maximum || 4);
        return category.maximum === 0 || category.score >= category.maximum;
      });
    const allAtMaximum = categories.every((category) => category.maximum === 0 || category.score >= category.maximum);
    const indicatorsSS4 =
      hasIndicators && repositorySignal >= 98 && evidenceDepth >= 100 && gateDiscipline >= 100;
    const indicatorsSS5 =
      hasIndicators && repositorySignal >= 100 && evidenceDepth >= 100 && gateDiscipline >= 100;

    let family;
    let level;
    let bandMin = 0;
    let bandMax = 19;

    if (totalScore >= 97) {
      family = "SS";
      bandMin = 97;
      bandMax = 100;
      if (totalScore >= 100 && allAtMaximum && indicatorsSS5) {
        level = 5;
      } else if (totalScore === 99 && completeExceptExternal && indicatorsSS4) {
        level = 4;
      } else if (totalScore === 99) {
        level = 3;
      } else if (totalScore === 98) {
        level = 2;
      } else {
        level = 1; // 97, or other near-top without stronger conditions
      }
    } else if (totalScore >= 89) {
      family = "S";
      bandMin = 89;
      bandMax = 96;
      level = sublevelInRange(totalScore, 89, 96);
    } else if (totalScore >= 77) {
      family = "A";
      bandMin = 77;
      bandMax = 88;
      level = sublevelInRange(totalScore, 77, 88);
    } else if (totalScore >= 65) {
      family = "B";
      bandMin = 65;
      bandMax = 76;
      level = sublevelInRange(totalScore, 65, 76);
    } else if (totalScore >= 50) {
      family = "C";
      bandMin = 50;
      bandMax = 64;
      level = sublevelInRange(totalScore, 50, 64);
    } else if (totalScore >= 35) {
      family = "D";
      bandMin = 35;
      bandMax = 49;
      level = sublevelInRange(totalScore, 35, 49);
    } else if (totalScore >= 20) {
      family = "E";
      bandMin = 20;
      bandMax = 34;
      level = sublevelInRange(totalScore, 20, 34);
    } else {
      family = "F";
      bandMin = 0;
      bandMax = 19;
      level = sublevelInRange(totalScore, 0, 19);
    }

    const meta = FAMILY_META[family];
    const code = `${family}-${level}`;
    return {
      code,
      family,
      level,
      stageLabel: `Stage ${level} of 5`,
      stageKey: "bench.rank.stage",
      familyName: meta.name,
      familyNameKey: meta.nameKey,
      bandMin,
      bandMax,
      totalScore: round(totalScore),
      categories,
    };
  }

  function listAllEvidenceRanks() {
    const ranks = [];
    ["F", "E", "D", "C", "B", "A", "S", "SS"].forEach((family) => {
      for (let level = 1; level <= 5; level += 1) {
        ranks.push(`${family}-${level}`);
      }
    });
    return ranks;
  }

  function emptyGeometry(originX, originY) {
    return {
      facets: [],
      paths: [],
      anchors: [],
      apex: { x: originX, y: originY - 40 },
      origin: { x: originX, y: originY },
    };
  }

  function pushEdge(paths, category, d, options) {
    const settings = options || {};
    paths.push({
      id: settings.id || `${category}-edge-${paths.length + 1}`,
      category,
      categoryIndex: EVIDENCE_CATEGORIES.indexOf(category),
      d,
      color: settings.color || "gold",
      width: settings.width == null ? 1.15 : settings.width,
      opacity: settings.opacity == null ? 0.78 : settings.opacity,
      dash: settings.dash || "",
      primary: settings.primary !== false,
    });
  }

  function pushFacet(facets, category, points, options) {
    const settings = options || {};
    facets.push({
      id: settings.id || `${category}-facet-${facets.length + 1}`,
      category,
      categoryIndex: EVIDENCE_CATEGORIES.indexOf(category),
      points,
      color: settings.color || "gold",
      opacity: settings.opacity == null ? 0.12 : settings.opacity,
    });
  }

  function pushAnchor(anchors, category, x, y, options) {
    const settings = options || {};
    anchors.push({
      id: settings.id || `${category}-node-${anchors.length + 1}`,
      category,
      categoryIndex: EVIDENCE_CATEGORIES.indexOf(category),
      x,
      y,
      radius: settings.radius == null ? 2.2 : settings.radius,
      opacity: settings.opacity == null ? 0.85 : settings.opacity,
    });
  }

  function coverageMap(categories) {
    const map = {};
    categories.forEach((category) => {
      map[category.key] = category.coverage;
    });
    return map;
  }

  function levelFactor(level) {
    return 0.55 + (clamp(level, 1, 5) - 1) * 0.1125;
  }

  /* ---------------- Family geometry builders (distinct silhouettes) ---------------- */

  function buildFragmentGeometry(ctx) {
    const { originX, originY, yaw, level, cov, intensity } = ctx;
    const lf = levelFactor(level);
    const geo = emptyGeometry(originX, originY);
    const p = (x, y, z) => projectIso(x, y, z, originX, originY, yaw);

    // Two disconnected broken pieces — no enclosure.
    const a = [p(-58, -8, -12), p(-18, 22, 8), p(-42, 48, 18), p(-72, 18, -4)];
    const b = [p(22, -4, 10), p(68, 12, -6), p(54, 42, 16), p(14, 28, 24)];
    if (level >= 3) {
      const bridge = p(-4, 8, 6);
      pushEdge(geo.paths, "continuity", linePath(a[1], bridge), { width: 0.85, opacity: 0.35 * intensity, dash: "3 7", color: "violet" });
      pushEdge(geo.paths, "continuity", linePath(bridge, b[0]), { width: 0.85, opacity: 0.35 * intensity, dash: "3 7", color: "violet" });
    }
    pushFacet(geo.facets, "implementation", a, { opacity: 0.08 * intensity * lf, color: "gold" });
    pushFacet(geo.facets, "tests", b, { opacity: 0.07 * intensity * lf, color: "violet" });
    for (let i = 0; i < a.length; i += 1) {
      pushEdge(geo.paths, "implementation", linePath(a[i], a[(i + 1) % a.length]), {
        width: 1.35,
        opacity: (0.55 + cov.implementation * 0.3) * intensity,
        dash: level < 3 ? "4 6" : "",
      });
    }
    for (let i = 0; i < b.length; i += 1) {
      pushEdge(geo.paths, "evidence", linePath(b[i], b[(i + 1) % b.length]), {
        width: 1.2,
        opacity: (0.5 + cov.evidence * 0.3) * intensity,
        color: "violet",
        dash: "3 5",
      });
    }
    if (level >= 4) {
      pushAnchor(geo.anchors, "research", a[0].x, a[0].y, { radius: 2.1, opacity: 0.7 * intensity });
      pushAnchor(geo.anchors, "external", b[1].x, b[1].y, { radius: 2.0, opacity: 0.55 * intensity });
    }
    geo.apex = p(-8, 52 * lf, 4);
    return geo;
  }

  function buildShardGeometry(ctx) {
    const { originX, originY, yaw, level, cov, intensity } = ctx;
    const lf = levelFactor(level);
    const geo = emptyGeometry(originX, originY);
    const p = (x, y, z) => projectIso(x, y, z, originX, originY, yaw);
    // Tall sharp wedge + fractured secondary plane.
    const tip = p(0, 92 * lf, 0);
    const baseL = p(-34, -48, 8);
    const baseR = p(28, -46, -10);
    const mid = p(6, 18, 22);
    const fracture = p(-18, 8, -26);
    pushFacet(geo.facets, "implementation", [tip, baseL, mid], { opacity: 0.14 * intensity, color: "gold" });
    pushFacet(geo.facets, "tests", [tip, mid, baseR], { opacity: 0.1 * intensity, color: "violet" });
    pushEdge(geo.paths, "implementation", linePath(tip, baseL), { width: 1.7, opacity: 0.9 * intensity });
    pushEdge(geo.paths, "implementation", linePath(tip, baseR), { width: 1.55, opacity: 0.85 * intensity });
    pushEdge(geo.paths, "continuity", linePath(baseL, baseR), { width: 1.25, opacity: 0.7 * intensity, color: "violet" });
    pushEdge(geo.paths, "evidence", linePath(tip, mid), { width: 1.1, opacity: 0.75 * intensity });
    pushEdge(geo.paths, "release_control", linePath(mid, fracture), {
      width: 1.0,
      opacity: 0.55 * intensity,
      color: "violet",
      dash: level < 4 ? "5 5" : "",
    });
    if (level >= 3) {
      pushEdge(geo.paths, "research", linePath(fracture, baseL), { width: 0.95, opacity: 0.5 * intensity, dash: "2 6" });
    }
    pushAnchor(geo.anchors, "evidence", mid.x, mid.y, { radius: 2.4 * lf, opacity: 0.85 * intensity });
    if (level >= 5) pushAnchor(geo.anchors, "external", tip.x, tip.y, { radius: 2.6, opacity: 0.9 * intensity });
    geo.apex = tip;
    return geo;
  }

  function buildStoneGeometry(ctx) {
    const { originX, originY, yaw, level, cov, intensity } = ctx;
    const lf = levelFactor(level);
    const geo = emptyGeometry(originX, originY);
    const p = (x, y, z) => projectIso(x, y, z, originX, originY, yaw);
    // Low broad heavy mass — no crown.
    const top = [
      p(-48, 18 * lf, -20),
      p(12, 28 * lf, -28),
      p(52, 14 * lf, 4),
      p(18, 8 * lf, 36),
      p(-30, 6 * lf, 28),
    ];
    const bot = [
      p(-56, -36, -16),
      p(8, -28, -34),
      p(60, -38, 2),
      p(22, -44, 40),
      p(-36, -42, 30),
    ];
    for (let i = 0; i < top.length; i += 1) {
      const next = (i + 1) % top.length;
      const cat = EVIDENCE_CATEGORIES[i % EVIDENCE_CATEGORIES.length];
      pushFacet(geo.facets, cat, [top[i], top[next], bot[next], bot[i]], {
        opacity: (0.1 + (cov[cat] || 0) * 0.08) * intensity,
        color: i % 2 ? "violet" : "gold",
      });
      pushEdge(geo.paths, cat, linePath(top[i], top[next]), { width: 1.35, opacity: 0.82 * intensity });
      pushEdge(geo.paths, cat, linePath(bot[i], bot[next]), { width: 1.2, opacity: 0.7 * intensity, color: "violet" });
      pushEdge(geo.paths, cat, linePath(top[i], bot[i]), { width: 1.4, opacity: 0.8 * intensity });
    }
    if (level >= 3) {
      pushAnchor(geo.anchors, "evidence", p(0, -4, 0).x, p(0, -4, 0).y, { radius: 2.8, opacity: 0.8 * intensity });
    }
    geo.apex = p(4, 30 * lf, -8);
    return geo;
  }

  function buildPrismGeometry(ctx) {
    const { originX, originY, yaw, level, cov, intensity } = ctx;
    const lf = levelFactor(level);
    const geo = emptyGeometry(originX, originY);
    const p = (x, y, z) => projectIso(x, y, z, originX, originY, yaw);
    const sides = 4;
    const h = 70 * lf;
    const r = 46;
    const top = [];
    const bot = [];
    for (let i = 0; i < sides; i += 1) {
      const a = (i / sides) * Math.PI * 2 + Math.PI / 4;
      top.push(p(Math.cos(a) * r, h * 0.45, Math.sin(a) * r));
      bot.push(p(Math.cos(a) * r, -h * 0.45, Math.sin(a) * r));
    }
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      const cat = EVIDENCE_CATEGORIES[i % EVIDENCE_CATEGORIES.length];
      pushFacet(geo.facets, cat, [bot[i], bot[next], top[next], top[i]], {
        opacity: (0.09 + (cov[cat] || 0) * 0.1) * intensity,
        color: i % 2 ? "violet" : "gold",
      });
      pushEdge(geo.paths, cat, linePath(bot[i], bot[next]), { width: 1.45, opacity: 0.88 * intensity });
      pushEdge(geo.paths, cat, linePath(top[i], top[next]), { width: 1.45, opacity: 0.9 * intensity });
      pushEdge(geo.paths, cat, linePath(bot[i], top[i]), { width: 1.55, opacity: 0.92 * intensity });
      if (level >= 3) {
        const mid = p(
          (Math.cos((i / sides) * Math.PI * 2 + Math.PI / 4) * r) * 0.55,
          0,
          (Math.sin((i / sides) * Math.PI * 2 + Math.PI / 4) * r) * 0.55,
        );
        pushEdge(geo.paths, cat, linePath(bot[i], mid), { width: 0.7, opacity: 0.35 * intensity, dash: "4 5", primary: false });
      }
    }
    // Flat architectural cap — never a crystal crown.
    pushFacet(geo.facets, "release_control", top, { opacity: 0.08 * intensity, color: "gold" });
    geo.apex = p(0, h * 0.45, 0);
    pushAnchor(geo.anchors, "continuity", geo.apex.x, geo.apex.y, { radius: 2.2, opacity: 0.75 * intensity });
    return geo;
  }

  function buildRelicGeometry(ctx) {
    const { originX, originY, yaw, level, cov, intensity } = ctx;
    const lf = levelFactor(level);
    const geo = emptyGeometry(originX, originY);
    const p = (x, y, z) => projectIso(x, y, z, originX, originY, yaw);
    // Broad horizontal mass with internal chamber aperture.
    const outer = [
      p(-70, 8, -18),
      p(-20, 28 * lf, -40),
      p(40, 24 * lf, -28),
      p(72, 4, 8),
      p(36, -22, 34),
      p(-30, -26, 30),
      p(-68, -10, 6),
    ];
    const chamber = [
      p(-18, 2, -4),
      p(8, 10, -12),
      p(24, 0, 6),
      p(6, -12, 14),
      p(-16, -8, 8),
    ];
    for (let i = 0; i < outer.length; i += 1) {
      const next = (i + 1) % outer.length;
      const cat = EVIDENCE_CATEGORIES[i % EVIDENCE_CATEGORIES.length];
      pushEdge(geo.paths, cat, linePath(outer[i], outer[next]), { width: 1.5, opacity: 0.88 * intensity });
    }
    pushFacet(geo.facets, "implementation", outer.slice(0, 5), { opacity: 0.1 * intensity, color: "gold" });
    for (let i = 0; i < chamber.length; i += 1) {
      const next = (i + 1) % chamber.length;
      pushEdge(geo.paths, "evidence", linePath(chamber[i], chamber[next]), {
        width: 1.15,
        opacity: 0.8 * intensity,
        color: "violet",
      });
    }
    if (level >= 2) {
      pushEdge(geo.paths, "continuity", linePath(outer[1], chamber[1]), { width: 0.9, opacity: 0.55 * intensity, dash: "3 5" });
      pushEdge(geo.paths, "tests", linePath(outer[3], chamber[2]), { width: 0.9, opacity: 0.5 * intensity, dash: "3 5", color: "violet" });
    }
    if (level >= 4) {
      pushAnchor(geo.anchors, "release_control", chamber[0].x, chamber[0].y, { radius: 2.4, opacity: 0.85 * intensity });
      pushAnchor(geo.anchors, "research", outer[2].x, outer[2].y, { radius: 2.1, opacity: 0.7 * intensity });
    }
    geo.apex = p(4, 30 * lf, -20);
    return geo;
  }

  function buildCrystalGeometry(ctx) {
    const { originX, originY, yaw, level, cov, intensity } = ctx;
    const lf = levelFactor(level);
    const geo = emptyGeometry(originX, originY);
    const p = (x, y, z) => projectIso(x, y, z, originX, originY, yaw);
    const tip = p(0, 88 * lf, 0);
    const waist = [];
    const base = [];
    const sides = 5;
    for (let i = 0; i < sides; i += 1) {
      const a = (i / sides) * Math.PI * 2;
      waist.push(p(Math.cos(a) * 34, 12, Math.sin(a) * 34));
      base.push(p(Math.cos(a) * 42, -52 * lf, Math.sin(a) * 42));
    }
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      const cat = EVIDENCE_CATEGORIES[i % EVIDENCE_CATEGORIES.length];
      pushFacet(geo.facets, cat, [tip, waist[i], waist[next]], { opacity: 0.13 * intensity, color: i % 2 ? "violet" : "gold" });
      pushFacet(geo.facets, cat, [waist[i], waist[next], base[next], base[i]], { opacity: 0.09 * intensity, color: i % 2 ? "gold" : "violet" });
      pushEdge(geo.paths, cat, linePath(tip, waist[i]), { width: 1.45, opacity: 0.9 * intensity });
      pushEdge(geo.paths, cat, linePath(waist[i], waist[next]), { width: 1.2, opacity: 0.8 * intensity });
      pushEdge(geo.paths, cat, linePath(waist[i], base[i]), { width: 1.35, opacity: 0.85 * intensity });
      pushEdge(geo.paths, cat, linePath(base[i], base[next]), { width: 1.15, opacity: 0.72 * intensity, color: "violet" });
    }
    // Strong luminous core.
    const core = p(0, 8, 0);
    pushAnchor(geo.anchors, "evidence", core.x, core.y, { radius: 3.4 + level * 0.25, opacity: 0.95 * intensity });
    if (level >= 3) {
      for (let i = 0; i < sides; i += 1) {
        pushEdge(geo.paths, "continuity", linePath(core, waist[i]), {
          width: 0.65,
          opacity: 0.4 * intensity,
          dash: "2 5",
          primary: false,
          color: "gold",
        });
      }
    }
    geo.apex = tip;
    return geo;
  }

  function buildMonolithGeometry(ctx) {
    const { originX, originY, yaw, level, cov, intensity } = ctx;
    const lf = levelFactor(level);
    const geo = emptyGeometry(originX, originY);
    const p = (x, y, z) => projectIso(x, y, z, originX, originY, yaw);
    // Tall governed pillar with flat terminal — never a crown.
    const w = 28 + level * 1.5;
    const d = 22;
    const h = 100 * lf;
    const top = [p(-w, h * 0.48, -d), p(w, h * 0.48, -d), p(w, h * 0.48, d), p(-w, h * 0.48, d)];
    const bot = [p(-w * 1.08, -h * 0.48, -d * 1.05), p(w * 1.08, -h * 0.48, -d * 1.05), p(w * 1.08, -h * 0.48, d * 1.05), p(-w * 1.08, -h * 0.48, d * 1.05)];
    const cats = ["implementation", "tests", "evidence", "continuity"];
    for (let i = 0; i < 4; i += 1) {
      const next = (i + 1) % 4;
      pushFacet(geo.facets, cats[i], [bot[i], bot[next], top[next], top[i]], {
        opacity: 0.11 * intensity,
        color: i % 2 ? "violet" : "gold",
      });
      pushEdge(geo.paths, cats[i], linePath(bot[i], bot[next]), { width: 1.5, opacity: 0.88 * intensity });
      pushEdge(geo.paths, cats[i], linePath(top[i], top[next]), { width: 1.55, opacity: 0.92 * intensity });
      pushEdge(geo.paths, cats[i], linePath(bot[i], top[i]), { width: 1.65, opacity: 0.94 * intensity });
    }
    // Vertical governing axis.
    const axisTop = p(0, h * 0.48, 0);
    const axisBot = p(0, -h * 0.48, 0);
    pushEdge(geo.paths, "release_control", linePath(axisBot, axisTop), { width: 1.8, opacity: 0.95 * intensity, color: "gold" });
    if (level >= 3) {
      const bandY = -h * 0.1 + level * 4;
      const band = [p(-w * 0.92, bandY, -d * 0.92), p(w * 0.92, bandY, -d * 0.92), p(w * 0.92, bandY, d * 0.92), p(-w * 0.92, bandY, d * 0.92)];
      for (let i = 0; i < 4; i += 1) {
        pushEdge(geo.paths, "research", linePath(band[i], band[(i + 1) % 4]), {
          width: 1.0,
          opacity: 0.65 * intensity,
          color: "violet",
        });
      }
    }
    pushFacet(geo.facets, "external", top, { opacity: 0.1 * intensity, color: "gold" });
    pushAnchor(geo.anchors, "release_control", axisTop.x, axisTop.y, { radius: 2.5, opacity: 0.9 * intensity });
    geo.apex = axisTop;
    return geo;
  }

  function buildArchiveCrownGeometry(ctx) {
    const { originX, originY, yaw, level, cov, intensity } = ctx;
    const lf = levelFactor(level);
    const geo = emptyGeometry(originX, originY);
    const p = (x, y, z) => projectIso(x, y, z, originX, originY, yaw);
    // Ceremonial wide crown: stable base + multiple towers + deep chamber.
    // Intentionally wider and lower than Monolith, with open upper gaps between towers.
    const baseR = 78;
    const base = [];
    const towers = 5;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      base.push(p(Math.cos(a) * baseR, -46, Math.sin(a) * baseR * 0.72));
    }
    for (let i = 0; i < base.length; i += 1) {
      pushEdge(geo.paths, "implementation", linePath(base[i], base[(i + 1) % base.length]), {
        width: 1.55,
        opacity: 0.9 * intensity,
      });
    }
    // Deep central chamber ring.
    const chamber = [];
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      chamber.push(p(Math.cos(a) * 22, -8, Math.sin(a) * 18));
    }
    for (let i = 0; i < chamber.length; i += 1) {
      pushEdge(geo.paths, "evidence", linePath(chamber[i], chamber[(i + 1) % chamber.length]), {
        width: 1.25,
        opacity: 0.85 * intensity,
        color: "violet",
      });
    }
    // Multiple crown towers (archival segments).
    const towerCount = 3 + Math.min(2, level - 1);
    for (let i = 0; i < towerCount; i += 1) {
      const a = (i / towerCount) * Math.PI * 2 - Math.PI / 2;
      const cat = EVIDENCE_CATEGORIES[i % EVIDENCE_CATEGORIES.length];
      const foot = p(Math.cos(a) * 48, -40, Math.sin(a) * 36);
      const mid = p(Math.cos(a) * 40, 18 * lf, Math.sin(a) * 30);
      const tip = p(Math.cos(a) * 28, 58 * lf + i * 2, Math.sin(a) * 22);
      const foot2 = p(Math.cos(a + 0.35) * 44, -40, Math.sin(a + 0.35) * 32);
      pushFacet(geo.facets, cat, [foot, foot2, mid], { opacity: 0.12 * intensity, color: i % 2 ? "violet" : "gold" });
      pushEdge(geo.paths, cat, linePath(foot, mid), { width: 1.5, opacity: 0.92 * intensity });
      pushEdge(geo.paths, cat, linePath(mid, tip), { width: 1.4, opacity: 0.9 * intensity });
      pushEdge(geo.paths, cat, linePath(foot2, mid), { width: 1.25, opacity: 0.8 * intensity, color: "violet" });
      pushEdge(geo.paths, cat, linePath(foot, foot2), { width: 1.1, opacity: 0.75 * intensity });
      if (level >= 3) pushAnchor(geo.anchors, cat, tip.x, tip.y, { radius: 2.1, opacity: 0.85 * intensity });
    }
    // Cross-links between towers for ceremonial completeness.
    if (level >= 2) {
      for (let i = 0; i < towerCount; i += 1) {
        const a1 = (i / towerCount) * Math.PI * 2 - Math.PI / 2;
        const a2 = (((i + 1) % towerCount) / towerCount) * Math.PI * 2 - Math.PI / 2;
        const t1 = p(Math.cos(a1) * 34, 36 * lf, Math.sin(a1) * 26);
        const t2 = p(Math.cos(a2) * 34, 36 * lf, Math.sin(a2) * 26);
        pushEdge(geo.paths, "continuity", linePath(t1, t2), {
          width: 0.95,
          opacity: 0.65 * intensity,
          color: "gold",
        });
      }
    }
    // SS-4 near-complete diadem ring; SS-5 sealed second halo.
    if (level >= 4) {
      const diadem = [];
      for (let i = 0; i <= 16; i += 1) {
        const a = (i / 16) * Math.PI * 2;
        diadem.push(p(Math.cos(a) * 36, 48 * lf, Math.sin(a) * 28));
      }
      pushEdge(geo.paths, "release_control", `M ${diadem.map((v) => `${v.x} ${v.y}`).join(" L ")}`, {
        width: 1.2,
        opacity: 0.8 * intensity,
        color: "gold",
      });
    }
    if (level >= 5) {
      const halo = [];
      for (let i = 0; i <= 20; i += 1) {
        const a = (i / 20) * Math.PI * 2;
        halo.push(p(Math.cos(a) * 78, -10, Math.sin(a) * 52));
      }
      pushEdge(geo.paths, "external", `M ${halo.map((v) => `${v.x} ${v.y}`).join(" L ")}`, {
        width: 1.05,
        opacity: 0.55 * intensity,
        color: "violet",
      });
    }
    const core = p(0, -6, 0);
    pushAnchor(geo.anchors, "evidence", core.x, core.y, { radius: 3.2, opacity: 0.92 * intensity });
    geo.apex = p(0, 64 * lf, 0);
    return geo;
  }

  function organicEvidenceOpacity(ctx, category, minimum, span) {
    const floor = minimum == null ? 0.12 : minimum;
    const range = span == null ? 0.78 : span;
    return round((floor + (ctx.cov[category] || 0) * range) * ctx.intensity * levelFactor(ctx.level));
  }

  function pushOrganicTrajectory(geo, ctx, category, d, options) {
    const settings = options || {};
    const coverage = ctx.cov[category] || 0;
    pushEdge(geo.paths, category, d, {
      color: settings.color || "gold",
      width: settings.width == null ? 1.2 : settings.width,
      opacity: organicEvidenceOpacity(ctx, category, settings.minimum, settings.span),
      dash: settings.dash || (coverage <= 0 ? "5 11" : coverage < 0.4 ? "8 7 2 7" : ""),
      primary: settings.primary !== false,
    });
  }

  function pushOrganicBoundary(geo, ctx, category, d, options) {
    const settings = options || {};
    pushOrganicTrajectory(geo, ctx, category, d, {
      color: settings.color || "gold",
      width: settings.width == null ? 1.05 : settings.width,
      minimum: settings.minimum == null ? 0.16 : settings.minimum,
      span: settings.span == null ? 0.58 : settings.span,
      dash: settings.dash || "",
      primary: settings.primary !== false,
    });
  }

  function configureOrganicFrame(geo, apexX, apexY) {
    geo.origin = { x: 180, y: 232 };
    geo.source = { x: 43, y: 263 };
    geo.apex = { x: apexX, y: apexY };
    return geo;
  }

  function addOrganicMaturityMarks(geo, ctx, family) {
    const marks = [
      ["research", "M 70 272 C 118 286 224 286 292 266", "violet"],
      ["external", "M 82 248 C 118 220 145 207 181 207", "gold"],
      ["continuity", "M 118 283 C 161 290 220 286 259 269", "violet"],
      ["evidence", "M 145 121 C 166 108 190 105 213 115", "gold"],
    ];
    for (let index = 0; index < clamp(ctx.level, 1, 5) - 1; index += 1) {
      const [category, d, color] = marks[(index + family.length) % marks.length];
      pushOrganicTrajectory(geo, ctx, category, d, {
        color,
        width: 0.65,
        minimum: 0.06,
        span: 0.28,
        dash: index % 2 === 0 ? "3 9" : "",
        primary: false,
      });
    }
  }

  function buildOrganicFragmentGeometry(ctx) {
    const geo = emptyGeometry(180, 232);
    pushOrganicTrajectory(geo, ctx, "implementation", "M 43 263 C 72 256 84 233 103 218 C 115 209 126 208 140 212", { width: 1.35 });
    if (ctx.level >= 2) {
      pushOrganicTrajectory(geo, ctx, "tests", "M 151 204 C 174 185 190 179 212 184", {
        color: "violet",
        dash: "7 9 2 8",
      });
    }
    if (ctx.level >= 3) {
      pushOrganicTrajectory(geo, ctx, "continuity", "M 92 247 C 106 261 121 267 140 269", {
        width: 0.75,
        minimum: 0.08,
        span: 0.36,
      });
    }
    if (ctx.level >= 4) {
      pushOrganicTrajectory(geo, ctx, "evidence", "M 228 182 C 247 187 261 201 276 218", {
        color: "violet",
        width: 0.75,
        dash: "4 10",
      });
    }
    if (ctx.level >= 5) {
      pushAnchor(geo.anchors, "research", 140, 212, {
        radius: 1.8,
        opacity: organicEvidenceOpacity(ctx, "research", 0.12, 0.54),
      });
    }
    return configureOrganicFrame(geo, 151, 204);
  }

  function buildOrganicShardGeometry(ctx) {
    const geo = emptyGeometry(180, 232);
    pushOrganicTrajectory(geo, ctx, "implementation", "M 43 263 C 92 245 109 205 146 186 C 179 169 211 145 272 96", { width: 1.5 });
    pushOrganicTrajectory(geo, ctx, "tests", "M 109 231 C 143 231 168 213 191 182", { color: "violet", width: 1.05 });
    if (ctx.level >= 2) {
      pushOrganicTrajectory(geo, ctx, "evidence", "M 140 190 C 173 193 206 205 248 231", {
        width: 0.72,
        dash: ctx.level < 4 ? "4 9" : "",
      });
    }
    if (ctx.level >= 3) {
      pushOrganicBoundary(geo, ctx, "release_control", "M 91 260 L 159 178 L 252 233", {
        width: 0.78,
        minimum: 0.08,
        span: 0.34,
      });
    }
    if (ctx.level >= 4) {
      pushOrganicTrajectory(geo, ctx, "continuity", "M 146 186 C 181 197 209 216 252 233", {
        color: "violet",
        width: 0.65,
        primary: false,
      });
    }
    if (ctx.level >= 5) {
      pushAnchor(geo.anchors, "external", 272, 96, {
        radius: 2.1,
        opacity: organicEvidenceOpacity(ctx, "external", 0.12, 0.58),
      });
    }
    return configureOrganicFrame(geo, 272, 96);
  }

  function buildOrganicStoneGeometry(ctx) {
    const geo = emptyGeometry(180, 232);
    pushOrganicBoundary(geo, ctx, "release_control", "M 63 251 C 88 199 142 174 205 186 C 248 194 277 225 269 259 C 224 282 136 287 63 251 Z");
    pushOrganicTrajectory(geo, ctx, "implementation", "M 43 263 C 87 249 111 217 152 212 C 188 208 204 235 256 222", { width: 1.35 });
    pushOrganicTrajectory(geo, ctx, "continuity", "M 80 252 C 122 260 165 252 191 225 C 213 202 232 194 281 212", {
      color: "violet",
      width: 1.05,
    });
    if (ctx.level >= 3) {
      pushOrganicTrajectory(geo, ctx, "evidence", "M 109 200 C 139 223 166 233 217 241", {
        width: 0.68,
        dash: "4 10",
        primary: false,
      });
      pushAnchor(geo.anchors, "evidence", 191, 225, {
        radius: 2.3,
        opacity: organicEvidenceOpacity(ctx, "evidence", 0.12, 0.6),
      });
    }
    addOrganicMaturityMarks(geo, ctx, "D");
    return configureOrganicFrame(geo, 205, 186);
  }

  function buildOrganicPrismGeometry(ctx) {
    const geo = emptyGeometry(180, 232);
    pushOrganicBoundary(geo, ctx, "release_control", "M 76 258 C 69 206 107 158 159 148 C 211 139 270 176 279 225 C 272 262 224 284 167 279 C 121 276 89 269 76 258 Z");
    pushOrganicTrajectory(geo, ctx, "implementation", "M 43 263 C 99 253 107 212 145 196 C 177 179 209 185 260 222", { width: 1.35 });
    pushOrganicTrajectory(geo, ctx, "continuity", "M 121 239 C 142 265 193 261 218 230 C 240 202 214 172 184 171", {
      color: "violet",
      width: 1.08,
    });
    if (ctx.level >= 2) {
      pushOrganicTrajectory(geo, ctx, "tests", "M 96 211 C 131 205 157 216 176 244", {
        width: 0.72,
        minimum: 0.08,
        span: 0.42,
      });
    }
    addOrganicMaturityMarks(geo, ctx, "C");
    return configureOrganicFrame(geo, 159, 148);
  }

  function buildOrganicRelicGeometry(ctx) {
    const geo = emptyGeometry(180, 232);
    pushOrganicBoundary(geo, ctx, "release_control", "M 54 247 C 77 180 131 141 203 154 C 258 164 292 207 275 257 C 230 289 117 289 54 247 Z");
    pushOrganicBoundary(geo, ctx, "evidence", "M 124 237 C 132 200 158 181 190 188 C 219 194 232 219 216 243 C 192 263 150 260 124 237 Z", {
      color: "violet",
      width: 0.82,
    });
    pushOrganicTrajectory(geo, ctx, "implementation", "M 43 263 C 86 243 113 224 145 215 C 173 208 206 217 267 246", { width: 1.4 });
    pushOrganicTrajectory(geo, ctx, "tests", "M 87 192 C 123 202 144 222 153 250", { color: "violet", width: 0.95 });
    if (ctx.level >= 3) {
      pushOrganicTrajectory(geo, ctx, "continuity", "M 190 155 C 184 182 196 204 235 223", {
        width: 0.72,
        minimum: 0.09,
        span: 0.42,
      });
    }
    if (ctx.level >= 4) {
      pushOrganicTrajectory(geo, ctx, "research", "M 73 262 C 111 279 177 278 232 258", {
        color: "violet",
        width: 0.65,
        dash: "4 10",
        primary: false,
      });
    }
    addOrganicMaturityMarks(geo, ctx, "B");
    return configureOrganicFrame(geo, 203, 154);
  }

  function buildOrganicCrystalGeometry(ctx) {
    const geo = emptyGeometry(180, 232);
    pushOrganicBoundary(geo, ctx, "release_control", "M 73 256 C 86 181 127 127 179 121 C 235 128 274 180 278 247 C 244 280 112 287 73 256 Z");
    pushOrganicBoundary(geo, ctx, "evidence", "M 123 243 C 128 185 151 154 183 148 C 216 156 232 193 225 243 C 198 264 151 263 123 243 Z", {
      color: "violet",
      width: 0.82,
    });
    pushOrganicTrajectory(geo, ctx, "implementation", "M 43 263 C 95 240 113 209 153 191 C 194 173 226 194 275 228", { width: 1.42 });
    pushOrganicTrajectory(geo, ctx, "tests", "M 97 171 C 130 187 151 216 177 256", { color: "violet", width: 1.0 });
    pushOrganicTrajectory(geo, ctx, "continuity", "M 181 123 C 174 164 180 202 202 245", { width: 1.15 });
    if (ctx.level >= 3) {
      pushAnchor(geo.anchors, "evidence", 183, 202, {
        radius: 2.8 + ctx.level * 0.18,
        opacity: organicEvidenceOpacity(ctx, "evidence", 0.18, 0.7),
      });
    }
    if (ctx.level >= 4) {
      pushOrganicTrajectory(geo, ctx, "external", "M 75 250 C 126 275 211 274 273 248", {
        width: 0.62,
        dash: "4 11",
        primary: false,
      });
    }
    addOrganicMaturityMarks(geo, ctx, "A");
    return configureOrganicFrame(geo, 179, 121);
  }

  function buildOrganicMonolithGeometry(ctx) {
    const geo = emptyGeometry(180, 232);
    pushOrganicBoundary(geo, ctx, "release_control", "M 86 260 L 112 141 C 140 112 190 99 225 124 L 270 256 C 228 286 130 290 86 260 Z", { width: 1.12 });
    pushOrganicBoundary(geo, ctx, "evidence", "M 126 250 L 143 161 C 160 142 184 135 202 148 L 225 250 C 193 267 154 268 126 250 Z", {
      color: "violet",
      width: 0.78,
    });
    pushOrganicTrajectory(geo, ctx, "implementation", "M 43 263 C 92 243 119 207 151 187 C 183 167 214 182 281 226", { width: 1.4 });
    pushOrganicTrajectory(geo, ctx, "release_control", "M 177 107 C 167 155 171 206 187 261", { width: 1.3 });
    pushOrganicTrajectory(geo, ctx, "tests", "M 108 141 C 143 169 174 177 226 124", { color: "violet", width: 0.95 });
    if (ctx.level >= 3) {
      pushOrganicTrajectory(geo, ctx, "continuity", "M 94 261 C 137 277 221 276 267 254", {
        width: 0.65,
        dash: "4 10",
        primary: false,
      });
    }
    pushAnchor(geo.anchors, "release_control", 177, 107, {
      radius: 2.25,
      opacity: organicEvidenceOpacity(ctx, "release_control", 0.2, 0.72),
    });
    addOrganicMaturityMarks(geo, ctx, "S");
    return configureOrganicFrame(geo, 177, 107);
  }

  function buildOrganicArchiveGeometry(ctx) {
    const geo = emptyGeometry(180, 232);
    pushOrganicBoundary(geo, ctx, "release_control", "M 34 254 C 71 179 123 140 180 140 C 242 135 298 179 325 252 C 269 290 89 294 34 254 Z", { width: 1.15 });
    pushOrganicBoundary(geo, ctx, "evidence", "M 110 248 C 119 182 143 151 182 148 C 220 153 244 191 239 248 C 210 271 145 271 110 248 Z", {
      color: "violet",
      width: 0.85,
    });
    pushOrganicTrajectory(geo, ctx, "implementation", "M 24 270 C 74 251 95 208 134 189 C 171 171 210 185 252 216 C 278 235 301 243 335 237", { width: 1.42 });
    pushOrganicTrajectory(geo, ctx, "tests", "M 47 223 C 92 238 121 256 171 261 C 222 266 270 247 319 208", { color: "violet", width: 1.05 });
    pushOrganicTrajectory(geo, ctx, "evidence", "M 95 164 C 127 191 147 223 169 262", { width: 1.05 });
    pushOrganicTrajectory(geo, ctx, "continuity", "M 181 115 C 171 160 179 210 200 262", { color: "violet", width: 1.15 });
    pushOrganicTrajectory(geo, ctx, "release_control", "M 266 162 C 236 183 218 214 207 260", { width: 1.05 });
    if (ctx.level >= 2) {
      pushOrganicTrajectory(geo, ctx, "research", "M 57 261 C 115 286 255 285 311 254", {
        width: 0.65,
        dash: "4 10",
        primary: false,
      });
    }
    if (ctx.level >= 3) {
      pushOrganicTrajectory(geo, ctx, "external", "M 73 196 C 118 150 149 124 184 115 C 218 124 246 143 294 189", {
        color: "violet",
        width: 0.72,
      });
    }
    if (ctx.level >= 4) {
      pushOrganicTrajectory(geo, ctx, "continuity", "M 61 250 C 112 226 151 216 185 217 C 226 218 267 230 317 250", {
        width: 0.68,
        minimum: 0.1,
        span: 0.4,
        primary: false,
      });
    }
    if (ctx.level >= 5) {
      pushOrganicBoundary(geo, ctx, "external", "M 26 245 C 62 151 119 105 183 103 C 252 107 310 159 334 243", {
        color: "violet",
        width: 0.82,
        minimum: 0.1,
        span: 0.42,
      });
    }
    pushAnchor(geo.anchors, "evidence", 182, 148, {
      radius: 3.1,
      opacity: organicEvidenceOpacity(ctx, "evidence", 0.2, 0.72),
    });
    return configureOrganicFrame(geo, 181, 115);
  }

  const GEOMETRY_BUILDERS = Object.freeze({
    F: buildOrganicFragmentGeometry,
    E: buildOrganicShardGeometry,
    D: buildOrganicStoneGeometry,
    C: buildOrganicPrismGeometry,
    B: buildOrganicRelicGeometry,
    A: buildOrganicCrystalGeometry,
    S: buildOrganicMonolithGeometry,
    SS: buildOrganicArchiveGeometry,
  });

  /* ---------------- Preview hero sigil (compact) ---------------- */

  function buildSigilModel(input) {
    const repository = String(input.repository || "repository/unknown");
    const commitSha = String(input.commitSha || "pending");
    const policyVersion = String(input.policyVersion || "unknown-policy");
    const visualSeed = Number(input.visualSeed) === -3 ? -3 : 3;
    const phase = visualSeed > 0 ? "EXPANSION" : "CONSOLIDATION";
    const canonicalInput = `${repository}|${commitSha}|${policyVersion}|${visualSeed}`;
    const random = mulberry32(xmur3(canonicalInput)());
    const rank = deriveEvidenceRank({
      categoryScores: input.categoryScores || [
        { key: "implementation", score: visualSeed > 0 ? 18 : 10, max: 20 },
        { key: "tests", score: 12, max: 20 },
        { key: "evidence", score: 12, max: 20 },
        { key: "continuity", score: 8, max: 15 },
        { key: "release_control", score: 8, max: 15 },
        { key: "research", score: 3, max: 5 },
        { key: "external", score: 2, max: 5 },
      ],
      indicators: input.indicators,
    });
    // Force mid family for pending hero when no scores: use seed-based family preview
    const previewFamily = visualSeed > 0 ? "A" : "C";
    const previewLevel = 3;
    const yaw = random() * 0.4;
    const geo = GEOMETRY_BUILDERS[previewFamily]({
      originX: 160,
      originY: 168,
      yaw,
      level: previewLevel,
      cov: coverageMap(rank.categories),
      intensity: 0.9,
      categories: rank.categories,
    });
    return {
      schema: "semeai.repository-sigil.v3",
      canonicalInput,
      repository,
      commitSha,
      policyVersion,
      visualSeed,
      phase,
      periodSeconds: round(14 + random() * 3),
      paths: geo.paths,
      facets: geo.facets,
      anchors: geo.anchors,
      apex: geo.apex,
    };
  }

  function renderSigil(container, input) {
    if (!container || typeof document === "undefined") return buildSigilModel(input);
    const model = buildSigilModel(input);
    const svg = createSvgElement("svg", {
      viewBox: "0 0 320 320",
      role: "img",
      "aria-label": `${model.repository} repository form preview`,
      focusable: "false",
    });
    const breath = createSvgElement("g", { class: "sigil-breath" });
    breath.style.setProperty("--sigil-period", `${model.periodSeconds}s`);
    model.facets.forEach((facet) => {
      breath.appendChild(
        createSvgElement("path", {
          d: polygonPath(facet.points),
          fill: facet.color === "gold" ? "rgba(215,182,111,0.14)" : "rgba(139,120,160,0.12)",
          stroke: "none",
          opacity: facet.opacity,
        }),
      );
    });
    model.paths.forEach((pathModel) => {
      const color = pathModel.color === "gold" ? "#d7b66f" : "#8b78a0";
      breath.appendChild(
        createSvgElement("path", {
          d: pathModel.d,
          fill: "none",
          stroke: color,
          "stroke-width": pathModel.width,
          "stroke-linecap": "round",
          opacity: pathModel.opacity,
          class: pathModel.primary ? "sigil-trace" : "",
        }),
      );
    });
    svg.appendChild(breath);
    container.replaceChildren(svg);
    return model;
  }

  function canonicalSigil(input) {
    return JSON.stringify(buildSigilModel(input));
  }

  /* ---------------- Evidence artifact model + render ---------------- */

  function buildEvidenceSigilModel(input) {
    const repository = String(input.repository || "repository/unknown");
    const commitSha = String(input.commitSha || "pending");
    const policyVersion = String(input.policyVersion || "unknown-policy");
    const visualSeed = Number(input.visualSeed) === -3 ? -3 : 3;
    const visualPhase = String(input.visualPhase || (visualSeed > 0 ? "EXPANSION" : "CONSOLIDATION"));
    const gateDecision = ["SHOW", "REVIEW", "BLOCK"].includes(String(input.gateDecision))
      ? String(input.gateDecision)
      : "REVIEW";
    const rank = deriveEvidenceRank(input);
    const categories = rank.categories;
    const scoreSignature = categories.map((category) => `${category.key}:${category.score}/${category.maximum}`).join("|");
    const indicatorSignature = input.indicators
      ? `${input.indicators.repositorySignal}|${input.indicators.evidenceDepth}|${input.indicators.gateDiscipline}`
      : "na";
    const canonicalInput = `${repository}|${commitSha}|${policyVersion}|${visualSeed}|${visualPhase}|${scoreSignature}|${indicatorSignature}|${rank.code}`;
    const random = mulberry32(xmur3(canonicalInput)());
    const yaw = (visualSeed > 0 ? 0.35 : -0.3) + random() * 0.18;
    const identityBias = round(random() * 2 - 1);
    const intensity = gateDecision === "SHOW" ? 1 : gateDecision === "REVIEW" ? 0.78 : 0.42;
    const builder = GEOMETRY_BUILDERS[rank.family] || buildOrganicFragmentGeometry;
    const geo = builder({
      originX: 180,
      originY: 200,
      yaw,
      level: rank.level,
      cov: coverageMap(categories),
      intensity,
      categories,
    });

    return {
      schema: "semeai.repository-evidence-artifact.v3",
      canonicalInput,
      repository,
      commitSha,
      policyVersion,
      visualSeed,
      visualPhase,
      gateDecision,
      categories,
      evolution: {
        code: rank.code,
        family: rank.family,
        level: rank.level,
        name: rank.familyName,
        title: rank.familyName,
        stageLabel: rank.stageLabel,
        totalScore: rank.totalScore,
      },
      rank,
      metrics: {
        totalScore: rank.totalScore,
        family: rank.family,
        level: rank.level,
        yaw: round(yaw),
        identityBias,
        gateIntensity: intensity,
        evolution: rank.code,
      },
      facets: geo.facets,
      paths: geo.paths,
      anchors: geo.anchors,
      apex: geo.apex,
      origin: geo.origin,
      source: geo.source,
    };
  }

  function renderEvidenceSigil(container, input) {
    if (!container || typeof document === "undefined") return buildEvidenceSigilModel(input);
    if (input && input.suppressArtifact) {
      container.replaceChildren();
      container.dataset.evolution = "";
      container.dataset.artifact = "none";
      return null;
    }

    const model = buildEvidenceSigilModel(input);
    const svg = createSvgElement("svg", {
      viewBox: "0 0 360 320",
      role: "img",
      "aria-label": `Evidence rank ${model.rank.code} ${model.rank.familyName} for ${model.repository}. Gate ${model.gateDecision}.`,
      focusable: "false",
      class: "evidence-artifact-svg is-alive",
      "data-evolution": model.rank.code,
      "data-family": model.rank.family,
      "data-gate": model.gateDecision,
    });
    const filterPrefix = `ea-${String(container.id || "r").replace(/[^A-Za-z0-9_-]+/g, "-")}`;
    const defs = createSvgElement("defs");
    // Soft, restrained glow — not neon bloom.
    const goldGlow = createSvgElement("filter", { id: `${filterPrefix}-g`, x: "-50%", y: "-50%", width: "200%", height: "200%" });
    goldGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "1.35", result: "blur" }));
    const violetGlow = createSvgElement("filter", { id: `${filterPrefix}-v`, x: "-50%", y: "-50%", width: "200%", height: "200%" });
    violetGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "1.2", result: "blur" }));
    const softBloom = createSvgElement("filter", { id: `${filterPrefix}-bloom`, x: "-60%", y: "-60%", width: "220%", height: "220%" });
    softBloom.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "8", result: "blur" }));
    const atmosphereGrad = createSvgElement("radialGradient", {
      id: `${filterPrefix}-atm`,
      cx: "50%",
      cy: "46%",
      r: "58%",
    });
    atmosphereGrad.appendChild(createSvgElement("stop", { offset: "0%", "stop-color": "#d7b66f", "stop-opacity": "0.16" }));
    atmosphereGrad.appendChild(createSvgElement("stop", { offset: "42%", "stop-color": "#8b78a0", "stop-opacity": "0.08" }));
    atmosphereGrad.appendChild(createSvgElement("stop", { offset: "100%", "stop-color": "#000000", "stop-opacity": "0" }));
    defs.append(goldGlow, violetGlow, softBloom, atmosphereGrad);
    svg.appendChild(defs);

    const stage = createSvgElement("g", {
      class: "evidence-artifact__stage",
      "data-gate": model.gateDecision,
    });

    // Ambient atmosphere (behind object) — continuous field presence.
    const ambient = createSvgElement("g", {
      class: "evidence-artifact__ambient",
      "aria-hidden": "true",
      "data-gate": model.gateDecision,
    });
    ambient.appendChild(
      createSvgElement("circle", {
        class: "evidence-artifact__field",
        cx: model.origin.x,
        cy: model.origin.y - 18,
        r: model.rank.family === "SS" ? 136 : 108,
        fill: `url(#${filterPrefix}-atm)`,
        filter: `url(#${filterPrefix}-bloom)`,
      }),
    );
    ambient.appendChild(
      createSvgElement("path", {
        class: "evidence-artifact__field-line evidence-artifact__field-line--outer",
        d: model.rank.family === "SS"
          ? "M 18 271 C 76 298 272 300 344 263"
          : "M 43 270 C 102 294 248 292 316 261",
        fill: "none",
        stroke: "rgba(215,182,111,0.18)",
        "stroke-width": 0.7,
      }),
    );
    ambient.appendChild(
      createSvgElement("path", {
        class: "evidence-artifact__field-line evidence-artifact__field-line--inner",
        d: "M 72 246 C 112 219 146 207 181 207",
        fill: "none",
        stroke: "rgba(139,120,160,0.16)",
        "stroke-width": 0.55,
        "stroke-dasharray": "4 12",
      }),
    );
    stage.appendChild(ambient);

    const body = createSvgElement("g", {
      class: "evidence-artifact__body",
      "data-gate": model.gateDecision,
      "data-evolution": model.rank.code,
      "data-family": model.rank.family,
    });
    const breathePeriod =
      model.gateDecision === "SHOW" ? 12 + model.rank.level * 0.6 : model.gateDecision === "REVIEW" ? 16 + model.rank.level : 22;
    body.style.setProperty("--artifact-period", `${round(breathePeriod)}s`);
    body.style.setProperty("--glow-period", `${round(breathePeriod * 0.72)}s`);
    body.style.setProperty("--drift-period", `${round(breathePeriod * 1.35)}s`);
    body.style.setProperty("--identity-angle", `${round((model.metrics.yaw - 0.44) * 5)}deg`);
    stage.style.setProperty("--artifact-period", `${round(breathePeriod)}s`);
    stage.style.setProperty("--drift-period", `${round(breathePeriod * 1.35)}s`);
    const identity = createSvgElement("g", {
      class: "evidence-artifact__identity",
      transform: `translate(${round(model.metrics.identityBias * 4)} ${round(model.metrics.identityBias * 1.5)}) rotate(${round(model.metrics.identityBias * 3)} 180 220)`,
    });

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
          const fill = facet.color === "gold" ? "rgba(215,182,111,0.16)" : "rgba(139,120,160,0.14)";
          const path = createSvgElement("path", {
            d: polygonPath(facet.points),
            class: "evidence-artifact__facet",
            fill,
            stroke: facet.color === "gold" ? "rgba(215,182,111,0.28)" : "rgba(139,120,160,0.26)",
            "stroke-width": 0.45,
          });
          path.style.setProperty("--trace-opacity", String(facet.opacity));
          path.style.setProperty("--trace-delay", `${categoryIndex * 40 + facetIndex * 16}ms`);
          group.appendChild(path);
        });

      model.paths
        .filter((path) => path.category === category.key)
        .forEach((path, pathIndex) => {
          const color = path.color === "gold" ? "#e2c788" : "#9a88b0";
          const glowColor = path.color === "gold" ? "#d7b66f" : "#8b78a0";
          const shared = {
            d: path.d,
            fill: "none",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            pathLength: 100,
          };
          if (path.primary !== false) {
            const glow = createSvgElement("path", {
              ...shared,
              class: "evidence-sigil__glow evidence-artifact__glow",
              stroke: glowColor,
              "stroke-width": round(path.width * 2.6),
              filter: path.color === "gold" ? `url(#${filterPrefix}-g)` : `url(#${filterPrefix}-v)`,
            });
            glow.style.setProperty("--trace-opacity", String(round(path.opacity * 0.28)));
            glow.style.setProperty("--shimmer-delay", `${categoryIndex * 0.35 + pathIndex * 0.12}s`);
            group.appendChild(glow);
          }
          const trace = createSvgElement("path", {
            ...shared,
            class: `evidence-sigil__trace evidence-artifact__edge${path.primary !== false ? " evidence-artifact__edge--live" : ""}`,
            stroke: color,
            "stroke-width": path.width,
            "data-trace-index": pathIndex,
          });
          trace.style.setProperty("--trace-opacity", String(Math.min(1, path.opacity * 1.08)));
          trace.style.setProperty("--trace-delay", `${categoryIndex * 45 + pathIndex * 18}ms`);
          trace.style.setProperty("--shimmer-delay", `${categoryIndex * 0.4 + pathIndex * 0.15}s`);
          if (path.dash) trace.style.setProperty("--final-dash", path.dash);
          group.appendChild(trace);
        });

      model.anchors
        .filter((anchor) => anchor.category === category.key)
        .forEach((anchor) => {
          const node = createSvgElement("circle", {
            class: "evidence-sigil__anchor evidence-artifact__node",
            cx: anchor.x,
            cy: anchor.y,
            r: anchor.radius,
            fill: "#f0d9a0",
          });
          node.style.setProperty("--trace-opacity", String(anchor.opacity));
          group.appendChild(node);
        });

      identity.appendChild(group);
    });

    if (model.source) {
      const sourceGroup = createSvgElement("g", { class: "evidence-artifact__source", "aria-hidden": "true" });
      sourceGroup.appendChild(
        createSvgElement("circle", {
          class: "evidence-artifact__source-glow",
          cx: model.source.x,
          cy: model.source.y,
          r: 8,
          fill: "#d7b66f",
          opacity: model.gateDecision === "BLOCK" ? 0.12 : 0.2,
          filter: `url(#${filterPrefix}-bloom)`,
        }),
      );
      sourceGroup.appendChild(
        createSvgElement("circle", {
          class: "evidence-artifact__source-core",
          cx: model.source.x,
          cy: model.source.y,
          r: 2.7,
          fill: "#f0d9a0",
          opacity: model.gateDecision === "BLOCK" ? 0.34 : 0.94,
        }),
      );
      identity.appendChild(sourceGroup);
    }

    // Apex marker
    if (model.apex) {
      const apexGroup = createSvgElement("g", { class: "evidence-artifact__apex", "aria-hidden": "true" });
      apexGroup.appendChild(
        createSvgElement("circle", {
          class: "evidence-artifact__apex-core",
          cx: model.apex.x,
          cy: model.apex.y,
          r: 2.35,
          fill: "#f0d9a0",
          opacity: model.gateDecision === "BLOCK" ? 0.35 : 0.96,
        }),
      );
      identity.appendChild(apexGroup);
    }

    body.appendChild(identity);
    stage.appendChild(body);
    svg.appendChild(stage);
    container.dataset.gate = model.gateDecision;
    container.dataset.artifact = "organic-architecture-v4";
    container.dataset.evolution = model.rank.code;
    container.dataset.family = model.rank.family;
    container.classList.add("is-alive");
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
    deriveEvidenceRank,
    deriveEvolutionRank: deriveEvidenceRank,
    listAllEvidenceRanks,
    FAMILY_META,
    GEOMETRY_BUILDERS,
    EVOLUTION_RANKS: FAMILY_META,
  });
  globalScope.SemeAISigil = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
