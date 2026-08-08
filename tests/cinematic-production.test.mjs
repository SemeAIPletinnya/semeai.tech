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
  const bench = fs.readFileSync(path.join(ROOT, "benchmark", "index.html"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "assets", "css", "cinematic-system.css"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "assets", "js", "cinematic-production.mjs"), "utf8");
  const controller = fs.readFileSync(path.join(ROOT, "assets", "js", "commercial-gate-demo.js"), "utf8");

  // Structural rebuild markers
  assert.match(home, /class="cinematic-production"/);
  assert.match(home, /cinematic-system\.css/);
  assert.match(home, /cinematic-production\.mjs/);
  assert.match(home, /world--field|production-world/);
  assert.match(home, /Possibility has weight/i);
  assert.doesNotMatch(home, /id="live-gate"|data-decision-trigger|data-home-outcome/);
  assert.match(home, /data-field-scene/);

  assert.match(gate, /class="cinematic-production"/);
  assert.match(gate, /gate-console|gate-terminal/);
  assert.match(gate, /id="live-gate"/);
  assert.match(gate, /id="commercial-demo-release"[^>]*hidden/);
  assert.match(gate, /id="commercial-demo-run"/);
  assert.match(gate, /One boundary/i);

  assert.match(bench, /class="cinematic-production"/);
  assert.match(bench, /cinematic-benchmark-result|signal-inspector|benchmark-console/);
  assert.match(bench, /id="benchmark-form"/);
  assert.match(bench, /id="repository-input"/);
  assert.match(bench, /id="benchmark-result"/);
  assert.match(bench, /SEVEN SIGNALS/i);

  // Authority boundaries in presentation runtime
  assert.doesNotMatch(js, /ai_answer|safe_fallback|heldCopy|answer_hash\s*=/);
  assert.doesNotMatch(css, /ai_answer/);
  assert.doesNotMatch(controller, /ai_answer|business_data|business_rules|safe_fallback|heldCopy/);

  const { server, origin } = await serve();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await page.route("https://fonts.gstatic.com/**", (r) => r.abort());

    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    const homeState = await page.evaluate(() => ({
      canvas: Boolean(document.querySelector(".cinematic-canvas")),
      field: Boolean(document.querySelector("[data-field-scene]")),
      liveGate: Boolean(document.querySelector("#live-gate")),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      title: document.querySelector("#field-title")?.textContent?.replace(/\s+/g, " ") || "",
    }));
    assert.equal(homeState.liveGate, false, "Home must not host live Gate");
    assert.equal(homeState.field, true);
    assert.equal(homeState.canvas, true);
    assert.equal(homeState.overflow, false);
    assert.match(homeState.title, /weight|Possibility|вагу|Можливість|вес|Возможность/i);

    await page.goto(`${origin}/gate.html`, { waitUntil: "domcontentloaded" });
    const gateState = await page.evaluate(() => ({
      console: Boolean(document.querySelector(".gate-console")),
      terminal: Boolean(document.querySelector(".gate-terminal")),
      decision: document.querySelector("#live-gate")?.dataset.decision,
      releaseHidden: document.querySelector("#commercial-demo-release")?.hidden !== false,
      apertureY: document.querySelector(".gate-authority")?.getBoundingClientRect().y ?? 9999,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    }));
    assert.equal(gateState.console, true);
    assert.equal(gateState.terminal, true);
    assert.equal(gateState.decision, "IDLE");
    assert.equal(gateState.releaseHidden, true);
    assert.ok(gateState.apertureY < 900, "threshold geometry stays in first viewport");
    assert.equal(gateState.overflow, false);

    // Gate does not auto-run
    await page.waitForTimeout(400);
    assert.equal(await page.locator("#live-gate").getAttribute("data-decision"), "IDLE");

    await page.goto(`${origin}/benchmark/`, { waitUntil: "domcontentloaded" });
    const benchState = await page.evaluate(() => ({
      form: Boolean(document.querySelector("#benchmark-form")),
      scorePanel: Boolean(document.querySelector(".cinematic-benchmark-result")),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    }));
    assert.equal(benchState.form, true);
    assert.equal(benchState.scorePanel, true);
    assert.equal(benchState.overflow, false);

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const m = await mobile.newPage();
    await m.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await m.route("https://fonts.gstatic.com/**", (r) => r.abort());
    for (const route of ["/", "/gate.html", "/benchmark/"]) {
      await m.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
      const overflow = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      assert.equal(overflow, false, `overflow at ${route} mobile`);
    }

    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const n = await noJs.newPage();
    await n.goto(`${origin}/`, { waitUntil: "load" });
    const text = await n.locator("body").innerText();
    assert.match(text, /Possibility has weight|release|Gate|boundary/i);

    await page.context().close();
    await mobile.close();
    await noJs.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log("cinematic production integration contracts: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
