# Contestic Hosting Migration Playbooks

Last reviewed: 2026-08-13. Provider prices and limits change. Re-check the
official links in this document immediately before approving a migration.

This is a future-agent runbook for moving the existing Contestic Next.js
application from Netlify to one of three targets:

1. Cloudflare Workers Paid through the OpenNext adapter.
2. Firebase App Hosting, which is backed by Cloud Build, Cloud Run and Cloud
   CDN.
3. Direct Google Cloud Run, with explicit control of the container, scheduler,
   revisions and front door.

It is a plan, not authorization. It does not authorize code changes, secrets,
deployments, DNS changes, database writes, Razorpay changes, refunds or
payouts. Netlify remains the production host during the controlled beta until
the owner explicitly approves a different target and exact cutover.

## Executive decision

Do not migrate because a provider looks inexpensive in isolation. Finish the
first month on Netlify, capture real usage and latency, then select the target
against the measured workload.

| Target | Best fit | Main advantage | Main risk | Current preference |
| --- | --- | --- | --- | --- |
| Cloudflare Workers Paid | Lowest-cost edge deployment after compatibility is proven | Low minimum, broad edge network, no separate Workers bandwidth charge | OpenNext/workerd compatibility and CPU/bundle constraints | First target to prototype |
| Firebase App Hosting | Managed Next.js deployment with minimal platform operations | GitHub rollouts, Cloud Run/CDN/Secret Manager managed together | Blaze billing and bandwidth can dominate at scale | Best managed fallback |
| Direct Cloud Run | Maximum Node.js compatibility and operational control | Portable container, revisions, traffic splitting and mature Google Cloud services | More setup and more infrastructure decisions | Long-term control path |

For Contestic, a hosting migration does **not** require a database migration.
Keep the current Supabase project, schema, Auth, Realtime and RLS unless a
separate database migration is approved. Changing hosting and changing the
database in one release would create an unnecessary rollback risk.

## Current application boundary

The host must run the existing Next.js application and preserve these
contracts:

| Concern | Current implementation and evidence |
| --- | --- |
| Next.js pages and APIs | `src/app/`, including 22 route handlers under `src/app/api/` |
| Supabase Auth/Postgres/RLS/Realtime | `src/lib/supabase/`, `proxy.ts`, `src/app/api/auth/callback/route.ts`, `supabase/migrations/` |
| Razorpay Checkout, webhook and refunds | `src/app/api/payments/`, `src/app/api/webhooks/razorpay/route.ts`, `src/lib/razorpay-refund.ts` |
| Email and durable outbox | `src/lib/resend.ts`, `src/lib/email-delivery.ts`, `email_delivery_jobs` in Supabase |
| Lifecycle reconciliation | `src/app/api/cron/check-expired/route.ts` |
| Current scheduler | `netlify/functions/check-expired.mjs`, `netlify/functions/check-expired-background.mjs`, `netlify.toml` |
| Private submissions | `src/lib/r2.ts`, `src/app/api/upload/`, `src/app/api/download/` |
| Rate limits | `src/lib/ratelimit.ts` using Upstash Redis |
| Monitoring | `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation.ts`, `src/instrumentation-client.ts` |
| Environment contract | `.env.example`; values must never be copied into documentation or Git |

The provider-specific migration should change the hosting adapter, deployment
configuration and scheduler wrapper. It should not change product behavior,
authorization, payment amounts, lifecycle timing or data ownership.

## Non-negotiable product invariants

- Entry is final and available only during `entry_open`.
- Full brief and materials remain locked for the whole entry period.
- Only contestants entered before cutoff receive access during
  `submission_open`.
- Winner selection is creator-only and available only during `judging`.
- Razorpay webhooks and refunds remain signature-checked and idempotent.
- Only one production lifecycle scheduler may be enabled at any moment.
- Supabase RLS remains the user-data boundary on every hosting provider.
- Submission objects remain private in Cloudflare R2 and use short-lived signed
  access.
- Secrets remain server-only. Only `NEXT_PUBLIC_*` values may reach browser
  bundles.

## Phase 0: evidence required before choosing a target

