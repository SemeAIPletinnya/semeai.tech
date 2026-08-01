import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { startProofServer } from "../dev-server.mjs";

const outputDirectory = path.resolve(process.argv[2] || "cinematic-engine/evidence/rendered");
await mkdir(outputDirectory, { recursive: true });

let githubToken = "";
try {
  githubToken = execFileSync("gh", ["auth", "token"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch {
  githubToken = "";
}
const { server, origin } = await startProofServer({ githubToken });
const browser = await chromium.launch({ headless: true });
const generated = [];
const evidence = {
  schema_version: "semeai.cinematic.rendered-evidence.v1",
  frozen_baseline_sha: "1fc5b22ba1d83ed0de5cfff6e6e4ec2e02ebadf0",
  captured_at: new Date().toISOString(),
  origin: "loopback proof server with bounded production Gate proxy",
  gate: {},
  benchmark: null,
  performance: {},
  layout: {},
  console_errors: []
};

function outputPath(name) {
  generated.push(name);
  return path.join(outputDirectory, name);
}

async function setEnglish(page) {
  const button = page.locator("[data-lang=en]");
  if (await button.count()) await button.click();
}

function watchErrors(page) {
  page.on("pageerror", (error) => evidence.console_errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") evidence.console_errors.push(message.text());
  });
}

async function captureBaseline(route, name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const page = await context.newPage();
  watchErrors(page);
  await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: outputPath(name) });
  await context.close();
}

async function saveVideo(context, page, name) {
  const video = page.video();
  await context.close();
  await video.saveAs(outputPath(name));
}

