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

  const GEOMETRY_BUILDERS = Object.freeze({
    F: buildFragmentGeometry,
    E: buildShardGeometry,
    D: buildStoneGeometry,
    C: buildPrismGeometry,
    B: buildRelicGeometry,
    A: buildCrystalGeometry,
    S: buildMonolithGeometry,
    SS: buildArchiveCrownGeometry,
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
    const intensity = gateDecision === "SHOW" ? 1 : gateDecision === "REVIEW" ? 0.78 : 0.42;
    const builder = GEOMETRY_BUILDERS[rank.family] || buildFragmentGeometry;
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
        gateIntensity: intensity,
        evolution: rank.code,
      },
      facets: geo.facets,
      paths: geo.paths,
      anchors: geo.anchors,
      apex: geo.apex,
      origin: geo.origin,
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
      viewBox: "0 0 360 360",
      role: "img",
      "aria-label": `Evidence rank ${model.rank.code} ${model.rank.familyName} for ${model.repository}. Gate ${model.gateDecision}.`,
      focusable: "false",
      class: "evidence-artifact-svg",
      "data-evolution": model.rank.code,
      "data-family": model.rank.family,
    });
    const filterPrefix = `ea-${String(container.id || "r").replace(/[^A-Za-z0-9_-]+/g, "-")}`;
    const defs = createSvgElement("defs");
    // Soft, restrained glow — not neon bloom.
    const goldGlow = createSvgElement("filter", { id: `${filterPrefix}-g`, x: "-40%", y: "-40%", width: "180%", height: "180%" });
    goldGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "1.1", result: "blur" }));
    const violetGlow = createSvgElement("filter", { id: `${filterPrefix}-v`, x: "-40%", y: "-40%", width: "180%", height: "180%" });
    violetGlow.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "1.0", result: "blur" }));
    defs.append(goldGlow, violetGlow);
    svg.appendChild(defs);

    const stage = createSvgElement("g", { class: "evidence-artifact__stage" });
    stage.appendChild(
      createSvgElement("ellipse", {
        class: "evidence-artifact__plinth",
        cx: model.origin.x,
        cy: model.origin.y + 82,
        rx: 96,
        ry: 15,
        fill: "rgba(0,0,0,0.62)",
        opacity: 0.9,
      }),
    );

    const body = createSvgElement("g", {
      class: "evidence-artifact__body",
      "data-gate": model.gateDecision,
      "data-evolution": model.rank.code,
      "data-family": model.rank.family,
    });
    body.style.setProperty("--artifact-period", `${16 + model.rank.level}s`);

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
              "stroke-width": round(path.width * 2.2),
              filter: path.color === "gold" ? `url(#${filterPrefix}-g)` : `url(#${filterPrefix}-v)`,
            });
            glow.style.setProperty("--trace-opacity", String(round(path.opacity * 0.22)));
            group.appendChild(glow);
          }
          const trace = createSvgElement("path", {
            ...shared,
            class: "evidence-sigil__trace evidence-artifact__edge",
            stroke: color,
            "stroke-width": path.width,
            "data-trace-index": pathIndex,
          });
          trace.style.setProperty("--trace-opacity", String(path.opacity));
          trace.style.setProperty("--trace-delay", `${categoryIndex * 45 + pathIndex * 18}ms`);
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

      body.appendChild(group);
    });

    // Apex marker
    if (model.apex) {
      const apexGroup = createSvgElement("g", { class: "evidence-artifact__apex", "aria-hidden": "true" });
      apexGroup.appendChild(
        createSvgElement("circle", {
          cx: model.apex.x,
          cy: model.apex.y,
          r: 3.4,
          fill: "#f0d9a0",
          opacity: model.gateDecision === "BLOCK" ? 0.35 : 0.95,
        }),
      );
      body.appendChild(apexGroup);
    }

    stage.appendChild(body);
    svg.appendChild(stage);
    container.dataset.gate = model.gateDecision;
    container.dataset.artifact = "family-v3";
    container.dataset.evolution = model.rank.code;
    container.dataset.family = model.rank.family;
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
