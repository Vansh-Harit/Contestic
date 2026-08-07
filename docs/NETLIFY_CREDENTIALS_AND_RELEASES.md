# Netlify Credentials and Release Runbook

Last updated: 2026-08-06

This guide covers the current live project without recording any credential values.

## Current project

- Live site: <https://contestic.netlify.app>
- Netlify console: <https://app.netlify.com/projects/contestic>
- Project/site ID: `7c8cee82-db0c-49b5-8507-1cdd7945583a` (identifier, not a secret)
- Production branch: `main`
- Verified live deploy: `6a74adecf701cd0015ea9224`
- Scheduled function: `check-expired`, every six hours (`0 */6 * * *`)

## Where to check credentials

Open [the Contestic Netlify project](https://app.netlify.com/projects/contestic), then go to:

**Project configuration → Environment variables**

There you can check:

- whether a key exists;
- whether it is marked sensitive;
- its deploy context (`Production`, `Deploy Previews`, `Branch deploys`, `Local development`, or all);
- its scopes (`Builds`, `Functions`, `Runtime`, or other supported scopes);
- when it was changed.

Netlify may mask sensitive values and may not reveal them later. If the original value is lost, rotate/recreate it at the owning provider and replace it in Netlify. Never copy values into Git, issues, screenshots or these docs.

The current read-only inventory found 24 expected variable names. `NEXT_PUBLIC_APP_URL` matches the live Netlify origin and `NETLIFY_SCHEDULED_JOBS_ENABLED` is enabled. Both currently apply to all deploy contexts/scopes; context separation is a required hardening task before accepting untrusted preview builds.

## Variable inventory

### Browser-exposed by design

These are compiled into or available to browser code. They are identifiers/configuration, not privileged server secrets:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `NEXT_PUBLIC_SENTRY_DSN`

The Supabase anonymous key is safe to publish only because RLS remains the actual authorization boundary.

### Server secrets

These must never reach browser bundles, public logs, previews from untrusted code, or Git:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `RESEND_API_KEY`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`
- optional `SENTRY_AUTH_TOKEN` when source-map upload is enabled

### Server identifiers/configuration

Treat these as non-public operational configuration even where they are not sufficient credentials:

- `RAZORPAY_KEY_ID`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `CLOUDFLARE_R2_PUBLIC_URL`
- `UPSTASH_REDIS_REST_URL`
- `EMAIL_DOMAIN`
- `ADMIN_EMAIL`
- `ADMIN_USER_ID`
- `OPERATOR_EMAIL`
- `TEST_EMAIL`
- `NETLIFY_SCHEDULED_JOBS_ENABLED`
- optional `DASHBOARD_READ_PROJECTIONS_ENABLED` (keep `false` or unset until
  migration `20260807142130_optimize_authenticated_dashboard_reads.sql` is
  approved, applied and verified)

The placeholder-only contract is `.env.example`. If a runtime key is added or removed, update that file without copying a real value.

## Context and scope policy

Recommended before public launch:

| Variable type | Production | Deploy Preview / branch | Scope |
| --- | --- | --- | --- |
| Public `NEXT_PUBLIC_*` | production values | test values | builds + runtime/functions only where needed |
| Supabase service role | production only | separate test project key or absent | functions/runtime |
| Razorpay secret/webhook | production/test-mode as approved | separate test keys or absent | functions/runtime |
| R2 write credentials | production only | separate test bucket credentials | functions/runtime |
| Resend key | production only | restricted test sender/key | functions/runtime |
| Upstash token | production only | separate test database/token | functions/runtime |
| Cron secret/enable flag | production only | disabled unless a controlled test requires it | functions/runtime |
| Sentry auth token | build only | optional separate project token | builds |

Do not make production secrets available to deploy previews from forked/untrusted pull requests. Importing one `.env` file into the `all` context is convenient for initial deployment but is not the final least-privilege setup.

Environment changes require a new deploy to take effect; `NEXT_PUBLIC_*` values are embedded during the build and always require rebuilding.

## Where to check runtime health

- Deploy status/build log: **Deploys → select the deploy**.
- Function invocations/errors: **Logs & metrics → Functions** or <https://app.netlify.com/projects/contestic/logs/functions>.
- Scheduled run: open `check-expired` function logs and confirm a six-hour invocation, successful authenticated handoff and background execution.
- Domain/TLS: **Domain management**.
- Git branch/build settings: **Project configuration → Build & deploy → Continuous deployment**.
- Access restrictions for previews: **Project configuration → Access & security**.

Netlify success does not prove downstream delivery. Correlate one test action with Supabase state, Razorpay dashboard/webhook event, Resend event, R2 object state and Sentry/log output as applicable.

## Safe release checklist

1. Review the Git diff and verify the intended commit/branch.
2. Confirm no `.env*` secret file is staged; `.env.example` must contain placeholders only.
3. Confirm environment contexts and provider modes (Razorpay test versus live).
4. Run only the explicitly approved quality checks.
5. Deploy a preview from a non-production branch using test credentials.
6. Manually verify authentication, contest entry/brief lock, submission, judging/winner, payment callback/webhook, email, file access and scheduled work appropriate to the change.
7. Merge to `main` only after evidence is accepted.
8. Watch deploy logs, function logs and Sentry during the observation window.
9. Roll back to the previous known-good deploy if failures are material; do not improvise database reversal.

## Provider changes after a domain is purchased

Follow `docs/PRODUCTION_LAUNCH_AND_SCALE_GUIDE.md` for the full sequence. At minimum update and redeploy:

- Netlify custom domain and TLS/DNS records;
- `NEXT_PUBLIC_APP_URL`;
- Supabase Site URL, allowed callback/redirect URLs and custom SMTP;
- Google OAuth authorized origins/redirect URI;
- Razorpay webhook URL and Checkout/domain configuration, separately for test/live modes;
- Resend verified sending subdomain and `EMAIL_DOMAIN`;
- Sentry allowed origins/environment/release settings if used;
- R2 CORS allowlist for the final application origin.

Keep the `netlify.app` callback/origin temporarily during a controlled cutover when the provider supports multiple allowlisted URLs. Remove obsolete origins only after the custom domain is verified end-to-end.

## Credential rotation order

For a suspected leak: contain access, create a replacement at the provider, update the production-only Netlify variable, redeploy, verify, then revoke the old credential. For webhook secrets, support both values temporarily only if the provider and application explicitly support a safe overlap. Record the incident without recording secret values.

Official Netlify references:

- [Environment variables](https://docs.netlify.com/build/environment-variables/get-started/)
- [Scopes and deploy contexts](https://docs.netlify.com/build/environment-variables/overview/)
- [Sensitive variable policy](https://docs.netlify.com/build/environment-variables/secrets-controller/)
