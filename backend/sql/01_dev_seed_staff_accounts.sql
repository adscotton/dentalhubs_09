-- DEV ONLY: creates or normalizes three test auth users.
-- Do not use these credentials in production.
--
-- Generated users:
-- 1) admin@dent22.local        / Admin123!
-- 2) receptionist@dent22.local / Reception123!
-- 3) associate@dent22.local    / Dentist123!
--
-- Important:
-- - Run 00_schema_and_policies.sql first.
-- - Running this script reapplies known dev credentials and active profiles.

create extension if not exists pgcrypto;

do $$
declare
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_admin_id uuid;
  v_receptionist_id uuid;
  v_associate_id uuid;
begin
  perform set_config('search_path', 'public, auth, extensions', true);

  select id into v_admin_id
  from auth.users
  where email = 'admin@dent22.local';

  if v_admin_id is null then
    v_admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_instance_id,
      v_admin_id,
      'authenticated',
      'authenticated',
      'admin@dent22.local',
      crypt('Admin123!', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}',
      '{"role":"admin","full_name":"Admin User","username":"admin"}',
      now(),
      now()
    );

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
    values (
      gen_random_uuid(),
      v_admin_id,
      'admin@dent22.local',
      jsonb_build_object(
        'sub', v_admin_id::text,
        'email', 'admin@dent22.local'
      ),
      'email',
      now(),
      now(),
      now()
    );
  end if;

  update auth.users
  set
    email = 'admin@dent22.local',
    encrypted_password = crypt('Admin123!', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_app_meta_data = '{"provider":"email","providers":["email"]}',
    raw_user_meta_data = '{"role":"admin","full_name":"Admin User","username":"admin"}',
    updated_at = now()
  where id = v_admin_id;

  if not exists (
    select 1
    from auth.identities ai
    where ai.user_id = v_admin_id
      and ai.provider = 'email'
  ) then
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
    values (
      gen_random_uuid(),
      v_admin_id,
      'admin@dent22.local',
      jsonb_build_object(
        'sub', v_admin_id::text,
        'email', 'admin@dent22.local'
      ),
      'email',
      now(),
      now(),
      now()
    );
  else
    update auth.identities
    set
      provider_id = 'admin@dent22.local',
      identity_data = jsonb_build_object(
        'sub', v_admin_id::text,
        'email', 'admin@dent22.local'
      ),
      updated_at = now()
    where user_id = v_admin_id
      and provider = 'email';
  end if;

  insert into public.staff_profiles (user_id, email, username, full_name, role, is_active)
  values (
    v_admin_id,
    'admin@dent22.local',
    'admin',
    'Admin User',
    'admin',
    true
  )
  on conflict (user_id) do update
    set email = excluded.email,
        username = excluded.username,
        full_name = excluded.full_name,
        role = excluded.role,
        is_active = true,
        updated_at = now();

  select id into v_receptionist_id
  from auth.users
  where email = 'receptionist@dent22.local';

  if v_receptionist_id is null then
    v_receptionist_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_instance_id,
      v_receptionist_id,
      'authenticated',
      'authenticated',
      'receptionist@dent22.local',
      crypt('Reception123!', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}',
      '{"role":"receptionist","full_name":"Receptionist User","username":"receptionist"}',
      now(),
      now()
    );

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
    values (
      gen_random_uuid(),
      v_receptionist_id,
      'receptionist@dent22.local',
      jsonb_build_object(
        'sub', v_receptionist_id::text,
        'email', 'receptionist@dent22.local'
      ),
      'email',
      now(),
      now(),
      now()
    );
  end if;

  update auth.users
  set
    email = 'receptionist@dent22.local',
    encrypted_password = crypt('Reception123!', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_app_meta_data = '{"provider":"email","providers":["email"]}',
    raw_user_meta_data = '{"role":"receptionist","full_name":"Receptionist User","username":"receptionist"}',
    updated_at = now()
  where id = v_receptionist_id;

  if not exists (
    select 1
    from auth.identities ai
    where ai.user_id = v_receptionist_id
      and ai.provider = 'email'
  ) then
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
    values (
      gen_random_uuid(),
      v_receptionist_id,
      'receptionist@dent22.local',
      jsonb_build_object(
        'sub', v_receptionist_id::text,
        'email', 'receptionist@dent22.local'
      ),
      'email',
      now(),
      now(),
      now()
    );
  else
    update auth.identities
    set
      provider_id = 'receptionist@dent22.local',
      identity_data = jsonb_build_object(
        'sub', v_receptionist_id::text,
        'email', 'receptionist@dent22.local'
      ),
      updated_at = now()
    where user_id = v_receptionist_id
      and provider = 'email';
  end if;

  insert into public.staff_profiles (user_id, email, username, full_name, role, is_active)
  values (
    v_receptionist_id,
    'receptionist@dent22.local',
    'receptionist',
    'Receptionist User',
    'receptionist',
    true
  )
  on conflict (user_id) do update
    set email = excluded.email,
        username = excluded.username,
        full_name = excluded.full_name,
        role = excluded.role,
        is_active = true,
        updated_at = now();

  select id into v_associate_id
  from auth.users
  where email = 'associate@dent22.local';

  if v_associate_id is null then
    v_associate_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_instance_id,
      v_associate_id,
      'authenticated',
      'authenticated',
      'associate@dent22.local',
      crypt('Dentist123!', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}',
      '{"role":"associate_dentist","full_name":"Associate Dentist User","username":"associate"}',
      now(),
      now()
    );

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
    values (
      gen_random_uuid(),
      v_associate_id,
      'associate@dent22.local',
      jsonb_build_object(
        'sub', v_associate_id::text,
        'email', 'associate@dent22.local'
      ),
      'email',
      now(),
      now(),
      now()
    );
  end if;

  update auth.users
  set
    email = 'associate@dent22.local',
    encrypted_password = crypt('Dentist123!', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_app_meta_data = '{"provider":"email","providers":["email"]}',
    raw_user_meta_data = '{"role":"associate_dentist","full_name":"Associate Dentist User","username":"associate"}',
    updated_at = now()
  where id = v_associate_id;

  if not exists (
    select 1
    from auth.identities ai
    where ai.user_id = v_associate_id
      and ai.provider = 'email'
  ) then
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
    values (
      gen_random_uuid(),
      v_associate_id,
      'associate@dent22.local',
      jsonb_build_object(
        'sub', v_associate_id::text,
        'email', 'associate@dent22.local'
      ),
      'email',
      now(),
      now(),
      now()
    );
  else
    update auth.identities
    set
      provider_id = 'associate@dent22.local',
      identity_data = jsonb_build_object(
        'sub', v_associate_id::text,
        'email', 'associate@dent22.local'
      ),
      updated_at = now()
    where user_id = v_associate_id
      and provider = 'email';
  end if;

  insert into public.staff_profiles (user_id, email, username, full_name, role, is_active)
  values (
    v_associate_id,
    'associate@dent22.local',
    'associate',
    'Associate Dentist User',
    'associate_dentist',
    true
  )
  on conflict (user_id) do update
    set email = excluded.email,
        username = excluded.username,
        full_name = excluded.full_name,
        role = excluded.role,
        is_active = true,
        updated_at = now();
end
$$;
