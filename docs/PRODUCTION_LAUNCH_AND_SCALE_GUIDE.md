# Contestic Production Launch, Domain, Migration and Scale Guide

Last reviewed: 2026-08-03. Prices and provider limits change; re-check the
linked official pages before purchasing or migrating.

This is the durable operational guide for launching the current application.
It does not authorize a deploy, live payment, refund, payout, DNS change or
production database write. Known unresolved work remains authoritative in
`docs/ISSUE_REGISTER.md` and `docs/MIGRATION_BOARD.md`.

## Current architecture

- Next.js application and APIs: `src/app/`, currently configured for Netlify in
  `netlify.toml`.
- Authentication and database: Supabase through `src/lib/supabase/`.
- Payments and refunds: Razorpay through `src/app/api/payments/`,
  `src/app/api/webhooks/razorpay/` and `src/lib/razorpay*.ts`.
- Transactional application email: Resend through `src/lib/resend.ts` and the
  outbox in `src/lib/email-delivery.ts`.
- Authentication email: Supabase Auth. It is separate from the application
  outbox and must use custom SMTP for production.
- Submission objects: Cloudflare R2 through `src/lib/r2.ts`.
- Rate limiting: Upstash Redis through `src/lib/ratelimit.ts`.
- Error monitoring: Sentry through `src/instrumentation.ts` and
  `src/instrumentation-client.ts`.
- Lifecycle scheduling: Netlify calls `netlify/functions/check-expired.mjs`
  every six hours, which dispatches the protected cron route.

## Release strategy: quiet public beta

The intended first release is a real production deployment on its stable
Netlify subdomain, with no paid marketing for one month. It is still public and
must be treated as production: strangers can discover it, automated jobs can
change records, and live Razorpay credentials move real money.

1. Finish every launch gate below.
2. Publish one stable production deployment using the Netlify subdomain.
3. Keep one production environment only; do not mix Razorpay test IDs with live
   keys or test records with real contests.
4. After the initial smoke test, set `NETLIFY_SCHEDULED_JOBS_ENABLED=true` in
   the Netlify production context and leave it enabled for the month.
5. Invite a small known group, monitor daily for the first week and weekly
   afterward, and avoid unnecessary production deploys.
6. Buy and attach the custom domain after the testing month, then follow the
   domain cutover procedure below.

Domain timing constraint: the website may stay on its Netlify subdomain during
the month, but production authentication email still needs a verified sending
domain. If no usable domain is already available, purchase one before inviting
friends and use it for Resend/Supabase SMTP; attaching it as the website domain
can still wait. Without custom SMTP, Supabase's default sender is limited to
project-team addresses and password recovery will not work for ordinary users.

The repository default remains `NETLIFY_SCHEDULED_JOBS_ENABLED=false` in
`.env.example`. This is an intentional fail-safe; the deployed production
environment is where it becomes `true`.

## Blockers before the first public production deploy

Do not call the application production-ready until these are complete:

- [ ] Complete all manual role/lifecycle checks under M-07, M-09 and M-20.
- [ ] Complete Razorpay test-mode success, failure/retry, duplicate webhook,
      refund and payout checks under M-08, M-08a and M-10.
- [ ] Verify outbox retries and repeated cron invocation cannot duplicate email
      or refunds under M-11 and M-13.
- [ ] Verify R2 privacy, cleanup retry and completed-contest access under M-12.
- [ ] Verify Upstash and Sentry behavior under M-14.
- [ ] Review the final Terms and Privacy text under M-23a.
- [ ] Run the final TypeScript, lint, production build and production smoke
      checks only when explicitly approved.
- [ ] Correct environment separation before deploying. `src/lib/resend.ts`
      currently treats every production build as real email delivery, and the
      Sentry files use `NODE_ENV` with 100% tracing. Netlify previews are also
      production builds, so preview and live behavior must not depend on
      `NODE_ENV` alone.
- [ ] Finish Razorpay webhook production review. The current handler explicitly
      handles captured/failed payments and processed/failed refunds; production
      event selection, prompt acknowledgement and replay evidence remain to be
      verified.

## Environment-variable contract

Use `.env.example` as the list of names. Never copy values into this document.

Browser-visible values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SENTRY_DSN`

Server-only secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_AUTH_TOKEN`

Also configure the non-secret server values from `.env.example`, including the
R2 bucket, email domain, administrator email and Upstash URL. Enter secrets only
in the host/provider settings, mark them secret where supported, and scope them
to the intended Netlify deploy context.

