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
  "/genesis/archive/v02/",
  "/gate.html",
  "/benchmark/",
  "/book/",
  "/research.html",
  "/skills/",
  "/roadmap/",
  "/benchmark/workspace/",
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
  skills: {
    count: 1,
    records: [
      {
        schema_version: "semeai.workspace-skill-record.v0.1",
        record_id: "skillrec_111111111111111111111111",
        workspace_id: "ws_evidence_lab",
        identity: {
          skill_id: "get-job",
          name: "GET JOB <img src=x onerror=window.__unsafeSkill=1>",
          version: "0.1-candidate",
          skill_hash: "3b030d109ad876294cc6fe57525dfd5c190cbd61134ab0715f261de46db35c59",
        },
        evidence: { cases: [{ case_id: "case-003" }, { case_id: "case-005" }] },
        admission: {
          state: "REVIEW",
          decision: null,
          receipt_id: null,
          receipt_integrity_hash: null,
        },
        availability: { available: false, installable: false, marketplace_ready: false },
        boundaries: {
          candidate_retention_is_admission: false,
          skill_admission_is_runtime_release_authority: false,
          distribution_authorized: false,
        },
        raw_skill_content_stored: false,
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
  await page.route("http://127.0.0.1:8787/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        github: { enabled: false, app_configured: false },
        analyzer: { configured: false },
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
  const workspaceSkills = structuredClone(PRODUCT_FIXTURE.skills.records);
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
    } else if (url.pathname === "/v0/workspace/skills" && request.method() === "GET") {
      body = { count: workspaceSkills.length, records: workspaceSkills };
    } else if (url.pathname === "/v0/workspace/skills" && request.method() === "POST") {
      const payload = entry.body || {};
      let record = workspaceSkills.find((item) => item.identity?.skill_id === payload.skill_id);
      const created = !record;
      if (!record) {
        record = {
          schema_version: "semeai.workspace-skill-record.v0.1",
          record_id: "skillrec_222222222222222222222222",
          workspace_id: PRODUCT_FIXTURE.account.workspace_id,
          identity: {
            skill_id: payload.skill_id,
            name: payload.name,
            version: payload.version,
            skill_hash: payload.skill_hash,
          },
          provenance: payload.provenance,
          evidence: {
            cases: payload.evidence_cases,
            evaluated_domains: payload.evaluated_domains,
            failures: payload.failures,
            limitations: payload.limitations,
          },
          evaluation_context: payload.evaluation_context,
          admission: {
            state: "REVIEW",
            decision: null,
            receipt_id: null,
            receipt_integrity_hash: null,
          },
          availability: { available: false, installable: false, marketplace_ready: false },
          raw_skill_content_stored: false,
        };
        workspaceSkills.push(record);
      }
      body = { created, record };
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
      status: request.method() === "POST" && url.pathname === "/v0/workspace/skills" ? 201 : 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("http://127.0.0.1:8787/**", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unexpected local product endpoint" }),
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

async function validatePublicRouteContext(browser, origin, tailwindRuntime) {
  const expected = [
    {
      route: "/",
      position: "01 / 06",
      role: "System",
      summary: "Release-control overview",
      next: "/gate.html",
    },
    {
      route: "/gate.html",
      position: "02 / 06",
      role: "Authority",
      summary: "Release-decision contract",
      next: "/benchmark/",
    },
    {
      route: "/benchmark/",
      position: "03 / 06",
      role: "Instrument",
      summary: "Visible repository evidence",
      next: "/genesis/",
    },
    {
      route: "/genesis/",
      position: "04 / 06",
      role: "Trace",
      summary: "Admitted historical chronology",
      next: "/book/",
    },
    {
      route: "/book/",
      position: "05 / 06",
      role: "Method",
      summary: "Engineering rationale",
      next: "/research.html",
    },
    {
      route: "/research.html",
      position: "06 / 06",
      role: "Boundary",
      summary: "Public evidence and claim limits",
      next: "/",
    },
  ];
  const results = [];

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, locale: "en-US" });
    for (const item of expected) {
      const page = await context.newPage();
      const errors = [];
      await wirePage(page, tailwindRuntime, errors);
      await loadRoute(page, origin, item.route);
      const state = await page.locator(".site-route-context").evaluate((element) => ({
        label: element.getAttribute("aria-label"),
        position: element.querySelector(".site-route-context__position")?.textContent.trim(),
        role: element.querySelector(".site-route-context__role")?.textContent.trim(),
        summary: element.querySelector(".site-route-context__summary")?.textContent.trim(),
        next: element.querySelector(".site-route-context__next")?.getAttribute("href"),
      }));
      assert.deepEqual(
        state,
        {
          label: "Public route context",
          position: item.position,
          role: item.role,
          summary: item.summary,
          next: item.next,
        },
        `${item.route} should expose its stable public-route context`,
      );

      if (viewport.width === 390) {
        const burger = page.locator(".nav-burger:visible").first();
        await burger.click();
        const mobileRoutes = page.locator(".mobile-link--described:visible");
        assert.equal(
          await mobileRoutes.count(),
          10,
          "Mobile navigation should describe six public routes plus four complete-system destinations",
        );
        const mobileHrefs = await mobileRoutes.evaluateAll((links) =>
          links.map((link) => link.getAttribute("href")),
        );
        for (const href of ["/roadmap/", "/skills/", "/account/", "/dashboard.html"]) {
          assert.ok(mobileHrefs.includes(href), `Mobile navigation should expose ${href}`);
        }
        const current = page.locator('.mobile-link--described[aria-current="page"]:visible');
        assert.equal(await current.count(), 1, `${item.route} should identify one current mobile route`);
        assert.match(
          await current.locator(".mobile-link__descriptor").textContent(),
          new RegExp(`${item.role}\\s*·\\s*${item.summary}`),
          `${item.route} should preserve semantic route context in the mobile menu`,
        );
      }

      assert.deepEqual(errors, [], `${item.route} route context should not emit browser errors`);
      results.push(`${item.route}@${viewport.width}x${viewport.height}`);
      await page.close();
    }
    await context.close();
  }

  const localeContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const localePage = await localeContext.newPage();
  const localeErrors = [];
  await wirePage(localePage, tailwindRuntime, localeErrors);
  await loadRoute(localePage, origin, "/benchmark/");
  await localePage.locator('[data-lang="uk"]:visible').first().click();
  assert.equal(
    await localePage.locator(".site-route-context__role").textContent(),
    "Інструмент",
    "Public route role should localize to Ukrainian",
  );
  await localePage.locator('[data-lang="ru"]:visible').first().click();
  assert.equal(
    await localePage.locator(".site-route-context__role").textContent(),
    "Инструмент",
    "Public route role should localize to Russian",
  );
  assert.deepEqual(localeErrors, [], "Localized route context should not emit browser errors");
  await localeContext.close();

  return results;
}

async function validateSystemMap(browser, origin, tailwindRuntime) {
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const desktopPage = await desktopContext.newPage();
  const desktopErrors = [];
  await wirePage(desktopPage, tailwindRuntime, desktopErrors);
  await loadRoute(desktopPage, origin, "/skills/");

  let trigger = desktopPage.locator(".system-map-trigger:visible");
  assert.equal(await trigger.count(), 1, "Desktop shell should expose one System map trigger");
  assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  await trigger.focus();
  await desktopPage.keyboard.press("ArrowDown");
  assert.equal(await trigger.getAttribute("aria-expanded"), "true");

  let panel = desktopPage.locator(".system-map-panel:visible");
  assert.equal(await panel.count(), 1, "ArrowDown should reveal the System map");
  assert.equal(
    await desktopPage.evaluate(() => document.activeElement?.matches(".system-map-link")),
    true,
    "ArrowDown should move focus into the System map",
  );

  const expectedHrefs = [
    "/",
    "/gate.html",
    "/book/",
    "/roadmap/",
    "/benchmark/",
    "/genesis/",
    "/research.html",
    "/skills/",
    "/account/",
    "/dashboard.html",
  ];
  const systemLinks = panel.locator(".system-map-link");
  assert.equal(await systemLinks.count(), expectedHrefs.length);
  const systemHrefs = await systemLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  assert.deepEqual(systemHrefs, expectedHrefs, "System map should preserve the complete route architecture");
  assert.equal(
    await panel.locator('.system-map-link[aria-current="page"]').count(),
    1,
    "System map should expose one current route",
  );

  await desktopPage.keyboard.press("Escape");
  trigger = desktopPage.locator(".system-map-trigger:visible");
  assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  assert.equal(
    await desktopPage.evaluate(() => document.activeElement?.matches(".system-map-trigger")),
    true,
    "Escape should close the map and restore trigger focus",
  );

  await desktopPage.locator('[data-lang="uk"]:visible').first().click();
  trigger = desktopPage.locator(".system-map-trigger:visible");
  assert.equal((await trigger.textContent()).trim().startsWith("Система"), true);
  assert.equal(await trigger.getAttribute("aria-label"), "Відкрити мапу системи SemeAI");
  await trigger.click();
  assert.equal(await trigger.getAttribute("aria-expanded"), "true");
  await desktopPage.keyboard.press("Escape");

  await desktopPage.locator('[data-lang="ru"]:visible').first().click();
  trigger = desktopPage.locator(".system-map-trigger:visible");
  assert.equal((await trigger.textContent()).trim().startsWith("Система"), true);
  assert.equal(await trigger.getAttribute("aria-label"), "Открыть карту системы SemeAI");
  await desktopPage.locator('[data-lang="en"]:visible').first().click();
  trigger = desktopPage.locator(".system-map-trigger:visible");
  await trigger.click();
  assert.equal(
    await trigger.getAttribute("aria-expanded"),
    "true",
    "Language remounts should leave exactly one working System map listener",
  );

  const desktopOverflow = await desktopPage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert.equal(desktopOverflow, 0);
  assert.deepEqual(desktopErrors, [], "Desktop System map should not emit browser errors");
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "en-US",
  });
  const mobilePage = await mobileContext.newPage();
  const mobileErrors = [];
  await wirePage(mobilePage, tailwindRuntime, mobileErrors);
  await loadRoute(mobilePage, origin, "/skills/");
  await mobilePage.locator(".nav-burger:visible").click();

  const supplemental = mobilePage.locator(".mobile-system-link:visible");
  assert.equal(await supplemental.count(), 4, "Mobile shell should expose four supplemental destinations");
  const mobileHrefs = await supplemental.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  assert.deepEqual(mobileHrefs, ["/roadmap/", "/skills/", "/account/", "/dashboard.html"]);
  assert.equal(
    await mobilePage.locator('.mobile-system-link[aria-current="page"]:visible').count(),
    1,
    "Supplemental mobile destinations should retain current-route orientation",
  );
  const mobileTargets = await supplemental.evaluateAll((links) =>
    links.map((link) => {
      const rectangle = link.getBoundingClientRect();
      return { width: rectangle.width, height: rectangle.height };
    }),
  );
  assert.ok(
    mobileTargets.every(({ width, height }) => width >= 44 && height >= 44),
    "Supplemental mobile destinations should meet the 44px target boundary",
  );
  assert.equal(
    await mobilePage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
    0,
  );
  assert.deepEqual(mobileErrors, [], "Mobile System map should not emit browser errors");
  await mobileContext.close();

  return {
    desktopRoutes: expectedHrefs.length,
    mobileSupplementalRoutes: mobileHrefs.length,
    localized: ["en", "uk", "ru"],
    keyboard: ["ArrowDown", "Escape"],
  };
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
      eras: document.querySelectorAll("[data-era]").length,
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
      assert.equal(state.eras, 12, "Genesis v04 should keep all twelve eras without JavaScript");
    }
    if (route === "/genesis/archive/v02/") {
      assert.equal(state.scenes, 9, "Genesis v02 archive should keep all nine scenes without JavaScript");
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
    assert.ok(
      (await page.locator(".account-layout").boundingBox()).y < 700,
      "Account access should begin within the common desktop viewport",
    );

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
      workAreaTop: document.querySelector(".workspace-work-area")?.getBoundingClientRect().top,
      navigationCount: document.querySelectorAll(".workspace-nav [data-workspace-view]").length,
      navigationControlsValid: [...document.querySelectorAll(".workspace-nav [data-workspace-view]")].every(
        (button) => {
          const controlled = document.getElementById(button.getAttribute("aria-controls") || "");
          return controlled?.dataset.workspaceSection === button.dataset.workspaceView;
        },
      ),
      navigationHintDisplay: getComputedStyle(document.querySelector(".workspace-nav-hint")).display,
      navigationHintText: document.querySelector(".workspace-nav-hint")?.textContent.trim() || "",
      navigationPosition: document.querySelector("#workspace-nav-position")?.textContent || "",
      receiptColumns: [...document.querySelectorAll(".workspace-receipt-columns span")].map(
        (element) => element.textContent.trim(),
      ),
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
    assert.equal(state.navigationCount, 9, "Workspace should retain all nine truthful product surfaces");
    assert.equal(state.navigationControlsValid, true, "Workspace navigation should identify its controlled sections");
    assert.deepEqual(
      state.receiptColumns,
      ["Action", "Receipt ID", "Internal decision", "Captured"],
      "Receipt columns should expose their scanning hierarchy",
    );
    assert.ok(state.maximumAnimationMs <= 10, "Workspace should collapse motion under reduced motion");
    assert.ok(state.rafCount <= 2, "Workspace should not install a permanent animation frame loop");
    if (viewport.width === 390) {
      assert.ok(state.workAreaTop <= 340, "Mobile workspace content should enter the first viewport promptly");
      assert.equal(state.navigationHintDisplay, "flex", "Mobile workspace should expose rail discoverability");
      assert.match(state.navigationHintText, /Swipe to inspect all workspace surfaces/);
      assert.equal(state.navigationPosition, "01 / 09");
    } else {
      assert.equal(state.navigationHintDisplay, "none", "Desktop workspace does not need a swipe hint");
    }

    assert.equal(await page.locator("#workspace-sidebar-name").textContent(), "Evidence Lab");
    assert.equal(await page.locator("#workspace-usage").textContent(), "7 / 43");
    assert.equal(await page.locator("#workspace-receipt-count").textContent(), "4");

    await page.locator('[data-workspace-view="decisions"]').click();
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      "workspace-work-area",
      "Workspace view changes should move focus to the controlled work area",
    );
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

    await page.locator('[data-workspace-view="skills"]').click();
    await page.locator(".workspace-skill-candidate").first().waitFor();
    assert.equal(await page.locator(".workspace-skill-record").count(), 1);
    assert.equal(await page.locator(".workspace-skill-candidate").count(), 2);
    assert.equal(await page.locator("#workspace-context-skills").textContent(), "1 retained");
    assert.equal(
      await page.locator(".workspace-skill-record img").count(),
      0,
      "Retained skill identity must render through textContent",
    );
    assert.equal(await page.evaluate(() => Boolean(window.__unsafeSkill)), false);
    assert.equal(
      await page.locator('[data-workspace-section="skills"] button').filter({ hasText: /admit|install/i }).count(),
      0,
      "Workspace retention must not expose admission or installation authority",
    );

    const getVisCandidate = page.locator(".workspace-skill-candidate").filter({ hasText: "GET VIS" });
    await getVisCandidate.getByRole("button", { name: "Retain evidence" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".workspace-skill-record").length === 2);
    const retainRequest = requests.find(
      (request) => request.path.startsWith("/v0/workspace/skills") && request.method === "POST",
    );
    assert.equal(retainRequest?.body?.skill_id, "get-vis");
    assert.equal(retainRequest?.body?.evidence_cases?.length, 5);
    assert.equal(retainRequest?.body?.evaluation_context?.independent_evaluation, false);
    assert.equal(retainRequest?.body?.admission, undefined);
    assert.equal(retainRequest?.body?.decision, undefined);
    assert.equal(retainRequest?.body?.availability, undefined);
    assert.equal(retainRequest?.body?.raw_skill, undefined);
    assert.equal(await page.locator("#workspace-context-skills").textContent(), "2 retained");
    assert.match(await page.locator("#workspace-skills-status").textContent(), /Retention is not admission/);

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
      await page.locator('[data-workspace-view="settings"]').click();
      const rail = await page.locator(".workspace-nav").evaluate((navigation) => {
        const selected = navigation.querySelector('[aria-current="page"]');
        const navigationRect = navigation.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();
        return {
          scrollLeft: navigation.scrollLeft,
          contained:
            selectedRect.left >= navigationRect.left &&
            selectedRect.right <= navigationRect.right,
          scrollWidth: navigation.scrollWidth,
          clientWidth: navigation.clientWidth,
        };
      });
      assert.ok(rail.scrollWidth > rail.clientWidth, "Mobile workspace navigation should form a contained operational rail");
      assert.ok(rail.scrollLeft > 0, "A later hash destination should move into the mobile rail viewport");
      assert.equal(rail.contained, true, "The active mobile workspace destination should remain visible");
      assert.equal(
        await page.locator("#workspace-nav-position").textContent(),
        "09 / 09",
        "The mobile rail should expose the current destination position",
      );

      await page.locator('[data-lang="uk"]').click();
      assert.equal(await page.getAttribute("html", "lang"), "uk");
      assert.equal(await page.locator('[data-workspace-view="sources"]').textContent(), "Джерела");
      assert.notEqual(
        await page.locator(".workspace-nav-hint span").last().textContent(),
        "Swipe to inspect all workspace surfaces",
        "The mobile rail hint should localize to Ukrainian",
      );
      assert.deepEqual(
        await page.locator(".workspace-receipt-columns span").allTextContents(),
        ["Дія", "ID receipt", "Внутрішнє рішення", "Зафіксовано"],
      );
      await page.locator('[data-lang="ru"]').click();
      assert.equal(await page.getAttribute("html", "lang"), "ru");
      assert.equal(await page.locator('[data-workspace-view="sources"]').textContent(), "Источники");
      assert.deepEqual(
        await page.locator(".workspace-receipt-columns span").allTextContents(),
        ["Действие", "ID receipt", "Внутреннее решение", "Зафиксировано"],
      );
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
    partial: document.querySelectorAll(".roadmap-phases > .is-partial").length,
    future: document.querySelectorAll(".roadmap-phases > .is-future").length,
    fakeItems: document.querySelectorAll("[data-fake-item]").length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    footerLink: document.querySelector('.site-footer a[href="/roadmap/"]')?.textContent.trim() || "",
  }));

  assert.equal(state.title, "SemeAI Product Roadmap v1.0");
  assert.equal(state.pdfHref, "/roadmap/SemeAI_Product_Roadmap_v1.0.pdf");
  assert.equal(state.hash, "ad32c712afd07e9b13f3050737a97e28384620d120cccad07ea303cc9b1dafcb");
  assert.equal(state.phases, 12, "Roadmap should expose all twelve dependency phases");
  assert.equal(state.complete, 5, "Only repository-backed phases should be marked implemented");
  assert.equal(state.next, 0, "No phase should be presented as an uncomplicated next gate");
  assert.equal(state.partial, 5, "Locally implemented or structurally integrated phases should remain partial");
  assert.equal(state.future, 1, "Marketplace operation should remain a future hypothesis");
  assert.equal(state.held, 1, "Market evidence should remain dependency-held");
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
    "phases 0–4 marked implemented",
    "phases 5–8 and 10 partial; phase 9 future; phase 11 held",
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
  assert.equal(
    await page.locator(".gate-opening .gate-state-visual").count(),
    1,
    "Gate authority geometry should be part of the opening composition",
  );
  assert.ok(
    (await page.locator(".gate-authority-instrument").boundingBox()).y < 900,
    "Gate authority geometry should enter the first desktop viewport",
  );
  for (const state of ["show", "review", "block"]) {
    await page.locator(`[data-gate-state="${state}"]`).focus();
    assert.equal(
      await page.locator(".gate-state-visual").getAttribute("data-motion-phase"),
      state,
      `Gate keyboard focus should expose the ${state} structural state`,
    );
  }

  await loadRoute(page, origin, "/research.html");
  assert.equal(
    await page.locator(".research-opening .research-artifact-section").count(),
    1,
    "Research provenance should be part of the opening composition",
  );
  assert.equal(await page.locator(".research-artifact-section .emblem").count(), 7);
  assert.equal(
    await page.locator(".research-artifact-section .emblem").first().evaluate((element) => getComputedStyle(element).borderRadius),
    "0px",
    "Research sources should render as an evidence ledger rather than rounded badges",
  );
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

