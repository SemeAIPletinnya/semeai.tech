import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, "..", "..");
const FIXTURE_DIR = path.join(TEST_DIR, "fixtures");
const requireFromTest = createRequire(import.meta.url);

const Core = requireFromTest(path.join(REPOSITORY_ROOT, "benchmark", "assets", "benchmark.js"));
const Sigil = requireFromTest(path.join(REPOSITORY_ROOT, "benchmark", "assets", "sigil.js"));

const expectedAuthority = readJson("canonical-authority.expected.json");
const expectedFallback = readJson("canonical-fallback.expected.json");
const lowEvidenceSnapshot = readJson("low-evidence.json");
const malformedInputs = readJson("malformed-input.json");
const rankCases = readJson("rank-mutation-cases.json");
const canonicalSnapshot = JSON.parse(
  fs.readFileSync(path.join(REPOSITORY_ROOT, "benchmark", "data", "silence-as-control.snapshot.json"), "utf8"),
);

const tests = [];
const FIXED_BROWSER_TIME = "2026-07-26T00:00:00.000Z";

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8"));
}

function test(name, implementation) {
  tests.push({ name, implementation });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function clone(value) {
  return structuredClone(value);
}

function categoryProjection(candidate) {
  return candidate.categoryScores.map((category) => ({
    key: category.key,
    name: category.name,
    score: category.score,
    maximum: category.max,
  }));
}

function authorityState(snapshot) {
  const candidate = Core.scoreSnapshot(snapshot);
  const gate = Core.runPresentationGate(candidate);
  const indicators = Core.computeIndicators(candidate);
  const visual = Core.computeVisualPhase(snapshot.public_metadata.stars);
  return { candidate, gate, indicators, visual };
}

async function completeAuthorityState(snapshot) {
  const authority = authorityState(snapshot);
  const receipt = await Core.buildReceipt(authority.candidate, authority.gate, authority.visual);
  return { ...authority, receipt };
}

function evidenceRankInput(candidate, indicators) {
  return {
    categoryScores: candidate.categoryScores,
    indicators,
  };
}

function artifactInput(snapshot, candidate, gate, indicators, visual, overrides = {}) {
  return {
    repository: snapshot.repository,
    commitSha: snapshot.commit_sha,
    policyVersion: Core.SCORING_POLICY_VERSION,
    visualSeed: visual.visualSeed,
    visualPhase: visual.visualPhase,
    gateDecision: gate.decision,
    categoryScores: candidate.categoryScores,
    indicators,
    ...overrides,
  };
}

function categoryScoresForTotal(total) {
  let remaining = total;
  return Core.SCORING_POLICY.map((category) => {
    const score = Math.min(category.max, remaining);
    remaining -= score;
    return {
      key: category.key,
      name: category.name,
      score,
      max: category.max,
    };
  });
}

function rankForTotal(total, indicators = { repositorySignal: 0, evidenceDepth: 0, gateDiscipline: 0 }) {
  return Sigil.deriveEvidenceRank({
    categoryScores: categoryScoresForTotal(total),
    indicators,
  });
}

function loadPlaywright() {
  try {
    return requireFromTest("playwright");
  } catch (_error) {
    // Continue through known environment-provided module roots.
  }

  const moduleRoots = [
    process.env.PLAYWRIGHT_NODE_MODULES,
    ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : []),
    path.join(
      os.homedir(),
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "node",
      "node_modules",
    ),
  ].filter(Boolean);

  for (const moduleRoot of moduleRoots) {
    try {
      return requireFromTest(path.join(moduleRoot, "playwright"));
    } catch (_error) {
      // Try the next environment-provided module root.
    }
  }

  throw new Error(
    "Playwright is required for the browser boundary tests. Expose the existing installation through NODE_PATH or PLAYWRIGHT_NODE_MODULES.",
  );
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
      ".png": "image/png",
      ".ico": "image/x-icon",
    }[extension] || "application/octet-stream"
  );
}

