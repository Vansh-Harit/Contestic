# Deployment Notes

## Current repository configuration

- `package.json` defines `dev`, `build`, `start`, and `lint` only.
- `netlify.toml` configures the Next.js build and schedules the Netlify
  `check-expired` dispatcher every six hours.
- `netlify/functions/check-expired.mjs` dispatches the work to the protected
  background adapter so Netlify's 30-second scheduled-function limit cannot
  interrupt the lifecycle route.
- `netlify/functions/check-expired-background.mjs` calls the existing protected
  `GET /api/cron/check-expired` route. Both adapters fail closed unless the
  published deploy is the production context and
  `NETLIFY_SCHEDULED_JOBS_ENABLED=true`.
- The cron route requires `Authorization: Bearer <CRON_SECRET>`: `src/app/api/cron/check-expired/route.ts`.
- The obsolete Vercel schedule file has been removed after its Netlify
  replacement was added.
- `PRODUCT_STATE.md` records that production is not yet deployed.

## Environment contract

The committed placeholder contract is `.env.example`. Required runtime areas are Supabase, Razorpay, R2, Resend, application/cron, Upstash, Sentry, and PostHog product analytics.

Do not commit `.env.local`. Before a deployment, compare host variables by name only with `.env.example`; do not copy secrets into documentation or logs.

## Hosting decision

Status: **Netlify selected for staging and production** (2026-07-28).

The Netlify schedule replacement is present locally but is not deployed. The
owner explicitly approved `NETLIFY_SCHEDULED_JOBS_ENABLED=true` for the
month-long production-context end-to-end test. Deploy Previews still do not run
scheduled functions automatically.

Fresh launch project status: **created, not deployed** (2026-08-06). The local
workspace is linked to Netlify project `contestic-app` (site ID
`eda5eba8-899c-40d5-b2c4-33abf80aee49`) in the Contestic Free team. It has no
deploy or environment variables and currently requires Netlify team SSO. The
older `contestic-staging` project still exists because the available Netlify
connector does not expose project deletion; remove it manually only after the
fresh project is confirmed usable.

Netlify labels the deploy from the configured branch as a “production deploy” within this isolated staging project. That label does not represent a Contestic production launch. Do not attach a production domain or production credentials to this project.

## Low-credit preview strategy

- Use one pull request and share its stable Deploy Preview URL with friends.
- Push test batches to that pull-request branch; do not merge to the production
  branch until launch approval.
- Deploy Previews do not incur the production-deploy credit charge, but their
  requests, bandwidth and function compute still consume account credits.
- Scheduled functions do not run automatically on Deploy Previews. Leave the
  enable flag false and invoke the protected lifecycle route manually only when
  a lifecycle test requires it.
- Configure preview environment values separately and use only test-mode
  Razorpay credentials. The preview callback must be allowed in Supabase Auth;
  change Google provider settings only if the existing provider configuration
  requires the app origin. Configure the preview as the test webhook/application
  URL before those flows are tested remotely.
- Batch changes before pushing and monitor Netlify **Usage & billing** at 50%,
  75% and 100% thresholds.

See `docs/NETLIFY_RUNBOOK.md` for the controlled preview, launch and rollback
steps.

See `docs/PRODUCTION_LAUNCH_AND_SCALE_GUIDE.md` for the quiet public-beta
sequence, password-recovery provider setup, custom-domain cutover, scaling/cost
triggers, disaster recovery and the optional Cloudflare Workers migration.

## Readiness checkpoint — 2026-08-06

- Next.js 16.3.0 production build, TypeScript, lint, 16 focused tests, diff
  validation and the production dependency audit pass locally.
- The Netlify offline adapter completed the application build and reached
  function packaging. Windows then denied a local symlink operation; the first
  real Deploy Preview is the authoritative Linux packaging check.
- The fresh `contestic-app` Netlify project currently has no environment
  variables or deploy and is protected by Netlify team SSO. Populate the
  required production-context names and choose the intended visitor-access rule
  only after explicit approval.
- Supabase, Razorpay test mode, R2, Upstash and Sentry ingestion are reachable.
  The replacement Resend API key authenticated successfully on 2026-08-06, but
  the configured sending domain is not present in that Resend account. Production
  transactional email remains blocked until a sender domain is verified or an
  explicitly approved deployed-test delivery mode is implemented.
- No deploy, webhook change, cron invocation, lifecycle mutation, payment,
  refund, payout or DNS change was performed during this checkpoint.

## Pre-deployment gate

- Database migrations recreate staging.
- TypeScript, lint, build, and critical E2E tests pass.
- Staging Razorpay webhook, cron, upload, email, and authorization tests pass.
- DNS/OAuth/email-domain settings are verified.
- Live credential entry, DNS updates, and the production deployment have explicit approval.