Capture at least two normal weeks, including one complete contest lifecycle:

- dynamic requests per day and per month;
- static asset requests and transferred GiB;
- p50, p95 and p99 server response duration, split by public page, authenticated
  page and API route;
- cold-start frequency and duration;
- function errors, timeouts and memory usage;
- average and worst Supabase request/query duration;
- cron duration, repeated-invocation behavior, failure count and outbox backlog;
- R2 operations/transfer, Resend volume, Upstash requests and Sentry events;
- maximum concurrent signed-in sessions observed;
- actual Netlify credit consumption by category.

Do not estimate future cost from user count alone. One user can generate very
different request, compute and bandwidth usage depending on page navigation,
uploads and contest activity.

## Selection gates

Choose Cloudflare Workers Paid only if all of the following pass in a preview:

- the OpenNext build fits Workers deployment and startup limits;
- Supabase SSR cookies and `proxy.ts` behavior work correctly;
- Razorpay signature verification works with the exact raw webhook body;
- the Razorpay, Resend, AWS/R2 signing, Upstash and Sentry packages work under
  Workers `nodejs_compat`;
- uploads, downloads, chat and long lifecycle reconciliation finish within
  Worker CPU/runtime limits;
- source maps and useful logs are available;
- measured cost is lower after including Workers logs and any queue/cache use.

Choose Firebase App Hosting when managed GitHub rollouts, CDN, secrets and
rollback are worth more than the lower theoretical Cloudflare cost. It is the
least operationally demanding Google option for this Next.js application.

Choose direct Cloud Run when full Node.js/container compatibility, canary
traffic, private worker services or future Cloud Tasks processing are more
important than a one-product hosting experience.

## Shared preparation for every migration

Complete these steps in order. Each step needs separate reviewable evidence.

### 1. Freeze and recovery point

- Stop unrelated UI, database and payment work during the migration window.
- Record the exact Git commit and healthy Netlify deploy ID.
- Preserve the previous working Netlify environment and custom domain
  configuration.
- Export a current database backup and verify it can be read. Do not modify the
  database for a host-only migration.
- Record DNS values and TTLs without changing them.
- Record provider configuration by variable **name**, never by secret value.

### 2. Environment separation

Create an isolated target preview using test-mode providers. At minimum:

- a target-specific `NEXT_PUBLIC_APP_URL`;
- Razorpay test keys and a target-specific test webhook secret;
- a target-specific `CRON_SECRET`;
- a restricted Resend test recipient policy until the sender is verified;
- non-production Sentry environment/release labels;
- R2 CORS that contains the exact preview origin only while it is being tested;
- Upstash limits suitable for test traffic.

The Supabase project may remain the same only for the owner-approved controlled
preview. Use clearly identifiable test users and contests and never test
destructive flows on real records. A separate Supabase project becomes the
recommended staging boundary after the migration-history blockers C-01 and
C-16 are resolved.

### 3. Environment contract

Use `.env.example` as the authoritative list of names. Classify them before
importing:

**Browser-visible**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SENTRY_DSN`

**Server-only**

- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `CLOUDFLARE_R2_PUBLIC_URL`
- `RESEND_API_KEY`
- `EMAIL_DOMAIN`
- `ADMIN_EMAIL`
- `TEST_EMAIL`
- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_AUTH_TOKEN`

`NETLIFY_SCHEDULED_JOBS_ENABLED` is Netlify-specific. A replacement host must
have its own explicit scheduler enable/disable control. Do not reuse a
production flag in previews.

### 4. Callback and external-service inventory

Prepare the new origin but keep the old origin allowed until rollback is no
longer needed:

- Supabase Auth Site URL and exact allowed redirect/callback URLs;
- Google OAuth authorized website domains and public app links. The OAuth
  provider callback remains the Supabase `/auth/v1/callback` URL;
- Razorpay test and live webhook endpoints and separate secrets;
- R2 CORS allowed origins;
- Resend/Supabase SMTP sender domain and application links;
- Sentry allowed origins, environment and release;
- `NEXT_PUBLIC_APP_URL` used in emails and redirects.

## Shared preview verification matrix

Run the complete matrix on the target provider subdomain before attaching
`contestic.in`.

