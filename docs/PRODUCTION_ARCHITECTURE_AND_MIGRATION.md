# Production Architecture and Migration Plan

Last updated: 2026-08-06

Purpose: evolve Contestic from a controlled beta into a scalable, operable product without a risky rewrite. This is a future-agent runbook, not approval to migrate services.

## Decision

Keep the current Netlify deployment for beta validation. The recommended long-term architecture is:

- **Cloudflare** for DNS, CDN and WAF.
- **Google Cloud Run** for the containerized Next.js web/API service.
- **Cloud Tasks** for bounded, retryable background jobs and **Cloud Scheduler** only for timed enqueue/reconciliation triggers.
- **Supabase Pro** for Postgres/Auth/Realtime with RLS, pooled connections, daily backups/PITR and restore drills.
- **Cloudflare R2** for private submission objects.
- **Razorpay**, **Resend**, **Upstash Redis** and **Sentry** retained behind explicit operational contracts.

Do **not** introduce Kubernetes or many microservices now. Cloud Run supplies revisions, autoscaling, traffic splitting and rollback without requiring a platform team. Move only when measured operational or cost limits justify it.

## Target architecture

```text
Users
  -> Cloudflare DNS / TLS / CDN / WAF
      -> Cloud Run: Next.js web + authenticated API
          -> Supabase Auth / Postgres / Realtime
          -> R2 private object storage
          -> Razorpay API
          -> Upstash Redis (rate limiting/cache only)
          -> Cloud Tasks queues
                -> private Cloud Run worker endpoints
                     -> Resend delivery
                     -> refund/webhook reconciliation
                     -> R2 cleanup
                     -> lifecycle transitions
          -> Sentry + structured cloud logs/metrics/traces

Cloud Scheduler -> authenticated enqueue/reconciliation endpoint -> Cloud Tasks
GitHub Actions -> tests/scans -> Artifact Registry -> migration approval -> Cloud Run revision
```

## Component rules

### Edge and web

- Use Cloudflare for custom-domain TLS, WAF, basic bot protection and cacheable public assets.
- Package the existing Next.js application as one immutable container first. Preserve routes under `src/app/`.
- Run it as a Cloud Run service in a region chosen after confirming the Supabase primary region and measured user geography.
- Start with conservative maximum instances to protect Postgres connections and budget. Add one minimum instance only when latency/SLO evidence justifies the cost.
- Keep requests stateless; the Cloud Run filesystem is disposable.
- Use revision traffic splitting for canary releases and retain the previous healthy revision for immediate rollback.

### Background work

- Keep the database as the authoritative state machine and outbox, not the queue alone.
- Convert `src/app/api/cron/check-expired/route.ts` into small idempotent job producers/handlers over time.
- Cloud Scheduler must only invoke an authenticated enqueue/reconciliation endpoint. Scheduler is at-least-once, so every target must tolerate duplicates.
- Use Cloud Tasks for retry policy, rate limits and per-job delivery. Financial work must not depend on one long HTTP cron request.
- Separate queues for email, lifecycle, payment/refund reconciliation and R2 cleanup so one provider outage cannot block all work.
- Every job requires an idempotency key, maximum attempts, terminal failure state and operator-visible replay process.

### Database, Auth and Realtime

- Upgrade to Supabase Pro before general public launch if continuous availability, managed daily backups and support expectations require it.
- Keep RLS as the primary user-data boundary. Trusted server operations should use narrow functions/routes, not broadly exposed service credentials.
- Use Supavisor/connection pooling for short-lived application connections and set Cloud Run instance/concurrency ceilings against the database connection budget.
- Maintain off-site logical dumps and conduct restore drills even when managed backups/PITR are enabled.
- Add indexes only from measured query plans/advisors. Address the existing migration-history gap before automated schema delivery.
- Add read replicas only after evidence of read pressure. Supabase replicas are asynchronous and do not serve Auth, Storage or Realtime workloads.
- Separate development, test and production Supabase projects and credentials. Never test destructive flows on production data.

### Payments and payouts

