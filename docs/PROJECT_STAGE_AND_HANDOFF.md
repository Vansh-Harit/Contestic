# Contestic Project Stage and Handoff

Last updated: 2026-08-16

This is the first-stop project handoff for a new engineer or AI agent. Detailed risks remain in `docs/ISSUE_REGISTER.md`; executable work remains in `docs/MIGRATION_BOARD.md`.

## Current stage

Contestic is a **live, controlled beta**, not yet a generally marketed production service.

- Primary domain: <https://contestic.in>
- Netlify fallback URL: <https://contestic.netlify.app>
- Netlify project: `contestic` (`7c8cee82-db0c-49b5-8507-1cdd7945583a`)
- Netlify project console: <https://app.netlify.com/projects/contestic>
- Verified production deploy: `6a74adecf701cd0015ea9224`, state `ready`, branch `main`, commit `5c693906126ace8440df59aca786f1b5db53833f`, published 2026-08-06.
- The `check-expired` scheduled function is registered for `0 */6 * * *` and `NETLIFY_SCHEDULED_JOBS_ENABLED` is enabled. Successful end-to-end scheduled execution is still unverified.
- The site currently uses provider test/development configuration where documented. It must not be represented as fully production-verified.

The owner intends to keep Netlify for the first controlled month while testing
with a small group. The future host has not been selected. The complete,
provider-neutral comparison and cutover plan is in
`docs/HOSTING_MIGRATION_PLAYBOOKS.md`.

## What the product does

Contestic is a contest marketplace:

1. A creator posts a contest and pays the prize plus a 5% platform fee through Razorpay.
2. Contestants enter during `entry_open`. Entry is final; withdrawal is not supported.
3. The full brief and materials remain hidden for the whole entry period.
4. During `submission_open`, only contestants who entered before the cutoff can see the brief/materials and submit.
5. During `judging`, the creator reviews submissions and selects a winner.
6. Winner payout is a manual UPI transfer recorded with a UTR/reference.

Financial rules already documented in the application:

- Example: ₹1,000 prize + ₹50 fee = ₹1,050 paid by the creator; winner receives ₹1,000.
- If there are zero submissions when judging begins, the advertised prize is refundable but the 5% platform fee is retained. This also applies when no users entered.
- A live contest cannot be voluntarily cancelled.
- If no winner is selected within three days, the platform retains its fee and the prize is manually allocated among valid submitters after review.

## Current system

| Concern | Current implementation | Important paths |
| --- | --- | --- |
| Web/API | Next.js 16 App Router on Netlify | `src/app/`; `netlify.toml` |
| Authentication | Supabase Auth and SSR session handling | `proxy.ts`; `src/app/api/auth/callback/route.ts` |
| Database/security | Supabase Postgres, RLS, functions and committed migrations | `supabase/migrations/`; `docs/SECURITY_AUDIT.md` |
| Payments | Razorpay Checkout, webhook reconciliation, refunds and manual payout records | `src/app/api/payments/`; `src/app/api/webhooks/razorpay/route.ts`; `src/app/api/admin/payouts/` |
| Email | Resend plus a private Supabase delivery outbox | `src/lib/email-delivery.ts`; `src/lib/resend.ts`; `supabase/migrations/20260801201639_create_email_delivery_outbox.sql` |
| Lifecycle/cron | Protected application route called by Netlify scheduled/background functions | `src/app/api/cron/check-expired/route.ts`; `netlify/functions/check-expired.mjs`; `netlify/functions/check-expired-background.mjs` |
| Submission files | Private Cloudflare R2 objects and short-lived signed URLs | `src/lib/r2.ts`; `src/app/api/download/route.ts` |
| Rate limits | Upstash Redis | `src/lib/ratelimit.ts` |
| Monitoring and analytics | Sentry errors; privacy-limited PostHog product events | `sentry.*.config.ts`; `src/app/global-error.tsx`; `src/instrumentation-client.ts`; `docs/ANALYTICS_EVENT_CATALOG.md` |

