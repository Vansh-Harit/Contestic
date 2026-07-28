# Issue Register

Status values: `open`, `verify`, `resolved`. Confirmed means directly observed in this repository; suspected means it needs staging/dashboard evidence.

## Confirmed

| ID | Severity | Category | Status | Finding | Evidence |
| --- | --- | --- | --- | --- | --- |
| C-01 | blocker | database | open | Database schema, RLS policies, views, storage configuration, and `select_winner()` are required by the app but no committed migration/schema files were found. | `PRODUCT_STATE.md`; `src/app/api/contests/[id]/winner/route.ts`; no `supabase/migrations/` directory |
| C-02 | high | build | open | Lint is not clean: 51 errors and 29 warnings were observed on 2026-07-26. | `package.json`; lint output recorded during initial audit |
| C-03 | high | security | open | A public route always throws a Sentry test error. | `src/app/api/test-error/route.ts` |
| C-04 | high | build | open | No project-owned unit, integration, or E2E test files/scripts were found. | `package.json`; repository file audit |
| C-05 | medium | API | open | Runtime data uses `file_urls`, while the shared `Submission` type still declares `file_url`. | `src/lib/types.ts`; `src/app/api/contests/[id]/submit/route.ts` |
| C-06 | medium | env | resolved | The environment example lacked runtime variables and included an obsolete Razorpay X variable. It was replaced with placeholders matching current runtime references. | `.env.example`; `src/lib/r2.ts`; `src/lib/resend.ts` |
| C-07 | medium | deployment | open | The configured cron is Vercel-specific and runs every six hours; target hosting has not been selected/configured. | `vercel.json`; `src/app/api/cron/check-expired/route.ts` |
| C-08 | low | UI | open | Product README is still the create-next-app boilerplate rather than operational documentation. | `README.md` |

## Suspected — verify before changing

| ID | Severity | Category | Status | Finding to verify | Evidence / reason |
| --- | --- | --- | --- | --- | --- |
| S-01 | high | security | verify | Confirm all Supabase RLS policies, the view security mode, and the `SECURITY DEFINER` winner function enforce the intended roles. | Database objects are not stored locally; app uses `createAdminClient()` and `select_winner()`. |
| S-02 | high | auth | verify | Confirm OAuth redirect URLs, admin role assignment, and session behavior in staging. | `middleware.ts`; `src/app/api/auth/callback/route.ts` |
| S-03 | high | API | verify | Confirm Razorpay webhook idempotency and reconciliation for browser-close, duplicate, and out-of-order events. | `src/app/api/webhooks/razorpay/route.ts`; `src/app/api/contests/route.ts` |
| S-04 | medium | cron | verify | Confirm the single cron route completes safely for batch sizes expected at launch and cannot duplicate refunds/emails. | `src/app/api/cron/check-expired/route.ts` |
| S-05 | medium | security | verify | Confirm R2 download authorization, URL expiry, CORS, and retention after winner selection. | `src/lib/r2.ts`; `src/app/api/download/route.ts`; `src/app/api/contests/[id]/winner/route.ts` |
| S-06 | medium | deployment | verify | Confirm all host, Supabase, Razorpay, R2, Resend, Upstash, and Sentry settings in a staging environment. | `.env.example`; `docs/TESTING_REQUIREMENTS.md` |
