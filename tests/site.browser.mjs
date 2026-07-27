import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, "..");
const requireFromTest = createRequire(import.meta.url);

const ROUTES = [
  "/",
  "/genesis/",
  "/gate.html",
  "/benchmark/",
  "/book/",
  "/research.html",
  "/roadmap/",
  "/dashboard.html",
  "/account/",
  "/workspace/",
  "/account.html",
];

const VIEWPORTS = [
  [360, 800],
  [390, 844],
  [844, 390],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
];

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xml": "application/xml",
};

const PRODUCT_FIXTURE = {
  account: {
    authenticated: true,
    auth_mode: "password_session",
    workspace_id: "ws_evidence_lab",
    workspace_name: "Evidence Lab",
    email: "owner@example.test",
    subscription: { tier: "pilot" },
    billing: { status: "active" },
  },
  usage: {
    workspace_id: "ws_evidence_lab",
    checks_today: 7,
    daily_limit: 50,
    remaining_today: 43,
  },
  billing: { status: "active", provider: "operator_review" },
  receipts: {
    count: 4,
    receipts: [
      {
        receipt_id: "receipt_show_<img src=x onerror=window.__unsafe=1>",
        receipt_type: "decision",
        timestamp: "2026-07-26T09:00:00Z",
        action: "SHOW",
        internal_decision: "PROCEED",
        path: "D:\\private\\must-not-render.json",
      },
      {
        receipt_id: "receipt_review",
        receipt_type: "decision",
        timestamp: "2026-07-26T08:00:00Z",
        action: "REVIEW",
        internal_decision: "NEEDS_REVIEW",
      },
      {
        receipt_id: "receipt_block",
        receipt_type: "decision",
        timestamp: "2026-07-26T07:00:00Z",
        action: "BLOCK",
        internal_decision: "SILENCE",
      },
      {
        receipt_id: "receipt_unclassified",
        receipt_type: "decision",
        timestamp: "2026-07-26T06:00:00Z",
        action: "UNKNOWN",
        internal_decision: "UNCLASSIFIED",
      },
    ],
  },
};

function loadPlaywright() {
  try {
    return requireFromTest("playwright");
  } catch (_error) {
    // Continue through the bundled runtime roots.
  }

  const roots = [
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

  for (const root of roots) {
    try {
      return requireFromTest(path.join(root, "playwright"));
    } catch (_error) {
      // Try the next bundled root.
    }
  }

  throw new Error("Playwright is required for tests/site.browser.mjs");
}

async function startServer() {
  const server = http.createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, "http://local").pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.resolve(ROOT, `.${pathname}`);

    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404);
      response.end("not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(response);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    server,
  };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function expectedPath(route) {
  if (route === "/account.html" || route === "/workspace/") return "/account/";
  return route;
}

async function loadTailwindRuntime() {
  const response = await fetch("https://cdn.tailwindcss.com");
  assert.equal(response.ok, true, "the existing homepage Tailwind runtime must remain available");
  return response.text();
}

