# Testing Requirements and Access

Use staging/test-mode credentials only. A signed-in browser session is preferred to sharing passwords or long-lived tokens.

| System | Needed for | Is read-only enough? | Safer alternative |
| --- | --- | --- | --- |
| Local workspace | Build, lint, static review, local tests | Yes for review | Work on a feature branch |
| Supabase dashboard + staging project | Schema/RLS/auth/storage/realtime audit and integration tests | Yes for audit; no for staging fixes | Separate staging project; backup before writes |
| Razorpay test mode | Checkout, webhook, refund, reconciliation tests | No | Test keys, test orders, explicit approval for each refund action |
| R2 staging bucket | Upload, download, expiry, cleanup tests | No | Separate bucket and scoped token |
| Resend test domain/inboxes | Delivery and template verification | No | Test-only sender and aliases |
| Upstash staging database | Rate-limit behavior and metrics | Read-only for audit; no for behavior tests | Separate database with a budget/usage alert |
| Sentry project | Verify errors, releases, and alerting | Yes | Separate staging environment/release |
| Hosting dashboard | Build logs, cron, environment, preview deployment | Yes for review; no for deployment | Preview/staging site before production |
| DNS / OAuth console | Domain, email DNS, Google callback verification | Yes for audit; no for changes | User performs approved record/callback changes |
| GitHub repository | CI, branch protection, deploy integration | No for setup | Private repository; protected main branch |

Minimum test identities: lister, two contestants, admin, non-participant, and test inboxes for each. Never use real payout recipients or production contest data for testing.

Required checks before launch:

- TypeScript, lint, and production build pass.
- Staging E2E paths cover signup, payment success/failure, webhook retry, entry, brief unlock, submission, winner selection, payout status, refund, chat, and upload/download authorization.
- Supabase RLS and storage policy audit is recorded.
- Cron execution is invoked manually in staging and its output is checked.