async function startStaticServer() {
  const server = http.createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const target = path.resolve(REPOSITORY_ROOT, `.${pathname}`);
      const rootPrefix = `${REPOSITORY_ROOT}${path.sep}`;
      if (target !== REPOSITORY_ROOT && !target.startsWith(rootPrefix)) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        response.end("forbidden");
        return;
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("not found");
        return;
      }
      response.writeHead(200, {
        "content-type": contentType(target),
        "cache-control": "no-store",
      });
      fs.createReadStream(target).pipe(response);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error.message);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function newBenchmarkPage(browser, origin, options = {}) {
  const context = await browser.newContext({
    locale: "en-US",
    reducedMotion: options.reducedMotion || "reduce",
    viewport: options.viewport || { width: 1280, height: 900 },
  });
  await context.addInitScript((fixedTime) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(args.length ? args[0] : fixedTime);
      }

      static now() {
        return new NativeDate(fixedTime).valueOf();
      }
    }
    globalThis.Date = FixedDate;
  }, FIXED_BROWSER_TIME);
  const page = await context.newPage();
  const unexpectedExternalRequests = [];
  page.on("request", (request) => {
    const requestOrigin = new URL(request.url()).origin;
    if (requestOrigin !== origin && requestOrigin !== "https://api.github.com") {
      unexpectedExternalRequests.push(request.url());
    }
  });
  if (options.routeGitHub) {
    await page.route("https://api.github.com/**", options.routeGitHub);
  }
  await page.goto(`${origin}/benchmark/`, { waitUntil: "networkidle" });
  return { context, page, unexpectedExternalRequests };
}

async function submitRepository(page, repository) {
  await page.locator("#repository-input").fill(repository);
  await page.locator("#run-button").click();
  await page.waitForFunction(
    () =>
      !document.querySelector("#benchmark-result").hidden ||
      !document.querySelector("#blocked-result").hidden,
  );
}

function fulfillJson(route, status, value) {
  const body = JSON.stringify(value);
  return route.fulfill({
    status,
    body,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-length": String(Buffer.byteLength(body)),
    },
  });
}

function lowEvidenceGitHubRoute(counter) {
  return async (route) => {
    counter.count += 1;
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    const sha = lowEvidenceSnapshot.commit_sha;
    if (pathname === "/repos/FixtureOrg/low-evidence") {
      return fulfillJson(route, 200, {
        full_name: "FixtureOrg/low-evidence",
        owner: { login: "FixtureOrg" },
        default_branch: "master",
        visibility: "public",
        private: false,
        description: null,
        html_url: "https://github.com/FixtureOrg/low-evidence",
        fork: false,
        archived: false,
        disabled: false,
        stargazers_count: 0,
        forks_count: 0,
        open_issues_count: 0,
        size: 1,
        created_at: FIXED_BROWSER_TIME,
        updated_at: FIXED_BROWSER_TIME,
        pushed_at: FIXED_BROWSER_TIME,
        license: null,
        topics: [],
      });
    }
    if (pathname === "/repos/FixtureOrg/low-evidence/commits/master") {
      return fulfillJson(route, 200, {
        sha,
        commit: { committer: { date: FIXED_BROWSER_TIME } },
      });
    }
    if (pathname === "/repos/FixtureOrg/low-evidence/languages") {
      return fulfillJson(route, 200, {});
    }
    if (pathname === "/repos/FixtureOrg/low-evidence/releases") {
      return fulfillJson(route, 200, []);
    }
    if (pathname === "/repos/FixtureOrg/low-evidence/readme") {
      return fulfillJson(route, 404, { message: "Not Found" });
    }
    if (pathname === `/repos/FixtureOrg/low-evidence/git/trees/${sha}`) {
      return fulfillJson(route, 200, { truncated: false, tree: [] });
    }
    return fulfillJson(route, 404, { message: "Unexpected test URL" });
  };
}

test("production policy and analytical function surfaces match the v1 authority baseline", () => {
  assert.equal(Core.ANALYZER_VERSION, expectedAuthority.analyzer_version);
  assert.equal(Core.SCORING_POLICY_VERSION, expectedAuthority.scoring_policy_version);
  assert.equal(Core.SNAPSHOT_SCHEMA_VERSION, expectedAuthority.snapshot_schema_version);

  const policyCanonical = Core.stableStringify(Core.SCORING_POLICY);
  assert.equal(Buffer.byteLength(policyCanonical), expectedAuthority.policy_canonical_bytes);
  assert.equal(sha256(policyCanonical), expectedAuthority.policy_sha256);

  for (const [name, expectedHash] of Object.entries(expectedAuthority.protected_function_sha256)) {
    assert.equal(typeof Core[name], "function", `${name} must remain part of the production Core surface`);
    const portableSource = Core[name].toString().replace(/\r\n/g, "\n");
    assert.equal(sha256(portableSource), expectedHash, `${name} source changed`);
  }
});

