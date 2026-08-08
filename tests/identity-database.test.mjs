import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(
  path.join(ROOT, "supabase", "migrations", "202608080001_identity_foundation_v1.sql"),
  "utf8",
);

const ownerId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const ownerIdentityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const memberIdentityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const db = new PGlite();

async function asUser(userId, sql) {
  await db.exec("set role authenticated");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      raw_app_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      last_sign_in_at timestamptz
    );
    create table auth.identities (
      id uuid primary key,
      user_id uuid not null references auth.users(id) on delete cascade,
      identity_data jsonb not null default '{}'::jsonb,
      provider text not null,
      provider_id text not null,
      created_at timestamptz not null default now(),
      last_sign_in_at timestamptz
    );
    create function auth.uid()
    returns uuid
    language sql
    stable
    set search_path = ''
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);

  await db.exec(migration);

  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, last_sign_in_at)
     values ($1, $2, $3::jsonb, $4::jsonb, $5, $6)`,
    [
      ownerId,
      "owner@example.test",
      JSON.stringify({ full_name: "Owner Identity", avatar_url: "https://avatars.githubusercontent.com/u/1" }),
      JSON.stringify({ provider: "google", providers: ["google"] }),
      "2026-08-08T06:00:00Z",
      "2026-08-08T07:00:00Z",
    ],
  );
  await db.query(
    `insert into auth.identities (id, user_id, identity_data, provider, provider_id, created_at, last_sign_in_at)
     values ($1, $2, $3::jsonb, 'google', 'google-101', $4, $5)`,
    [ownerIdentityId, ownerId, JSON.stringify({ email: "owner@example.test" }), "2026-08-08T06:00:00Z", "2026-08-08T07:00:00Z"],
  );

  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, last_sign_in_at)
     values ($1, null, $2::jsonb, $3::jsonb, $4, $5)`,
    [
      memberId,
      JSON.stringify({ user_name: "hidden-email-user" }),
      JSON.stringify({ provider: "github", providers: ["github"] }),
      "2026-08-08T06:30:00Z",
      "2026-08-08T07:30:00Z",
    ],
  );
  await db.query(
    `insert into auth.identities (id, user_id, identity_data, provider, provider_id, created_at, last_sign_in_at)
     values ($1, $2, '{}'::jsonb, 'github', 'github-202', $3, $4)`,
    [memberIdentityId, memberId, "2026-08-08T06:30:00Z", "2026-08-08T07:30:00Z"],
  );

  const generated = await db.query(`
    select
      (select count(*)::int from public.profiles) as profiles,
      (select count(*)::int from public.registrations) as registrations,
      (select count(*)::int from public.linked_identities) as identities
  `);
  assert.deepEqual(generated.rows[0], { profiles: 2, registrations: 2, identities: 2 });

  const hiddenEmail = await db.query("select display_name, primary_email, providers from public.registrations where user_id = $1", [memberId]);
  assert.equal(hiddenEmail.rows[0].display_name, "hidden-email-user");
  assert.equal(hiddenEmail.rows[0].primary_email, null);
  assert.deepEqual(hiddenEmail.rows[0].providers, ["github"]);

  const memberProfiles = await asUser(memberId, "select id from public.profiles order by id");
  assert.deepEqual(memberProfiles.rows.map((row) => row.id), [memberId]);
  const memberRegistrations = await asUser(memberId, "select user_id from public.registrations");
  assert.equal(memberRegistrations.rows.length, 0);
  const memberAdminRow = await asUser(memberId, "select role from public.admin_memberships");
  assert.equal(memberAdminRow.rows.length, 0);

  await db.query("insert into public.admin_memberships (user_id, role) values ($1, 'owner')", [ownerId]);
  const ownerMembership = await asUser(ownerId, "select role from public.admin_memberships");
  assert.deepEqual(ownerMembership.rows, [{ role: "owner" }]);
  const ownerRegistrations = await asUser(ownerId, "select user_id from public.registrations order by created_at");
  assert.deepEqual(ownerRegistrations.rows.map((row) => row.user_id), [ownerId, memberId]);

  await asUser(ownerId, `update public.registrations set lifecycle_status = 'contacted', owner_note = 'Owner-only note' where user_id = '${memberId}'`);
  const updated = await db.query("select lifecycle_status, owner_note from public.registrations where user_id = $1", [memberId]);
  assert.deepEqual(updated.rows[0], { lifecycle_status: "contacted", owner_note: "Owner-only note" });

  const linkedForMember = await asUser(memberId, "select provider, provider_user_id from public.linked_identities");
  assert.deepEqual(linkedForMember.rows, [{ provider: "github", provider_user_id: "github-202" }]);

  console.log("Identity database migration, triggers, grants, and RLS contracts passed.");
} finally {
  await db.close();
}