| Role/flow | Required evidence |
| --- | --- |
| Anonymous | Browse, legal pages, contest summary, login and protected-route redirect work without private data leakage |
| Auth | Email/password sign-in, Google sign-in, sign-out, fresh password recovery, used/expired recovery rejection |
| Contestant | Enter once, locked brief during entry, unlock after cutoff, submit description, upload, link, chat and authorized download |
| Creator | Create draft, retry payment on same draft, payment verification, review names/descriptions/files/chat, select winner only in judging |
| Unrelated user | Cannot read private brief, materials, submissions, files, chat, payment IDs or payout records |
| Admin | Can view payout queue, record UTR/reference and trigger only the intended email |
| Lifecycle | Entry close, early capacity close, submission close, judging, zero-submission prize-only refund with the 5% fee retained, overdue review alert, email retry and 90-day chat purge |
| Reliability | Duplicate webhook and duplicate cron invocation do not duplicate payment, refund, email or cleanup side effects |
| Observability | Logs and Sentry identify release, environment, route and error without exposing secrets or private content |
| Responsive | Critical flows work on desktop and approximately 390 px mobile width |

No target is eligible for DNS cutover while any money, auth, upload, winner or
cron row is unverified.

## Playbook A: Cloudflare Workers Paid

### Intended architecture

```text
Users -> Cloudflare DNS/TLS -> Next.js Worker (OpenNext)
                                  -> Supabase
                                  -> Razorpay
                                  -> R2
                                  -> Resend
                                  -> Upstash

Cloudflare Cron Trigger -> dedicated scheduler Worker
                       -> protected Contestic lifecycle endpoint
```

Keep the application as one Next.js Worker initially. Keep the scheduler as a
separate tiny Worker so it can be disabled, retried and observed independently
of website deployments.

### Preparation branch

In a future migration branch only:

1. Add pinned `@opennextjs/cloudflare` and Wrangler development dependencies.
2. Add reviewed `wrangler.jsonc` and `open-next.config.ts` configuration.
3. Add `.open-next/` to `.gitignore`.
4. Add explicit preview/build/deploy scripts without replacing the normal
   local Next.js workflow.
5. Enable the documented `nodejs_compat` compatibility flag and pin a reviewed
   compatibility date.
6. Keep `netlify.toml` and Netlify functions until Cloudflare production is
   verified; they are the rollback path.

Do not run the OpenNext migration command blindly. Review every generated file
and dependency change. The current application uses Node-oriented packages and
security-sensitive route handlers.

### Compatibility audit

Verify every item on Cloudflare before proceeding:

- Next.js 16 App Router, route handlers, server components, middleware/proxy,
  cookies, redirects, streaming and image behavior;
- raw Razorpay webhook body and HMAC verification;
- Razorpay SDK networking and Node crypto;
- AWS S3-compatible signing used by `src/lib/r2.ts`;
- Supabase SSR authentication refresh/cookies;
- Resend, Upstash and Sentry transports/source maps;
- R2 signed upload/download response sizes and browser CORS;
- cron duration and CPU use for the full reconciliation route;
- bundle/startup size and absence of unsupported native Node dependencies.

Cloudflare documents App Router, route handlers, SSR and middleware support
through OpenNext, but Node.js middleware is not yet supported. Treat
`proxy.ts` as a release gate rather than assuming compatibility.

### Secrets and builds

- Store server secrets as encrypted Worker secrets, never plaintext Wrangler
  variables or GitHub files.
- Keep public variables non-secret and environment-specific.
- Use separate Worker environments/services for preview and production.
- Configure GitHub builds so pull requests cannot receive production secrets.
- Upload a preview version first and capture the version ID.
- Put an explicit CPU limit in Worker configuration to reduce runaway-cost
  risk.

### Scheduler migration

Use a dedicated scheduled Worker for the first migration. Its only job is to
call `/api/cron/check-expired` with the protected bearer secret and record the
result. The application route remains the source of lifecycle logic.