try {
  await captureBaseline("/", "baseline-home-desktop.png");
  await captureBaseline("/gate.html", "baseline-gate-desktop.png");
  await captureBaseline("/benchmark/", "baseline-benchmark-desktop.png");

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const page = await desktop.newPage();
  watchErrors(page);
  await page.goto(`${origin}/cinematic-engine/`, { waitUntil: "networkidle" });
  await setEnglish(page);
  await page.mouse.move(810, 505);
  await page.waitForTimeout(900);
  await page.screenshot({ path: outputPath("prototype-field-desktop.png") });
  evidence.layout.field_desktop = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight
  }));
  await page.evaluate(() => window.SemeAICinematicEngine.resetPerformance());
  await page.waitForTimeout(1600);
  evidence.performance.field = await page.evaluate(() => window.SemeAICinematicEngine.getPerformance());

  await page.evaluate(() => window.SemeAICinematicEngine.setScene("gate"));
  await page.waitForTimeout(900);
  for (const [scenario, state, file] of [
    ["supported_answer", "SHOW", "prototype-gate-show-desktop.png"],
    ["unsupported_claim", "REVIEW", "prototype-gate-review-desktop.png"],
    ["fake_promo_code", "BLOCK", "prototype-gate-block-desktop.png"],
    ["__error__", "ERROR", "prototype-gate-error-desktop.png"]
  ]) {
    const result = await page.evaluate((selected) => window.SemeAICinematicEngine.runGate(selected), scenario);
    await page.waitForTimeout(state === "SHOW" ? 2300 : 1900);
    const stateEvidence = await page.evaluate(() => ({
      state: window.SemeAICinematicEngine.getState().gate,
      releasedText: document.querySelector("[data-gate-answer]")?.textContent || "",
      releaseHidden: document.querySelector("[data-gate-release]")?.hidden,
      receiptHidden: document.querySelector("[data-gate-receipt]")?.hidden,
      publicState: document.querySelector("[data-gate-public]")?.textContent,
      canonicalState: document.querySelector("[data-gate-internal]")?.textContent || null,
      receiptId: document.querySelector("[data-gate-receipt-id]")?.textContent || null,
      bodyHasReviewLeakSentinel: document.body.innerText.includes("LEAK-ME-REVIEW"),
      bodyHasBlockLeakSentinel: document.body.innerText.includes("LEAK-ME-BLOCK")
    }));
    evidence.gate[state] = {
      ...stateEvidence,
      response: result ? {
        action: result.action,
        internal_decision: result.internalDecision,
        reason: result.reason,
        released_answer: result.releasedAnswer,
        receipt: result.receipt
      } : null
    };
    await page.screenshot({ path: outputPath(file) });
  }
  await page.evaluate(() => window.SemeAICinematicEngine.resetPerformance());
  await page.waitForTimeout(1600);
  evidence.performance.gate = await page.evaluate(() => window.SemeAICinematicEngine.getPerformance());

  await page.evaluate(() => window.SemeAICinematicEngine.setScene("benchmark"));
  await page.waitForTimeout(900);
  const benchmarkResult = await page.evaluate(() => window.SemeAICinematicEngine.runBenchmark("SemeAIPletinnya/silence-as-control"));
  await page.waitForTimeout(3400);
  await page.screenshot({ path: outputPath("prototype-benchmark-desktop.png") });
  evidence.benchmark = benchmarkResult ? {
    presentation_gate: benchmarkResult.gate,
    repository: benchmarkResult.candidate?.snapshot.repository,
    source_mode: benchmarkResult.candidate?.snapshot.source_mode,
    source_commit_sha: benchmarkResult.candidate?.snapshot.commit_sha,
    captured_at: benchmarkResult.candidate?.snapshot.captured_at,
    total_score: benchmarkResult.candidate?.totalScore,
    categories: benchmarkResult.categories,
    receipt_hash: benchmarkResult.receipt?.receipt_hash,
    ui_score: await page.locator("[data-benchmark-score]").textContent(),
    ui_signal_count: await page.locator("[data-signal-inspector] li").count()
  } : null;
  evidence.layout.benchmark_desktop = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight
  }));
  await page.evaluate(() => window.SemeAICinematicEngine.resetPerformance());
  await page.waitForTimeout(1800);
  evidence.performance.benchmark = await page.evaluate(() => window.SemeAICinematicEngine.getPerformance());
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" });
  const mobilePage = await mobile.newPage();
  watchErrors(mobilePage);
  await mobilePage.goto(`${origin}/cinematic-engine/`, { waitUntil: "networkidle" });
  await setEnglish(mobilePage);
  await mobilePage.screenshot({ path: outputPath("prototype-field-mobile.png"), fullPage: true });
  evidence.layout.field_mobile = await mobilePage.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight
  }));
  await mobilePage.evaluate(() => window.SemeAICinematicEngine.setScene("gate"));
  await mobilePage.evaluate(() => window.SemeAICinematicEngine.runGate("unsupported_claim"));
  await mobilePage.waitForTimeout(1900);
  await mobilePage.screenshot({ path: outputPath("prototype-gate-review-mobile.png"), fullPage: true });
  evidence.layout.gate_mobile = await mobilePage.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight
  }));
  await mobilePage.evaluate(() => window.SemeAICinematicEngine.setScene("benchmark"));
  const mobileBenchmark = await mobilePage.evaluate(() => window.SemeAICinematicEngine.runBenchmark("SemeAIPletinnya/silence-as-control"));
  await mobilePage.waitForTimeout(3400);
  await mobilePage.screenshot({ path: outputPath("prototype-benchmark-mobile.png"), fullPage: true });
  evidence.layout.benchmark_mobile = await mobilePage.evaluate((resultAvailable) => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    score: document.querySelector("[data-benchmark-score]")?.textContent,
    categoryCount: document.querySelectorAll("[data-signal-inspector] li").length,
    resultAvailable
  }), Boolean(mobileBenchmark));
  await mobile.close();

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce", locale: "en-US" });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(`${origin}/cinematic-engine/`, { waitUntil: "networkidle" });
  await reducedPage.waitForTimeout(400);
  evidence.performance.reduced_motion = await reducedPage.evaluate(() => ({
    state: window.SemeAICinematicEngine.getState(),
    performance: window.SemeAICinematicEngine.getPerformance()
  }));
  await reduced.close();

  const noJs = await browser.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
  const noJsPage = await noJs.newPage();
  await noJsPage.goto(`${origin}/cinematic-engine/`, { waitUntil: "load" });
  await noJsPage.screenshot({ path: outputPath("prototype-no-js-contract.png"), fullPage: true });
  evidence.no_js = {
    text: await noJsPage.locator(".nojs-contract").innerText(),
    gateContractReadable: (await noJsPage.locator(".nojs-contract").innerText()).includes("Gate remains the final release authority")
  };
  await noJs.close();

  const fieldVideoContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    recordVideo: { dir: outputDirectory, size: { width: 1440, height: 900 } }
  });
  const fieldVideoPage = await fieldVideoContext.newPage();
  await fieldVideoPage.goto(`${origin}/cinematic-engine/`, { waitUntil: "networkidle" });
  await setEnglish(fieldVideoPage);
  for (const point of [[320, 500], [560, 470], [750, 510], [890, 490], [960, 510], [740, 560]]) {
    await fieldVideoPage.mouse.move(point[0], point[1], { steps: 26 });
    await fieldVideoPage.waitForTimeout(520);
  }
  await fieldVideoPage.waitForTimeout(1100);
  await saveVideo(fieldVideoContext, fieldVideoPage, "prototype-release-field-desktop.webm");

  const gateVideoContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    recordVideo: { dir: outputDirectory, size: { width: 1440, height: 900 } }
  });
  const gateVideoPage = await gateVideoContext.newPage();
  await gateVideoPage.goto(`${origin}/cinematic-engine/#gate`, { waitUntil: "networkidle" });
  await setEnglish(gateVideoPage);
  await gateVideoPage.waitForTimeout(900);
  for (const scenario of ["supported_answer", "unsupported_claim", "fake_promo_code", "__error__"]) {
    await gateVideoPage.evaluate((selected) => window.SemeAICinematicEngine.runGate(selected), scenario);
    await gateVideoPage.waitForTimeout(scenario === "supported_answer" ? 2900 : 2500);
  }
  await saveVideo(gateVideoContext, gateVideoPage, "prototype-gate-four-fates-desktop.webm");

  const benchmarkVideoContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    recordVideo: { dir: outputDirectory, size: { width: 1440, height: 900 } }
  });
  const benchmarkVideoPage = await benchmarkVideoContext.newPage();
  await benchmarkVideoPage.goto(`${origin}/cinematic-engine/#benchmark`, { waitUntil: "networkidle" });
  await setEnglish(benchmarkVideoPage);
  await benchmarkVideoPage.waitForTimeout(900);
  await benchmarkVideoPage.evaluate(() => window.SemeAICinematicEngine.runBenchmark("SemeAIPletinnya/silence-as-control"));
  await benchmarkVideoPage.waitForTimeout(4700);
  await saveVideo(benchmarkVideoContext, benchmarkVideoPage, "prototype-benchmark-seven-signal-desktop.webm");

  const continuityVideoContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "en-US",
    recordVideo: { dir: outputDirectory, size: { width: 390, height: 844 } }
  });
  const continuityPage = await continuityVideoContext.newPage();
  await continuityPage.goto(`${origin}/cinematic-engine/`, { waitUntil: "networkidle" });
  await setEnglish(continuityPage);
  await continuityPage.waitForTimeout(1100);
  await continuityPage.evaluate(() => window.SemeAICinematicEngine.setScene("gate"));
  await continuityPage.waitForTimeout(900);
  await continuityPage.evaluate(() => window.SemeAICinematicEngine.runGate("unsupported_claim"));
  await continuityPage.waitForTimeout(2400);
  await continuityPage.evaluate(() => window.SemeAICinematicEngine.setScene("benchmark"));
  await continuityPage.waitForTimeout(900);
  await continuityPage.evaluate(() => window.SemeAICinematicEngine.runBenchmark("SemeAIPletinnya/silence-as-control"));
  await continuityPage.waitForTimeout(4300);
  await saveVideo(continuityVideoContext, continuityPage, "prototype-route-continuity-mobile.webm");

  const evidencePath = outputPath("rendered-evidence.json");
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  const manifest = [];
  for (const name of generated) {
    const content = await readFile(path.join(outputDirectory, name));
    manifest.push({ name, bytes: content.length, sha256: createHash("sha256").update(content).digest("hex") });
  }
  const manifestPath = path.join(outputDirectory, "artifact-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify({ captured_at: evidence.captured_at, artifacts: manifest }, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputDirectory, evidence, artifacts: manifest }, null, 2)}\n`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