## Initial Netlify deployment

### 1. Preserve a rollback point

1. Confirm the intended files are committed and the production branch is known.
2. Record the commit SHA in the deployment record.
3. Export a Supabase schema/data backup suitable for the current plan. The
   repository migrations are not yet considered blank-database verified while
   M-04 and M-04a remain open.
4. Record the current Razorpay webhook, Supabase Auth and DNS settings without
   recording secrets.

### 2. Configure the final Netlify project

1. Link the GitHub repository and production branch.
2. Confirm `npm run build`, `.next`, Node 20 and `netlify.toml` are detected.
3. Add every environment name from `.env.example` to the production context.
4. Initially set `NEXT_PUBLIC_APP_URL` to the stable production
   `https://<site>.netlify.app` origin.
5. Initially keep `NETLIFY_SCHEDULED_JOBS_ENABLED=false`.
6. Disable automatic credit recharge unless deliberate paid overage is wanted.
7. Enable the 50%, 75% and 100% usage notifications.

### 3. Configure Supabase Auth

1. Set the Supabase Auth Site URL to the Netlify production origin.
2. Add the exact app callback URL to the redirect allowlist:
   `https://<site>.netlify.app/api/auth/callback`.
3. Keep the localhost callback only if local sign-in remains required.
4. Confirm email/password and Google providers are enabled as intended.
5. Configure Supabase Auth custom SMTP with the verified Resend domain. The app's
   `RESEND_API_KEY` does not configure Supabase Auth automatically.
6. Review the password-reset email template and ensure it uses Supabase's
   generated confirmation URL rather than building tokens manually.
7. Enable leaked-password protection if available for the project and record
   the decision.

Password recovery is implemented at:

- Request screen: `src/app/(auth)/forgot-password/page.tsx`
- PKCE exchange: `src/app/api/auth/callback/route.ts`
- Authenticated password update: `src/app/(auth)/reset-password/page.tsx`

Supabase documents the PKCE reset flow at
<https://supabase.com/docs/guides/auth/passwords> and production SMTP at
<https://supabase.com/docs/guides/auth/auth-smtp>. Resend's Supabase SMTP guide
is <https://resend.com/docs/send-with-supabase-smtp>.

### 4. Configure Google OAuth

1. Keep the Google OAuth redirect URI set to Supabase's exact provider callback,
   normally `https://<project-ref>.supabase.co/auth/v1/callback`.
2. In Google Cloud, complete the OAuth consent-screen production requirements:
   product name, support email, authorized domain, homepage, Terms and Privacy.
3. Publish the consent screen from Testing to Production when the final public
   launch is approved. Until then, only configured Google test users can log in.
4. Perform one new-account and one returning-account login after deployment.

### 5. Configure Resend

1. Verify the sending domain and its DKIM/SPF records; publish DMARC deliberately.
2. Use a professional sender such as `noreply@<domain>` for app mail and a
   dedicated authentication sender where practical.
3. Configure Resend SMTP in Supabase Auth separately from the application API.
4. Verify the app outbox sends one controlled email of each critical template,
   including the payout reference template.
5. Confirm bounces and provider failures are visible and retry safely.

### 6. Configure Razorpay live mode

1. Complete every Razorpay test-mode check first.
2. Replace all three production Razorpay values together: public key ID, secret
   key and webhook secret. Never combine test and live values.
3. Set the live webhook URL to
   `https://<site>.netlify.app/api/webhooks/razorpay`.
4. Select only events the reviewed handler supports and add any required
   production events before launch.
5. Confirm signature verification and rapid 2xx acknowledgement using Razorpay
   delivery logs.
6. Treat live refunds and winner payouts as financial operations requiring an
   audit record. Payouts remain manual UPI transfers in the current product.

### 7. Configure R2, Upstash and Sentry

R2:

- Keep the submission bucket private.
- Allow browser upload origins only for the Netlify production origin.
- Verify one disposable upload, authorized download and approved cleanup.
- Do not expose the S3 endpoint or object listing publicly.

Upstash:

- Use the production REST URL/token pair.
- Confirm a protected route is rate-limited without blocking ordinary use.
- Set usage alerts in the Upstash console.

Sentry:

- Use a production DSN and a distinct environment name.
- Lower performance sampling from the current 100% before public traffic.
- Verify one controlled event, source maps and alert delivery, then remove or
  disable any deliberate test trigger.

### 8. Deploy, smoke test, then enable cron