1. Deploy the scheduler with triggers disabled.
2. Invoke it manually against test data.
3. Repeat the invocation and prove idempotency.
4. Enable the Cloudflare cron trigger in UTC.
5. Confirm one automatic run and complete logs.
6. Disable `NETLIFY_SCHEDULED_JOBS_ENABLED` only after that evidence exists.
7. Confirm that exactly one scheduler remains enabled.

Later, split email, refund reconciliation and R2 cleanup into Cloudflare Queues
only if the single reconciliation request becomes a measured limit. Supabase
outbox rows remain authoritative; queue delivery is at-least-once.

### Domain and production cutover

1. Verify the Worker on its provider hostname with test providers.
2. Add `contestic.in` as a Worker custom domain/route without changing live DNS
   until the release window.
3. Configure the production environment, but keep the target scheduler off.
4. Update Supabase, R2, Razorpay test webhook and Sentry allowlists for the
   final origin while retaining Netlify temporarily.
5. Deploy the exact approved commit and repeat the critical smoke matrix.
6. Switch the custom-domain route/DNS to the Worker.
7. Observe logs, Sentry, Razorpay and auth for at least one full session.
8. Enable the Cloudflare scheduler, verify one automatic run, then disable the
   Netlify scheduler.
9. Keep Netlify deployable for at least seven days before removing old callback
   and CORS origins.

### Cloudflare rollback

1. Disable the Cloudflare scheduler first.
2. Restore the previous healthy Worker version for an application-only defect,
   or route the domain back to Netlify for a platform defect.
3. Restore the Netlify `NEXT_PUBLIC_APP_URL`/deploy configuration if required.
4. Re-enable the Netlify scheduler only after confirming the Cloudflare
   scheduler is off.
5. Keep both Razorpay webhook secrets while provider retries for the old
   endpoint can still arrive; never point an old endpoint at a new secret.
6. Do not roll back Supabase data or RLS for a host-only rollback.

### Cloudflare cost guardrails

As of 2026-08-13, Workers Paid has a USD 5 monthly minimum, includes 10 million
dynamic requests and 30 million CPU-ms, and lists no additional Workers data
transfer charge. Static asset requests are free and unlimited unless a feature
changes their billing behavior. Configure CPU limits and review logs because
requests, CPU, logs, queues, KV and other bound products have separate meters.

Official references:

- <https://developers.cloudflare.com/workers/platform/pricing/>
- <https://developers.cloudflare.com/workers/platform/limits/>
- <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>
- <https://opennext.js.org/cloudflare/get-started>
- <https://developers.cloudflare.com/workers/configuration/cron-triggers/>

## Playbook B: Firebase App Hosting

### Use App Hosting, not static Firebase Hosting alone

Contestic has server-rendered pages, route handlers, auth callbacks, webhooks
and cron logic. Static Firebase Hosting alone cannot replace the current host.
The managed Firebase option is **Firebase App Hosting**. It builds through
Cloud Build, runs on Cloud Run and serves through Cloud CDN. Firebase Hosting
may alternatively be used only as a front door for a separately managed Cloud
Run service.

### Intended architecture

```text
Users -> Firebase App Hosting / Google load balancer / Cloud CDN
             -> managed Cloud Run revision for Next.js
                  -> existing Supabase, Razorpay, R2, Resend, Upstash, Sentry

Cloud Scheduler (OIDC) -> private dispatcher -> protected lifecycle endpoint
```

### Project and backend preparation

1. Create a dedicated Google Cloud/Firebase project for production and enable
   Blaze billing. Do not reuse a personal experimental project.
2. Add billing budgets and alerts before enabling the backend. Alerts do not
   cap spend.
3. Connect the GitHub repository through Firebase App Hosting.
4. Create a non-production backend first, with automatic rollouts disabled or
   attached to a dedicated migration branch.
5. Add `apphosting.yaml` only in the future migration branch and review memory,
   CPU, concurrency, minimum and maximum instances.
6. Store server-only values in Secret Manager references. Keep browser-visible
   values in environment-specific configuration.
7. Start with `minInstances: 0` and a conservative `maxInstances` such as 2-5;
   adjust only from load and Supabase-connection evidence.

Firebase App Hosting deploys commits from a configured live branch. Use a
second backend/project for preview/staging rather than treating every branch as
a trusted production preview.