test("built-in fallback snapshot integrity and canonical analytical authority remain golden", async () => {
  const hashInput = clone(canonicalSnapshot);
  const claimedSnapshotHash = hashInput.snapshot_hash;
  delete hashInput.snapshot_hash;
  assert.equal(await Core.sha256Hex(Core.stableStringify(hashInput)), claimedSnapshotHash);

  const state = await completeAuthorityState(canonicalSnapshot);
  assert.equal(state.candidate.totalScore, expectedAuthority.total_score);
  assert.deepEqual(categoryProjection(state.candidate), expectedAuthority.category_scores);
  assert.deepEqual(state.indicators, expectedAuthority.indicators);
  assert.deepEqual(state.gate, expectedAuthority.presentation_gate);
  assert.deepEqual(state.visual, expectedAuthority.visual);

  const rank = Sigil.deriveEvidenceRank(evidenceRankInput(state.candidate, state.indicators));
  assert.deepEqual(
    {
      code: rank.code,
      family: rank.family,
      level: rank.level,
      name: rank.familyName,
    },
    expectedAuthority.rank,
  );
  assert.equal(state.receipt.receipt_hash, expectedFallback.receipt_hash);
});

test("canonical receipt object and serialized bytes remain exact", async () => {
  const { receipt } = await completeAuthorityState(canonicalSnapshot);
  assert.deepEqual(Object.keys(receipt), expectedFallback.receipt_root_keys);
  assert.deepEqual(Object.keys(receipt.category_scores[0]), expectedFallback.category_score_keys);
  assert.deepEqual(Object.keys(receipt.admitted_signals[0]), expectedFallback.admitted_signal_keys);
  assert.deepEqual(Object.keys(receipt.missing_signals[0]), expectedFallback.missing_signal_keys);
  assert.deepEqual(Object.keys(receipt.presentation_gate), expectedFallback.presentation_gate_keys);
  assert.equal(receipt.admitted_signals.length, expectedFallback.admitted_signal_count);
  assert.equal(receipt.missing_signals.length, expectedFallback.missing_signal_count);

  const withoutHash = clone(receipt);
  delete withoutHash.receipt_hash;
  const canonical = Core.stableStringify(withoutHash);
  assert.equal(Buffer.byteLength(canonical), expectedFallback.canonical_without_hash_bytes);
  assert.equal(sha256(canonical), expectedFallback.canonical_without_hash_sha256);
  assert.equal(receipt.receipt_hash, expectedFallback.receipt_hash);

  const downloadJson = `${JSON.stringify(receipt, null, 2)}\n`;
  assert.equal(Buffer.byteLength(downloadJson), expectedFallback.download_json_bytes);
  assert.equal(sha256(downloadJson), expectedFallback.download_json_sha256);
});

test("fixed authority and artifact outputs are deterministic across repeated runs", async () => {
  const authorityRuns = [];
  const artifactRuns = [];
  for (let index = 0; index < 5; index += 1) {
    const state = await completeAuthorityState(clone(canonicalSnapshot));
    authorityRuns.push(
      Core.stableStringify({
        evidence: state.candidate.snapshot.normalized_evidence,
        categories: categoryProjection(state.candidate),
        total: state.candidate.totalScore,
        indicators: state.indicators,
        gate: state.gate,
        visual: state.visual,
        receipt: state.receipt,
      }),
    );
    artifactRuns.push(
      Sigil.canonicalEvidenceSigil(
        artifactInput(
          state.candidate.snapshot,
          state.candidate,
          state.gate,
          state.indicators,
          state.visual,
        ),
      ),
    );
  }

  authorityRuns.forEach((value) => assert.equal(value, authorityRuns[0]));
  artifactRuns.forEach((value) => assert.equal(value, artifactRuns[0]));
  assert.equal(Buffer.byteLength(artifactRuns[0]), expectedAuthority.canonical_artifact_bytes);
  assert.equal(sha256(artifactRuns[0]), expectedAuthority.canonical_artifact_sha256);

  const roadmapCandidate = Core.scoreSnapshot(clone(lowEvidenceSnapshot));
  const candidateBeforeRoadmap = Core.stableStringify(roadmapCandidate);
  const firstRoadmap = Core.buildEvidenceRoadmap(roadmapCandidate);
  const secondRoadmap = Core.buildEvidenceRoadmap(clone(roadmapCandidate));
  assert.equal(firstRoadmap.schema, "semeai.repository-evidence.roadmap.v1");
  assert.equal(firstRoadmap.policy_version, expectedAuthority.scoring_policy_version);
  assert.equal(firstRoadmap.prioritized.length, 6);
  assert.ok(firstRoadmap.prioritized.every((item) => item.status === "OPEN"));
  assert.ok(firstRoadmap.observed.every((item) => item.status === "OBSERVE"));
  assert.ok(firstRoadmap.prioritized.every((item) => /not a score guarantee/i.test(item.potential_policy_effect)));
  assert.equal(Core.stableStringify(firstRoadmap), Core.stableStringify(secondRoadmap));
  assert.equal(Core.stableStringify(roadmapCandidate), candidateBeforeRoadmap);
});

