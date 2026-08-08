# SemeAI Identity Foundation V1

## Boundaries

```text
Public product
  -> Supabase Auth (Google or GitHub)
  -> stable auth.users UUID
  -> private workspace (authenticated)
  -> owner CRM (authenticated + admin_memberships + RLS)

Generated candidate
  -> SaC / PoR Gate
  -> PROCEED / NEEDS_REVIEW / SILENCE
```

Identity, authorization, and Gate authority remain separate. Signing in never grants release authority. Axiom may witness an authenticated session but does not authenticate, authorize, or decide release.

## Data model

- `profiles`: user-owned display profile keyed to `auth.users.id`.
- `linked_identities`: Google/GitHub provider lineage keyed to one stable SemeAI user.
- `registrations`: owner-only CRM projection of real authenticated registrations.
- `admin_memberships`: stable owner/admin authorization; no frontend role flag.

The auth trigger creates and refreshes the profile and registration projection from Supabase-controlled user metadata. The identity trigger preserves provider lineage. A future explicit `linkIdentity()` UX can attach a second provider to the same SemeAI UUID without changing application data ownership.

## Session model

The official Supabase browser client uses PKCE, automatic refresh, and `sessionStorage` through the supported storage interface. The browser restores the session across reloads in the same tab without adding a home-grown JWT store. Private routes validate the user with `auth.getUser()` before rendering. Database RLS remains the actual private-data boundary.

## CRM security

The `/crm/` HTML contains no registration records. It first queries only the signed-in user's own `admin_memberships` row. Registration data is requested only after that authorization succeeds, and the `registrations` RLS policy independently enforces the same stable membership. A non-admin request returns no rows even if route JavaScript is modified.

Only `lifecycle_status` and `owner_note` are writable by an admitted administrator. OAuth tokens, provider secrets, service-role keys, and raw provider responses are never stored in the CRM or rendered into HTML.

## Honest V1 workspace

The workspace proves a real private session, identity, and navigation to the real Gate and Benchmark. Recent runs, receipts, benchmarks, and saved evidence remain honest empty states until their own persistence contracts exist.