### Scheduler migration

The current application cron route accepts `Authorization: Bearer
<CRON_SECRET>`. The preferred Google design is:

1. Cloud Scheduler authenticates with OIDC to a small private Cloud Run
   dispatcher service.
2. The dispatcher reads `CRON_SECRET` from Secret Manager.
3. It calls the public App Hosting lifecycle endpoint with the bearer header.
4. It records status, duration and response without logging the secret.

This keeps the secret out of a URL and keeps Scheduler identity-based. A direct
Scheduler call with a stored custom authorization header may be used only after
a security review and explicit approval. Do not change the main route to accept
unauthenticated scheduler traffic.

Use the same one-scheduler sequence: deploy disabled, invoke manually, repeat,
enable automatic target execution, verify, then disable Netlify.

### Rollouts and domain cutover

1. Deploy and verify the App Hosting provider subdomain.
2. Review Cloud Build logs and the generated Cloud Run revision.
3. Confirm all secrets are available only at runtime and not in build logs.
4. Add the custom domain using the App Hosting wizard and wait for managed TLS.
5. Update external callback/CORS/webhook allowlists while retaining Netlify.
6. Deploy the exact approved commit manually or from the controlled live
   branch.
7. Switch the domain after the full preview matrix passes.
8. Verify the scheduler handoff and monitor the first automatic run.

### Firebase rollback

1. Disable the Google scheduler/dispatcher first.
2. Use App Hosting instant rollback to the previous rollout for an application
   defect.
3. For a provider defect, restore DNS to Netlify and re-enable Netlify cron
   only after Google scheduling is off.
4. Retain the old App Hosting revision and logs until payment/auth retries have
   settled.
5. Do not change Supabase data during rollback.

### Firebase cost guardrails

App Hosting requires Blaze billing. As of 2026-08-13, documented monthly
no-cost allowances include 10 GiB App Hosting outgoing bandwidth, 2 million
Cloud Run requests, 180,000 vCPU-seconds and 360,000 GiB-seconds. Above the
allowance, App Hosting lists cached and uncached bandwidth separately, and the
underlying Cloud Run, Build, Artifact Registry, Secret Manager and Logging
meters also apply. Bandwidth is the most likely surprise for a media-heavy
site, although Contestic submission files remain on R2.

Set budgets at 50%, 75%, 90% and 100% of the owner-approved monthly amount,
keep maximum instances low initially, limit log retention and avoid unnecessary
rollouts. A budget alert is not a hard spending cap.

Official references:

- <https://firebase.google.com/docs/app-hosting>
- <https://firebase.google.com/docs/app-hosting/costs>
- <https://firebase.google.com/docs/app-hosting/rollouts>
- <https://firebase.google.com/docs/app-hosting/custom-domain>
- <https://firebase.google.com/docs/app-hosting/configure>

## Playbook C: Direct Google Cloud Run

### Intended architecture

```text
Users -> global external Application Load Balancer + managed TLS + Cloud CDN
             -> Cloud Run web service (Next.js container)
                  -> existing Supabase, Razorpay, R2, Resend, Upstash, Sentry

Cloud Scheduler (OIDC) -> private Cloud Run dispatcher
                              -> protected web reconciliation endpoint

Later: dispatcher -> Cloud Tasks -> private worker routes/services
```

This is the most portable option because the deployment artifact is a normal
container and the runtime is full Node.js. It also requires the most explicit
operations work.

### Foundation

1. Create separate Google Cloud projects for non-production and production.
2. Attach billing, create budget alerts and enable only the required APIs:
   Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Scheduler and,
   later, Cloud Tasks.
3. Create least-privilege service accounts for build, web runtime, scheduler
   dispatcher and workers. Do not use owner/editor identities at runtime.
4. Choose the initial region from measured database and user latency. The
   current Supabase project is recorded in Singapore, so `asia-southeast1` is
   the first region to benchmark for database-heavy requests.
5. Keep a staging service and production service with separate secrets and
   deployment identities.

### Packaging and deployment

In a future migration branch:

1. Produce a reproducible Next.js container, preferably using Next.js
   standalone output and a multi-stage build.
