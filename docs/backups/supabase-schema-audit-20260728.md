# Supabase Read-Only Schema Audit Snapshot — 2026-07-28

Project: `Contestic` (`txbrnrikmrawisdyhqbj`), inspected through the Supabase connector before the first cleanup migration.

This is a schema/security inventory, not a physical data backup. It intentionally contains no user, payout, payment, submission, or credential data. A physical restore point/export must be created in the Supabase dashboard before any future destructive data operation.

## Migration history at capture

- `20260610081812_create_profiles_table`
- `20260610081829_create_contests_table`
- `20260610082008_create_submissions_table`
- `20260610082015_create_payments_table`
- `20260610082024_create_notifications_table`
- `20260610082032_create_messages_table`
- `20260610082043_create_indexes`
- `20260610082051_create_contests_with_counts_view`
- `20260610082100_create_select_winner_function`
- `20260611055119_fix_contests_with_counts_security_invoker`
- `20260701150741_create_avatars_storage_bucket`

## Objects observed

- RLS enabled: `profiles`, `contests`, `submissions`, `payments`, `notifications`, `messages`, `contest_entries`, `payout_requests`, and `contest_materials`.
- Public view: `public.contests_with_counts`.
- Public functions: `handle_new_user()`, `select_winner(uuid, uuid, uuid, text)`, `update_updated_at()`.
- Storage bucket: `avatars`.

## Pre-change security findings

- `contests_with_counts` has `security_invoker = false` and returns contest payment identifiers and full descriptions. Its intended public/private contract must be redesigned before changing the view.
- `select_winner()` is `SECURITY DEFINER`, has no fixed `search_path`, and was executable by `anon` and `authenticated` roles.
- `handle_new_user()` and `update_updated_at()` were executable by `anon` and `authenticated`; both are trigger functions and do not need public RPC execution.
- The `avatars` public bucket has a broad object-listing SELECT policy; review separately after core function hardening.

## First applied cleanup migration

`supabase/migrations/20260728145203_harden_function_permissions.sql` fixes function search paths and removes public RPC execution from the three functions. It grants `select_winner()` only to `service_role`, which matches `src/app/api/contests/[id]/winner/route.ts`.