async function wirePage(page, tailwindRuntime, errors) {
  await page.route("https://cdn.tailwindcss.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: tailwindRuntime,
    }),
  );
  await page.route("https://api.semeai.tech/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "BLOCK",
        internal_decision: "SILENCE",
        show_to_user: false,
        audit_preserved: true,
        reason: "Bounded regression fixture.",
      }),
    }),
  );

  page.on("pageerror", (error) => errors.push(`pageerror ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    errors.push(`requestfailed ${request.url()} ${request.failure()?.errorText || ""}`.trim());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
}

async function wireProductPage(page, errors, requests) {
  await page.route("https://api.semeai.tech/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const entry = {
      method: request.method(),
      path: `${url.pathname}${url.search}`,
      body: request.postDataJSON?.() ?? null,
      authorization: request.headers().authorization || "",
    };
    requests.push(entry);

    let body;
    if (url.pathname === "/v0/login") {
      body = {
        ...PRODUCT_FIXTURE.account,
        session_token: "session_login_fixture",
        session_expires_at: "2026-07-27T09:00:00Z",
      };
    } else if (url.pathname === "/v0/register") {
      body = { status: "pending_verification", verification: { email_sent: true } };
    } else if (url.pathname === "/v0/verify") {
      body = {
        ...PRODUCT_FIXTURE.account,
        session_token: "session_verify_fixture",
        api_key: "semeai_one_time_fixture_key",
      };
    } else if (url.pathname === "/v0/account") {
      body = PRODUCT_FIXTURE.account;
    } else if (url.pathname === "/v0/usage") {
      body = PRODUCT_FIXTURE.usage;
    } else if (url.pathname === "/v0/receipts") {
      body = PRODUCT_FIXTURE.receipts;
    } else if (url.pathname === "/v0/billing/status") {
      body = PRODUCT_FIXTURE.billing;
    } else if (url.pathname === "/v0/logout") {
      body = { status: "logged_out" };
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: `Unexpected product endpoint ${url.pathname}` }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  page.on("pageerror", (error) => errors.push(`pageerror ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    errors.push(`requestfailed ${request.url()} ${request.failure()?.errorText || ""}`.trim());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
}

async function loadRoute(page, origin, route) {
  await page.goto(`${origin}${route}${route.includes("?") ? "&" : "?"}lang=en`, {
    waitUntil: "load",
    timeout: 15_000,
  });
  if (route === "/account.html" || route === "/workspace/") {
    await page.waitForURL(/\/account\/(?:\?|$)/, { timeout: 3_000 });
  }
  await page.waitForTimeout(route === "/" ? 120 : 70);
}

async function validateMatrix(browser, origin, tailwindRuntime) {
  const results = [];

  for (const [width, height] of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width, height },
      locale: "en-US",
      colorScheme: "dark",
    });

    for (const route of ROUTES) {
      const page = await context.newPage();
      const errors = [];
      await wirePage(page, tailwindRuntime, errors);
      await loadRoute(page, origin, route);

      const state = await page.evaluate(() => {
        const visible = (element) => {
          if (!element) return false;
          const rectangle = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rectangle.width > 0 &&
            rectangle.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        };
        const burger = [...document.querySelectorAll(".nav-burger")].find(visible);
        const primary = [...document.querySelectorAll(".btn-primary,.primary-button,button")].find(
          visible,
        );
        const touchTarget = burger || primary;
        const rectangle = touchTarget?.getBoundingClientRect();

        return {
          path: location.pathname,
          lang: document.documentElement.lang,
          overflow:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
          mainVisible: visible(document.querySelector("main")),
          headingVisible: visible(document.querySelector("h1,h2")),
          navLinks: document.querySelectorAll("nav a[href]").length,
          touchTarget: rectangle
            ? { width: rectangle.width, height: rectangle.height }
            : null,
        };
      });

      assert.equal(state.path, expectedPath(route), `${route} should resolve to its expected path`);
      assert.equal(state.lang, "en", `${route} should honor the requested language`);
      assert.equal(state.overflow, 0, `${route} should not overflow at ${width}x${height}`);
      assert.equal(state.mainVisible, true, `${route} should expose visible main content`);
      assert.equal(state.headingVisible, true, `${route} should expose a visible heading`);
      assert.ok(state.navLinks >= 3, `${route} should retain route navigation`);
      assert.deepEqual(errors, [], `${route} should not emit browser or asset errors`);

      if (width <= 844 && state.touchTarget) {
        assert.ok(
          state.touchTarget.width >= 40 && state.touchTarget.height >= 40,
          `${route} should expose a usable primary touch target at ${width}x${height}`,
        );
      }

      results.push(`${route}@${width}x${height}`);
      await page.close();
    }

    await context.close();
  }

  return results;
}