async function validateGenesisEvolutionTrace(browser, origin, tailwindRuntime) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await wirePage(page, tailwindRuntime, errors);

  await loadRoute(page, origin, "/genesis/");
  await page.waitForFunction(
    () => document.querySelector("[data-genesis-status]")?.dataset.state === "ready",
  );

  const state = await page.evaluate(() => ({
    eras: document.querySelectorAll("[data-era]").length,
    admittedMilestones: document.querySelectorAll(".milestone .evidence-state").length,
    eraControls: document.querySelectorAll("[data-era-control]").length,
    lineageEdges: document.querySelectorAll(".lineage-edge").length,
    lineageNodes: document.querySelectorAll(".lineage-node").length,
    firstParty: document.querySelector('[data-repository-count="first_party"]')?.textContent,
    forks: document.querySelector('[data-repository-count="forks"]')?.textContent,
    status: document.querySelector("[data-genesis-status]")?.textContent,
    chronicleEntries: document.querySelectorAll(".chronicle-entry").length,
    admittedHistoricalClaims: document.querySelectorAll(".historical-claim").length,
    heldHistoricalClaims: document.querySelectorAll(".admission-ledger li").length,
    historicalTimelines: document.querySelectorAll(".historical-timeline").length,
    evidenceQualityEras: document.querySelectorAll("[data-evidence-quality] > li").length,
    conceptLineageEdges: document.querySelectorAll("[data-concept-lineage] > li").length,
    traceStages: [...document.querySelectorAll("[data-trace-stage]")].map((control) => ({
      id: control.dataset.traceStage,
      label: control.textContent.replace(/\s+/g, " ").trim(),
    })),
    traceCurrent: document.querySelector("[data-trace-current]")?.textContent,
    traceActive: document.querySelector('[data-trace-stage][aria-current="step"]')?.dataset.traceStage,
    genesisVersion: document.body.dataset.genesisVersion,
    unsafeMarker: window.__unsafe,
  }));
  assert.equal(state.genesisVersion, "v04");
  assert.equal(state.eras, 12, "Genesis v04 should render the twelve curated eras");
  assert.equal(state.eraControls, 12, "each era should have a keyboard control");
  assert.equal(state.admittedMilestones, 14, "only the fourteen admitted milestones should render");
  assert.equal(state.lineageEdges, 13, "the curated lineage should render all thirteen relations");
  assert.equal(state.lineageNodes, 14, "forks should remain outside the first-party lineage geometry");
  assert.equal(state.firstParty, "6");
  assert.equal(state.forks, "6");
  assert.equal(state.chronicleEntries, 5, "Genesis should render five admitted Chronicle entries");
  assert.equal(state.admittedHistoricalClaims, 18, "the sanitized historical manifest should render eighteen admitted claims");
  assert.equal(state.heldHistoricalClaims, 5, "review and withheld decisions should remain inspectable");
  assert.equal(state.historicalTimelines, 4, "concept, publication, implementation, and evidence clocks should remain separate");
  assert.equal(state.evidenceQualityEras, 4, "evidence quality should render as four descriptive eras");
  assert.equal(state.conceptLineageEdges, 8, "only evidence-backed conceptual relations should render");
  assert.deepEqual(
    state.traceStages,
    [
      { id: "chronology", label: "01ERAS" },
      { id: "lineage", label: "02FORMATION" },
      { id: "historical-provenance", label: "03EVIDENCE GATE" },
      { id: "claim-boundaries", label: "04CLAIMS" },
      { id: "chronicle", label: "05CHRONICLE" },
      { id: "current-boundary", label: "06BOUNDARY" },
    ],
    "the trace spine should name the six existing Genesis stages without creating product state",
  );
  assert.equal(state.traceActive, "chronology");
  assert.match(state.traceCurrent, /^EVOLUTION TRACE · /);
  assert.match(state.status, /STRUCTURED PROVENANCE LOADED/);
  assert.equal(state.unsafeMarker, undefined, "manifest data must not execute as markup");

  const firstHistoricalClaim = page.locator(".historical-claim").first();
  await firstHistoricalClaim.locator("summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await firstHistoricalClaim.getAttribute("open"),
    "",
    "historical claim disclosure should be keyboard operable",
  );

  const controls = page.locator("[data-era-control]");
  await controls.first().focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("data-era-control")),
    "01-signal",
    "era navigation should support arrow keys",
  );

  const traceControls = page.locator("[data-trace-stage]");
  await traceControls.first().focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("data-trace-stage")),
    "lineage",
    "trace-stage navigation should support arrow keys",
  );

  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, document.getElementById("current-boundary").offsetTop);
  });
  await page.waitForTimeout(250);
  const completedTrace = await page.evaluate(() => ({
    active: document.querySelector('[data-trace-stage][aria-current="step"]')?.dataset.traceStage,
    current: document.querySelector("[data-trace-current]")?.textContent,
    progress: getComputedStyle(document.querySelector("[data-trace-spine]"))
      .getPropertyValue("--trace-progress")
      .trim(),
  }));
  assert.deepEqual(
    completedTrace,
    { active: "current-boundary", current: "CURRENT BOUNDARY", progress: "100%" },
    "the visible trace should persist through the current boundary",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await traceControls.nth(1).click();
  await page.waitForTimeout(100);
  const reducedTrace = await page.evaluate(() => ({
    active: document.querySelector('[data-trace-stage][aria-current="step"]')?.dataset.traceStage,
    focus: document.activeElement?.id,
    hash: window.location.hash,
    motionEnabled: document.documentElement.classList.contains("motion-enabled"),
    transition: getComputedStyle(document.querySelector("[data-trace-progress]")).transitionDuration,
  }));
  assert.equal(reducedTrace.active, "lineage");
  assert.equal(reducedTrace.focus, "lineage");
  assert.equal(reducedTrace.hash, "#lineage");
  assert.equal(reducedTrace.motionEnabled, false);
  assert.match(reducedTrace.transition, /0\.001ms|0s/);

  const unexpectedExternal = requests.filter((url) => {
    const parsed = new URL(url);
    return parsed.origin !== origin
      && parsed.origin !== "https://cdn.tailwindcss.com"
      && parsed.origin !== "https://fonts.googleapis.com"
      && parsed.origin !== "https://fonts.gstatic.com";
  });
  assert.deepEqual(unexpectedExternal, [], "Genesis v04 should not add external requests");
  assert.deepEqual(errors, [], "Genesis v04 should remain console and request error-free");

  await loadRoute(page, origin, "/genesis/archive/v02/");
  assert.equal(
    await page.locator("[data-scene]").count(),
    9,
    "the archived cinematic v02 should preserve all nine scenes",
  );
  assert.deepEqual(errors, [], "the Genesis v02 archive should remain error-free");

  const genesisScript = fs.readFileSync(path.join(ROOT, "genesis", "assets", "genesis.js"), "utf8");
  assert.equal(
    genesisScript.includes("innerHTML"),
    false,
    "Genesis manifest rendering should not use innerHTML",
  );

  await context.close();
  return {
    eras: state.eras,
    admittedMilestones: state.admittedMilestones,
    lineageEdges: state.lineageEdges,
    lineageNodes: state.lineageNodes,
    archivedScenes: 9,
    chronicleEntries: state.chronicleEntries,
    admittedHistoricalClaims: state.admittedHistoricalClaims,
    heldHistoricalClaims: state.heldHistoricalClaims,
  };
}

