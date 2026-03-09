-- Optional one-time hotfix for environments where staff logins stopped working.
--
-- What this script does:
-- 1) Makes login email resolution accept either username or email.
-- 2) Rebuilds/normalizes public.staff_profiles from auth.users metadata.
-- 3) Ensures auth.identities email rows exist and match current emails.
--
-- Safe to rerun.
-- Run after backend/sql/00_schema_and_policies.sql.

create extension if not exists citext;
create extension if not exists pgcrypto;

create or replace function public.resolve_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select sp.email::text
  from public.staff_profiles sp
  where sp.is_active = true
    and (
      sp.username = nullif(trim(p_username), '')::citext
      or sp.email = nullif(trim(p_username), '')::citext
    )
  limit 1;
$$;

grant execute on function public.resolve_login_email(text) to anon;
grant execute on function public.resolve_login_email(text) to authenticated;

with candidates as (
  select
    au.id as user_id,
    au.email::citext as email,
    coalesce(nullif(trim(au.raw_user_meta_data ->> 'role'), ''), sp.role::text) as role_text,
    coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(sp.full_name), ''),
      split_part(coalesce(au.email, ''), '@', 1)
    ) as full_name,
    coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'username'), ''),
      nullif(trim(sp.username::text), ''),
      split_part(coalesce(au.email, ''), '@', 1)
    ) as raw_username,
    coalesce(sp.is_active, true) as is_active
  from auth.users au
  left join public.staff_profiles sp on sp.user_id = au.id
  where nullif(trim(coalesce(au.email, '')), '') is not null
),
normalized as (
  select
    c.user_id,
    c.email,
    c.role_text,
    c.full_name,
    c.is_active,
    coalesce(
      nullif(regexp_replace(lower(trim(c.raw_username)), '[^a-zA-Z0-9_.-]', '', 'g'), ''),
      'user_' || replace(c.user_id::text, '-', '')
    ) as base_username
  from candidates c
  where c.role_text in ('admin', 'receptionist', 'associate_dentist')
),
deduped as (
  select
    n.user_id,
    n.email,
    n.role_text,
    n.full_name,
    n.is_active,
    case
      when row_number() over (partition by n.base_username order by n.user_id) = 1 then n.base_username
      else n.base_username || '_' || (row_number() over (partition by n.base_username order by n.user_id) - 1)::text
    end as final_username
  from normalized n
),
upserted as (
  insert into public.staff_profiles (user_id, email, username, full_name, role, is_active)
  select
    d.user_id,
    d.email,
    d.final_username::citext,
    d.full_name,
    d.role_text::public.staff_role,
    d.is_active
  from deduped d
  on conflict (user_id) do update
    set email = excluded.email,
        username = excluded.username,
        full_name = excluded.full_name,
        role = excluded.role,
        is_active = excluded.is_active,
        updated_at = now()
  returning user_id
)
update auth.users au
set
  raw_user_meta_data = coalesce(au.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', d.role_text,
    'full_name', d.full_name,
    'username', d.final_username
  ),
  updated_at = now()
from deduped d
where au.id = d.user_id
  and exists (select 1 from upserted u where u.user_id = d.user_id);

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  d.user_id,
  d.email::text,
  jsonb_build_object(
    'sub', d.user_id::text,
    'email', d.email::text
  ),
  'email',
  now(),
  now(),
  now()
from (
  select sp.user_id, sp.email
  from public.staff_profiles sp
) d
where not exists (
  select 1
  from auth.identities ai
  where ai.user_id = d.user_id
    and ai.provider = 'email'
);

update auth.identities ai
set
  provider_id = sp.email::text,
  identity_data = coalesce(ai.identity_data, '{}'::jsonb) || jsonb_build_object(
    'sub', sp.user_id::text,
    'email', sp.email::text
  ),
  updated_at = now()
from public.staff_profiles sp
where ai.user_id = sp.user_id
  and ai.provider = 'email';

-- Quick verification query:
-- select user_id, email, username, role, is_active from public.staff_profiles order by role, username;
