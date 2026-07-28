# Contestic Context Pack

## Product

Contestic is a prepaid creative-contest marketplace: a lister funds a prize, contestants enter a limited entry phase, the full brief unlocks, contestants submit work, the lister chooses a winner, and an admin records a manual UPI payout.

## Stack

- Next.js 16 / React 19 / TypeScript: `package.json`
- Supabase Auth, Postgres, Storage, and Realtime: `src/lib/supabase/`
- Razorpay payments and webhook: `src/lib/razorpay.ts`, `src/app/api/webhooks/razorpay/route.ts`
- Cloudflare R2 uploads: `src/lib/r2.ts`, `src/app/api/contests/[id]/upload-url/route.ts`
- Resend email: `src/lib/resend.ts`
- Upstash rate limits: `src/lib/ratelimit.ts`
- Sentry: `next.config.ts`, `instrumentation.ts`

## Important routes

- Contest creation: `src/app/(main)/post/page.tsx`, `src/app/api/contests/route.ts`
- Contest lifecycle: `src/app/api/contests/[id]/enter/route.ts`, `submit/route.ts`, `end/route.ts`, `winner/route.ts`
- Scheduled lifecycle processing: `src/app/api/cron/check-expired/route.ts`
- Payout administration: `src/app/(main)/admin/payouts/page.tsx`, `src/app/api/admin/payouts/`
- Chat: `src/components/chat-panel.tsx`, `src/app/api/messages/`

## Current known state

- Initial Git baseline: `66a6dd6`.
- `.env.local` is ignored; `.env.example` contains placeholders: `.gitignore`, `.env.example`.
- TypeScript check passed on 2026-07-26.
- ESLint failed on 2026-07-26 with 51 errors and 29 warnings; see `docs/ISSUE_REGISTER.md`.
- `PRODUCT_STATE.md` says production is not yet deployed.

## First reads before a production task

- `docs/SECURITY_AUDIT.md`
- `docs/TESTING_REQUIREMENTS.md`
- `docs/MIGRATION_PLAN.md`
- `PRODUCT_STATE.md`

Do not assume database schema, RLS, views, functions, or storage policies can be reconstructed locally: no committed Supabase migration directory was found during the initial audit.