async function validateInteraction(browser, origin, tailwindRuntime) {
  const results = [];

  for (const route of ROUTES.filter((candidate) => candidate !== "/account.html")) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "en-US",
    });
    const page = await context.newPage();
    const errors = [];
    await wirePage(page, tailwindRuntime, errors);
    await loadRoute(page, origin, route);

    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        body: element === document.body,
        outline: style.outlineStyle,
        shadow: style.boxShadow,
      };
    });
    assert.equal(focus.body, false, `${route} should provide a first keyboard focus target`);
    assert.notEqual(focus.tag, "HTML", `${route} should move focus into the document`);
    assert.ok(
      focus.outline !== "none" || focus.shadow !== "none",
      `${route} should expose visible keyboard focus`,
    );

    const burger = page.locator(".nav-burger:visible").first();
    if (await burger.count()) {
      const box = await burger.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44, `${route} burger should be 44px`);

      await burger.focus();
      await page.keyboard.press("Enter");
      assert.equal(await burger.getAttribute("aria-expanded"), "true");

      const mobileTargets = await page.locator(".mobile-link:visible,.mobile-lang .lang-btn:visible").evaluateAll(
        (elements) =>
          elements.map((element) => {
            const rectangle = element.getBoundingClientRect();
            return { width: rectangle.width, height: rectangle.height };
          }),
      );
      assert.ok(mobileTargets.length > 0, `${route} should expose mobile navigation targets`);
      assert.ok(
        mobileTargets.every(({ width, height }) => width >= 44 && height >= 44),
        `${route} mobile navigation targets should meet the 44px boundary`,
      );

      await page.keyboard.press("Escape");
      assert.equal(await burger.getAttribute("aria-expanded"), "false");
    }

    const uk = page.locator('[data-lang="uk"]:visible').first();
    if (await uk.count()) {
      await uk.click();
      assert.equal(await page.getAttribute("html", "lang"), "uk");
      await page.locator('[data-lang="en"]:visible').first().click();
      assert.equal(await page.getAttribute("html", "lang"), "en");
    }

    assert.deepEqual(errors, [], `${route} interactions should remain error-free`);
    results.push(route);
    await context.close();
  }

  return results;
}

async function validateDeepLinks(browser, origin, tailwindRuntime) {
  const cases = [
    ["/gate.html#semantics-title", "#semantics-title"],
    ["/research.html#research-posture-title", "#research-posture-title"],
    ["/book/#gate", "#gate"],
  ];
  const results = [];

  for (const [route, selector] of cases) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const errors = [];
    await wirePage(page, tailwindRuntime, errors);
    await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(route.startsWith("/book/") ? 220 : 250);

    const rectangle = await page.locator(selector).evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom };
    });
    assert.ok(
      rectangle.bottom > 0 && rectangle.top < 900,
      `${route} should reveal its target: ${JSON.stringify(rectangle)}`,
    );
    assert.deepEqual(errors, [], `${route} should load without errors`);
    results.push(route);
    await page.close();
  }

  return results;
}

async function validateNoJavaScript(browser, origin) {
  const results = [];

  for (const route of ROUTES) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      javaScriptEnabled: false,
      locale: "en-US",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto(`${origin}${route}`, { waitUntil: "load" });
    if (route === "/account.html") {
      await page.waitForURL(/\/account\/(?:\?|$)/, { timeout: 3_000 });
    }

    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      textLength: (document.querySelector("main") || document.body).innerText.trim().length,
      noscriptLength: document.querySelector("noscript")?.textContent.trim().length || 0,
      scenes: document.querySelectorAll("[data-scene]").length,
    }));

    assert.equal(state.overflow, 0, `${route} no-JS baseline should not overflow`);
    assert.ok(state.textLength >= 40, `${route} no-JS baseline should retain meaningful content`);
    assert.deepEqual(errors, [], `${route} no-JS baseline should not lose assets`);
    if (route === "/benchmark/") {
      assert.ok(state.noscriptLength >= 40, "Benchmark should withhold without its analyzer");
    }
    if (route === "/book/") {
      assert.ok(state.noscriptLength >= 40, "Book should explain its no-JS boundary");
    }
    if (route === "/account/" || route === "/workspace/") {
      assert.ok(state.noscriptLength >= 40, `${route} should explain its private-product no-JS boundary`);
    }
    if (route === "/genesis/") {
      assert.equal(state.scenes, 9, "Genesis should keep all nine scenes without JavaScript");
    }

    results.push(route);
    await context.close();
  }

  return results;
}

