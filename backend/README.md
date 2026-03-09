# Dent22 Backend (Supabase)

Project target: `hddexuhvimiwevuhzjyg`

This backend setup enforces staff-only accounts for:
- `admin`
- `receptionist`
- `associate_dentist`

No patient account role is included.

## Files

- `sql/00_schema_and_policies.sql`
  - Creates tables
  - Creates role helpers and signup trigger
  - Enables RLS and policies
  - Adds navigation permissions that exclude `/admin` for both roles
- `sql/00a_add_admin_role_enum.sql`
  - Upgrade helper for older DBs where `public.staff_role` exists without `admin`
- `sql/01_dev_seed_staff_accounts.sql`
  - Optional dev-only script to create/reset sample users
- `sql/02_smoke_test_flow.sql`
  - Optional verification queries for role/account/navigation flow
- `sql/03_seed_app_data.sql`
  - Optional seed data for patients, services, tooth conditions, and initial logs
- `sql/04_profile_and_amount_hotfix.sql`
  - Optional one-time hotfix for older databases:
    - fixes service amount overflow
    - adds extended patient profile/medical/dental columns
    - normalizes patient code format to `PT-000001`
- `sql/05_service_pricing_and_discount_hotfix.sql`
  - Optional hotfix to add:
    - `services.price`
    - `service_records.quantity`
    - `service_records.unit_price`
    - `service_records.discount_amount`
- `sql/06_patient_documents_columns_hotfix.sql`
  - Optional hotfix for older DBs where `patient_documents` exists but misses:
    - `file_url`
    - `storage_path`
    - `mime_type`
    - `file_size`
- `sql/07_auth_account_recovery_hotfix.sql`
  - Optional one-time auth/login recovery hotfix:
    - rebuilds/normalizes `staff_profiles` from `auth.users`
    - accepts username or email during login resolution
    - backfills/normalizes `auth.identities` email identity rows
- `sql/09_auth_pgcrypto_search_path_hotfix.sql`
  - Optional one-time auth password-hash hotfix:
    - fixes `gen_salt(unknown) does not exist`
    - updates auth/admin function `search_path` to include `extensions`

## Run Order (Supabase SQL Editor)

1. If upgrading an existing DB, run `backend/sql/00a_add_admin_role_enum.sql` in its own execution.
2. Run `backend/sql/00_schema_and_policies.sql`
3. If your DB already existed before these latest updates, run `backend/sql/04_profile_and_amount_hotfix.sql`
4. If your DB already existed before service price/discount support, run `backend/sql/05_service_pricing_and_discount_hotfix.sql`
5. If your DB already existed before patient document metadata support, run `backend/sql/06_patient_documents_columns_hotfix.sql`
6. If your logins/accounts are broken or inconsistent, run `backend/sql/07_auth_account_recovery_hotfix.sql`
7. If creating/resetting users throws `gen_salt(unknown) does not exist`, run `backend/sql/09_auth_pgcrypto_search_path_hotfix.sql`
8. Optional (dev only): run `backend/sql/01_dev_seed_staff_accounts.sql`
9. Optional: run `backend/sql/03_seed_app_data.sql` for baseline app data
10. Optional: run `backend/sql/02_smoke_test_flow.sql` to verify role flow

## Auth Signup Rule

The trigger on `auth.users` blocks signup unless `raw_user_meta_data.role` is:
- `admin`
- `receptionist`
- `associate_dentist`

The trigger also requires `raw_user_meta_data.username` (alphanumeric plus `._-`).

Example metadata when creating a user:

```json
{
  "role": "admin",
  "full_name": "Jane Doe",
  "username": "admin"
}
```

or

```json
{
  "role": "receptionist",
  "full_name": "John Smith",
  "username": "receptionist"
}
```

or

```json
{
  "role": "associate_dentist",
  "full_name": "Alex Cruz",
  "username": "associate"
}
```

## Navigation Behavior

Use this query from your app to fetch allowed menu items:

```sql
select * from public.allowed_navigation();
```

For `receptionist` and `associate_dentist`, `/admin` is intentionally not returned.
For `admin`, `/admin` is returned.

## Dev Test Accounts

If you run `01_dev_seed_staff_accounts.sql`, it creates or resets:

- `admin` (email: `admin@dent22.local`) / `Admin123!`
- `receptionist` (email: `receptionist@dent22.local`) / `Reception123!`
- `associate` (email: `associate@dent22.local`) / `Dentist123!`

Use these only for local/dev testing.

## Admin User Management RPCs

Admin users can manage staff accounts through:
- `public.admin_create_user(email, password, full_name, username, role)`
- `public.admin_update_user_profile(user_id, full_name, username, role, is_active)`
- `public.admin_reset_user_password(user_id, new_password)`

Patient logs can be read through:
- `public.list_patient_logs()`
