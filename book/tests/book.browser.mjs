import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, "..", "..");
const requireFromTest = createRequire(import.meta.url);

function loadPlaywright() {
  try {
    return requireFromTest("playwright");
  } catch (_) {
    // Continue through environment-provided runtime roots.
  }

  const roots = [
    process.env.PLAYWRIGHT_NODE_MODULES,
    ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : []),
    path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules"),
  ].filter(Boolean);
  for (const root of roots) {
    try {
      return requireFromTest(path.join(root, "playwright"));
    } catch (_) {
      // Try the next environment-provided runtime.
    }
  }
  throw new Error("Playwright is required. Expose the existing runtime through PLAYWRIGHT_NODE_MODULES.");
}

function contentType(filePath) {
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".webp": "image/webp",
      ".ico": "image/x-icon",
    }[path.extname(filePath).toLowerCase()] || "application/octet-stream"
  );
}

async function startServer() {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const target = path.resolve(ROOT, `.${pathname}`);
    if ((target !== ROOT && !target.startsWith(`${ROOT}${path.sep}`)) || !fs.existsSync(target)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": contentType(target), "cache-control": "no-store" });
    fs.createReadStream(target).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function openBook(browser, origin, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1440, height: 900 },
    reducedMotion: options.reducedMotion || "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${origin}/book/${options.hash ? `#${options.hash}` : ""}`, { waitUntil: "networkidle" });
  return { context, page, errors };
}

async function activeChapter(page) {
  return page.locator("[data-chapter-link][aria-current='location']").getAttribute("data-chapter-link");
}

async function main() {
  const { chromium } = loadPlaywright();
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });
  let assertions = 0;

  try {
    const base = await openBook(browser, origin);
    assert.equal(await base.page.locator(".book-page").count(), 24);
    assert.equal(await base.page.locator("#book-start ol > li").count(), 7);
    assert.deepEqual(base.errors, []);
    assertions += 3;

    await base.page.locator("#book-collapse-button").click();
    assert.equal(await base.page.locator("body").evaluate((node) => node.classList.contains("book-nav-collapsed")), true);
    assert.equal(await base.page.locator("#book-nav-rail").isVisible(), true);
    await base.page.locator("#book-rail-expand").click();
    assert.equal(await base.page.locator("body").evaluate((node) => node.classList.contains("book-nav-collapsed")), false);
    assertions += 3;

    await base.page.locator("#book-main").focus();
    await base.page.locator("#book-main").press("ArrowRight");
    assert.equal(await activeChapter(base.page), "every-ai-system");
    await base.page.locator("#every-ai-system .book-turn--next").click();
    await base.page.waitForFunction(() => location.hash === "#observable-path");
    assert.equal(await activeChapter(base.page), "observable-path");
    assertions += 2;

    await base.page.evaluate(() => {
      location.hash = "gate";
    });
    await base.page.waitForFunction(() => document.querySelector("[data-chapter-link][aria-current='location']")?.dataset.chapterLink === "gate");
    await base.page.evaluate(() => {
      location.hash = "evidence";
    });
    await base.page.waitForFunction(() => document.querySelector("[data-chapter-link][aria-current='location']")?.dataset.chapterLink === "evidence");
    await base.page.goBack();
    await base.page.waitForFunction(() => location.hash === "#gate");
    assert.equal(await activeChapter(base.page), "gate");
    await base.page.goForward();
    await base.page.waitForFunction(() => location.hash === "#evidence");
    assert.equal(await activeChapter(base.page), "evidence");
    assertions += 2;
    await base.context.close();

    for (const [hash, target, progress] of [
      ["gate", "gate", "11"],
      ["runtime", "runtime-stack", "14"],
      ["evidence", "evidence", "15"],
    ]) {
      const direct = await openBook(browser, origin, { hash });
      await direct.page.waitForTimeout(220);
      const state = await direct.page.evaluate((id) => {
        const targetElement = document.getElementById(id);
        return {
          active: document.querySelector("[data-chapter-link][aria-current='location']")?.dataset.chapterLink,
          top: targetElement?.getBoundingClientRect().top,
          progress: document.querySelector("#book-progress")?.getAttribute("aria-valuenow"),
        };
      }, target);
      assert.equal(state.active, target);
      assert.equal(state.progress, progress);
      assert.ok(state.top >= 60 && state.top < 110, `${hash} should be visible below the fixed header`);
      assert.deepEqual(direct.errors, []);
      assertions += 4;
      await direct.context.close();
    }

    for (const [width, height] of [
      [360, 800],
      [390, 844],
      [844, 390],
      [768, 1024],
      [1024, 768],
      [1440, 900],
      [1920, 1080],
    ]) {
      const responsive = await openBook(browser, origin, { viewport: { width, height } });
      const overflow = await responsive.page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      assert.equal(overflow, 0, `${width}x${height} horizontal overflow`);
      if (width <= 1024) {
        await responsive.page.locator("#book-menu-button").click();
        assert.equal(await responsive.page.locator("body").evaluate((node) => node.classList.contains("book-nav-open")), true);
        await responsive.page.keyboard.press("Escape");
        assert.equal(await responsive.page.locator("body").evaluate((node) => node.classList.contains("book-nav-open")), false);
        assertions += 2;
      }
      assert.deepEqual(responsive.errors, []);
      assertions += 2;
      await responsive.context.close();
    }

    const motion = await openBook(browser, origin, { reducedMotion: "no-preference" });
    assert.equal(await motion.page.locator(".book-field-path.is-released").first().evaluate((node) => getComputedStyle(node).animationName), "bookEvidenceFlow");
    await motion.page.locator("#gate").scrollIntoViewIfNeeded();
    await motion.page.waitForFunction(() => document.querySelector(".book-field")?.classList.contains("is-motion-paused"));
    assert.equal(await motion.page.locator(".book-field").evaluate((node) => node.classList.contains("is-motion-paused")), true);
    assertions += 2;
    await motion.context.close();

    const reduced = await openBook(browser, origin, { reducedMotion: "reduce" });
    assert.equal(await reduced.page.locator(".book-field-path.is-released").first().evaluate((node) => getComputedStyle(node).animationName), "none");
    assertions += 1;
    await reduced.context.close();

    const print = await openBook(browser, origin);
    await print.page.emulateMedia({ media: "print" });
    const printPages = await print.page.locator(".book-page").evaluateAll((pages) =>
      pages.map((page) => ({ id: page.id, overflow: page.scrollHeight - page.clientHeight })),
    );
    assert.equal(printPages.length, 24);
    assert.deepEqual(printPages.filter((page) => page.overflow !== 0), []);
    assertions += 2;
    await print.context.close();

    console.log(`ok - ${assertions} Engineering Book assertions passed`);
  } finally {
    await browser.close();
    await closeServer(server);
  }
}

await main();
