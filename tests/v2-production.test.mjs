import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATE = "Use promo code SAVE30 to get 30% off.";
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

const terminalFixtures = [
  {
    name: "show",
    expected: "SHOW",
    response: { action: "SHOW", internal_decision: "PROCEED", show_to_user: true, audit_preserved: true, reason: "Supported fixture.", audit_id: "show-receipt", answer_hash: "6ca851aa85f2cf479fc2562dab09195e91229d17290720682aa0ae604bffb3e8" },
  },
  {
    name: "review",
    expected: "REVIEW",
    response: { action: "REVIEW", internal_decision: "NEEDS_REVIEW", show_to_user: false, audit_preserved: true, reason: "Review fixture.", audit_id: "review-receipt", ai_answer: "LEAK-ME-REVIEW" },
  },
  {
    name: "block",
    expected: "BLOCK",
    response: { action: "BLOCK", internal_decision: "SILENCE", show_to_user: false, audit_preserved: true, reason: "Blocked fixture.", audit_id: "block-receipt", ai_answer: "LEAK-ME-BLOCK" },
  },
  {
    name: "unknown",
    expected: "ERROR",
    response: { action: "MAYBE", internal_decision: "PROCEED", reason: "Malformed fixture.", ai_answer: "LEAK-ME-UNKNOWN" },
  },
  {
    name: "show-hash-mismatch",
    expected: "ERROR",
    response: { action: "SHOW", internal_decision: "PROCEED", show_to_user: true, audit_preserved: true, reason: "Mismatched fixture.", audit_id: "mismatch-receipt", answer_hash: "0".repeat(64), ai_answer: "LEAK-ME-MISMATCH" },
  },
];

async function run() {
  const home = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const gate = fs.readFileSync(path.join(ROOT, "gate.html"), "utf8");
  const controller = fs.readFileSync(path.join(ROOT, "assets", "js", "commercial-gate-demo.js"), "utf8");
  const benchmark = fs.readFileSync(path.join(ROOT, "benchmark", "index.html"), "utf8");
  const benchmarkRuntime = fs.readFileSync(path.join(ROOT, "benchmark", "assets", "benchmark.js"), "utf8");
  const genesisRuntime = fs.readFileSync(path.join(ROOT, "genesis", "assets", "genesis.js"), "utf8");

  assert.match(home, /data-v2-world="field"/);
  assert.doesNotMatch(home, /data-decision-trigger|data-home-outcome|id="live-gate"/);
  assert.match(gate, /data-v2-world="gate"/);
  assert.match(gate, /id="commercial-demo-release"[^>]*hidden/);
  assert.doesNotMatch(controller, /ai_answer|business_data|business_rules|safe_fallback|heldCopy/);
  assert.equal((controller.match(new RegExp(CANDIDATE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1, "Only the supported pre-gate fixture may exist in the controller");
  assert.match(controller, /receipt_id: data\.receipt_id \|\| data\.audit_id \|\| null/);
  assert.doesNotMatch(benchmark, />\s*46\s*</);
  assert.doesNotMatch(benchmarkRuntime, /TASK-ANCHORED RESULT|frozen task anchor/i);
  assert.match(benchmarkRuntime, /api\.github\.com/);
  assert.match(genesisRuntime, /state === "ADMITTED"/);

  const { server, origin } = await serve();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const fixture of terminalFixtures) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const requests = [];
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
      await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
      await page.route("https://api.semeai.tech/v0/demo/check", async (route) => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture.response) });
      });
      await page.goto(`${origin}/gate.html`, { waitUntil: "domcontentloaded" });
      assert.equal(requests.length, 0, `${fixture.name}: Gate must not run automatically`);
      await page.locator("#commercial-demo-run").click({ force: true });
      await page.waitForFunction((expected) => document.querySelector("#live-gate")?.dataset.decision === expected, fixture.expected);
      const expectedAxiom = { SHOW: "RESULT", REVIEW: "REVIEW", BLOCK: "HELD", ERROR: "ERROR" }[fixture.expected];
      await page.waitForFunction((expected) => document.querySelector("[data-axiom-agent]")?.dataset.semanticState === expected, expectedAxiom);
      assert.deepEqual(requests, [{ scenario_id: "supported_answer" }], `${fixture.name}: only scenario_id may cross the public request boundary`);
      const state = await page.evaluate(({ candidate, expected }) => ({
        releaseHidden: document.querySelector("#commercial-demo-release").hidden,
        answer: document.querySelector("#commercial-demo-answer").textContent,
        bodyHasCandidate: document.body.textContent.includes(candidate),
        bodyHasLeakMarker: document.body.textContent.includes("LEAK-ME-"),
        receiptHasLeakMarker: document.querySelector("#commercial-demo-json").textContent.includes("LEAK-ME-"),
        decision: document.querySelector("#live-gate").dataset.decision,
        axiomSemantic: document.querySelector("[data-axiom-agent]")?.dataset.semanticState,
        expected,
      }), { candidate: CANDIDATE, expected: fixture.expected });
      assert.equal(state.decision, fixture.expected);
      assert.equal(state.axiomSemantic, expectedAxiom, `${fixture.name}: Axiom should witness the terminal state without deciding it`);
      assert.equal(state.releaseHidden, fixture.expected !== "SHOW");
      assert.equal(state.answer, fixture.expected === "SHOW" ? CANDIDATE : "");
      assert.equal(state.bodyHasCandidate, fixture.expected === "SHOW");
      assert.equal(state.bodyHasLeakMarker, false, `${fixture.name}: response candidate-like content must never reach the DOM`);
      assert.equal(state.receiptHasLeakMarker, false, `${fixture.name}: receipt view must whitelist decision metadata`);
      assert.deepEqual(errors, [], `${fixture.name}: browser controller should remain error-free`);
      await context.close();
    }

    const errorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const errorPage = await errorContext.newPage();
    await errorPage.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await errorPage.route("https://fonts.gstatic.com/**", (route) => route.abort());
    await errorPage.route("https://api.semeai.tech/v0/demo/check", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Unavailable", ai_answer: "LEAK-ME-503" }) }));
    await errorPage.goto(`${origin}/gate.html`, { waitUntil: "domcontentloaded" });
    await errorPage.locator("#commercial-demo-run").click({ force: true });
    await errorPage.waitForFunction(() => document.querySelector("#live-gate")?.dataset.decision === "ERROR");
    assert.equal(await errorPage.locator("#commercial-demo-release").isHidden(), true);
    assert.equal(await errorPage.locator("#commercial-demo-answer").textContent(), "");
    assert.equal((await errorPage.locator("body").innerText()).includes("LEAK-ME-503"), false);
    await errorContext.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("ok - production V2 Gate, Benchmark, Genesis, and leakage contracts passed");
}

await run();
