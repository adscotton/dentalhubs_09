-- Optional one-time hotfix for:
-- ERROR: function gen_salt(unknown) does not exist
--
-- Cause:
-- In Supabase, pgcrypto functions are commonly in schema "extensions".
-- If a SECURITY DEFINER function runs with search_path that excludes "extensions",
-- calls to crypt()/gen_salt() fail.
--
-- Safe to rerun.
-- Run after backend/sql/00_schema_and_policies.sql.

create extension if not exists pgcrypto;

do $$
begin
  if to_regprocedure('public.admin_create_user(text,text,text,text,public.staff_role)') is not null then
    execute 'alter function public.admin_create_user(text, text, text, text, public.staff_role) set search_path = public, auth, extensions';
  end if;

  if to_regprocedure('public.admin_reset_user_password(uuid,text)') is not null then
    execute 'alter function public.admin_reset_user_password(uuid, text) set search_path = public, auth, extensions';
  end if;

  if to_regprocedure('public.handle_new_auth_user()') is not null then
    execute 'alter function public.handle_new_auth_user() set search_path = public, auth, extensions';
  end if;
end
$$;

-- Quick verification:
-- select proname, proconfig
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('admin_create_user', 'admin_reset_user_password', 'handle_new_auth_user');