async function validateReducedMotion(browser, origin, tailwindRuntime) {
  const results = [];

  for (const route of ROUTES.filter((candidate) => candidate !== "/account.html")) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      locale: "en-US",
    });
    const page = await context.newPage();
    const errors = [];
    await page.addInitScript(() => {
      const nativeRequest = window.requestAnimationFrame.bind(window);
      let count = 0;
      window.requestAnimationFrame = (callback) =>
        nativeRequest((timestamp) => {
          count += 1;
          callback(timestamp);
        });
      window.__semeaiRafCount = () => count;
    });
    await wirePage(page, tailwindRuntime, errors);
    await loadRoute(page, origin, route);
    await page.waitForTimeout(360);

    const state = await page.evaluate(() => ({
      preference: matchMedia("(prefers-reduced-motion: reduce)").matches,
      rafCount: window.__semeaiRafCount(),
      genesisMotion: document.documentElement.classList.contains("motion-enabled"),
      maximumAnimationMs: [...document.querySelectorAll("*")].reduce((maximum, element) => {
        const durations = getComputedStyle(element)
          .animationDuration.split(",")
          .map((value) =>
            value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000,
          )
          .filter(Number.isFinite);
        return Math.max(maximum, ...durations, 0);
      }, 0),
    }));

    assert.equal(state.preference, true);
    assert.equal(state.genesisMotion, false, "Genesis motion should be disabled");
    assert.ok(state.maximumAnimationMs <= 10, `${route} should collapse CSS animation`);
    assert.ok(state.rafCount <= 5, `${route} should not retain a requestAnimationFrame loop`);
    assert.deepEqual(errors, [], `${route} reduced-motion state should remain error-free`);
    results.push({
      route,
      rafCount: state.rafCount,
      maximumAnimationMs: state.maximumAnimationMs,
    });
    await context.close();
  }

  return results;
}