test("all 40 rank codes and every ordinary score boundary remain frozen", () => {
  const allRanks = Sigil.listAllEvidenceRanks();
  const expectedRanks = ["F", "E", "D", "C", "B", "A", "S", "SS"].flatMap((family) =>
    [1, 2, 3, 4, 5].map((level) => `${family}-${level}`),
  );
  assert.deepEqual(allRanks, expectedRanks);

  for (const range of rankCases.ordinary_ranges) {
    for (let total = range.min; total <= range.max; total += 1) {
      assert.equal(rankForTotal(total).code, range.code, `rank mismatch for total ${total}`);
    }
  }
  assert.equal(rankForTotal(97).code, "SS-1");
  assert.equal(rankForTotal(98).code, "SS-2");
});

test("SS-3, canonical SS-4, and complete SS-5 remain distinct", () => {
  const ss3Scores = categoryScoresForTotal(100);
  const releaseControl = ss3Scores.find((category) => category.key === "release_control");
  const external = ss3Scores.find((category) => category.key === "external");
  releaseControl.score -= 1;
  external.score = external.max;
  assert.equal(
    Sigil.deriveEvidenceRank({
      categoryScores: ss3Scores,
      indicators: { repositorySignal: 100, evidenceDepth: 100, gateDiscipline: 93 },
    }).code,
    "SS-3",
  );

  const canonical = authorityState(canonicalSnapshot);
  assert.equal(
    Sigil.deriveEvidenceRank(evidenceRankInput(canonical.candidate, canonical.indicators)).code,
    "SS-4",
  );

  const completeScores = categoryScoresForTotal(100);
  assert.equal(
    Sigil.deriveEvidenceRank({
      categoryScores: completeScores,
      indicators: { repositorySignal: 100, evidenceDepth: 100, gateDiscipline: 100 },
    }).code,
    "SS-5",
  );
});

test("documents current behavior for inconsistent 100-point candidate", () => {
  const currentBehavior = Sigil.deriveEvidenceRank({
    categoryScores: categoryScoresForTotal(100),
    indicators: { repositorySignal: 0, evidenceDepth: 0, gateDiscipline: 0 },
  });
  assert.equal(currentBehavior.code, "SS-1");
});

test("valid low-evidence candidate computes internally but Presentation Gate returns BLOCK", () => {
  const sourceSnapshot = clone(lowEvidenceSnapshot);
  delete sourceSnapshot.normalized_evidence;
  delete sourceSnapshot.expected;
  const derivedEvidence = Core.deriveEvidence(sourceSnapshot, [], {});
  assert.deepEqual(derivedEvidence.recent_default_commit, lowEvidenceSnapshot.normalized_evidence.recent_default_commit);
  assert.deepEqual(derivedEvidence.public_visibility, lowEvidenceSnapshot.normalized_evidence.public_visibility);
  Object.entries(derivedEvidence)
    .filter(([key]) => !["recent_default_commit", "public_visibility"].includes(key))
    .forEach(([key, value]) => assert.deepEqual(value, [], `${key} should remain absent in the low-evidence fixture`));

  const scoredSnapshot = {
    ...sourceSnapshot,
    normalized_evidence: derivedEvidence,
  };
  const repeatedStates = Array.from({ length: 5 }, () => authorityState(clone(scoredSnapshot)));
  repeatedStates.slice(1).forEach((state) => {
    assert.equal(
      Core.stableStringify(state),
      Core.stableStringify(repeatedStates[0]),
      "low-evidence authority must remain deterministic",
    );
  });
  const state = repeatedStates[0];
  assert.equal(state.candidate.totalScore, lowEvidenceSnapshot.expected.internal_total_score);
  assert.deepEqual(
    state.candidate.categoryScores.map((category) => category.score),
    lowEvidenceSnapshot.expected.category_scores,
  );
  assert.deepEqual(state.indicators, lowEvidenceSnapshot.expected.indicators);
  assert.equal(state.gate.decision, lowEvidenceSnapshot.expected.presentation_gate);
});

