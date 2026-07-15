-- Minimal stand-in for the parts of a Supabase project that our migrations lean
-- on but do not create themselves. Used only by `npm run test:migrations`, which
-- replays every migration into a throwaway Postgres container.
--
-- This exists because the migrations are the least-tested code in the repo. They
-- hold RLS, a SECURITY DEFINER account-deletion function, and rate limiters — the
-- things where "looks right" is worth the least — and until now the only way to
-- find out whether one worked was to paste it into the production SQL editor and
-- watch. Everything below is a faithful-enough copy of what Supabase provides so
-- the real migration files can run unmodified.
--
-- Faithful-ENOUGH is the important caveat: this proves a migration is valid SQL
-- that does what it claims against this schema. It does not prove Supabase's
-- exact auth internals, PostgREST's error mapping, or the real data. Treat a pass
-- as "the logic is sound", not "production is fine".

-- ---- roles Supabase ships with ------------------------------------------------
-- Migrations grant/revoke against these by name, so they must exist.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

-- ---- grants, the way Supabase sets them up ------------------------------------
-- Supabase grants anon/authenticated access to everything in `public` and relies
-- on RLS to do the actual gatekeeping. Reproducing that here matters for more
-- than realism: without it, `set local role authenticated` inside a migration's
-- self-test would fail on permissions instead of exercising the policy, and an
-- RLS test that errors for the wrong reason is worse than none.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- ---- the auth schema ----------------------------------------------------------
create schema if not exists auth;

-- Closer to the real shape than it strictly needs to be, on purpose: migrations
-- that insert a probe user here must use column lists that also work against a
-- real Supabase project. A stand-in that's *more* permissive than production
-- lets a migration pass locally and fail on the SQL editor, which is the exact
-- failure mode this harness exists to prevent.
create table if not exists auth.users (
  instance_id        uuid,
  id                 uuid primary key,
  aud                varchar(255),
  role               varchar(255),
  email              varchar(255),
  encrypted_password varchar(255),
  -- Where the account came from ('email', 'google', 'apple'). 0027's signup
  -- trigger reads `provider` out of this, the way Supabase Auth populates it.
  raw_app_meta_data  jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

/*
 * auth.uid() — the real one reads the request's JWT claims out of a GUC, which is
 * precisely why the migrations can self-test: set_config('request.jwt.claims', …)
 * impersonates a user without creating one. This mirrors Supabase's definition,
 * including the older singular `request.jwt.claim.sub` fallback.
 */
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

-- ---- the storage schema (0015 avatars, 0020 deletion) -------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  created_at         timestamptz default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz default now()
);

-- Splits 'uid/avatar.png' into {uid} — the migrations use [1] to read the owner
-- segment out of an object path.
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1 : array_length(parts, 1) - 1];
end;
$$;