async function validateAccountWorkspaceFoundation(browser, origin) {
  const results = [];

  async function openProductPage({
    route,
    viewport = { width: 1440, height: 900 },
    token = "",
    reducedMotion = "no-preference",
    trackRaf = false,
  }) {
    const context = await browser.newContext({
      viewport,
      locale: "en-US",
      reducedMotion,
    });
    if (token) {
      await context.addInitScript((value) => {
        sessionStorage.setItem("semeai_session_token", value);
        sessionStorage.setItem("semeai_dashboard_api_key", value);
      }, token);
    }
    if (trackRaf) {
      await context.addInitScript(() => {
        const requestFrame = window.requestAnimationFrame.bind(window);
        window.__workspaceRafCount = 0;
        window.requestAnimationFrame = (callback) =>
          requestFrame((time) => {
            window.__workspaceRafCount += 1;
            callback(time);
          });
      });
    }
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    const external = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(origin) && !url.startsWith("https://api.semeai.tech/")) external.push(url);
    });
    await wireProductPage(page, errors, requests);
    await page.goto(`${origin}${route}`, { waitUntil: "load" });
    return { context, page, errors, requests, external };
  }

  {
    const { context, page, errors, requests, external } = await openProductPage({
      route: "/account/?lang=en",
    });
    await page.locator("#account-signed-out:not([hidden])").waitFor();

    assert.equal(
      await page.locator('meta[name="robots"]').getAttribute("content"),
      "noindex,nofollow,noarchive",
      "Account should remain private to search engines",
    );
    assert.equal(
      await page.locator('a[href*="/oauth/"],button').filter({ hasText: /Google|GitHub/i }).count(),
      0,
      "Account should not render unverified social sign-in",
    );
    assert.equal(
      await page.locator(".header-dashboard").getAttribute("href"),
      "/account/",
      "Signed-out public shell should route Workspace through Account",
    );
    assert.equal(requests.length, 0, "Signed-out Account should not speculate against the API");

    await page.locator("#account-login-email").fill("owner@example.test");
    await page.locator("#account-login-password").fill("correct-horse");
    await page.locator("#account-login-form [type=submit]").click();
    await page.locator("#account-signed-in:not([hidden])").waitFor();

    const loginRequest = requests.find((request) => request.path === "/v0/login");
    assert.deepEqual(loginRequest?.body, {
      email: "owner@example.test",
      password: "correct-horse",
    });
    assert.equal(
      await page.locator("#account-workspace-name").textContent(),
      "Evidence Lab",
      "Account should render backend workspace identity",
    );
    assert.equal(await page.locator("#account-workspace-id").textContent(), "ws_evidence_lab");
    assert.equal(await page.locator("#account-email").textContent(), "owner@example.test");
    assert.equal(await page.locator("#account-usage").textContent(), "7 / 43");
    assert.equal(await page.locator("#account-receipt-count").textContent(), "4");
    assert.ok(
      requests
        .filter((request) => request.path !== "/v0/login")
        .every((request) => request.authorization === "Bearer session_login_fixture"),
      "Authenticated account reads should use the real bearer-session client contract",
    );
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("semeai_session_token")),
      "session_login_fixture",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    results.push("account signed-out + login");
    await context.close();
  }

  {
    const { context, page, errors, requests, external } = await openProductPage({
      route: "/account/?lang=en",
    });
    await page.locator("#account-signed-out:not([hidden])").waitFor();
    await page.locator("#account-register-tab").click();
    await page.locator("#account-register-workspace").fill("Evidence Lab");
    await page.locator("#account-register-email").fill("owner@example.test");
    await page.locator("#account-register-password").fill("correct-horse");
    await page.locator("#account-register-confirm").fill("correct-horse");
    await page.locator("#account-register-form [type=submit]").click();
    await page.locator("#account-verify-panel:not([hidden])").waitFor();

    const registerRequest = requests.find((request) => request.path === "/v0/register");
    assert.deepEqual(registerRequest?.body, {
      email: "owner@example.test",
      company: "Evidence Lab",
      password: "correct-horse",
      password_confirm: "correct-horse",
      use_case: "internal_tools",
      expected_monthly_checks: "pilot",
      notes: "",
      source: "https://semeai.tech/account/",
    });

    await page.locator("#account-verification-token").fill("verify_fixture");
    await page.locator("#account-verify-form [type=submit]").click();
    await page.locator("#account-signed-in:not([hidden])").waitFor();
    const verifyRequest = requests.find((request) => request.path === "/v0/verify");
    assert.deepEqual(verifyRequest?.body, { verification_token: "verify_fixture" });
    await page.locator("#account-key-once:not([hidden])").waitFor();
    assert.equal(
      await page.locator("#account-key-value").textContent(),
      "semeai_one_time_fixture_key",
      "One-time integration key should be shown only from the verification response",
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem("semeai_one_time_fixture_key")),
      null,
      "The one-time key must not be persisted",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    results.push("account register + verify contract");
    await context.close();
  }

  {
    const { context, page, errors } = await openProductPage({
      route: "/workspace/",
      viewport: { width: 390, height: 844 },
    });
    await page.waitForURL(/\/account\/\?return=%2Fworkspace%2F/, { timeout: 3_000 });
    assert.equal(page.url().startsWith(`${origin}/account/`), true);
    assert.deepEqual(errors, []);
    results.push("workspace unauthenticated redirect");
    await context.close();
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const { context, page, errors, requests, external } = await openProductPage({
      route: "/workspace/?lang=en",
      viewport,
      token: "session_workspace_fixture",
      reducedMotion: "reduce",
      trackRaf: true,
    });
    await page.locator("#workspace-app:not([hidden])").waitFor();

    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      unsafeImageCount: document.querySelectorAll("#workspace-receipts-list img").length,
      unsafeExecuted: Boolean(window.__unsafe),
      receiptText: document.querySelector("#workspace-receipts-list")?.textContent || "",
      maximumAnimationMs: [...document.querySelectorAll("*")].reduce((maximum, element) => {
        const durations = getComputedStyle(element)
          .animationDuration.split(",")
          .map((value) =>
            value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000,
          )
          .filter(Number.isFinite);
        return Math.max(maximum, ...durations, 0);
      }, 0),
      rafCount: window.__workspaceRafCount,
    }));
    assert.equal(state.overflow, 0, `Workspace should not overflow at ${viewport.width}x${viewport.height}`);
    assert.equal(state.unsafeImageCount, 0, "Receipt fields must render through textContent");
    assert.equal(state.unsafeExecuted, false, "Receipt fields must not execute markup");
    assert.equal(state.receiptText.includes("D:\\private\\"), false, "Receipt server paths must not render");
    assert.ok(state.maximumAnimationMs <= 10, "Workspace should collapse motion under reduced motion");
    assert.ok(state.rafCount <= 2, "Workspace should not install a permanent animation frame loop");

    assert.equal(await page.locator("#workspace-sidebar-name").textContent(), "Evidence Lab");
    assert.equal(await page.locator("#workspace-usage").textContent(), "7 / 43");
    assert.equal(await page.locator("#workspace-receipt-count").textContent(), "4");

    await page.locator('[data-workspace-view="decisions"]').click();
    assert.equal(await page.locator("#workspace-show-count").textContent(), "1");
    assert.equal(await page.locator("#workspace-review-count").textContent(), "1");
    assert.equal(await page.locator("#workspace-block-count").textContent(), "1");

    await page.locator('[data-workspace-view="receipts"]').click();
    assert.equal(await page.locator(".workspace-receipt").count(), 4);
    assert.equal(await page.locator(".workspace-receipt code").first().textContent(), "receipt_show_<img src=x onerror=window.__unsafe=1>");

    await page.locator('[data-workspace-view="sources"]').click();
    assert.equal(
      await page.locator('[data-workspace-section="sources"] .unconnected-surface strong').textContent(),
      "Persistence not connected in v0.1.",
    );
    assert.equal(
      await page.locator('[data-workspace-section="sources"] .unconnected-surface').locator("li,[data-item]").count(),
      0,
      "Unconnected product surfaces must not fabricate items",
    );

    await page.locator('[data-workspace-view="memory"]').focus();
    await page.keyboard.press("Tab");
    const focusState = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement);
      return { outline: style.outlineStyle, shadow: style.boxShadow };
    });
    assert.ok(focusState.outline !== "none" || focusState.shadow !== "none", "Workspace focus must remain visible");

    if (viewport.width === 390) {
      const targets = await page.locator(".workspace-nav button").evaluateAll((elements) =>
        elements.map((element) => {
          const rectangle = element.getBoundingClientRect();
          return { width: rectangle.width, height: rectangle.height };
        }),
      );
      assert.ok(targets.every(({ width, height }) => width >= 44 && height >= 44), "Workspace mobile navigation should expose usable touch targets");

      await page.locator('[data-lang="uk"]').click();
      assert.equal(await page.getAttribute("html", "lang"), "uk");
      assert.equal(await page.locator('[data-workspace-view="sources"]').textContent(), "Джерела");
      await page.locator('[data-lang="ru"]').click();
      assert.equal(await page.getAttribute("html", "lang"), "ru");
      assert.equal(await page.locator('[data-workspace-view="sources"]').textContent(), "Источники");
      await page.locator('[data-lang="en"]').click();
    }

    assert.ok(
      requests.every((request) => request.authorization === "Bearer session_workspace_fixture"),
      "Workspace reads should use the existing session bearer contract",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    results.push(`workspace fixture ${viewport.width}x${viewport.height}`);
    await context.close();
  }

  {
    const { context, page, errors, requests } = await openProductPage({
      route: "/account/?lang=en",
      token: "session_known_fixture",
    });
    await page.locator("#account-signed-in:not([hidden])").waitFor();
    assert.equal(
      await page.locator(".header-dashboard").getAttribute("href"),
      "/workspace/",
      "A locally known session should route the public Workspace action directly",
    );
    await page.locator("#account-sign-out").click();
    await page.waitForURL(/\/account\/$/, { timeout: 3_000 });
    assert.ok(requests.some((request) => request.path === "/v0/logout"), "Sign out should call the existing logout endpoint");
    assert.deepEqual(errors, []);
    results.push("known session entry + logout");
    await context.close();
  }

  {
    const { context, page, errors } = await openProductPage({
      route: "/account.html?lang=uk#verify=legacy_token",
    });
    await page.waitForURL(/\/account\/\?lang=uk#verify=legacy_token/, { timeout: 3_000 });
    await page.locator("#account-verify-panel:not([hidden])").waitFor();
    assert.equal(await page.locator("#account-verification-token").inputValue(), "legacy_token");
    assert.deepEqual(errors, []);
    results.push("legacy account query + hash preservation");
    await context.close();
  }

  return results;
}