- Preserve the raw Razorpay request body for signature verification in `src/app/api/webhooks/razorpay/route.ts`.
- Store immutable webhook event IDs and state transitions. Webhooks are duplicated and may arrive out of order.
- Acknowledge a valid webhook quickly, then enqueue reconciliation; never depend only on the browser callback.
- Retain deterministic refund idempotency and reconcile provider state before repeating a refund.
- Keep winner payouts manual until operational volume and compliance needs justify a regulated payout product. Store UTR/reference and operator identity as immutable audit evidence.
- Maintain separate Razorpay test/live keys, webhook endpoints and data. A production deploy may use test mode during controlled beta, but it is not a live-money verification.

### Files and retention

- Keep the R2 bucket private. Generate short-lived, operation-specific presigned URLs; they are bearer tokens.
- Continue contest-scoped keys used by `src/lib/r2.ts` and application-controlled deletion after successful winner selection.
- Add an R2 lifecycle rule only as a delayed safety net, never as the immediate product-state transition; lifecycle deletion timing is not exact.
- Store deletion status, attempts and last error in Postgres. An R2 failure must leave the contest locked and retryable.
- Backups of Postgres do not restore deleted R2 objects; define separate object-retention and recovery expectations.

### Email and authentication mail

- Verify a dedicated sending subdomain in Resend with SPF/DKIM and add DMARC deliberately.
- Keep compact events in the outbox created by `supabase/migrations/20260801201639_create_email_delivery_outbox.sql`; render/send in workers.
- Track provider message ID, attempt count, next attempt and terminal failure. Add bounce/complaint monitoring before marketing use.
- Configure Supabase Auth custom SMTP separately for login/password-recovery mail. Resend application mail does not automatically configure Supabase Auth mail.

### Secrets, observability and operations

- Use Google Secret Manager for server secrets and Cloud Run service identities for Google access. Do not copy `.env.local` into CI.
- Use separate cloud projects and secret sets per environment; grant least privilege and rotate provider credentials.
- Keep browser variables explicitly public. Never expose service-role, Razorpay secret/webhook secret, R2 secret, Resend key, Upstash token or cron secret.
- Send structured logs with request/job/event IDs. Keep Sentry for application errors and add latency, error-rate, queue-depth, database and payment alerts.
- Define initial SLOs before public launch: web availability, API error rate, checkout confirmation latency, job age, email backlog and refund reconciliation age.
- Maintain incident, rollback, secret-rotation, database-restore, payment-reconciliation and provider-outage runbooks.

## Delivery pipeline

1. Pull request: install from lockfile; TypeScript/lint/focused tests; migration lint; secret/dependency/container scan.
2. Build one immutable container, generate an SBOM, scan it and push to Artifact Registry.
3. Apply database migrations through a separate, approved job using a dedicated migration identity. Never apply schema implicitly during web startup.
4. Deploy a new Cloud Run revision with no traffic, run smoke checks, then canary a small percentage.
5. Promote only after health/error/payment/job signals pass. Roll back traffic to the previous revision if they do not.
6. Record application revision, migration versions and provider configuration change together in a release log.

## Migration phases

### Phase 0 — stabilize the live Netlify beta

Entry: current live deployment.

- Complete the manual gates in `docs/MIGRATION_BOARD.md`.
- Verify Resend domain, Supabase Auth SMTP/redirects, Razorpay test webhooks, scheduled runs, R2 cleanup and password reset.
- Add alert ownership and an incident rollback switch.

Exit: core workflows have owner-supplied evidence and no blocker remains in `docs/ISSUE_REGISTER.md`.

Rollback: keep Netlify deploy rollback and `NETLIFY_SCHEDULED_JOBS_ENABLED` as the cron incident switch.

### Phase 1 — data and operational baseline

- Perform backup-first test-data cleanup using `docs/PROJECT_STAGE_AND_HANDOFF.md`.
- Resolve `supabase/migrations/20260729151427_authorization_reset.sql` history safely.
- Prove blank-database migration rebuild and backup restore in a non-production project.
- Define retention, SLOs, capacity budget and monthly provider-cost dashboard.

Exit: restore drill passes; every production table/object category has an owner and retention rule.

Rollback: restore from the verified backup; never continue cleanup after a reconciliation mismatch.

