-- SemeAI Identity Foundation V1
-- Google + GitHub Auth -> private workspace -> owner-only registration CRM.
-- Apply in a dedicated Supabase project. Never run with a service-role key in the browser.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text not null default 'SemeAI user',
  avatar_url text,
  primary_email text
);

create table if not exists public.linked_identities (
  identity_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'github')),
  provider_user_id text not null,
  provider_email text,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz,
  unique (provider, provider_user_id)
);

create table if not exists public.registrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz,
  display_name text not null default 'SemeAI user',
  primary_email text,
  avatar_url text,
  providers text[] not null default '{}',
  lifecycle_status text not null default 'registered'
    check (lifecycle_status in ('registered', 'contacted', 'qualified', 'archived')),
  owner_note text not null default '' check (length(owner_note) <= 2000)
);

create table if not exists public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'User-owned display profile; never release authority.';
comment on table public.linked_identities is 'Provider identity lineage mapped to one stable SemeAI user.';
comment on table public.registrations is 'Owner-only CRM projection of real authenticated registrations.';
comment on table public.admin_memberships is 'Stable user-id authorization for the private CRM.';

create or replace function private.is_semeai_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin')
  );
$$;

revoke all on function private.is_semeai_admin() from public, anon;
grant execute on function private.is_semeai_admin() to authenticated;

create or replace function private.identity_display_name(metadata jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(metadata ->> 'full_name'), ''),
    nullif(trim(metadata ->> 'name'), ''),
    nullif(trim(metadata ->> 'user_name'), ''),
    'SemeAI user'
  );
$$;

create or replace function private.identity_providers(metadata jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with supplied as (
    select lower(value) as provider
    from jsonb_array_elements_text(coalesce(metadata -> 'providers', '[]'::jsonb))
    union
    select lower(metadata ->> 'provider')
  )
  select coalesce(array_agg(distinct provider order by provider), '{}'::text[])
  from supplied
  where provider in ('google', 'github');
$$;

create or replace function private.sync_identity_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text := private.identity_display_name(new.raw_user_meta_data);
  resolved_avatar text := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
  resolved_providers text[] := private.identity_providers(new.raw_app_meta_data);
begin
  insert into public.profiles (id, created_at, updated_at, display_name, avatar_url, primary_email)
  values (new.id, coalesce(new.created_at, now()), now(), resolved_name, resolved_avatar, new.email)
  on conflict (id) do update set
    updated_at = now(),
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    primary_email = excluded.primary_email;

  insert into public.registrations (
    user_id, created_at, updated_at, last_sign_in_at, display_name, primary_email, avatar_url, providers
  )
  values (
    new.id, coalesce(new.created_at, now()), now(), new.last_sign_in_at,
    resolved_name, new.email, resolved_avatar, resolved_providers
  )
  on conflict (user_id) do update set
    updated_at = now(),
    last_sign_in_at = excluded.last_sign_in_at,
    display_name = excluded.display_name,
    primary_email = excluded.primary_email,
    avatar_url = excluded.avatar_url,
    providers = excluded.providers;

  return new;
end;
$$;

drop trigger if exists semeai_identity_user_sync on auth.users;
create trigger semeai_identity_user_sync
  after insert or update of email, raw_user_meta_data, raw_app_meta_data, last_sign_in_at
  on auth.users
  for each row execute function private.sync_identity_user();

create or replace function private.sync_linked_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.provider) not in ('google', 'github') then
    return new;
  end if;

  insert into public.linked_identities (
    identity_id, user_id, provider, provider_user_id, provider_email, created_at, last_sign_in_at
  )
  values (
    new.id,
    new.user_id,
    lower(new.provider),
    new.provider_id,
    new.identity_data ->> 'email',
    coalesce(new.created_at, now()),
    new.last_sign_in_at
  )
  on conflict (identity_id) do update set
    user_id = excluded.user_id,
    provider = excluded.provider,
    provider_user_id = excluded.provider_user_id,
    provider_email = excluded.provider_email,
    last_sign_in_at = excluded.last_sign_in_at;

  return new;
end;
$$;

create or replace function private.remove_linked_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.linked_identities where identity_id = old.id;
  return old;
end;
$$;

drop trigger if exists semeai_linked_identity_sync on auth.identities;
create trigger semeai_linked_identity_sync
  after insert or update of identity_data, last_sign_in_at
  on auth.identities
  for each row execute function private.sync_linked_identity();

drop trigger if exists semeai_linked_identity_remove on auth.identities;
create trigger semeai_linked_identity_remove
  after delete on auth.identities
  for each row execute function private.remove_linked_identity();

create or replace function private.set_registration_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists semeai_registration_updated_at on public.registrations;
create trigger semeai_registration_updated_at
  before update on public.registrations
  for each row execute function private.set_registration_updated_at();

alter table public.profiles enable row level security;
alter table public.linked_identities enable row level security;
alter table public.registrations enable row level security;
alter table public.admin_memberships enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or (select private.is_semeai_admin()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists identities_select_own_or_admin on public.linked_identities;
create policy identities_select_own_or_admin on public.linked_identities
  for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_semeai_admin()));

drop policy if exists registrations_owner_select on public.registrations;
create policy registrations_owner_select on public.registrations
  for select to authenticated
  using ((select private.is_semeai_admin()));

drop policy if exists registrations_owner_update on public.registrations;
create policy registrations_owner_update on public.registrations
  for update to authenticated
  using ((select private.is_semeai_admin()))
  with check ((select private.is_semeai_admin()));

drop policy if exists memberships_select_self on public.admin_memberships;
create policy memberships_select_self on public.admin_memberships
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.linked_identities, public.registrations, public.admin_memberships from anon;
revoke all on public.profiles, public.linked_identities, public.registrations, public.admin_memberships from authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select on public.linked_identities to authenticated;
grant select on public.registrations to authenticated;
grant update (lifecycle_status, owner_note) on public.registrations to authenticated;
grant select on public.admin_memberships to authenticated;

-- Owner admission is intentionally a separate operator action after the owner's
-- first real OAuth sign-in. Use the stable auth.users.id, never a frontend flag:
--
-- insert into public.admin_memberships (user_id, role)
-- select id, 'owner' from auth.users where lower(email) = lower('OWNER_EMAIL_HERE')
-- on conflict (user_id) do update set role = excluded.role;