async function validateProductRoadmap(browser, origin, tailwindRuntime) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  await wirePage(page, tailwindRuntime, errors);
  await loadRoute(page, origin, "/roadmap/");

  const state = await page.evaluate(() => ({
    title: document.title,
    pdfHref: document.querySelector("[data-roadmap-pdf]")?.getAttribute("href") || "",
    hash: document.querySelector("[data-roadmap-hash]")?.textContent.trim() || "",
    phases: document.querySelectorAll(".roadmap-phases > li").length,
    complete: document.querySelectorAll(".roadmap-phases > .is-complete").length,
    next: document.querySelectorAll(".roadmap-phases > .is-next").length,
    held: document.querySelectorAll(".roadmap-phases > .is-held").length,
    fakeItems: document.querySelectorAll("[data-fake-item]").length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    footerLink: document.querySelector('.site-footer a[href="/roadmap/"]')?.textContent.trim() || "",
  }));

  assert.equal(state.title, "SemeAI Product Roadmap v1.0");
  assert.equal(state.pdfHref, "/roadmap/SemeAI_Product_Roadmap_v1.0.pdf");
  assert.equal(state.hash, "ad32c712afd07e9b13f3050737a97e28384620d120cccad07ea303cc9b1dafcb");
  assert.equal(state.phases, 12, "Roadmap should expose all twelve dependency phases");
  assert.equal(state.complete, 2, "Only repository-backed phases should be marked implemented");
  assert.equal(state.next, 1, "Exactly one next dependency gate should be identified");
  assert.equal(state.held, 9, "Later phases should remain explicitly dependency-held");
  assert.equal(state.fakeItems, 0, "Roadmap must not simulate future product data");
  assert.equal(state.overflow, 0);
  assert.equal(state.footerLink, "Product Roadmap");

  const pdfResponse = await page.request.get(`${origin}${state.pdfHref}`);
  assert.equal(pdfResponse.status(), 200);
  assert.equal(pdfResponse.headers()["content-type"], "application/pdf");
  const pdfBytes = await pdfResponse.body();
  assert.equal(pdfBytes.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.equal(
    crypto.createHash("sha256").update(pdfBytes).digest("hex"),
    state.hash,
    "Hosted PDF bytes should match the published integrity value",
  );

  await page.locator('[data-lang="uk"]:visible').first().click();
  assert.equal(
    await page.locator("#roadmap-title").innerText(),
    "Від evidence runtime\nдо систем агентних навичок.",
  );
  await page.locator('[data-lang="ru"]:visible').first().click();
  assert.equal(
    await page.locator("#roadmap-title").innerText(),
    "От evidence runtime\nк системам агентных навыков.",
  );

  assert.deepEqual(errors, [], "Roadmap should remain free of browser and asset errors");
  await context.close();
  return [
    "12-phase dependency ledger",
    "only phases 0–1 marked implemented",
    "phase 2 next + phases 3–11 held",
    "hosted PDF hash",
    "EN / UK / RU",
  ];
}

