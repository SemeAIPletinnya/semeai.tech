# Supabase production configuration

The repository contains no Supabase project secret and no OAuth provider secret. The browser receives only the public project URL and publishable key after the project is configured. The service-role key must never enter this repository or GitHub Pages.

## Apply the database contract

1. Create a dedicated Supabase project for `semeai.tech`.
2. Open SQL Editor as the project owner.
3. Run `migrations/202608080001_identity_foundation_v1.sql`.
4. Inspect Authentication > Users after the first real login.
5. Admit the owner's stable `auth.users.id` to `public.admin_memberships` using the final operator statement at the bottom of the migration.

Do not grant CRM access by a frontend flag or by an unverified email comparison. The resulting membership is keyed to the stable Supabase user UUID.

## Auth URL configuration

Set Site URL to:

`https://semeai.tech`

Allow exactly these production redirects:

- `https://semeai.tech/account/`
- `https://semeai.tech/workspace/`
- `https://semeai.tech/crm/`

For local verification, additionally allow the exact development origin in use, for example:

- `http://127.0.0.1:4178/account/`
- `http://127.0.0.1:4178/workspace/`
- `http://127.0.0.1:4178/crm/`

Avoid broad wildcard redirects.

## Providers

Enable only Google and GitHub in Supabase Authentication Providers. Disable email/password, phone, and anonymous sign-in for V1.

Both provider applications use the callback shown by the Supabase dashboard:

`https://PROJECT_REF.supabase.co/auth/v1/callback`

- Google: create a Web OAuth client, add that exact authorized redirect URI, and place its client ID/secret only in the Supabase provider settings.
- GitHub: create an OAuth App, set its Authorization callback URL to that exact Supabase callback, and place its client ID/secret only in Supabase.

Never paste either provider secret into chat, `identity-config.js`, GitHub Pages, or a browser console.

## Public frontend configuration

After the project and both providers exist, set only these public values in `assets/js/identity-config.js`:

- `supabaseUrl`
- `supabasePublishableKey`
- `enabled: true`

The publishable key is intentionally client-visible and is safe only because every private table is protected by RLS. Do not substitute the service-role key.

## Admission sequence

1. Apply migration and configure redirects.
2. Verify Google real login, workspace, account, and logout.
3. Verify GitHub real login, hidden-email handling, workspace, account, and logout.
4. Admit the owner's stable UUID to `admin_memberships`.
5. Verify `/crm/` as owner and as a non-admin identity.
6. Run the complete repository test suite and secrets audit.
7. Only then merge and deploy.
