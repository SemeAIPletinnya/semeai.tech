import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const account = read("account", "index.html");
const workspace = read("workspace", "index.html");
const crm = read("crm", "index.html");
const runtime = read("assets", "js", "identity-app.mjs");
const config = read("assets", "js", "identity-config.js");
const migration = read("supabase", "migrations", "202608080001_identity_foundation_v1.sql");
const packageJson = JSON.parse(read("package.json"));

assert.match(account, /data-identity-provider="google"/);
assert.match(account, /data-identity-provider="github"/);
assert.doesNotMatch(account, /type="password"|account-register-form|email\/password/i);
assert.match(account, /identity-config\.js/);
assert.match(account, /identity-app\.mjs/);
assert.match(account, /https:\/\/\*\.supabase\.co/);

assert.match(workspace, /id="workspace-private"[^>]*hidden/);
assert.match(workspace, /No private history yet/i);
assert.match(workspace, /No example activity has been fabricated/i);
assert.doesNotMatch(workspace, /data-private-record|sample receipt/i);
assert.match(crm, /id="crm-private"[^>]*hidden/);
assert.match(crm, /OWNER-ONLY CRM/);
assert.doesNotMatch(crm, /data-semeai-nav|href="\/crm\/"/);

assert.match(runtime, /flowType:\s*"pkce"/);
assert.match(runtime, /storage:\s*window\.sessionStorage/);
assert.match(runtime, /auth\.getSession\(\)/);
assert.match(runtime, /auth\.getUser\(\)/);
assert.match(runtime, /signInWithOAuth/);
assert.match(runtime, /provider !== "google" && provider !== "github"/);
assert.match(runtime, /safeNextPath/);
assert.match(runtime, /ALLOWED_PRIVATE_ROUTES/);
assert.match(runtime, /window\.top !== window\.self/);
assert.match(runtime, /admin_memberships/);
assert.ok(runtime.indexOf("const membership = await") < runtime.indexOf("const registrationResult = await"), "CRM membership must be checked before registration query");
assert.doesNotMatch(runtime, /service[_-]?role|provider_token|provider_refresh_token|localStorage/i);

assert.equal(config.includes('supabaseUrl: ""'), true);
assert.equal(config.includes('supabasePublishableKey: ""'), true);
assert.equal(config.includes("enabled: false"), true);
assert.doesNotMatch(config, /sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{30,}/);

for (const table of ["profiles", "linked_identities", "registrations", "admin_memberships"]) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
}
assert.match(migration, /registrations_owner_select/);
assert.match(migration, /registrations_owner_update/);
assert.match(migration, /private\.is_semeai_admin\(\)/);
assert.match(migration, /memberships_select_self/);
assert.match(migration, /revoke all on public\.profiles[\s\S]+from anon/i);
assert.match(migration, /grant update \(lifecycle_status, owner_note\) on public\.registrations to authenticated/i);
assert.doesNotMatch(migration, /grant (insert|delete)[\s\S]+registrations[\s\S]+authenticated/i);
assert.match(migration, /auth\.users/);
assert.match(migration, /auth\.identities/);
assert.match(migration, /provider in \('google', 'github'\)/);

assert.equal(packageJson.dependencies["@supabase/supabase-js"], "2.112.2");
assert.match(packageJson.scripts["test:identity"], /identity-foundation\.test\.mjs/);
assert.ok(fs.statSync(path.join(ROOT, "assets", "js", "supabase-browser.mjs")).size > 100_000);

console.log("Identity foundation static/security contracts passed.");