2. Run as a non-root user, use a read-only application image and write only to
   disposable `/tmp` when unavoidable.
3. Add a health/readiness endpoint that proves the process is serving without
   performing a destructive database action.
4. Pin the Node major version and dependency lockfile.
5. Build with Cloud Build into Artifact Registry and deploy by immutable image
   digest.
6. Make the web service publicly reachable but keep dispatcher/worker services
   private and service-account authenticated.
7. Start with request-based billing, `min-instances=0`, a conservative maximum
   such as 2-5, and measured concurrency rather than the platform maximum.

Do not add Cloud SQL. Supabase remains the database. Do not move R2 objects into
Google storage as part of hosting migration.

### CI/CD and revisions

- GitHub changes build a staging image first.
- Required checks and the shared verification matrix gate production.
- Production deploys use a specific image digest, not an unpinned tag.
- Send a small percentage of traffic to the new revision only after staging
  passes; then increase gradually.
- Retain the last healthy revision for immediate rollback.
- Keep schema migrations in a separate, explicitly approved step. A web
  revision must remain compatible with the current database during rollback.

### Scheduler and background work

Create a private dispatcher service:

1. Cloud Scheduler sends an OIDC-authenticated request to the dispatcher.
2. The dispatcher reads `CRON_SECRET` from Secret Manager and invokes the
   protected application route.
3. It emits structured completion/failure metrics and never logs payload
   secrets.
4. Enable retries only after repeated invocation is proven safe.

When reconciliation outgrows one request, split it incrementally:

- Scheduler enqueues lifecycle reconciliation.
- Cloud Tasks invokes authenticated private handlers.
- Separate queues cover email, refund reconciliation and R2 cleanup.
- Supabase state and idempotency keys remain authoritative.

Do not perform this decomposition during the first hosting move unless measured
runtime limits require it.

### Front door and custom domain

Google recommends a global external Application Load Balancer for a production
Cloud Run custom domain. It supports managed routing, Cloud CDN and Cloud Armor.
Direct Cloud Run domain mapping is preview/limited and is not the preferred
production path. Firebase Hosting is another supported front door.

1. Verify the `run.app` staging service first.
2. Create the load balancer, serverless network endpoint group, managed
   certificate and HTTPS routing.
3. Restrict Cloud Run ingress so production traffic reaches it through the
   approved front door where practical.
4. Add `contestic.in`, wait for certificate readiness and only then change DNS.
5. Keep Netlify available throughout the observation window.

### Cloud Run rollback

1. Disable the target Scheduler job first.
2. Shift traffic to the previous healthy Cloud Run revision for an application
   defect.
3. For load-balancer/platform failure, restore DNS to Netlify and re-enable
   Netlify cron only when Google scheduling is off.
4. Preserve logs, revision digest and incident timestamps.
5. Do not revert Supabase records for a hosting rollback.

### Cloud Run cost guardrails

As of 2026-08-13, request-based Cloud Run lists a monthly free tier equivalent
to 2 million requests, 180,000 vCPU-seconds and 360,000 GiB-seconds, calculated
at `us-central1` rates. Region, egress, load balancer, CDN, logging, builds,
artifact storage, secrets and Scheduler/Tasks are separate charges. The Google
Cloud USD 300 trial credit is temporary and is not a sustainable cost model.

Use budgets and alerts, low maximum instances, zero minimum instances until
latency justifies otherwise, log exclusions/retention controls and per-service
labels. Recalculate from measured request duration, concurrency and bandwidth
rather than users.

Official references:

- <https://cloud.google.com/run/docs/overview/what-is-cloud-run>
- <https://cloud.google.com/run/pricing>
- <https://cloud.google.com/run/docs/mapping-custom-domains>
- <https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration>
- <https://cloud.google.com/scheduler/docs/http-target-auth>
- <https://cloud.google.com/tasks/docs/creating-http-target-tasks>

## Shared production cutover sequence

This is the exact dependency order. Never combine it with unrelated cleanup.