test("presentation-only model permutations cannot mutate analytical authority", async () => {
  const state = await completeAuthorityState(clone(canonicalSnapshot));
  const before = clone(state);
  const canonicalModels = [];

  for (const permutation of rankCases.presentation_permutations) {
    canonicalModels.push(
      Sigil.canonicalEvidenceSigil(
        artifactInput(
          state.candidate.snapshot,
          state.candidate,
          state.gate,
          state.indicators,
          state.visual,
          permutation,
        ),
      ),
    );
  }

  assert.ok(new Set(canonicalModels).size > 1, "presentation permutations should produce distinct presentation models");
  assert.deepEqual(state, before);
  const rebuiltReceipt = await Core.buildReceipt(state.candidate, state.gate, state.visual);
  assert.deepEqual(rebuiltReceipt, before.receipt);
});

async function runBrowserBoundaryTests() {
  const playwright = loadPlaywright();
  const { server, origin } = await startStaticServer();
  const browser = await playwright.chromium.launch({ headless: true });

  try {
    await browserFallbackGolden(browser, origin);
    await browserBlockWithholding(browser, origin);
    await browserCollectionFailure(browser, origin);
    await browserMalformedInputs(browser, origin);
    await browserMutationSafety(browser, origin);
    await browserMotionBoundaries(browser, origin);
  } finally {
    await browser.close();
    await closeServer(server);
  }
}

async function browserMotionBoundaries(browser, origin) {
  const { context, page, unexpectedExternalRequests } = await newBenchmarkPage(browser, origin, {
    reducedMotion: "no-preference",
    routeGitHub: async (route) => route.abort("failed"),
  });
  try {
    await submitRepository(page, "SemeAIPletinnya/silence-as-control");
    await page.locator("#result-sigil").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("#result-sigil").dataset.motionState === "running");
    await page.waitForTimeout(1400);

    const motion = await page.locator("#result-sigil").evaluate((mount) => {
      const names = [...mount.querySelectorAll("*")]
        .map((node) => getComputedStyle(node).animationName)
        .filter((name) => name && name !== "none");
      return [...new Set(names)].sort();
    });
    assert.deepEqual(
      motion,
      [
        "evidence-ambient-depth",
        "evidence-core-breath",
        "evidence-field-drift",
        "evidence-flow",
        "evidence-structural-response",
        "evidence-wave",
      ],
    );

    await page.evaluate(() => scrollTo(0, 999999));
    await page.waitForFunction(() => document.querySelector("#result-sigil").dataset.motionState === "paused");
    const offscreenPlayStates = await page.locator("#result-sigil").evaluate((mount) =>
      [...mount.querySelectorAll("*")]
        .map((node) => getComputedStyle(node).animationPlayState)
        .filter(Boolean),
    );
    assert.ok(offscreenPlayStates.length > 0);
    assert.ok(offscreenPlayStates.every((state) => state === "paused"));

    await page.locator("#result-sigil").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("#result-sigil").dataset.motionState === "running");
    const visibilityPause = await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      const hiddenState = document.querySelector("#result-sigil").dataset.motionState;
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
      return {
        hiddenState,
        visibleState: document.querySelector("#result-sigil").dataset.motionState,
      };
    });
    assert.deepEqual(visibilityPause, { hiddenState: "paused", visibleState: "running" });
    assert.deepEqual(unexpectedExternalRequests, []);
  } finally {
    await context.close();
  }

  const reduced = await newBenchmarkPage(browser, origin, {
    reducedMotion: "reduce",
    routeGitHub: async (route) => route.abort("failed"),
  });
  try {
    await submitRepository(reduced.page, "SemeAIPletinnya/silence-as-control");
    await reduced.page.locator("#result-sigil").scrollIntoViewIfNeeded();
    const reducedAnimations = await reduced.page.locator("#result-sigil").evaluate((mount) =>
      [...mount.querySelectorAll("*")]
        .map((node) => getComputedStyle(node).animationName)
        .filter((name) => name && name !== "none"),
    );
    assert.deepEqual(reducedAnimations, []);
    assert.deepEqual(reduced.unexpectedExternalRequests, []);
  } finally {
    await reduced.context.close();
  }
}