async function validateSkillForge(browser, origin, tailwindRuntime) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await wirePage(page, tailwindRuntime, errors);
  await loadRoute(page, origin, "/skills/");
  await page.waitForFunction(() => document.querySelector("#skills-status")?.dataset.state === "ready");

  const state = await page.evaluate(() => ({
    skills: document.querySelectorAll(".skill-record").length,
    cases: document.querySelectorAll(".case-record").length,
    counts: document.querySelector("#registry-counts")?.textContent.trim(),
    admission: [...document.querySelectorAll(".skill-facts dd")].map((node) => node.textContent),
    forgeStates: [...document.querySelectorAll(".forge-trace small")].map((node) => node.textContent.trim()),
    imprintLevels: [...document.querySelectorAll(".method-imprint__bar")].map((node) => node.dataset.level),
    caseSignals: [...document.querySelectorAll(".case-record")].map((record) =>
      [...record.querySelectorAll(".case-record__signal strong")].map((node) => node.textContent.trim()),
    ),
    caseToggles: document.querySelectorAll(".case-record__toggle").length,
    closedPanels: document.querySelectorAll(".case-record__panel[hidden]").length,
    caseFactRows: document.querySelectorAll(".case-facts > div").length,
    artifactRows: document.querySelectorAll(".artifact-list > li").length,
    testEvidenceRows: document.querySelectorAll(".case-tests").length,
    knownBoundaries: document.querySelectorAll(".evaluation-boundaries__item li").length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    unsafe: window.__unsafe,
  }));
  assert.equal(state.skills, 2);
  assert.equal(state.cases, 9);
  assert.equal(state.counts, "2 REVIEW · 0 ADMITTED");
  assert.equal(state.admission.filter((value) => value === "NO DECISION").length, 2);
  assert.deepEqual(state.forgeStates, [
    "9 CASES RETAINED",
    "2 CANDIDATES · 2 REVIEW",
    "NO ADMISSION DECISIONS",
    "0 ADMITTED · NOT AVAILABLE",
  ]);
  assert.deepEqual(
    state.imprintLevels,
    [..."3b030d109ad876294cc6fe57525dfd5ca0ed0f0a2e6522729aadce18b891f0ae"].map(
      (character) => String(Number.parseInt(character, 16)),
    ),
  );
  assert.deepEqual(state.caseSignals, [
    ["2 RETAINED", "NOT CAPTURED", "NOT RETAINED", "NOT CAPTURED"],
    ["2 RETAINED", "NOT CAPTURED", "NOT RETAINED", "NOT CAPTURED"],
    ["2 RETAINED", "HEAD CAPTURED", "1 RETAINED", "NOT DEPLOYED"],
    ["2 RETAINED", "HEAD CAPTURED", "2 RETAINED", "LIVE VERIFIED"],
    ["2 RETAINED", "HEAD CAPTURED", "3 RETAINED", "LIVE VERIFIED"],
    ["2 RETAINED", "HEAD CAPTURED", "3 RETAINED", "LIVE VERIFIED"],
    ["2 RETAINED", "HEAD CAPTURED", "3 RETAINED", "LIVE VERIFIED"],
    ["2 RETAINED", "HEAD CAPTURED", "3 RETAINED", "LIVE VERIFIED"],
    ["2 RETAINED", "HEAD CAPTURED", "3 RETAINED", "LIVE VERIFIED"],
  ]);
  assert.equal(state.caseToggles, 9);
  assert.equal(state.closedPanels, 9);
  assert.equal(state.caseFactRows, 54);
  assert.equal(state.artifactRows, 18);
  assert.equal(state.testEvidenceRows, 7);
  assert.equal(state.knownBoundaries, 15);
  assert.equal(state.overflow, 0);
  assert.equal(state.unsafe, undefined);

  const caseToggles = page.locator(".case-record__toggle");
  await caseToggles.nth(0).focus();
  await page.keyboard.press("Enter");
  await caseToggles.nth(1).click();
  const disclosure = await page.evaluate(() => ({
    expanded: [...document.querySelectorAll(".case-record__toggle")].map((toggle) =>
      toggle.getAttribute("aria-expanded"),
    ),
    closedPanels: document.querySelectorAll(".case-record__panel[hidden]").length,
    firstPanelLabelledBy: document.querySelector(".case-record__panel")?.getAttribute("aria-labelledby"),
  }));
  assert.deepEqual(
    disclosure.expanded,
    ["true", "true", "false", "false", "false", "false", "false", "false", "false"],
  );
  assert.equal(disclosure.closedPanels, 7);
  assert.equal(disclosure.firstPanelLabelledBy, "get-job-case-001-label get-job-case-001-toggle");

  await page.locator('[data-lang="uk"]:visible').first().click();
  assert.equal(await page.locator("#skills-title").innerText(), "МЕТОД СТАЄ КАНДИДАТОМ.\nПЕРЕГЛЯД ВИРІШУЄ ДОПУСК.");
  await page.locator('[data-lang="ru"]:visible').first().click();
  assert.equal(await page.locator("#skills-title").innerText(), "МЕТОД СТАНОВИТСЯ КАНДИДАТОМ.\nПРОВЕРКА РЕШАЕТ ДОПУСК.");

  const unexpectedExternal = requests.filter((url) => {
    const parsed = new URL(url);
    return parsed.origin !== origin
      && parsed.origin !== "https://cdn.tailwindcss.com"
      && parsed.origin !== "https://fonts.googleapis.com"
      && parsed.origin !== "https://fonts.gstatic.com";
  });
  assert.deepEqual(unexpectedExternal, []);
  assert.deepEqual(errors, []);
  assert.equal(
    fs.readFileSync(path.join(ROOT, "skills", "assets", "skills.js"), "utf8").includes("innerHTML"),
    false,
    "Skill evidence must not use unsafe innerHTML",
  );
  await context.close();
  return { candidates: 2, admitted: 0, cases: 9, languages: ["en", "uk", "ru"] };
}