1. Owner selects one provider from measured evidence.
2. Agent shows exact code/config files to change and receives approval.
3. Target preview deploys with test-mode credentials and target scheduler off.
4. Full shared verification matrix passes on the provider hostname.
5. Exact production environment-variable **names** and destination scopes are
   reviewed; secret values are entered through the provider secret store.
6. Target production deploy is created without receiving custom-domain traffic.
7. R2 CORS and Supabase redirect allowlists add the new exact origin; old origin
   stays temporarily.
8. A new Razorpay webhook endpoint and secret are created for the target. Test
   mode success, failure, duplicate and replay evidence must pass.
9. Sentry environment/release and Resend-generated links are verified.
10. Target cron is manually invoked twice. It remains scheduled-off.
11. DNS TTL is lowered in advance, and the exact before/after records are shown
    for approval.
12. DNS/custom-domain traffic moves to the target.
13. Auth, Razorpay, R2 and critical role smoke checks run immediately.
14. Target scheduler is enabled and one automatic run is observed.
15. Netlify scheduler is disabled. Confirm there is exactly one scheduler.
16. Monitor errors, latency, payment webhooks, outbox backlog and cost for 24
    hours; retain Netlify for at least seven days.
17. Only after stability is accepted, remove obsolete callback/CORS origins and
    stop the old host. Deletion is a separate destructive action.

## Shared rollback trigger and sequence

Rollback immediately for any of these:

- auth sessions/callbacks fail for ordinary users;
- Razorpay webhook verification or payment reconciliation fails;
- unauthorized private data becomes visible;
- upload/download or winner cleanup is unsafe;
- cron duplicates or stops lifecycle/refund/email processing;
- p95 latency or error rate breaches the owner-approved threshold;
- cost increases without an understood workload explanation.

Rollback order:

1. Disable the new scheduler.
2. Restore application traffic to the last healthy revision or Netlify.
3. Confirm external callbacks point to a healthy endpoint.
4. Re-enable Netlify scheduler only if every target scheduler is off.
5. Verify one login, one read-only contest view and webhook endpoint health.
6. Preserve logs/evidence; do not delete the failed environment.
7. Do not reverse database state unless a separately approved database change
   was part of the incident.

## Database migration policy

No database schema or data migration is required for any of the three hosting
options. Retain:

- the same Supabase URL/keys and server-client boundaries;
- every RLS policy and database function;
- the database email outbox and idempotency records;
- Auth identities and callback flow;
- Realtime chat behavior.

A later move away from Supabase is a separate project. It requires resolving
C-01/C-16, proving a blank rebuild, rehearsing data export/import, recreating
Auth identities, RLS-equivalent authorization, Realtime, backups and a
dual-read/cutover plan. See `docs/PRODUCTION_ARCHITECTURE_AND_MIGRATION.md` and
`docs/PRODUCTION_LAUNCH_AND_SCALE_GUIDE.md`. Never combine that work with a
hosting cutover.

## Required approval gates

Explicit owner approval is required before each of these actions:

- adding or changing provider dependencies/configuration;
- importing production secrets;
- deploying a production environment;
- creating/enabling/disabling a production scheduler;
- adding or switching Razorpay webhooks/secrets;
- changing Supabase Auth Site URL/redirect allowlists;
- changing R2 CORS;
- changing DNS/custom-domain routing;
- disabling or deleting Netlify resources;
- any database, refund or payout write.

## Evidence package for future agents

Before declaring a migration complete, update:

- `docs/PROJECT_STAGE_AND_HANDOFF.md` with the authoritative provider, domain,
  deploy/revision/version identifier and rollback target;
- `docs/DEPLOYMENT_NOTES.md` with provider configuration and observed results;
- `docs/ISSUE_REGISTER.md` with regressions and resolved evidence;
- `docs/MIGRATION_BOARD.md` one checkbox at a time;
- `.env.example` only if new variable names were introduced, using placeholders
  only.

Final handoff must include:

- exact commit and provider release ID;
- target region/runtime and scheduler identity;
- proof that only one scheduler is active;
- tested callback/webhook/CORS origins;
- p50/p95 latency, error rate and first cost reading;
- previous Netlify deploy and DNS rollback instructions;
- unverified risks and the next observation time.
