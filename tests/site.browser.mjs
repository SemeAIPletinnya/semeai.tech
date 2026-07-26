import assert from "node:assert/strict";
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
  "/dashboard.html",
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
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xml": "application/xml",
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
  return route === "/account.html" ? "/dashboard.html" : route;
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

async function loadRoute(page, origin, route) {
  await page.goto(`${origin}${route}${route.includes("?") ? "&" : "?"}lang=en`, {
    waitUntil: "load",
    timeout: 15_000,
  });
  if (route === "/account.html") {
    await page.waitForURL(/dashboard\.html/, { timeout: 3_000 });
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
      await page.waitForURL(/dashboard\.html/, { timeout: 3_000 });
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
    await validateBenchmarkBoundary(browser, origin, tailwindRuntime);

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