async function browserFallbackGolden(browser, origin) {
  const requestCounter = { count: 0 };
  const { context, page, unexpectedExternalRequests } = await newBenchmarkPage(browser, origin, {
    routeGitHub: async (route) => {
      requestCounter.count += 1;
      await route.abort("failed");
    },
  });
  try {
    const authBoundary = await page.evaluate(() => ({
      oauthLinks: [...document.querySelectorAll("a[href]")].filter((link) =>
        link.href.includes("/v0/oauth/github/start"),
      ).length,
      headerState: document.querySelector(".benchmark-auth-state")?.textContent.trim(),
      headerDisabled: document.querySelector(".benchmark-auth-state")?.getAttribute("aria-disabled"),
      headerHint: document.querySelector(".benchmark-auth-entry > span:last-child")?.textContent.trim(),
    }));
    assert.deepEqual(authBoundary, {
      oauthLinks: 0,
      headerState: "GITHUB CONNECTION UNAVAILABLE",
      headerDisabled: "true",
      headerHint: "Anonymous benchmark remains available.",
    });

    await submitRepository(page, "SemeAIPletinnya/silence-as-control");
    const result = await page.evaluate(() => ({
      resultHidden: document.querySelector("#benchmark-result").hidden,
      blockedHidden: document.querySelector("#blocked-result").hidden,
      total: document.querySelector("#total-score").textContent.trim(),
      categories: [...document.querySelectorAll(".category-score")].map((element) => element.textContent.trim()),
      gate: document.querySelector("#gate-decision").textContent.trim(),
      seed: document.querySelector("#visual-seed").textContent.trim(),
      phase: document.querySelector("#visual-phase").textContent.trim(),
      rank: document.querySelector("#evidence-rank-code").textContent.trim(),
      family: document.querySelector("#evidence-rank-family").textContent.trim(),
      receiptHash: document.querySelector("#receipt-hash").textContent.trim(),
      receiptEnabled: !document.querySelector("#download-receipt").disabled,
      saveControlDisabled: document.querySelector(".save-trace-button").disabled,
      saveControlLabel: document.querySelector(".save-trace-button").textContent.trim(),
      roadmapCount: document.querySelector("#roadmap-count").textContent.trim(),
      roadmapItems: document.querySelectorAll(".roadmap-item").length,
      roadmapObserved: document.querySelector("#roadmap-observed").textContent.trim(),
    }));
    assert.equal(result.resultHidden, false);
    assert.equal(result.blockedHidden, true);
    assert.equal(result.total, "99");
    assert.equal(result.gate, "REVIEW");
    assert.equal(result.seed, "+3");
    assert.match(result.phase, /\+3\s+EXPANSION/);
    assert.equal(result.rank, "SS-4");
    assert.equal(result.family, "ARCHIVE CROWN");
    assert.equal(result.receiptHash, expectedFallback.receipt_hash);
    assert.equal(result.receiptEnabled, true);
    assert.equal(result.saveControlDisabled, true);
    assert.equal(result.saveControlLabel, "GITHUB CONNECTION UNAVAILABLE");
    assert.equal(result.roadmapCount, "0 OF 0 ACTIONABLE GAPS");
    assert.equal(result.roadmapItems, 0);
    assert.match(result.roadmapObserved, /^1 external or chronological signal remains observation-only/);
    assert.ok(requestCounter.count >= 1, "fallback must begin with a real collection attempt in the UI");
    assert.deepEqual(unexpectedExternalRequests, []);
  } finally {
    await context.close();
  }
}