async function validateAxiomArchiveShell(browser, origin, tailwindRuntime) {
  const manifestPath = path.join(ROOT, "assets", "pets", "axiom", "pet.json");
  const atlasPath = path.join(ROOT, "assets", "pets", "axiom", "spritesheet.webp");
  const manifestSource = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestSource);
  const atlasHash = crypto.createHash("sha256").update(fs.readFileSync(atlasPath)).digest("hex");

  assert.equal(manifest.spriteVersionNumber, 2);
  assert.deepEqual(manifest.atlas, {
    columns: 8,
    rows: 11,
    cellWidth: 192,
    cellHeight: 208,
    width: 1536,
    height: 2288,
  });
  assert.equal(atlasHash, manifest.spritesheetSha256);
  assert.equal(manifest.authority.animationCreatesAuthority, false);
  assert.equal(manifest.authority.candidateIsReleasedAnswer, false);
  assert.equal(manifest.authority.releaseAuthority, "SaC/PoR Gate");
  assert.equal(/[A-Z]:\\|file:\/\/|session_token|api[_-]?key/i.test(manifestSource), false);

  const selectedRoutes = [
    ["/", "home", "Home"],
    ["/genesis/", "genesis", "Genesis"],
    ["/benchmark/", "benchmark", "Benchmark"],
    ["/gate.html", "gate", "Gate"],
    ["/skills/", "skills", "Skill Forge"],
  ];
  const results = [];
  const releasedFixture =
    "Gate is the release authority.\n\nSources:\n[1] public:gate:runtime-decision-contract:v0.1";
  const unsafeMarkupFixture = '<img src=x onerror="window.__axiomUnsafe=1"> remains data.';

  function archiveResponse(payload) {
    const question = String(payload?.question || "");
    if (question.includes("no evidence")) {
      return {
        schemaVersion: "semeai.axiom-public-answer.v0.1",
        query: question,
        routeContext: payload.routeContext,
        evidenceBundle: {
          schemaVersion: "semeai.axiom-evidence-bundle.v0.1",
          query: question,
          routeContext: payload.routeContext,
          noEvidence: true,
          evidence: [],
          authority: {
            retrievalIsTruth: false,
            retrievalIsReleaseAuthority: false,
            candidateAnswerProduced: false,
            releaseAuthority: "SaC/PoR Gate",
          },
        },
        candidate: null,
        release: {
          gateEvaluated: false,
          action: null,
          internalDecision: null,
          showToUser: false,
          decisionReceiptId: null,
          receipt_id: null,
          executionReceiptId: null,
          reason: "No matching public evidence; no candidate was generated.",
          auditPreserved: null,
        },
        releasedAnswer: null,
      };
    }

    const action = question.includes("block this") ? "BLOCK" : "SHOW";
    const answer = question.includes("markup") ? unsafeMarkupFixture : releasedFixture;
    const releasedAnswer = action === "SHOW" ? answer : null;
    const receiptId = action === "SHOW" ? "decision-show-fixture" : "decision-block-fixture";
    return {
      schemaVersion: "semeai.axiom-public-answer.v0.1",
      query: question,
      routeContext: payload.routeContext,
      evidenceBundle: {
        schemaVersion: "semeai.axiom-evidence-bundle.v0.1",
        query: question,
        routeContext: payload.routeContext,
        noEvidence: false,
        evidence: [
          {
            sourceId: "public:gate:runtime-decision-contract:v0.1",
            title: "Runtime release-decision contract",
            summary: "Generation creates a candidate; the Gate separately decides release.",
            evidenceType: "PUBLIC_CONTRACT",
            visibility: "PUBLIC",
            admissionState: "PUBLIC_CONTRACT",
            date: "2026-07-29",
            version: "0.1",
            route: "/gate.html#semantics-title",
            source: { identity: "semeai.tech:docs/runtime_decision_contract.md@0.1" },
            facts: {},
            relevanceScore: 12,
            contentTrust: "UNTRUSTED_DATA",
          },
        ],
        authority: {
          retrievalIsTruth: false,
          retrievalIsReleaseAuthority: false,
          candidateAnswerProduced: false,
          releaseAuthority: "SaC/PoR Gate",
        },
      },
      candidate: {
        candidateId: "axiom-candidate-fixture",
        candidateHash: question.includes("mutated after gate")
          ? "0".repeat(64)
          : crypto.createHash("sha256").update(answer).digest("hex"),
        candidateTextIncluded: false,
        state: "CANDIDATE_EVALUATED_BY_GATE",
      },
      release: {
        gateEvaluated: true,
        action,
        internalDecision: action === "SHOW" ? "PROCEED" : "SILENCE",
        showToUser: action === "SHOW",
        decisionReceiptId: receiptId,
        receipt_id: receiptId,
        executionReceiptId: null,
        reason:
          action === "SHOW"
            ? "The candidate is supported by supplied public evidence."
            : "The candidate is withheld by the Gate.",
        riskDetails: action === "SHOW" ? [] : ["unsafe_action"],
        nextStep: action === "SHOW" ? "Show the candidate exactly." : "Do not release.",
        auditPreserved: true,
        contextIntegrity: "ok",
      },
      releasedAnswer,
    };
  }

  for (const [route, routeKey, routeLabel] of selectedRoutes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" });
    const page = await context.newPage();
    const errors = [];
    const archiveRequests = [];
    await wirePage(page, tailwindRuntime, errors);
    await page.route("https://api.semeai.tech/v0/archive/query", async (requestRoute) => {
      const payload = requestRoute.request().postDataJSON();
      archiveRequests.push(payload);
      if (String(payload?.question || "").includes("service outage")) {
        await requestRoute.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            schemaVersion: "semeai.axiom-service-unavailable.v0.1",
            error: "bounded outage fixture",
          }),
        });
        return;
      }
      await requestRoute.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(archiveResponse(payload)),
      });
    });
    await loadRoute(page, origin, route);
    await page.waitForSelector('[data-axiom-agent][data-asset-state="ready"]');

    assert.equal(await page.locator("[data-axiom-agent]").count(), 1);
    assert.equal(await page.locator(".axiom-agent__launcher").getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator("[data-axiom-agent]").getAttribute("data-state"), "idle");

    await page.locator(".axiom-agent__launcher").click();
    assert.equal(await page.locator(".axiom-agent__launcher").getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator(".axiom-agent__panel").isVisible(), true);
    assert.equal(await page.locator(".axiom-agent__mode").innerText(), "PUBLIC EVIDENCE");
    assert.equal(await page.locator(".axiom-agent__route-identity strong").innerText(), routeLabel);
    assert.match(
      await page.locator(".axiom-agent__boundary").innerText(),
      /An answer appears only when SaC\/PoR Gate permits release/,
    );
    assert.equal(await page.locator(".axiom-agent__query input").count(), 1);
    assert.equal(await page.locator(".axiom-agent__query input").getAttribute("maxlength"), "256");
    assert.equal(await page.locator(".axiom-agent__source-list a").count(), 3);

    const geometry = await page.evaluate(() => {
      const panel = document.querySelector(".axiom-agent__panel").getBoundingClientRect();
      return {
        route: window.SemeAI_Axiom.getState().route,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        panelLeft: panel.left,
        panelRight: panel.right,
        panelTop: panel.top,
        panelBottom: panel.bottom,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.equal(geometry.route, routeKey);
    assert.ok(geometry.panelLeft >= 0 && geometry.panelRight <= geometry.viewportWidth);
    assert.ok(geometry.panelTop >= 0 && geometry.panelBottom <= geometry.viewportHeight);
    assert.equal(geometry.overflow, 0);

    if (route === "/") {
      const mappings = await page.evaluate(async () => {
        const read = () => {
          const root = document.querySelector("[data-axiom-agent]");
          return {
            state: root.dataset.state,
            row: Number(root.dataset.spriteRow),
            column: Number(root.dataset.spriteColumn),
          };
        };
        const values = {};
        for (const state of ["waiting", "running", "review", "failed", "idle"]) {
          window.SemeAI_Axiom.setState(state, "browser-contract-test");
          values[state] = read();
        }
        window.SemeAI_Axiom.lookAtAngle(90);
        values.lookRight = read();
        window.SemeAI_Axiom.lookAtAngle(270);
        values.lookLeft = read();
        return values;
      });
      assert.equal(mappings.waiting.row, 6);
      assert.equal(mappings.running.row, 7);
      assert.equal(mappings.review.row, 8);
      assert.equal(mappings.failed.row, 5);
      assert.equal(mappings.idle.row, 0);
      assert.deepEqual([mappings.lookRight.row, mappings.lookRight.column], [9, 4]);
      assert.deepEqual([mappings.lookLeft.row, mappings.lookLeft.column], [10, 4]);

      const retrieval = await page.evaluate(async () => {
        const gate = await window.SemeAI_AxiomArchive.search("release authority gate", {
          routeContext: "gate",
        });
        const skills = await window.SemeAI_AxiomArchive.search("skill admission review", {
          routeContext: "skills",
        });
        const absent = await window.SemeAI_AxiomArchive.search("cicada-739-unrepresented");
        return { gate, skills, absent };
      });
      assert.equal(retrieval.gate.schemaVersion, "semeai.axiom-evidence-bundle.v0.1");
      assert.equal(retrieval.gate.noEvidence, false);
      assert.equal(retrieval.gate.evidence[0].sourceId, "public:gate:runtime-decision-contract:v0.1");
      assert.equal(retrieval.gate.evidence.every((item) => item.visibility === "PUBLIC"), true);
      assert.equal(retrieval.gate.evidence.every((item) => item.contentTrust === "UNTRUSTED_DATA"), true);
      assert.deepEqual(retrieval.gate.authority, {
        retrievalIsTruth: false,
        retrievalIsReleaseAuthority: false,
        candidateAnswerProduced: false,
        releaseAuthority: "SaC/PoR Gate",
      });
      assert.equal(retrieval.skills.evidence[0].sourceId, "public:skills:registry:v0.1");
      assert.equal(retrieval.absent.noEvidence, true);
      assert.deepEqual(retrieval.absent.evidence, []);
      assert.equal(Object.hasOwn(retrieval.gate, "answer"), false);
      assert.equal(Object.hasOwn(retrieval.gate, "receipt"), false);

      const queryInput = page.locator(".axiom-agent__query input");
      await queryInput.fill("Who is the release authority?");
      await queryInput.press("Enter");
      await page.locator('.axiom-agent__result[data-action="show"]').waitFor();
      assert.deepEqual(archiveRequests[0], {
        question: "Who is the release authority?",
        routeContext: "home",
        limit: 5,
      });
      assert.equal(await page.locator(".axiom-agent__result-action").innerText(), "SHOW / PROCEED");
      assert.equal(await page.locator(".axiom-agent__result-answer").innerText(), releasedFixture);
      assert.equal(
        await page.locator(".axiom-agent__result-receipt").innerText(),
        "Decision receipt: decision-show-fixture",
      );
      assert.equal(await page.locator(".axiom-agent__result-sources a").getAttribute("href"), "/gate.html#semantics-title");
      assert.equal(await page.locator("[data-axiom-agent]").getAttribute("data-state"), "idle");
      assert.equal(
        await page.locator(".axiom-agent__result").evaluate((node) => node === document.activeElement),
        true,
        "A completed query should move focus to the Gate result",
      );

      await queryInput.fill("block this candidate");
      await queryInput.press("Enter");
      await page.locator('.axiom-agent__result[data-action="block"]').waitFor();
      assert.equal(await page.locator(".axiom-agent__result-action").innerText(), "BLOCK / SILENCE");
      assert.equal(await page.locator(".axiom-agent__result-answer").isHidden(), true);
      assert.equal(await page.locator(".axiom-agent__result-answer").textContent(), "");
      assert.equal(await page.locator("[data-axiom-agent]").getAttribute("data-state"), "review");
      assert.equal(
        await page.locator(".axiom-agent__result").innerText().then((text) => text.includes(releasedFixture)),
        false,
        "A held candidate must not render as an answer or fallback",
      );

      await queryInput.fill("no evidence for this");
      await queryInput.press("Enter");
      await page.locator('.axiom-agent__result[data-action="no_evidence"]').waitFor();
      assert.equal(
        await page.locator(".axiom-agent__result-action").innerText(),
        "NO EVIDENCE / NOT EVALUATED",
      );
      assert.match(await page.locator(".axiom-agent__result-reason").innerText(), /no candidate was generated/i);

      await queryInput.fill("show markup as evidence");
      await queryInput.press("Enter");
      await page.locator('.axiom-agent__result[data-action="show"]').waitFor();
      assert.equal(await page.locator(".axiom-agent__result-answer").textContent(), unsafeMarkupFixture);
      assert.equal(await page.locator(".axiom-agent__result-answer img").count(), 0);
      assert.equal(await page.evaluate(() => Boolean(window.__axiomUnsafe)), false);

      await queryInput.fill("mutated after gate");
      await queryInput.press("Enter");
      await page.waitForFunction(
        () =>
          document.querySelector("[data-axiom-agent]")?.dataset.state === "failed" &&
          document.querySelector(".axiom-agent__result")?.hidden === true,
      );
      assert.match(
        await page.locator("[data-axiom-agent]").getAttribute("data-request-error"),
        /differs from the evaluated candidate/,
      );

      await queryInput.fill("service outage");
      await queryInput.press("Enter");
      await page.waitForFunction(
        () =>
          document.querySelector("[data-axiom-agent]")?.dataset.state === "failed" &&
          document.querySelector(".axiom-agent__result")?.hidden === true,
      );
      assert.match(await page.locator(".axiom-agent__status").innerText(), /archive service unavailable/i);

      await queryInput.fill("");
      await queryInput.press("Enter");
      assert.equal(await page.locator("[data-axiom-agent]").getAttribute("data-state"), "waiting");
      assert.match(await page.locator(".axiom-agent__status").innerText(), /enter a public archive question/i);

      await page.evaluate(() => window.SemeAI_I18n.setLang("uk"));
      assert.equal(await page.locator(".axiom-agent__mode").innerText(), "ПУБЛІЧНІ ДОКАЗИ");
      assert.equal(await page.locator(".axiom-agent__query button").innerText(), "Запитати Axiom");
      await page.evaluate(() => window.SemeAI_I18n.setLang("ru"));
      assert.equal(await page.locator(".axiom-agent__mode").innerText(), "ПУБЛИЧНЫЕ ДОКАЗАТЕЛЬСТВА");
      assert.equal(await page.locator(".axiom-agent__query button").innerText(), "Спросить Axiom");
    }

    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".axiom-agent__panel").isHidden(), true);
    assert.equal(await page.locator(".axiom-agent__launcher").getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator(".axiom-agent__launcher").evaluate((node) => node === document.activeElement), true);
    assert.deepEqual(errors, [], `${route} Axiom shell should remain error-free`);
    results.push(routeKey);
    await context.close();
  }

  const reducedContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const reducedPage = await reducedContext.newPage();
  const reducedErrors = [];
  await wirePage(reducedPage, tailwindRuntime, reducedErrors);
  await loadRoute(reducedPage, origin, "/gate.html");
  await reducedPage.waitForSelector('[data-axiom-agent][data-asset-state="ready"]');
  const before = await reducedPage.locator("[data-axiom-agent]").evaluate((node) => ({
    row: node.dataset.spriteRow,
    column: node.dataset.spriteColumn,
  }));
  await reducedPage.waitForTimeout(420);
  const after = await reducedPage.locator("[data-axiom-agent]").evaluate((node) => ({
    row: node.dataset.spriteRow,
    column: node.dataset.spriteColumn,
  }));
  assert.deepEqual(after, before, "reduced motion should keep one meaningful static Axiom frame");
  assert.equal(
    await reducedPage.evaluate(() => window.SemeAI_Axiom.lookAtAngle(90)),
    false,
    "reduced motion should suppress pointer-driven gaze animation",
  );
  assert.deepEqual(reducedErrors, []);
  await reducedContext.close();

  return {
    routes: results,
    spriteVersionNumber: manifest.spriteVersionNumber,
    atlasHash,
    publicEvidenceEntries: 9,
    retrievalContract: "typed evidence bundle or truthful no-evidence result",
    reducedMotion: "static frame",
    chatBackend: "candidate output is rendered only after a valid Gate SHOW response",
  };
}

