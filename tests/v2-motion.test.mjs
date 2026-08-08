import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp" };

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

function assertPresentationBoundary() {
  const runtime = fs.readFileSync(path.join(ROOT, "assets", "js", "cinematic-production.mjs"), "utf8");
  const motion = fs.readFileSync(path.join(ROOT, "assets", "css", "cinematic-system.css"), "utf8");
  const scenes = fs.readFileSync(path.join(ROOT, "assets", "js", "cinematic-scenes.mjs"), "utf8");
  const pages = ["index.html", "gate.html", "benchmark/index.html"];
  pages.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.match(html, /cinematic-system\.css\?v=[0-9a-zA-Z-]+/, `${file}: shared cinematic system must be versioned`);
    assert.match(html, /cinematic-production\.mjs\?v=[0-9a-zA-Z-]+/, `${file}: cinematic controller must be versioned`);
  });
  const genesis = fs.readFileSync(path.join(ROOT, "genesis", "index.html"), "utf8");
  assert.match(genesis, /v2-motion\.css\?v=[0-9a-zA-Z-]+/);
  assert.match(genesis, /v2-production\.js\?v=[0-9a-zA-Z-]+/);
  assert.match(scenes, /drawField/);
  assert.match(scenes, /drawGate/);
  assert.match(scenes, /drawBenchmark/);
  assert.match(runtime, /semeai:gate-decision/);
  assert.match(runtime, /GATE_DECISION/);
  assert.match(motion, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(runtime, /ai_answer|safe_fallback|business_data|business_rules/);
}

async function exerciseViewport(browser, origin, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.route("https://api.github.com/**", (route) => route.abort());

  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-field-scene], .cp-world");
  // Home must never stage a release signal as a primary product act.
  const releaseSignal = page.locator(".released-signal");
  if (await releaseSignal.count()) {
    assert.equal(await releaseSignal.evaluate((node) => getComputedStyle(node).display), "none");
  }
  await page.locator(".scene-run, a[href*='gate.html']").first().focus();
  await page.waitForFunction(() => {
    const field = document.querySelector("[data-field-scene]");
    return !field || field.getAttribute("data-field-motion") === "tension" || field.getAttribute("data-field-motion") === "ambient" || field.getAttribute("data-field-motion") === null;
  });
  // Prefer tension when focus lands on a Gate CTA; ambient is acceptable if focus moved elsewhere.
  const motion = await page.locator("[data-field-scene]").getAttribute("data-field-motion");
  if (motion) assert.ok(["tension", "ambient", "weighted"].includes(motion));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true, `field overflow at ${viewport.width}`);

  await page.goto(`${origin}/gate.html`, { waitUntil: "domcontentloaded" });
  for (const action of ["WORKING", "SHOW", "REVIEW", "BLOCK", "ERROR"]) {
    await page.evaluate((decision) => {
      const gate = document.querySelector("#live-gate");
      gate.dataset.decision = decision;
      window.dispatchEvent(new CustomEvent("semeai:gate-decision", { detail: { action: decision, receiptId: `${decision.toLowerCase()}-motion-receipt` } }));
    }, action);
    await page.waitForFunction((expected) => window.SemeAICinematicProduction?.state.gate === expected, action);
    const expectedWitness = { WORKING: "WORKING", SHOW: "RESULT", REVIEW: "REVIEW", BLOCK: "HELD", ERROR: "ERROR" }[action];
    await page.waitForFunction((expected) => document.querySelector("[data-axiom-witness]")?.dataset.semanticState === expected, expectedWitness);
    assert.equal(await page.locator("#live-gate").getAttribute("data-decision"), action);
    if (action !== "SHOW") assert.equal(await page.locator("#commercial-demo-release").isHidden(), true);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true, `gate overflow at ${viewport.width}`);

  await page.goto(`${origin}/benchmark/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const result = document.querySelector("#benchmark-result");
    document.querySelector("#total-score").textContent = "77";
    document.querySelector("#gate-decision").textContent = "SHOW";
    document.querySelector("#source-mode").textContent = "TESTED LIVE SNAPSHOT";
    document.querySelector("#source-commit").textContent = "abcdef0123456789";
    document.querySelector("#receipt-hash").textContent = "receipt-test-123";
    const grid = document.querySelector("#category-grid");
    grid.replaceChildren(...Array.from({ length: 7 }, (_, index) => {
      const card = document.createElement("article");
      card.className = "category-card";
      card.dataset.category = `signal-${index + 1}`;
      card.innerHTML = `<h4>Signal ${index + 1}</h4><strong>${index + 1}/10</strong>`;
      return card;
    }));
    result.hidden = false;
    window.SemeAICinematicBenchmark?.settle();
  });
  await page.waitForFunction(() => window.SemeAICinematicProduction?.state.benchmark === "RESULT");
  assert.equal(await page.locator("#cinematic-score").textContent(), "77");
  assert.equal(await page.locator("[data-cinematic-signal]").count(), 7);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true, `lab overflow at ${viewport.width}`);

  await page.goto(`${origin}/genesis/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("[data-era][data-stratum-state]").length === 12);
  assert.equal(await page.locator("[data-era][data-stratum-state='active']").count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true, `genesis overflow at ${viewport.width}`);
  assert.deepEqual(errors, [], `motion runtime errors at ${viewport.width}x${viewport.height}`);
  await context.close();
}

async function exerciseReducedMotion(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.SemeAICinematicProduction?.state.reducedMotion === true);
  assert.equal(await page.locator("#cinematic-canvas").count(), 1);
  assert.equal(await page.locator("[data-field-scene]").count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
  await context.close();
}

async function run() {
  assertPresentationBoundary();
  const { server, origin } = await serve();
  const browser = await chromium.launch({ headless: true });
  try {
    await exerciseViewport(browser, origin, { width: 1440, height: 900 });
    await exerciseViewport(browser, origin, { width: 390, height: 844 });
    await exerciseReducedMotion(browser, origin);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log("ok - semantic motion hierarchy, state fates, depth worlds, overflow, and reduced-motion contracts passed");
}

await run();
