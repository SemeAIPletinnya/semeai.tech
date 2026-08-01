import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { startProofServer } from "../dev-server.mjs";

const ANSWER_HASH = "6ca851aa85f2cf479fc2562dab09195e91229d17290720682aa0ae604bffb3e8";

const GATE_FIXTURES = {
  supported_answer: {
    action: "SHOW",
    internal_decision: "PROCEED",
    show_to_user: true,
    reason: "Supported deterministic browser fixture.",
    audit_id: "show-proof-receipt",
    audit_preserved: true,
    technical_details: { answer_hash: ANSWER_HASH }
  },
  unsupported_claim: {
    action: "REVIEW",
    internal_decision: "NEEDS_REVIEW",
    show_to_user: false,
    reason: "Review deterministic browser fixture.",
    audit_id: "review-proof-receipt",
    audit_preserved: true,
    ai_answer: "LEAK-ME-REVIEW"
  },
  fake_promo_code: {
    action: "BLOCK",
    internal_decision: "SILENCE",
    show_to_user: false,
    reason: "Block deterministic browser fixture.",
    audit_id: "block-proof-receipt",
    audit_preserved: true,
    candidate_content: "LEAK-ME-BLOCK"
  }
};

async function installGateFixtures(page, origin) {
  await page.route(`${origin}/__cinematic__/gate`, async (route) => {
    const payload = route.request().postDataJSON();
    const fixture = GATE_FIXTURES[payload.scenario_id];
    await route.fulfill({
      status: fixture ? 200 : 400,
      contentType: "application/json",
      body: JSON.stringify(fixture || { error: "Unknown fixture." })
    });
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  assert.ok(widths.scroll <= widths.client, `${label} has horizontal overflow: ${JSON.stringify(widths)}`);
}

let githubToken = "";
try {
  githubToken = execFileSync("gh", ["auth", "token"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch {
  githubToken = "";
}
const { server, origin } = await startProofServer({ githubToken });
const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const page = await context.newPage();
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await installGateFixtures(page, origin);
  await page.goto(`${origin}/cinematic-engine/`, { waitUntil: "networkidle" });

  assert.equal(await page.locator("#cinematic-canvas").count(), 1, "one persistent scene canvas should mount");
  assert.equal((await page.evaluate(() => window.SemeAICinematicEngine.getState())).scene, "field");
  assert.equal(await page.locator("[data-axiom-state]").textContent(), "ATTENTIVE");
  await assertNoHorizontalOverflow(page, "desktop Field");

  await page.evaluate(() => window.SemeAICinematicEngine.setScene("gate"));
  await page.waitForTimeout(30);

  const show = await page.evaluate(() => window.SemeAICinematicEngine.runGate("supported_answer"));
  assert.equal(show.action, "SHOW");
  assert.equal(show.internalDecision, "PROCEED");
  assert.equal(show.releasedAnswer, "Use promo code SAVE30 to get 30% off.");
  assert.equal(await page.locator("[data-gate-answer]").textContent(), show.releasedAnswer);
  assert.equal(await page.locator("[data-gate-receipt-id]").textContent(), "show-proof-receipt");

  const review = await page.evaluate(() => window.SemeAICinematicEngine.runGate("unsupported_claim"));
  assert.equal(review.action, "REVIEW");
  assert.equal(review.internalDecision, "NEEDS_REVIEW");
  assert.equal(review.releasedAnswer, null);
  assert.equal(await page.locator("[data-gate-release]").isHidden(), true);
  assert.equal((await page.locator("body").innerText()).includes("LEAK-ME-REVIEW"), false);
  assert.equal(JSON.stringify(review).includes("LEAK-ME-REVIEW"), false);

  const block = await page.evaluate(() => window.SemeAICinematicEngine.runGate("fake_promo_code"));
  assert.equal(block.action, "BLOCK");
  assert.equal(block.internalDecision, "SILENCE");
  assert.equal(block.releasedAnswer, null);
  assert.equal(await page.locator("[data-gate-release]").isHidden(), true);
  assert.equal((await page.locator("body").innerText()).includes("LEAK-ME-BLOCK"), false);
  assert.equal(JSON.stringify(block).includes("LEAK-ME-BLOCK"), false);

  const error = await page.evaluate(() => window.SemeAICinematicEngine.runGate("__error__"));
  assert.equal(error, null);
  assert.equal((await page.evaluate(() => window.SemeAICinematicEngine.getState())).gate, "ERROR");
  assert.equal(await page.locator("[data-gate-release]").isHidden(), true);
  assert.equal(await page.locator("[data-gate-receipt]").isHidden(), true);

  await page.click("[data-lang=uk]");
  assert.match(await page.locator("#gate-title").innerText(), /ОДНА МЕЖА/);
  await page.click("[data-lang=ru]");
  assert.match(await page.locator("#gate-title").innerText(), /ОДНА ГРАНИЦА/);
  await page.click("[data-lang=en]");
  assert.match(await page.locator("#gate-title").innerText(), /ONE BOUNDARY/);

  await page.evaluate(() => window.SemeAICinematicEngine.setScene("benchmark"));
  const benchmark = await page.evaluate(() => window.SemeAICinematicEngine.runBenchmark("SemeAIPletinnya/silence-as-control"));
  assert.ok(benchmark, "live Benchmark should return an analyzer result");
  assert.equal(benchmark.withheld, false);
  assert.equal(benchmark.candidate.snapshot.source_mode, "LIVE GITHUB SNAPSHOT");
  assert.equal(benchmark.categories.length, 7);
  assert.equal(benchmark.candidate.totalScore, benchmark.categories.reduce((sum, category) => sum + category.score, 0));
  await page.waitForTimeout(3100);
  assert.equal(Number(await page.locator("[data-benchmark-score]").textContent()), benchmark.candidate.totalScore);
  assert.equal(await page.locator("[data-signal-inspector] li").count(), 7);
  assert.equal(await page.locator("[data-benchmark-gate]").textContent(), benchmark.gate.decision);
  await assertNoHorizontalOverflow(page, "desktop Benchmark");

  await page.evaluate(() => window.SemeAICinematicEngine.resetPerformance());
  await page.waitForTimeout(1800);
  const perf = await page.evaluate(() => window.SemeAICinematicEngine.getPerformance());
  assert.ok(perf.samples > 30, "motion performance evidence should contain frame samples");
  assert.ok(perf.averageRenderMs < 20, `average render cost is unexpectedly high: ${JSON.stringify(perf)}`);
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" });
  const mobilePage = await mobile.newPage();
  await installGateFixtures(mobilePage, origin);
  await mobilePage.goto(`${origin}/cinematic-engine/#gate`, { waitUntil: "networkidle" });
  await mobilePage.evaluate(() => window.SemeAICinematicEngine.runGate("unsupported_claim"));
  assert.equal(await mobilePage.locator("[data-gate-release]").isHidden(), true);
  await assertNoHorizontalOverflow(mobilePage, "mobile Gate");
  await mobilePage.evaluate(() => window.SemeAICinematicEngine.setScene("benchmark"));
  await assertNoHorizontalOverflow(mobilePage, "mobile Benchmark");
  await mobile.close();

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce", locale: "en-US" });
  const reducedPage = await reduced.newPage();
  await installGateFixtures(reducedPage, origin);
  await reducedPage.goto(`${origin}/cinematic-engine/`, { waitUntil: "networkidle" });
  await reducedPage.waitForTimeout(250);
  const reducedState = await reducedPage.evaluate(() => ({
    state: window.SemeAICinematicEngine.getState(),
    perf: window.SemeAICinematicEngine.getPerformance()
  }));
  assert.equal(reducedState.state.reducedMotion, true);
  assert.equal(reducedState.perf.samples, 0, "reduced motion must not start a continuous RAF loop");
  await reduced.close();

  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
  const noJsPage = await noJs.newPage();
  await noJsPage.goto(`${origin}/cinematic-engine/`, { waitUntil: "load" });
  const noJsText = await noJsPage.locator(".nojs-contract").innerText();
  assert.match(noJsText, /Gate remains the final release authority/);
  assert.match(noJsText, /REVIEW \/ NEEDS_REVIEW/);
  assert.match(noJsText, /BLOCK \/ SILENCE/);
  await noJs.close();

  assert.deepEqual(consoleErrors, [], `browser console errors: ${JSON.stringify(consoleErrors, null, 2)}`);
  process.stdout.write("Cinematic engine browser verification passed.\n");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