## Confirmed completed work

- Repository secret hygiene, `.gitignore`, and placeholder-only `.env.example` are in place.
- Authorization hardening and the core RLS migrations were applied to the Contestic Supabase project.
- Contest entry is server-authorized and final.
- Full brief/material visibility follows the lifecycle invariant above.
- Payment signature verification, webhook reconciliation, refund idempotency and payout audit fields are implemented.
- Email outbox, bounded retries and lifecycle event keys are implemented.
- Winner selection schedules contest-scoped R2 deletion; completed contests lose submission/chat access.
- Public profiles expose only safe fields (`id`, name, avatar and a 200-character bio).
- Password-reset pages and PKCE callback handling are implemented.
- The approved UI polish and Netlify deployment configuration are implemented.
- The latest recorded local quality gate passed before deployment. Do not treat that as live workflow verification.
- A local performance pass reduces public/auth round trips, adds cached Browse data, loading shells, prefetching, lazy client features and parallel private reads. The optional database read projections remain unapplied and disabled.
- Privacy-limited PostHog instrumentation is implemented locally with manual events only; deploy-context variables and live event receipt remain unverified.

## Still unverified or incomplete

These are launch gates, not permission to make broad changes:

- Razorpay test-mode success, retry, duplicate and out-of-order webhook scenarios.
- Scheduled lifecycle run, duplicate invocation, refund and email recovery behavior on Netlify.
- Resend sender domain: the configured domain was not verified in the inspected account.
- Supabase Auth custom SMTP and final callback/redirect allowlists.
- Winner selection, payout, upload/download, cleanup and deadline-boundary flows with live deployed test data.
- Blank-database restore from migrations and the migration-history mismatch for `supabase/migrations/20260729151427_authorization_reset.sql`.
- R2 bucket public-access setting and full deletion/retry evidence.
- Final operator identity, jurisdiction and legal review of Terms/Privacy. The current support contact is `contestic.support@gmail.com`.
- Automated integration/E2E coverage remains intentionally limited.
- The optional `SENTRY_AUTH_TOKEN` is absent, so production source-map upload is not configured.
- Deployed cold/warm navigation timings and the performance-pass regression card have not yet been run.

See `docs/ISSUE_REGISTER.md` for severity and evidence. Never change security rules merely to make a failed manual test pass.

## Tomorrow: configuration and database cleanup

Provider configuration should follow `docs/NETLIFY_CREDENTIALS_AND_RELEASES.md` and `docs/PRODUCTION_LAUNCH_AND_SCALE_GUIDE.md`.

Database cleanup must be a controlled maintenance task:

1. Inventory test contests, duplicate drafts, payments, outbox rows and orphaned files without changing anything.
2. Take an off-site logical backup first. Supabase Free projects require owner-managed backup discipline.
3. Classify records as safe test data, financial/audit data, auth identities or live beta data.
4. Show exact table names, row counts and identifiers proposed for deletion.
5. Obtain explicit approval for the exact destructive statement.
6. Delete in a transaction or small reversible batches, then reconcile Razorpay records and R2 objects.
7. Never blindly delete payment, refund, payout, webhook, migration-history or audit evidence.

Do not disable scheduled jobs by default. If a stable snapshot genuinely requires a short maintenance window, show why and request explicit approval before changing the flag.

## Rules for the next agent

- Read `AGENTS.md`, this file, `docs/ISSUE_REGISTER.md`, `docs/MIGRATION_BOARD.md`, and the relevant task document before acting.
- Inspect the current branch, complete diff and the live provider state; do not trust stale deployment notes.
- Do not expose environment values. Key names and presence are enough for most audits.
- Every Supabase schema/policy/function change must exist as a migration and include an RLS impact review.
- No live payment, refund, payout, DNS, deployment or destructive database action without exact-action approval.
- Preserve the contest lifecycle invariants in `AGENTS.md`.
- Report behavior as verified only when there is direct tool evidence or the owner supplies the requested manual-test evidence.
