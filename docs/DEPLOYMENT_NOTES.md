# Deployment Notes

## Current repository configuration

- `package.json` defines `dev`, `build`, `start`, and `lint` only.
- `vercel.json` schedules `GET /api/cron/check-expired` every six hours.
- The cron route requires `Authorization: Bearer <CRON_SECRET>`: `src/app/api/cron/check-expired/route.ts`.
- `PRODUCT_STATE.md` records that production is not yet deployed.

## Environment contract

The committed placeholder contract is `.env.example`. Required runtime areas are Supabase, Razorpay, R2, Resend, application/cron, Upstash, and Sentry.

Do not commit `.env.local`. Before a deployment, compare host variables by name only with `.env.example`; do not copy secrets into documentation or logs.

## Hosting decision

Status: **not selected in this repository**.

The current schedule is Vercel-specific. If a non-Vercel host is selected, migrate scheduling deliberately and test authenticated invocation in staging; do not assume `vercel.json` is honored.

## Pre-deployment gate

- Database migrations recreate staging.
- TypeScript, lint, build, and critical E2E tests pass.
- Staging Razorpay webhook, cron, upload, email, and authorization tests pass.
- DNS/OAuth/email-domain settings are verified.
- Live credential entry, DNS updates, and the production deployment have explicit approval.