async function validateBenchmarkBoundary(browser, origin, tailwindRuntime) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  await wirePage(page, tailwindRuntime, errors);
  await loadRoute(page, origin, "/benchmark/");

  const boundary = await page.evaluate(() => ({
    robots: document.querySelector('meta[name="robots"]')?.content,
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
    oauthLinks: document.querySelectorAll('a[href*="/v0/oauth/github/start"]').length,
    disabledSave: document.querySelector(".save-trace-button")?.disabled,
  }));

  assert.equal(boundary.robots, "noindex,nofollow,noarchive");
  assert.match(boundary.csp, /connect-src 'self' https:\/\/api\.github\.com/);
  assert.match(boundary.csp, /form-action 'none'/);
  assert.equal(boundary.oauthLinks, 0);
  assert.equal(boundary.disabledSave, true);
  assert.deepEqual(errors, []);
  await page.close();
}

async function validateMotionSemantics(browser, origin, tailwindRuntime) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    reducedMotion: "no-preference",
  });
  await context.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.__semeaiRouteRafCount = 0;
    window.requestAnimationFrame = (callback) =>
      requestFrame((time) => {
        window.__semeaiRouteRafCount += 1;
        callback(time);
      });
  });

  const page = await context.newPage();
  const errors = [];
  await wirePage(page, tailwindRuntime, errors);

  await loadRoute(page, origin, "/gate.html");
  assert.equal(await page.locator(".gate-state-visual").getAttribute("aria-hidden"), "true");
  for (const state of ["show", "review", "block"]) {
    await page.locator(`[data-gate-state="${state}"]`).focus();
    assert.equal(
      await page.locator(".gate-state-visual").getAttribute("data-motion-phase"),
      state,
      `Gate keyboard focus should expose the ${state} structural state`,
    );
  }

  await loadRoute(page, origin, "/research.html");
  await page.locator(".research-artifact-section").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => document.querySelector(".research-artifact-section")?.dataset.evidenceAdmitted === "true",
  );
  assert.equal(
    await page.locator(".research-artifact-section").getAttribute("data-evidence-admitted"),
    "true",
  );

  await loadRoute(page, origin, "/dashboard.html");
  await page.evaluate(() => {
    window.__semeaiRouteRafCount = 0;
  });
  await page.waitForTimeout(300);
  const dashboard = await page.evaluate(() => ({
    lifecycle: Boolean(window.SemeAIDashboardMotion),
    rafCount: window.__semeaiRouteRafCount,
    canvasWidth: document.querySelector("#bg-canvas")?.width || 0,
  }));
  assert.equal(dashboard.lifecycle, true);
  assert.equal(dashboard.rafCount, 0, "Dashboard should not retain a cinematic frame loop");
  assert.ok(dashboard.canvasWidth > 0, "Dashboard should retain its deterministic operational field");

  await loadRoute(page, origin, "/");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(
    () => document.querySelector(".hero")?.dataset.motionState === "paused",
  );
  await page.evaluate(() => {
    window.__semeaiRouteRafCount = 0;
  });
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(() => window.__semeaiRouteRafCount),
    0,
    "Home should pause its frame loop when the hero is offscreen",
  );

  assert.deepEqual(errors, [], "semantic motion states should remain error-free");
  await context.close();
  return "Gate focus, Research admission, Dashboard calm state, Home offscreen pause verified";
}