async function browserBlockWithholding(browser, origin) {
  const requestCounter = { count: 0 };
  const { context, page, unexpectedExternalRequests } = await newBenchmarkPage(browser, origin, {
    routeGitHub: lowEvidenceGitHubRoute(requestCounter),
  });
  try {
    await submitRepository(page, lowEvidenceSnapshot.repository);
    const state = await page.evaluate(() => {
      const blocked = document.querySelector("#blocked-result");
      const blockedSigil = document.querySelector("#blocked-sigil");
      return {
        blockedHidden: blocked.hidden,
        resultHidden: document.querySelector("#benchmark-result").hidden,
        rankMode: blocked.dataset.rankMode,
        rankStatus: document.querySelector("#blocked-rank-status").textContent.trim(),
        totalText: document.querySelector("#total-score").textContent.trim(),
        resultRankHidden: document.querySelector("#evidence-rank-block").hidden,
        blockedArtifact: blockedSigil.dataset.artifact,
        blockedArtifactChildren: blockedSigil.childElementCount,
        leakedFamily: blocked.querySelector("[data-family]") !== null,
        receiptDisabled: document.querySelector("#download-receipt").disabled,
        status: document.querySelector("#run-status").textContent.trim(),
      };
    });
    assert.equal(state.blockedHidden, false);
    assert.equal(state.resultHidden, true);
    assert.equal(state.rankMode, "withheld");
    assert.equal(state.rankStatus, "RANK WITHHELD");
    assert.equal(state.totalText, "");
    assert.equal(state.resultRankHidden, true);
    assert.equal(state.blockedArtifact, "none");
    assert.equal(state.blockedArtifactChildren, 0);
    assert.equal(state.leakedFamily, false);
    assert.equal(state.receiptDisabled, true);
    assert.match(state.status, /BLOCK.+SCORE WITHHELD/);
    assert.ok(requestCounter.count >= 6, "valid low-evidence collection should exercise the bounded GitHub surface");
    assert.deepEqual(unexpectedExternalRequests, []);
  } finally {
    await context.close();
  }
}

async function browserCollectionFailure(browser, origin) {
  const requestCounter = { count: 0 };
  const { context, page, unexpectedExternalRequests } = await newBenchmarkPage(browser, origin, {
    routeGitHub: async (route) => {
      requestCounter.count += 1;
      await route.abort("failed");
    },
  });
  try {
    await submitRepository(page, "FixtureOrg/unavailable-repository");
    const state = await page.evaluate(() => {
      const blocked = document.querySelector("#blocked-result");
      const sigil = document.querySelector("#blocked-sigil");
      return {
        rankMode: blocked.dataset.rankMode,
        rankStatus: document.querySelector("#blocked-rank-status").textContent.trim(),
        resultHidden: document.querySelector("#benchmark-result").hidden,
        totalText: document.querySelector("#total-score").textContent.trim(),
        artifact: sigil.dataset.artifact,
        artifactChildren: sigil.childElementCount,
        receiptDisabled: document.querySelector("#download-receipt").disabled,
        status: document.querySelector("#run-status").textContent.trim(),
      };
    });
    assert.ok(requestCounter.count >= 1);
    assert.equal(state.rankMode, "none");
    assert.equal(state.rankStatus, "NO EVIDENCE RANK PRODUCED");
    assert.equal(state.resultHidden, true);
    assert.equal(state.totalText, "");
    assert.equal(state.artifact, "none");
    assert.equal(state.artifactChildren, 0);
    assert.equal(state.receiptDisabled, true);
    assert.match(state.status, /COLLECTION FAILURE.+NO EVIDENCE RANK PRODUCED/);
    assert.deepEqual(unexpectedExternalRequests, []);
  } finally {
    await context.close();
  }
}

async function browserMalformedInputs(browser, origin) {
  const requestCounter = { count: 0 };
  const { context, page, unexpectedExternalRequests } = await newBenchmarkPage(browser, origin, {
    routeGitHub: async (route) => {
      requestCounter.count += 1;
      await route.abort("failed");
    },
  });
  try {
    for (const fixture of malformedInputs.cases) {
      await page.locator("#reset-button").click();
      await page.locator("#repository-input").fill(fixture.input);
      await page.locator("#run-button").click();
      await page.waitForFunction(() => !document.querySelector("#blocked-result").hidden);
      const state = await page.evaluate(() => ({
        invalid: document.querySelector("#repository-input").getAttribute("aria-invalid"),
        rankMode: document.querySelector("#blocked-result").dataset.rankMode,
        resultHidden: document.querySelector("#benchmark-result").hidden,
        totalText: document.querySelector("#total-score").textContent.trim(),
        rankHidden: document.querySelector("#evidence-rank-block").hidden,
        receiptDisabled: document.querySelector("#download-receipt").disabled,
        artifact: document.querySelector("#blocked-sigil").dataset.artifact,
      }));
      assert.equal(state.invalid, "true", fixture.name);
      assert.equal(state.rankMode, "none", fixture.name);
      assert.equal(state.resultHidden, true, fixture.name);
      assert.equal(state.totalText, "", fixture.name);
      assert.equal(state.rankHidden, true, fixture.name);
      assert.equal(state.receiptDisabled, true, fixture.name);
      assert.equal(state.artifact, "none", fixture.name);
    }
    assert.equal(requestCounter.count, 0, "malformed input must not reach GitHub");
    assert.deepEqual(unexpectedExternalRequests, []);
  } finally {
    await context.close();
  }
}