async function validateRepositoryWorkspaceBoundary(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const fulfillRepositoryConfiguration = async (route) => {
    const pathName = new URL(route.request().url()).pathname;
    if (pathName === "/v0/benchmark/configuration") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          github: { enabled: false, app_configured: false },
          analyzer: { configured: false },
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  };
  await page.route("https://api.semeai.tech/**", fulfillRepositoryConfiguration);
  await page.route("http://127.0.0.1:8787/**", fulfillRepositoryConfiguration);
  await page.goto(`${origin}/benchmark/workspace/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#workspace-notice:not([hidden])"));
  assert.equal(await page.locator("#sign-in-button").getAttribute("href"), null);
  assert.equal(await page.locator("#sign-in-button").getAttribute("aria-disabled"), "true");
  assert.equal(
    await page.locator("#workspace-notice").textContent(),
    "GitHub identity authorization is not configured for this environment.",
  );
  assert.deepEqual(errors, []);
  await context.close();
  return "disabled until backend reports real GitHub and analyzer configuration";
}

async function main() {
  const playwright = loadPlaywright();
  const { server, origin } = await startServer();
  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const tailwindRuntime = await loadTailwindRuntime();
    const matrix = await validateMatrix(browser, origin, tailwindRuntime);
    const interactions = await validateInteraction(browser, origin, tailwindRuntime);
    const publicRouteContext = await validatePublicRouteContext(browser, origin, tailwindRuntime);
    const systemMap = await validateSystemMap(browser, origin, tailwindRuntime);
    const deepLinks = await validateDeepLinks(browser, origin, tailwindRuntime);
    const noJavaScript = await validateNoJavaScript(browser, origin);
    const reducedMotion = await validateReducedMotion(browser, origin, tailwindRuntime);
    const accountWorkspaceFoundation = await validateAccountWorkspaceFoundation(browser, origin);
    const productRoadmap = await validateProductRoadmap(browser, origin, tailwindRuntime);
    await validateBenchmarkBoundary(browser, origin, tailwindRuntime);
    const motionSemantics = await validateMotionSemantics(browser, origin, tailwindRuntime);
    const genesisEvolutionTrace = await validateGenesisEvolutionTrace(browser, origin, tailwindRuntime);
    const skillForge = await validateSkillForge(browser, origin, tailwindRuntime);
    const axiomArchiveShell = await validateAxiomArchiveShell(browser, origin, tailwindRuntime);
    const repositoryWorkspaceBoundary = await validateRepositoryWorkspaceBoundary(browser, origin);

    console.log(
      JSON.stringify(
        {
          matrix: matrix.length,
          routes: ROUTES.length,
          viewports: VIEWPORTS.map((viewport) => viewport.join("x")),
          keyboardLanguageAndMobileNavigation: interactions,
          publicRouteContext,
          systemMap,
          deepLinks,
          noJavaScript,
          reducedMotion,
          accountWorkspaceFoundation,
          productRoadmap,
          motionSemantics,
          genesisEvolutionTrace,
          skillForge,
          axiomArchiveShell,
          repositoryWorkspaceBoundary,
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
