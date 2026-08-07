import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mjs": "text/javascript",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function serve() {
  const server = http.createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, "http://local").pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.resolve(ROOT, `.${pathname}`);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end("not found");
      return;
    }
    response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function run() {
  const home = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const gate = fs.readFileSync(path.join(ROOT, "gate.html"), "utf8");
  const benchmark = fs.readFileSync(path.join(ROOT, "benchmark", "index.html"), "utf8");
  const cinematic = fs.readFileSync(path.join(ROOT, "cinematic-engine", "index.html"), "utf8");
  const productCss = fs.readFileSync(path.join(ROOT, "assets", "css", "product-cinematic.css"), "utf8");
  const productJs = fs.readFileSync(path.join(ROOT, "assets", "js", "product-cinematic.js"), "utf8");
  const controller = fs.readFileSync(path.join(ROOT, "assets", "js", "commercial-gate-demo.js"), "utf8");

  // Production product language (not prototype isolation theater).
  assert.match(home, /Possibility has weight/i);
  assert.match(home, /core-product\.css|product-cinematic\.css/);
  assert.match(home, /core-product\.js|product-cinematic\.js|cp-chain|pc-thesis/);
  assert.match(home, /MODEL|GATE|RECEIPT|AXIOM/i);
  assert.doesNotMatch(home, /ISOLATED PROOF|NO PR \/ NO DEPLOY|FROZEN PRODUCTION/i);

  assert.match(gate, /One boundary/i);
  assert.match(gate, /Four physical fates/i);
  assert.match(gate, /core-product\.css|product-cinematic\.css/);
  assert.match(gate, /id="live-gate"/);
  assert.match(gate, /id="commercial-demo-release"[^>]*hidden/);

  assert.match(benchmark, /SEVEN SIGNALS/i);
  assert.match(benchmark, /ONE ASSEMBLED TRACE/i);
  assert.match(benchmark, /core-product\.css|product-cinematic\.css/);

  // Archived cinematic study no longer markets itself as production product.
  assert.doesNotMatch(cinematic, /ISOLATED PROOF|NO PR \/ NO DEPLOY|OPEN FROZEN PRODUCTION/i);
  assert.match(cinematic, /ARCHIVED INTERACTION STUDY|HISTORICAL INTERACTION ARCHIVE/i);
  assert.match(cinematic, /OPEN THE LIVE PRODUCT GATE/i);

  // Presentation layer only — no Gate authority mutation or candidate fabrication.
  assert.doesNotMatch(productJs, /ai_answer|safe_fallback|heldCopy|answer_hash\s*=/);
  assert.doesNotMatch(productCss, /ai_answer/);
  assert.doesNotMatch(controller, /ai_answer|business_data|business_rules|safe_fallback|heldCopy/);

  // Homepage must not embed a live Gate (authority stays on gate.html).
  assert.doesNotMatch(home, /id="live-gate"|data-decision-trigger|data-home-outcome/);

  const { server, origin } = await serve();
  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desktop.newPage();
    await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-field-scene], .cp-world, .pc-thesis", { timeout: 8000 });
    const homeState = await page.evaluate(() => ({
      structure: Boolean(document.querySelector(".cp-world, .pc-thesis, [data-field-scene]")),
      field: Boolean(document.querySelector("[data-field-scene]")),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      hasLiveGate: Boolean(document.querySelector("#live-gate")),
      h1: document.querySelector("#field-title")?.textContent?.replace(/\s+/g, " ").trim() || "",
    }));
    assert.equal(homeState.structure, true);
    assert.equal(homeState.field, true);
    assert.equal(homeState.hasLiveGate, false);
    assert.equal(homeState.overflowX, false);
    assert.match(homeState.h1, /weight|Possibility|вагу|Можливість|вес|Возможность/i);

    await page.goto(`${origin}/gate.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#commercial-demo-run, .cp-gate-terminal", { timeout: 8000 });
    const gateState = await page.evaluate(() => ({
      chamber: Boolean(document.querySelector(".cp-gate-terminal, .pc-fate-legend, #live-gate")),
      decision: document.querySelector("#live-gate")?.dataset.decision || "",
      releaseHidden: document.querySelector("#commercial-demo-release")?.hidden !== false,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    }));
    assert.equal(gateState.chamber, true);
    assert.equal(gateState.decision, "IDLE");
    assert.equal(gateState.releaseHidden, true);
    assert.equal(gateState.overflowX, false);

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobile.newPage();
    await mobilePage.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await mobilePage.route("https://fonts.gstatic.com/**", (route) => route.abort());
    await mobilePage.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    const mobileHome = await mobilePage.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      structure: Boolean(document.querySelector(".cp-world, .pc-thesis, [data-field-scene]")),
    }));
    assert.equal(mobileHome.overflowX, false);
    assert.equal(mobileHome.structure, true);

    await mobilePage.goto(`${origin}/gate.html`, { waitUntil: "domcontentloaded" });
    const mobileGate = await mobilePage.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      runVisible: Boolean(document.querySelector("#commercial-demo-run")),
    }));
    assert.equal(mobileGate.overflowX, false);
    assert.equal(mobileGate.runVisible, true);

    // Reduced motion still mounts product structure.
    const reduced = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const reducedPage = await reduced.newPage();
    await reducedPage.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await reducedPage.route("https://fonts.gstatic.com/**", (route) => route.abort());
    await reducedPage.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    assert.ok((await reducedPage.locator(".cp-world, .pc-thesis, [data-field-scene]").count()) >= 1);

    // No-JS contract remains readable on home.
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const noJsPage = await noJs.newPage();
    await noJsPage.goto(`${origin}/`, { waitUntil: "load" });
    const noJsText = await noJsPage.locator("body").innerText();
    assert.match(noJsText, /Possibility has weight|release-control|Gate/i);
    assert.doesNotMatch(noJsText, /ISOLATED PROOF|NO PR \/ NO DEPLOY/i);

    await desktop.close();
    await mobile.close();
    await reduced.close();
    await noJs.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log("product-cinematic contracts: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