async function main() {
  const playwright = loadPlaywright();
  const { server, origin } = await startServer();
  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const tailwindRuntime = await loadTailwindRuntime();
    const matrix = await validateMatrix(browser, origin, tailwindRuntime);
    const interactions = await validateInteraction(browser, origin, tailwindRuntime);
    const deepLinks = await validateDeepLinks(browser, origin, tailwindRuntime);
    const noJavaScript = await validateNoJavaScript(browser, origin);
    const reducedMotion = await validateReducedMotion(browser, origin, tailwindRuntime);
    const accountWorkspaceFoundation = await validateAccountWorkspaceFoundation(browser, origin);
    const productRoadmap = await validateProductRoadmap(browser, origin, tailwindRuntime);
    await validateBenchmarkBoundary(browser, origin, tailwindRuntime);
    const motionSemantics = await validateMotionSemantics(browser, origin, tailwindRuntime);

    console.log(
      JSON.stringify(
        {
          matrix: matrix.length,
          routes: ROUTES.length,
          viewports: VIEWPORTS.map((viewport) => viewport.join("x")),
          keyboardLanguageAndMobileNavigation: interactions,
          deepLinks,
          noJavaScript,
          reducedMotion,
          accountWorkspaceFoundation,
          productRoadmap,
          motionSemantics,
          benchmarkBoundary: "CSP, noindex, auth withholding verified",
        },
        null,
        2,
      ),
    );
    console.log("ok - cross-route browser regression passed");
  } finally {
    await browser.close();
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
