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
  const runtime = fs.readFileSync(path.join(ROOT, "assets", "js", "v2-production.js"), "utf8");
  const motion = fs.readFileSync(path.join(ROOT, "assets", "css", "v2-motion.css"), "utf8");
  const pages = ["index.html", "gate.html", "benchmark/index.html", "genesis/index.html"];
  pages.forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.match(html, /v2-motion\.css\?v=20260801-motion-v1/, `${file}: semantic motion layer must be present`);
    assert.match(html, /v2-production\.js\?v=20260801-motion-v1/, `${file}: semantic runtime must be versioned`);
  });
  assert.match(motion, /Home is a topology, never a staged release/);
  assert.match(motion, /\.release-field--production \.released-signal\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(motion, /data-decision="REVIEW"[^}]*\.aperture-release[\s\S]*opacity:\s*0\s*!important/);
  assert.match(motion, /prefers-reduced-motion:\s*reduce/);
  assert.match(runtime, /receipt_id:\s*event\.detail\?\.receiptId\s*\|\|\s*null/);
  assert.doesNotMatch(runtime, /ai_answer|safe_fallback|business_data|business_rules/);
  assert.doesNotMatch(runtime, /textContent\s*=|innerText\s*=/, "motion runtime must not write user-visible content");
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
  await page.waitForSelector(".field-topology");
  assert.equal(await page.locator(".released-signal").evaluate((node) => getComputedStyle(node).display), "none");
  await page.locator(".scene-run").focus();
  assert.equal(await page.locator("[data-field-scene]").getAttribute("data-field-motion"), "tension");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true, `field overflow at ${viewport.width}`);

  await page.goto(`${origin}/gate.html`, { waitUntil: "domcontentloaded" });
  for (const action of ["WORKING", "SHOW", "REVIEW", "BLOCK", "ERROR"]) {
    await page.evaluate((decision) => {
      const gate = document.querySelector("#live-gate");
      gate.dataset.decision = decision;
      window.dispatchEvent(new CustomEvent("semeai:gate-decision", { detail: { action: decision, receiptId: `${decision.toLowerCase()}-motion-receipt` } }));
    }, action);
    if (action === "WORKING") {
      await page.waitForFunction(() => document.querySelector("#live-gate")?.dataset.motionPhase === "authority");
      assert.equal(await page.locator("[data-machine-step='receipt']").evaluate((node) => node.classList.contains("is-active")), false);
    } else {
      await page.waitForFunction(() => document.querySelector("#live-gate")?.dataset.motionPhase === "settled");
      assert.equal(await page.locator("#live-gate").getAttribute("data-decision"), action);
      if (action !== "SHOW") assert.equal(await page.locator(".aperture-release").evaluate((node) => getComputedStyle(node).opacity), "0");
    }
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true, `gate overflow at ${viewport.width}`);

  await page.goto(`${origin}/benchmark/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const result = document.querySelector("#benchmark-result");
    result.dataset.gate = "SHOW";
    result.hidden = false;
  });
  await page.waitForFunction(() => document.body.dataset.evidencePhase === "settled");
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
  assert.equal(await page.locator("html").getAttribute("data-motion"), "reduced");
  assert.equal(await page.locator(".world-canvas").evaluate((node) => getComputedStyle(node).display), "none");
  assert.equal(await page.locator("[data-v2-reveal]").first().getAttribute("data-revealed"), "true");
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
