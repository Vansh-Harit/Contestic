# Netlify Preview and Launch Runbook

This runbook does not authorize deployment, DNS changes, live credentials or
live payment actions. Keep secret values in Netlify environment settings, never
in repository files or deploy logs.

## Credit-conscious friend testing

1. Keep all pre-launch work on one pull-request branch and enable its Deploy
   Preview. Do not merge it into the configured production branch.
2. Share the stable `deploy-preview-<number>--<site>.netlify.app` URL. Later
   pushes to the same pull request update that URL.
3. Batch changes before pushing. Preview deploys avoid the production-deploy
   credit charge, but requests, bandwidth and server/function compute still use
   credits.
4. For the approved month-long production-context test, set
   `NETLIFY_SCHEDULED_JOBS_ENABLED=true` so lifecycle, email, cleanup and refund
   behavior can be exercised end to end. Use Deploy Previews only for code-only
   review because scheduled functions do not run automatically there.
5. Use Razorpay test mode and the current pre-production service resources only.
   Do not enter live payment credentials.
6. Check **Usage & billing** after the first test session and before inviting a
   larger group.

## Netlify project configuration

- Framework: Next.js, detected automatically through OpenNext.
- Build command: `npm run build`.
- Publish directory: `.next`.
- Node.js: version 20.
- Functions directory: `netlify/functions`.
- Production schedule: `0 */6 * * *` in UTC.

Add every key from `.env.example` in **Project configuration → Environment
variables**. Use separate Deploy Preview and Production values. Mark private
keys/tokens as secret and never paste values into issue reports.

Preview-specific requirements:

- Set `NEXT_PUBLIC_APP_URL` to the stable Deploy Preview URL.
- Set `NETLIFY_SCHEDULED_JOBS_ENABLED=true` for the approved month-long
  production-context test.
- Add the preview callback URL to the Supabase Auth redirect allowlist. Change
  Google provider settings only if the existing setup requires the app origin;
  the usual Google callback remains the Supabase Auth callback.
- Configure the Razorpay test webhook to the preview URL only when testing
  webhooks.

## Preview acceptance card

1. Confirm the deploy finishes and `/`, `/login`, `/terms` and `/privacy` load.
2. Confirm email/password and Google sign-in return to the preview URL.
3. Confirm anonymous Browse, creator dashboard and contestant dashboard data
   load without server errors.
4. Run only Razorpay test-mode payment checks.
5. Upload and download one disposable R2 file, then complete its approved
   cleanup flow.
6. Confirm the scheduled function is listed but does not run automatically.
7. When lifecycle verification is needed, manually invoke the existing protected
   `/api/cron/check-expired` route and inspect its response and function logs.

Report the failing step, role, timestamp, screenshot, response status and a
redacted log excerpt. Never report credentials or authorization headers.

## Production enablement

After all preview checks pass and separate deployment approval is given:

1. Configure production environment values and set `NEXT_PUBLIC_APP_URL` to the
   final HTTPS origin.
2. Keep `NETLIFY_SCHEDULED_JOBS_ENABLED=true` for the approved end-to-end test
   and monitor the first invocation closely.
3. Update production OAuth callbacks, Razorpay webhook, Resend domain and DNS
   only with separate explicit approval.
4. Publish one production deploy and complete the smoke test.
5. Run the scheduled function manually, inspect dispatcher/background/API logs,
   then confirm its next automatic execution.

## Rollback

1. Set `NETLIFY_SCHEDULED_JOBS_ENABLED=false` first if lifecycle processing is
   implicated.
2. Restore the last known-good Netlify production deploy from the Deploys page.
3. Revert OAuth/webhook/DNS targets only if they were changed and the rollback
   requires it.
4. Confirm Browse, authentication, payment callbacks and the protected cron
   route after rollback.
5. Record the failed deploy ID, time, symptoms and redacted logs in
   `docs/ISSUE_REGISTER.md` before attempting another launch.