async function browserMutationSafety(browser, origin) {
  const { context, page, unexpectedExternalRequests } = await newBenchmarkPage(browser, origin);
  try {
    const result = await page.evaluate(async () => {
      const snapshot = await (await fetch("/benchmark/data/silence-as-control.snapshot.json")).json();
      const CoreApi = window.SemeAIBenchmarkCore;
      const SigilApi = window.SemeAISigil;
      const candidate = CoreApi.scoreSnapshot(snapshot);
      const gate = CoreApi.runPresentationGate(candidate);
      const indicators = CoreApi.computeIndicators(candidate);
      const visual = CoreApi.computeVisualPhase(snapshot.public_metadata.stars);
      const authorityBeforeRender = structuredClone({ snapshot, candidate, gate, indicators, visual });
      const container = document.createElement("div");
      container.id = "test-only-artifact-container";
      document.body.appendChild(container);

      const baseInput = {
        repository: snapshot.repository,
        commitSha: snapshot.commit_sha,
        policyVersion: CoreApi.SCORING_POLICY_VERSION,
        visualSeed: visual.visualSeed,
        visualPhase: visual.visualPhase,
        gateDecision: gate.decision,
        categoryScores: candidate.categoryScores,
        indicators,
      };

      SigilApi.renderEvidenceSigil(container, baseInput);
      const firstMarkup = container.innerHTML;
      SigilApi.highlightEvidenceCategory(container, "implementation");
      SigilApi.clearEvidenceHighlight(container);
      document.documentElement.dataset.testAnimationState = "running";
      SigilApi.renderEvidenceSigil(container, { ...baseInput, gateDecision: "SHOW" });
      SigilApi.renderEvidenceSigil(container, { ...baseInput, gateDecision: "BLOCK" });
      SigilApi.renderEvidenceSigil(container, baseInput);
      const repeatedMarkup = container.innerHTML;
      const receiptAfterPresentation = await CoreApi.buildReceipt(candidate, gate, visual);
      const authorityAfterRender = structuredClone({ snapshot, candidate, gate, indicators, visual });
      container.remove();

      return {
        authorityEqual: JSON.stringify(authorityAfterRender) === JSON.stringify(authorityBeforeRender),
        markupDeterministic: firstMarkup === repeatedMarkup,
        receiptHash: receiptAfterPresentation.receipt_hash,
        gate: gate.decision,
        seed: visual.visualSeed,
        phase: visual.visualPhase,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
    });
    assert.equal(result.authorityEqual, true);
    assert.equal(result.markupDeterministic, true);
    assert.equal(result.receiptHash, expectedFallback.receipt_hash);
    assert.equal(result.gate, "REVIEW");
    assert.equal(result.seed, 3);
    assert.equal(result.phase, "EXPANSION");
    assert.equal(result.reducedMotion, true);
    assert.deepEqual(unexpectedExternalRequests, []);
  } finally {
    await context.close();
  }
}

test("browser UI preserves fallback, BLOCK, collection-failure, malformed-input, and mutation boundaries", async () => {
  await runBrowserBoundaryTests();
});

async function main() {
  let failures = 0;
  const startedAt = Date.now();
  for (const [index, item] of tests.entries()) {
    try {
      await item.implementation();
      console.log(`ok ${index + 1} - ${item.name}`);
    } catch (error) {
      failures += 1;
      console.error(`not ok ${index + 1} - ${item.name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }
  const duration = Date.now() - startedAt;
  console.log(`\n${tests.length - failures}/${tests.length} tests passed in ${duration} ms`);
  if (failures) process.exitCode = 1;
}

await main();