### Phase 2 — production hardening without host migration

- Buy and configure the domain, Cloudflare DNS/TLS/WAF, verified Resend subdomain and provider callback URLs.
- Separate test and production provider credentials.
- Move to Supabase Pro/backups/PITR as the launch risk requires.
- Add production alerts, synthetic smoke checks and release runbooks.

Exit: the existing Netlify service meets the agreed launch SLO and recovery requirements.

Rollback: DNS returns to the last healthy Netlify origin; provider callbacks retain the previous endpoint until validation completes.

### Phase 3 — extract reliable background execution

- Define an internal job envelope and idempotency rules around the current outbox/state tables.
- Deploy private Cloud Run worker handlers and Cloud Tasks queues.
- Shadow non-financial jobs first, compare results, then move email/R2/lifecycle work one category at a time.
- Move refunds only after duplicate/out-of-order tests and an operator reconciliation view pass.

Exit: no long cron request is required for correctness; failed jobs are visible and safely replayable.

Rollback: stop enqueueing the new job category and return it to the existing Netlify lifecycle route; retain idempotency records.

### Phase 4 — containerize and shadow the web service

- Add a production Docker build without changing application behavior.
- Deploy Cloud Run with separate test credentials and no public production traffic.
- Verify auth cookies/callbacks, Realtime, uploads/downloads, Checkout/webhooks and server runtime parity.
- Load-test against a non-production database and set instance/concurrency limits.

Exit: functional parity, security review, cost model and load envelope are recorded.

Rollback: delete the unused Cloud Run revision; Netlify remains authoritative.

### Phase 5 — controlled traffic cutover

- Freeze unrelated changes.
- Deploy the approved database-compatible revision.
- Canary through Cloudflare/Cloud Run traffic controls, monitor, then increase gradually.
- Keep Netlify and its last healthy deploy available during the rollback window.

Exit: all traffic is stable on Cloud Run for the agreed observation period; callbacks and scheduled workers point to the new authenticated endpoints.

Rollback: shift traffic/DNS to Netlify, revert callbacks and stop new Cloud Tasks producers. Do not roll back a data migration until its documented reverse path is proven safe.

### Phase 6 — evidence-led scaling

- Tune caching, indexes, database compute and Cloud Run concurrency from real traces.
- Add a read replica only when read pressure and acceptable replication lag are demonstrated.
- Consider service separation only when independent scaling, ownership or failure isolation is measured.
- Run recovery and provider-outage exercises at least quarterly.

## When to migrate off Netlify

Do not use a guessed user count. Start migration when one or more are measured:

- scheduled/background work cannot meet correctness or duration requirements;
- latency/error SLOs fail because of runtime/cold-start constraints;
- database connection pressure requires tighter instance/concurrency control;
- projected Netlify usage cost exceeds the approved Cloud Run model;
- private networking, workload identity, canary controls or compliance controls become mandatory;
- the team can operate the target architecture and has completed restore/rollback drills.

## Future-agent execution rules

- One phase and one provider-changing action at a time.
- Before each phase: inspect live state, list exact resources, calculate cost, map data flow/threats, and show rollback.
- Require explicit approval for DNS, production secrets, database writes, refunds/payouts and deployments.
- Do not replace Supabase, R2, Razorpay, Resend, Upstash or Sentry without measured evidence and a data/export plan.
- Update `docs/ISSUE_REGISTER.md`, `docs/MIGRATION_BOARD.md` and this document after every accepted architectural decision.

## Primary references

- [Cloud Run overview](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run)
- [Cloud Scheduler delivery semantics](https://docs.cloud.google.com/scheduler/docs/overview)
- [Cloud Tasks queue and retry controls](https://docs.cloud.google.com/tasks/docs/configuring-queues)
- [Google Secret Manager best practices](https://docs.cloud.google.com/secret-manager/docs/best-practices)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase backups and PITR](https://supabase.com/docs/guides/platform/backups)
- [Supabase read replicas and limitations](https://supabase.com/docs/guides/platform/read-replicas)
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2 object lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Razorpay webhook validation and test/live separation](https://razorpay.com/docs/webhooks/validate-test/)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)

