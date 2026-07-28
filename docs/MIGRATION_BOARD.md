# Migration Board

Execute one unchecked item at a time. Link new evidence back to `docs/ISSUE_REGISTER.md`.

## Baseline

- [ ] M-01 Confirm clean Git status and retain `66a6dd6` as rollback baseline.
- [ ] M-02 Select hosting target and create a staging project; record the decision in `docs/DEPLOYMENT_NOTES.md`.
- [ ] M-03 Create staging-only test identities and inboxes.

## Database and security

- [ ] M-04 Export Supabase schema, RLS, views, functions, and Storage policies into committed migrations. Closes C-01 only after blank-database rebuild succeeds.
- [ ] M-05 Audit RLS, `contests_with_counts`, and `select_winner()` in staging. Resolve/raise S-01.
- [ ] M-06 Remove or production-gate the deliberate error route. Resolve C-03.
- [ ] M-07 Audit auth redirects, admin role checks, chat membership, downloads, and private material access. Resolve/raise S-02 and S-05.

## Money and lifecycle

- [ ] M-08 Test Razorpay success, cancellation, failure, duplicate webhook, and out-of-order webhook cases. Resolve/raise S-03.
- [ ] M-09 Test entry, unlock, submit, judging, winner, cancel/refund, and payout transitions at deadline boundaries.
- [ ] M-10 Confirm manual payout procedure, UPI collection, transaction reference, and admin audit trail.

## Operations

- [ ] M-11 Configure the host-compatible cron and manually invoke it in staging. Resolve/raise C-07 and S-04.
- [ ] M-12 Test R2 upload/download expiry, authorization, cleanup, and retention decisions.
- [ ] M-13 Verify Resend domain DNS, delivery, and error handling.
- [ ] M-14 Verify Upstash limits and Sentry alerts in staging.

## Quality gates

- [ ] M-15 Resolve lint failures. Closes C-02.
- [ ] M-16 Align shared types with submission attachment data. Closes C-05.
- [ ] M-17 Add and run focused tests for payment, authorization, lifecycle, and cron paths. Closes C-04.
- [ ] M-18 Run TypeScript, lint, production build, and staging E2E smoke tests.

## Launch

- [ ] M-19 Update operational README and runbook. Resolve C-08.
- [ ] M-20 Obtain explicit approval for live credentials, DNS, and deployment.
- [ ] M-21 Deploy production once, smoke test, and monitor logs/Sentry/Razorpay.
