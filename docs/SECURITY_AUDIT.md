# Security Audit — Initial Static Review

Scope: repository-only review performed before production cleanup. It does not prove live Supabase, Razorpay, R2, DNS, or hosting configuration.

## Confirmed

| Severity | Category | Finding | Evidence |
| --- | --- | --- | --- |
| high | security | Public GET route intentionally throws an error. | `src/app/api/test-error/route.ts` |
| medium | env | `.env.local` contains runtime secrets and is ignored; `.env.example` now uses placeholders only. | `.gitignore`; `.env.local`; `.env.example` |
| medium | security | Server-side privileged Supabase client is used in API routes; authorization behavior needs database-policy verification. | `src/lib/supabase/admin.ts`; `src/app/api/admin/`; `src/app/api/contests/[id]/winner/route.ts` |
| low | security | Security headers are configured. | `next.config.ts` |
| low | API | Rate limiting is implemented for create, enter, submit, and winner actions. | `src/lib/ratelimit.ts`; contest API routes |

## Suspected / external verification required

| Severity | Category | Verification |
| --- | --- | --- |
| blocker | database | RLS policies, `security_invoker` view configuration, function grants, and `SECURITY DEFINER` authorization must be inspected in Supabase. |
| high | auth | Verify Google OAuth callback/origin settings and admin-role assignment in Supabase/Google. |
| high | API | Verify Razorpay event signature, replay, duplicate-event, and payment reconciliation behavior in test mode. |
| medium | security | Verify R2 CORS, object privacy, signed URL expiry, and download authorization. |
| medium | deployment | Verify host secrets, HTTPS, cron authentication, and runtime logs. |

## Mandatory handling rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, Razorpay secret, R2 secret, Resend key, Upstash token, or `CRON_SECRET` to the browser.
- Do not make live payment, payout, refund, DNS, or production database changes without explicit approval.
- Before modifying Supabase authorization, verify RLS and function grants in staging and commit the migration.
