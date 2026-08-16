# Contestic Context Pack

## Product

Contestic is a prepaid creative-contest marketplace: a lister funds a prize,
contestants may enter once during a limited entry phase, the full brief stays
locked until that phase ends, entered contestants receive the brief and
submit work, the lister chooses a winner, and an admin records a manual UPI
payout.

## Non-negotiable lifecycle

- `entry_open`: eligible contestants may enter; entry is final and cannot be withdrawn; full brief/materials are locked.
- `submission_open`: only contestants who entered before the cutoff receive the
  full brief/materials and may submit.
- `judging`: submissions close; the creator reviews and selects the winner.
- `completed`: the selected result and payout workflow remain available according
  to their authorization rules.
- `cancelled`: no new entry, submission, or winner action is allowed.

When a flow detail is not explicitly covered here, ask the user before changing
authorization or lifecycle behavior.

## Money rules

- Commission is 5% and is paid by the contest creator in addition to the
  prize. A ₹1,000 prize therefore charges ₹1,050; the winner receives ₹1,000.
- When a contest closes with zero submissions, including when entries existed
  but nobody submitted, only the advertised prize is refunded. The 5% platform
  fee is non-refundable and retained by Contestic.
- A live contest cannot be voluntarily cancelled.
- Winner payouts are manual UPI transfers: the winner supplies UPI after
  selection, and an administrator records the real transaction reference.
- If no winner is selected within three days after entering `judging`, the
  creator is not refunded. Contestic retains the commission and the prize is
  divided manually among manually reviewed valid submitters.

## Stack

- Next.js 16 / React 19 / TypeScript: `package.json`
- Supabase Auth, Postgres, Storage, and Realtime: `src/lib/supabase/`
- Razorpay payments and webhook: `src/lib/razorpay.ts`, `src/lib/razorpay-signature.ts`, `src/lib/razorpay-refund.ts`, `src/app/api/payments/verify/route.ts`, `src/app/api/webhooks/razorpay/route.ts`
- Cloudflare R2 uploads: `src/lib/r2.ts`, `src/app/api/contests/[id]/upload-url/route.ts`
- Resend email: `src/lib/resend.ts`
- Upstash rate limits: `src/lib/ratelimit.ts`
- Sentry: `next.config.ts`, `instrumentation.ts`
- PostHog product analytics: `src/instrumentation-client.ts`,
  `src/lib/analytics.ts`, `docs/ANALYTICS_EVENT_CATALOG.md`
- Supabase password recovery: `src/app/(auth)/forgot-password/page.tsx`,
  `src/app/(auth)/reset-password/page.tsx`, `src/app/api/auth/callback/route.ts`
- Durable email outbox (applied to Contestic on 2026-08-01): `src/lib/email-delivery.ts`, `supabase/migrations/20260801201639_create_email_delivery_outbox.sql`

## Important routes

- Contest creation: `src/app/(main)/post/page.tsx`, `src/app/api/contests/route.ts`
- Contest lifecycle: `src/app/api/contests/[id]/enter/route.ts`, `submit/route.ts`, `end/route.ts`, `winner/route.ts`
- Scheduled lifecycle processing: `src/app/api/cron/check-expired/route.ts`
- Payout administration: `src/app/(main)/admin/payouts/page.tsx`, `src/app/api/admin/payouts/`
- Chat: `src/components/chat-panel.tsx`, `src/app/api/messages/`

## Current known state

- Initial Git baseline: `66a6dd6`.
- `.env.local` is ignored; `.env.example` contains placeholders: `.gitignore`, `.env.example`.
- Contestic is a live controlled beta at `https://contestic.in`, currently
  hosted on Netlify. Keep Netlify for the first controlled month.
- The future host is not selected. Compare Cloudflare Workers Paid, Firebase
  App Hosting and direct Google Cloud Run only after collecting real usage.
  Follow `docs/HOSTING_MIGRATION_PLAYBOOKS.md`; a host move retains Supabase and
  is not a database migration.
- TypeScript check passed on 2026-07-26.
- ESLint failed on 2026-07-26 with 51 errors and 29 warnings; see `docs/ISSUE_REGISTER.md`.
- `PRODUCT_STATE.md` contains older pre-deployment context and is not the
  current hosting source of truth.

## First reads before a production task

- `docs/SECURITY_AUDIT.md`
- `docs/TESTING_REQUIREMENTS.md`
- `docs/MIGRATION_PLAN.md`
- `docs/PRODUCTION_LAUNCH_AND_SCALE_GUIDE.md`
- `docs/HOSTING_MIGRATION_PLAYBOOKS.md`
- `PRODUCT_STATE.md`

The repository now contains hardening migrations under `supabase/migrations/`,
but the original full schema baseline is still missing. Do not claim blank
database reproducibility until M-04 is completed and user-verified.