1. Publish exactly one production deploy.
2. Check anonymous Browse, signup/login/recovery, creator and contestant roles,
   profile privacy, contest lifecycle, Razorpay live configuration without
   making an accidental charge, R2, email and admin access.
3. Inspect Netlify logs, Sentry and provider dashboards.
4. Set `NETLIFY_SCHEDULED_JOBS_ENABLED=true` in the production context and
   redeploy once.
5. Invoke the scheduled dispatcher once under supervision, inspect its response
   and confirm no duplicate emails/refunds.
6. Confirm the next automatic six-hour execution.

With this flag enabled, cron is not passive: it advances lifecycle state, sends
email, retries R2 cleanup, purges eligible chat and can initiate approved refund
logic. Disable the flag first during a cron incident.

## One-month monitoring routine

Daily for the first week:

- Netlify credit use, failed functions and response times.
- Sentry new errors and regressions.
- Razorpay failed/duplicate webhook deliveries and unmatched payments.
- Supabase Auth failures, database size and API egress.
- Resend bounces, suppressions, failed outbox jobs and daily quota.
- R2 storage/object growth and cleanup failures.
- Cron last success, work performed and retry backlog.

Weekly afterward:

- Reconcile Razorpay payments/refunds against `payments` and contests.
- Reconcile manual payouts and UTR/reference records.
- Review unresolved `verify` items in `docs/ISSUE_REGISTER.md`.
- Export or confirm the planned database backup.
- Record traffic and provider usage; do not estimate capacity from user count
  alone.

## Custom-domain cutover after the month

1. Buy the domain from the chosen registrar.
2. Add it to Netlify, follow Netlify's exact DNS records and wait for TLS to be
   issued. Keep the Netlify subdomain working during verification.
3. Set the custom domain as primary only after HTTPS works.
4. Change `NEXT_PUBLIC_APP_URL` to the new HTTPS origin and redeploy.
5. In Supabase Auth, change Site URL and add
   `https://<domain>/api/auth/callback` to the redirect allowlist. Keep the old
   callback temporarily for rollback.
6. Update Google consent-screen authorized-domain/homepage/legal links. The
   Google redirect URI normally remains the Supabase provider callback.
7. Change the Razorpay webhook to the custom-domain endpoint, give it its own
   new webhook secret, deploy that secret, verify delivery, then disable the old
   endpoint.
8. Add the new origin to R2 CORS and remove the old origin only after upload and
   download checks pass.
9. Verify Resend DNS and sender identity if the email domain also changes.
10. Update Sentry environment/release settings and any uptime checks.
11. Test signup, Google login, password recovery, payment webhook, email links,
    upload/download, cron and logout on the custom domain.

Recovery links requested before cutover can be tied to the old browser origin
and cookie scope. Ask the user to request a fresh reset link on the new domain
instead of relying on an old outstanding link.

## Rollback order

1. Set `NETLIFY_SCHEDULED_JOBS_ENABLED=false` if cron is implicated.
2. Restore the last known-good Netlify deploy.
3. Restore the prior Razorpay webhook target/secret only if the webhook cutover
   caused the incident.
4. Restore the prior Supabase Site URL/redirect allowlist if authentication is
   broken.
5. Restore the prior primary domain/DNS only after confirming the old deploy is
   healthy.
6. Do not roll back database migrations blindly. Review forward compatibility
   and restore from the approved backup only for a proven data incident.
7. Record timestamps, affected contests/payments and redacted logs in
   `docs/ISSUE_REGISTER.md`.

## Scale and cost plan

Capacity must be based on requests, compute, bandwidth, email, database and file
usage—not a claimed number of users. A few large submission downloads can cost
more than many inactive accounts.

### Stage A: controlled beta

Target: approximately the first 100 light users with no marketing.

- Netlify Free currently provides 300 credits/month. Production deploys cost 15
  credits, compute 10 credits/GB-hour, bandwidth 20 credits/GB and requests 2
  credits/10,000: <https://www.netlify.com/pricing/>.
- Supabase Free currently includes 50,000 monthly active users, 500 MB database,
  5 GB egress and 1 GB Supabase Storage; inactivity can pause a project:
  <https://supabase.com/pricing>.
- Resend Free currently includes 3,000 transactional emails/month with a
  100/day limit: <https://resend.com/docs/knowledge-base/what-is-resend-pricing>.
- R2 Standard currently includes 10 GB-month storage, 1 million Class A and 10
  million Class B operations with free Internet egress:
  <https://developers.cloudflare.com/r2/pricing/>.

Operational limits:

- Batch code changes to avoid paying 15 Netlify credits for many tiny production
  deploys.
- Alert at 50% and investigate at 75% of every provider limit.
- Keep uploaded files short-lived through the approved winner cleanup.
- At Resend 80 emails/day or Netlify/Supabase/R2 70% sustained usage, prepare
  the next paid tier before the service pauses or rejects work.

### Stage B: first paid upgrades

Upgrade the measured bottleneck, not every provider at once.

- Netlify Personal currently starts at $9/month for 1,000 credits; Pro starts at
  $20/month for 3,000 credits.
- Supabase Pro currently starts at $25/month and adds non-pausing compute, 8 GB
  disk, higher egress/storage and daily backups.
- Resend Pro currently starts at $20/month for 50,000 emails.
- Cloudflare Workers Paid is a possible Netlify replacement from $5/month, but
  it requires the migration and compatibility work below.
- Razorpay fees remain transaction-variable; use the current live account rate
  and taxes from the Razorpay agreement rather than hardcoding an estimate.

### Stage C: sustained growth

Consider architecture work when monitoring shows a real constraint:

- Cache anonymous contest summaries while preserving private brief rules.
- Paginate dashboards, creator review and admin payout lists.
- Move long-running cron batches to bounded queues/work items.
- Add database indexes only from measured slow queries and advisor evidence.
- Add provider-budget alarms and reconciliation dashboards.
- Move Supabase compute/storage, Resend volume and host capacity independently.

## Optional Netlify-to-Cloudflare migration

Cloudflare can host this Next.js application on Workers through OpenNext:
<https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>.
It is not a configuration-only switch.

Required migration work:

1. Create a separate branch and preserve the working Netlify configuration.
2. Add and pin `@opennextjs/cloudflare` and Wrangler.
3. Add `wrangler.jsonc`, `open-next.config.ts` and Cloudflare build/deploy scripts.
4. Enable the documented Node.js compatibility mode.
5. Replace `netlify/functions/check-expired*.mjs` with a Cloudflare scheduled
   Worker that calls the same protected lifecycle logic.
6. Move every environment value to Cloudflare bindings/secrets by name.
7. Run a compatibility build and inspect Worker size/startup time.
8. Manually test every SSR page and server route, especially AWS/R2 signing,
   Razorpay, Resend, Sentry, Supabase SSR cookies and cron duration.
9. Create a preview Worker with test-mode providers; do not point the production
   domain or live webhook at it.
10. Cut over DNS/webhooks only after parity checks, then retain Netlify as the
    immediate rollback until the observation window passes.

Cloudflare Free currently allows 100,000 Worker requests/day but only 10 ms CPU
per invocation and a 3 MB Worker bundle. This app's server dependencies may not
fit or execute reliably inside those limits. Workers Paid starts at $5/month,
includes 10 million monthly requests and 30 million CPU-ms, and permits a 10 MB
bundle: <https://developers.cloudflare.com/workers/platform/pricing/> and
<https://developers.cloudflare.com/workers/platform/limits/>.

Decision rule: keep Netlify for the initial month. Reconsider Cloudflare Workers
Paid only after the application is behaviorally verified and a compatibility
build proves that all routes work. Do not assume Cloudflare Free is production-
safe for this server-heavy application.

## Database migration and disaster recovery

Repository migrations live in `supabase/migrations/`. Before migrating or
rebuilding Supabase:

1. Resolve M-04 and M-04a, including the migration-history mismatch recorded as
   C-16.
2. Export schema and data separately and verify the backup can be read.
3. Create the target project and configure Auth/Storage settings explicitly;
   database migrations do not reproduce every dashboard setting.
4. Apply migrations in timestamp order.
5. Review grants, RLS, security-definer functions, Storage policies, Realtime
   publication and advisors.
6. Import data only after structural verification.
7. Rotate service keys and update the host environment; never reuse a leaked or
   exported secret.
8. Reconfigure Auth URLs, Google provider, SMTP, webhooks and R2 separately.
9. Run the complete anonymous/contestant/creator/admin lifecycle test card.
10. Keep the old project read-only until reconciliation completes, then require
    explicit approval before deletion.

## Deployment record template

For each production change, record without secrets:

- Date/time and operator
- Git commit and Netlify deploy ID
- Database migration versions applied
- Environment names changed (never values)
- Razorpay webhook ID/mode
- Supabase Site URL and allowed callback origins
- Cron enabled/disabled and last successful run
- Smoke-test result
- Rollback deploy and decision owner
