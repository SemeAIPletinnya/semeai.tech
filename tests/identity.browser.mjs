import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp" };
const EVIDENCE_DIR = process.env.IDENTITY_EVIDENCE_DIR ? path.resolve(process.env.IDENTITY_EVIDENCE_DIR) : "";

async function capture(page, name) {
  if (!EVIDENCE_DIR) return;
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`), fullPage: true });
}

function serve() {
  const server = http.createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, "http://local").pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.resolve(ROOT, `.${pathname}`);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return response.writeHead(404).end("not found");
    response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

function clientFixture({ signedIn = true, admin = false, provider = "google", records = [] } = {}) {
  const user = {
    id: "4d30f985-a307-4fd8-ad3e-c80ae2db365a",
    email: provider === "github" ? "private-github@example.test" : "owner@example.test",
    created_at: "2026-08-08T06:00:00Z",
    app_metadata: { provider, providers: [provider] },
    user_metadata: { full_name: provider === "github" ? "GitHub Identity" : "Anton SemeAI", avatar_url: "" },
    identities: [{ provider }],
  };
  return `(() => {
    const scenario = ${JSON.stringify({ signedIn, admin, provider, records, user })};
    const log = [];
    const success = (data) => Promise.resolve({ data, error: null });
    function builder(table) {
      const state = { table, action: "select", payload: null };
      const api = {
        select() { state.action = "select"; return api; },
        update(payload) { state.action = "update"; state.payload = payload; return api; },
        eq(column, value) { state.eq = [column, value]; return api; },
        maybeSingle() {
          log.push({ table, action: state.action, eq: state.eq });
          if (table === "profiles") return success({ id: scenario.user.id, display_name: scenario.user.user_metadata.full_name, primary_email: scenario.user.email, avatar_url: "", created_at: scenario.user.created_at });
          if (table === "admin_memberships") return success(scenario.admin ? { role: "owner" } : null);
          return success(null);
        },
        order() { log.push({ table, action: state.action }); return success(table === "registrations" ? scenario.records : []); },
        then(resolve, reject) { log.push({ table, action: state.action, payload: state.payload, eq: state.eq }); return success(null).then(resolve, reject); }
      };
      return api;
    }
    window.__SEMEAI_IDENTITY_TEST_NO_REDIRECT__ = true;
    window.__SEMEAI_IDENTITY_TEST_CLIENT__ = {
      __log: log,
      auth: {
        getSession: () => success({ session: scenario.signedIn ? { user: scenario.user } : null }),
        getUser: () => success({ user: scenario.signedIn ? scenario.user : null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signInWithOAuth: (options) => { log.push({ auth: "oauth", options }); return success({ url: "https://provider.test" }); },
        signOut: () => { log.push({ auth: "signout" }); return success({}); },
      },
      from: builder,
    };
  })();`;
}

async function newPage(browser, scenario, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, locale: "en-US" });
  const page = await context.newPage();
  if (scenario) await page.addInitScript({ content: clientFixture(scenario) });
  return { context, page };
}

async function run() {
  const { server, origin } = await serve();
  const browser = await chromium.launch({ headless: true });
  try {
    {
      const { context, page } = await newPage(browser, { signedIn: false });
      await page.goto(`${origin}/account/`, { waitUntil: "networkidle" });
      await page.waitForSelector("#identity-signed-out:not([hidden])");
      assert.equal(await page.locator('[data-identity-provider="google"]').count(), 1);
      assert.equal(await page.locator('[data-identity-provider="github"]').count(), 1);
      await capture(page, "sign-in-desktop");
      await page.locator('[data-identity-provider="github"]').click();
      const oauth = await page.evaluate(() => window.__SEMEAI_IDENTITY_TEST_CLIENT__.__log.find((entry) => entry.auth === "oauth"));
      assert.equal(oauth.options.provider, "github");
      assert.equal(oauth.options.options.redirectTo, `${origin}/workspace/`);
      assert.equal(await page.locator('input[type="password"]').count(), 0);
      await capture(page, "auth-redirecting-desktop");
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, { signedIn: false }, { width: 390, height: 844 });
      await page.goto(`${origin}/account/`, { waitUntil: "networkidle" });
      await page.waitForSelector("#identity-signed-out:not([hidden])");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2), false);
      await capture(page, "sign-in-mobile");
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, { signedIn: true, provider: "google" });
      await page.goto(`${origin}/account/`, { waitUntil: "networkidle" });
      await page.waitForSelector("#identity-signed-in:not([hidden])");
      assert.equal(await page.locator("#identity-providers").textContent(), "Google");
      await capture(page, "account-google-desktop");
      await context.close();
    }

    for (const viewport of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ]) {
      const { context, page } = await newPage(browser, { signedIn: true, provider: "github" }, viewport);
      await page.goto(`${origin}/workspace/`, { waitUntil: "networkidle" });
      await page.waitForSelector("#workspace-private:not([hidden])");
      assert.equal(await page.locator("#workspace-display-name").textContent(), "GitHub Identity");
      assert.equal(await page.locator("#workspace-providers").textContent(), "GitHub");
      assert.equal(await page.locator(".workspace-empty-state").count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2), false);
      if ((viewport.width === 390 && viewport.height === 844) || (viewport.width === 1440 && viewport.height === 900)) {
        await capture(page, `workspace-github-${viewport.width}x${viewport.height}`);
      }
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, { signedIn: true, admin: false });
      await page.goto(`${origin}/crm/`, { waitUntil: "networkidle" });
      await page.waitForSelector("#crm-denied:not([hidden])");
      const tables = await page.evaluate(() => window.__SEMEAI_IDENTITY_TEST_CLIENT__.__log.filter((entry) => entry.table).map((entry) => entry.table));
      assert.deepEqual(tables, ["admin_memberships"]);
      assert.equal(await page.locator(".crm-row").count(), 0);
      await capture(page, "crm-access-denied-desktop");
      await context.close();
    }

    {
      const records = [
        { user_id: "u1", created_at: "2026-08-08T07:00:00Z", last_sign_in_at: "2026-08-08T07:20:00Z", display_name: "Google Person", primary_email: "google@example.test", avatar_url: "", providers: ["google"], lifecycle_status: "registered", owner_note: "" },
        { user_id: "u2", created_at: "2026-08-07T07:00:00Z", last_sign_in_at: "2026-08-08T07:20:00Z", display_name: "GitHub Person", primary_email: "github@example.test", avatar_url: "", providers: ["github"], lifecycle_status: "contacted", owner_note: "Requested pilot" },
      ];
      for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
        const { context, page } = await newPage(browser, { signedIn: true, admin: true, records }, viewport);
        await page.goto(`${origin}/crm/`, { waitUntil: "networkidle" });
        await page.waitForSelector("#crm-private:not([hidden])");
        assert.equal(await page.locator(".crm-row").count(), 2);
        assert.equal(await page.locator("#crm-total").textContent(), "2");
        assert.equal(await page.locator("#crm-google").textContent(), "1");
        assert.equal(await page.locator("#crm-github").textContent(), "1");
        await page.locator("#crm-search").fill("GitHub");
        assert.equal(await page.locator(".crm-row:not([hidden])").count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2), false);
        await page.locator("#crm-search").fill("");
        await capture(page, `crm-owner-${viewport.width}x${viewport.height}`);
        await context.close();
      }
    }

    {
      const { context, page } = await newPage(browser, { signedIn: false });
      await page.goto(`${origin}/account/?error_description=Provider+cancelled`, { waitUntil: "networkidle" });
      await page.waitForSelector("#identity-error:not([hidden])");
      assert.match(await page.locator("#identity-error-message").textContent(), /Provider cancelled/);
      assert.equal(await page.locator("#identity-signed-in:not([hidden])").count(), 0);
      await capture(page, "auth-error-desktop");
      await context.close();
    }

    {
      const { context, page } = await newPage(browser, null);
      await page.goto(`${origin}/account/`, { waitUntil: "networkidle" });
      await page.waitForSelector("#identity-unconfigured:not([hidden])");
      assert.equal(await page.locator("#identity-signed-out:not([hidden])").count(), 0);
      await capture(page, "provider-configuration-boundary");
      await context.close();
    }

    console.log("Identity browser contracts passed.");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
