# Security Audit — Static Review and Live Follow-up

Scope: repository review plus recorded Supabase checks performed on 2026-07-28. Razorpay, R2, DNS, Auth dashboard settings, and hosting still require separate verification.

## Confirmed

| Severity | Category | Status | Finding | Evidence |
| --- | --- | --- | --- | --- |
| blocker | security | resolved | Public contest reads no longer expose payment identifiers or locked full briefs. | `supabase/migrations/20260728151932_protect_contest_private_fields.sql`; live role assertions 2026-07-28 |
| high | security | resolved | `select_winner()` is callable only by trusted server code after the route verifies contest ownership. | `supabase/migrations/20260728145203_harden_function_permissions.sql`; `src/app/api/contests/[id]/winner/route.ts` |
| high | security | resolved | Contest materials access is correlated to the participant's specific contest. | `supabase/migrations/20260728145622_fix_contest_materials_policy.sql` |
| high | security | resolved | The former public error-test route returns a non-disclosing 404. | `src/app/api/test-error/route.ts` |
| medium | security | resolved | Public avatar URLs remain available while broad object-name listing is removed. | `supabase/migrations/20260728145830_restrict_avatar_listing.sql` |
| medium | env | resolved | Runtime secrets remain in ignored local environment files; `.env.example` contains placeholders only. | `.gitignore`; `.env.example` |
| low | security | confirmed | Security headers are configured. | `next.config.ts` |
| high | API | verify | Task 7 locally implements server-side Checkout signature verification using the stored order ID, timing-safe webhook verification, recoverable payment state transitions, deterministic refund idempotency, and real transfer-reference recording. Razorpay test-mode verification is pending. | `src/app/api/payments/verify/route.ts`; `src/app/api/webhooks/razorpay/route.ts`; `src/lib/razorpay-signature.ts`; `src/lib/razorpay-refund.ts`; `src/app/api/admin/payouts/[id]/route.ts` |
| high | cron | verify | Task 8 adds an email outbox with RLS enabled, no browser-role policies, explicit revocation from `PUBLIC`/`anon`/`authenticated`, and service-role-only table/function access. The migration was applied through Supabase MCP on 2026-08-01; advisors/assertions were not run. | `supabase/migrations/20260801201639_create_email_delivery_outbox.sql`; `src/lib/email-delivery.ts` |
| high | cron | verify | The cron/notification migration (SHA-256 `BE881DA1288B53361EAE76CC63C580A33773613F2548D76C450AC176B1B36825`) adds a private RLS-enabled lease table and service-role-only lease functions. Existing notification RLS and grants are unchanged: authenticated users retain own-row SELECT only, while application routes re-check identity before service-role read-state updates. A nullable keyed unique index leaves legacy rows intact and prevents concurrent duplicate events. It was owner-approved and applied through Supabase MCP on 2026-08-20; post-apply schema, index, RLS, grant, lease and active server winner-RPC checks passed. Advisors retain the separately recorded intentional/public-function and service-only-table findings. Real role/UI/cron testing remains pending. | `supabase/migrations/20260820155548_add_cron_lease_and_notification_events.sql`; `src/app/api/notifications/route.ts`; `src/lib/notification-service.ts`; Supabase migration version `20260820170603` |

## Reviewed exception

`public.get_visible_contests(uuid)` intentionally permits `anon` and `authenticated` execution. It is `SECURITY DEFINER` so it can aggregate private tables, but it has a fixed search path, excludes payment fields, conditionally redacts `description`, revokes `PUBLIC` execution, and passed live role assertions. Supabase advisors therefore retain two expected warnings for this endpoint.

## Authorization reset applied

Applied to Contestic on 2026-07-29 after approval of migration SHA-256
`41A16DED4285733935A971349150EB3AFFE181BF9DAEA5B3BD45F47306148BF9`:

- Migration: `supabase/migrations/20260729151427_authorization_reset.sql`
- Reverse migration: `supabase/rollback/20260729151427_authorization_reset.sql`
- Database assertions: `supabase/tests/authorization_reset_assertions.sql`
- Reverse assertions: `supabase/tests/authorization_reset_rollback_assertions.sql`

The migration removes public access to the complete profile row and all direct
sensitive writes. Its applied `get_public_profile(uuid)` projection currently
returns only `id`, `full_name`, and `avatar_url`. Task 10 migration
`20260803143724_add_profile_bio_and_chat_scope` now adds a 200-character `bio`
to that same narrow projection and keeps email, role, UPI, and payment fields
private. The reset
also adds service-only atomic entry, submission, and creator-validated winner
functions.

## Task 10 role and stage matrix (migration applied; user verification pending)

| Resource/action | Anonymous | Authenticated owner | Other authenticated user | Creator and valid entrant | Admin/server | Lifecycle rule |
| --- | --- | --- | --- | --- | --- | --- |
| Public profile (`id`, name, avatar, bio) | read | read/update own safe fields | read | read | read | all stages |
| Email, role, UPI, payments | denied | existing private owner paths only | denied | denied | authorized operations only | all stages |
| Contest chat | denied | participant rules apply | denied unless a participant | creator-to-entrant only | retention/maintenance only | entry, submission, judging allowed; completed/cancelled denied |
| Entrant-to-entrant chat | denied | denied | denied | denied | retention/maintenance only | all stages |

Verification: TypeScript passed; focused security lint passed; 16 local tests
passed; the complete migration plus role/stage fixtures passed inside a rolled
back transaction; the reverse migration passed inside a second rolled back
transaction. After adding the public-profile requirement, focused anonymous,
authenticated-own, authenticated-other-user, exact-output-shape, and reverse
assertions passed under rollback. A final live metadata check confirmed no
database change persisted.

The post-application advisor state is 0 errors and 5 warnings: two reviewed
`get_visible_contests` execute warnings, two reviewed `get_public_profile`
execute warnings, and leaked-password protection disabled.

## Still to verify

| Severity | Category | Verification |
| --- | --- | --- |
| high | auth | Enable leaked-password protection and verify OAuth redirects, admin assignment, and sessions. |
| high | API | Run the Task 7 Razorpay test-mode checklist for Checkout signatures, browser-close recovery, replay handling, duplicate/out-of-order events, zero-submission prize-only refunds with the 5% fee retained, and manual payout reconciliation. |
| medium | security | Permitted-user signed download passed locally on 2026-07-30. Verify unrelated-user denial, R2 CORS/object privacy, signed URL expiry, and post-winner cleanup. |
| medium | deployment | Verify Netlify secrets, HTTPS, scheduled functions, runtime logs, and rollback procedure. |

## Mandatory handling rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, Razorpay secret, R2 secret, Resend key, Upstash token, or `CRON_SECRET` to the browser.
- Require route-level authentication and object-level authorization before privileged server operations.
- Before changing Supabase authorization, dry-run migrations transactionally, assert role behavior, and run security advisors.
- Do not perform live payment, payout, refund, DNS, or production deployment actions without explicit approval.
