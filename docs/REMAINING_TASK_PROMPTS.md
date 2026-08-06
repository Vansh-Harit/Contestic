# Remaining Production-Readiness Prompts

Tasks 1-8 have local implementation work recorded; required user verification
and unapplied migrations remain tracked in `docs/MIGRATION_BOARD.md`.
Execute one prompt at a time. For every task, Codex implements only and supplies
a manual test card; the user runs the checks and reports results.

## Next manual test card

Run this before Task 4 and report only failed steps.

### While entry is open

1. In Chrome as the contestant, refresh the contest page.
2. Confirm the full brief and materials are locked.
3. Enter the contest.
4. Confirm `Entered` appears and no withdrawal action is available.
5. Confirm the full brief and materials are still locked.
6. Confirm a direct `DELETE` request to the entry endpoint is rejected with 405.

### After the entry period ends

1. Refresh Chrome as the contestant who remained entered.
2. Confirm entry remains final and no withdrawal action is available.
3. Confirm the full brief and materials are visible.
4. Confirm submission is available.
5. Using an unrelated account, confirm the brief/materials and
   submission action remain unavailable.
6. In Brave as the creator, confirm the remaining entrant appears in the contest
   management view.

Report: failed step number, account role, screenshot, visible message, and the
approximate time. Do not include credentials or environment values.

## Task 4 — Finish authorization integration

Before running: wait until the current contest naturally reaches the relevant
stage, then attach the user's manual test results.

```text
Follow AGENTS.md and read the required context documents first.

Act as a principal application-authorization and Supabase engineer.

Use my attached manual test report to fix only confirmed authorization or
lifecycle regressions. Preserve these invariants:
- entry_open permits entry, and a successful entry is final;
- the full brief/materials remain locked throughout entry_open;
- submission_open unlocks the brief/materials only for contestants who entered
  before the cutoff;
- only submission_open accepts submissions;
- only the creator may select a winner, and only during judging.

Ask me before changing anything if a business-flow detail is unclear. Prefer the
Supabase MCP connector; do not use the Supabase dashboard browser. Do not run
tests, browser automation, builds, lint, TypeScript, or database assertions.
After implementation, give me exact manual retest steps and expected results.
Do not commit or deploy.
```

## Task 5 — Make the database reproducible

Before running: enable the Supabase MCP connector for the Contestic project with
read access. Persistent database writes are not required.

```text
Follow AGENTS.md. Act as a principal PostgreSQL/Supabase migration engineer.

Resolve C-01 by exporting the current Contestic schema, tables, constraints,
indexes, RLS policies, grants, views, functions, triggers, cron definitions and
Storage policies into an ordered local migration baseline. Preserve the already
applied hardening migrations and do not duplicate or weaken them.

Use Supabase MCP, not dashboard browser automation. Make repository files only;
do not change the live database. Do not run tests or rebuild a database. Give me
exact blank-project reconstruction instructions that I can run manually and
report back. Do not commit or deploy.
```

## Task 6 — Build, lint and type cleanup

Before running: no external-service access is required.

```text
Follow AGENTS.md. Act as a principal Next.js/TypeScript build engineer.

Resolve confirmed C-02, C-05 and C-09 issues with the smallest behavior-
preserving changes. Fix lint errors in bounded groups, align submission types
with file_urls, and remove the Windows/native-build ambiguity without changing
product behavior or UI design. Do not refactor unrelated components.

Do not run TypeScript, lint, build or tests. Give me the exact commands to run,
the expected successful output, and which error sections to paste back. Do not
commit or deploy.
```

## Task 7 — Payments, refunds and payouts

Before running: provide Razorpay test-mode access and the intended refund,
commission and manual-payout rules. Do not provide live credentials.

```text
Follow AGENTS.md. Act as a principal payments and financial-systems engineer.

Harden Razorpay order creation, signature verification, webhook idempotency,
duplicate/out-of-order delivery, cancellation, refund reconciliation,
commission accounting and manual UPI payout records. Preserve the rule that the
contest creator funds the prize, Contestic keeps its commission, and the admin
records the manual payout. Ask me about any unclear money transition before
changing it.

Use test-mode contracts only. Do not initiate payments, refunds or payouts. Do
not run tests. Give me an exact Razorpay test-mode checklist with expected
database and UI outcomes. Do not commit or deploy.
```

## Task 8 — Lifecycle cron and email

Before running: provide the exact contest timing rules and Resend test-domain
access if email templates or delivery configuration must change.

```text
Follow AGENTS.md. Act as a principal distributed-jobs and email-delivery
engineer.

Make the contest lifecycle cron idempotent and safe for entry-close,
submission-close, judging, cancellation, refund scheduling and email retries.
Preserve the final-entry/brief-unlock lifecycle in AGENTS.md. Prevent
duplicate emails, duplicate refunds and skipped contests. Keep host migration
out of this task.

Do not invoke cron, send email, run tests or use browser automation. Give me the
exact manual cron requests, fixture states, expected database transitions and
email results to verify. Do not commit or deploy.
```

## Task 9 — Private submission files and cleanup

Before running: provide scoped Cloudflare R2 access and confirm the final
retention rule for winner files versus non-winning submissions.

```text
Follow AGENTS.md. Act as a principal cloud-storage and application-security
engineer.

Finish C-13/S-05: keep R2 objects private, issue short-lived authorized
downloads only to the submitting contestant and contest creator at allowed
stages, prevent key tampering, and implement the approved post-winner deletion
policy. Do not delete existing objects until I explicitly approve the exact
targets.

Do not run upload/download tests or browser automation. Give me exact manual
tests for owner, creator and unrelated users, signed-URL expiry, and cleanup.
Do not commit or deploy.
```

## Task 10 — Authentication, profiles and chat

Before running: confirm whether bio is included now and provide the allowed bio
length/content rules. Supabase MCP read access is required.

```text
Follow AGENTS.md. Act as a principal authentication and privacy engineer.

Finish OAuth/session/admin verification, profile editing and chat authorization.
Users may update their own safe public fields through validated server routes.
Other people may view only the approved public profile fields: display name,
avatar and, if I approve its schema, bio. Email, role, UPI and payment data stay
private. Chat is limited to the contest creator and valid entrant during allowed
stages.

Ask me before adding the bio schema or changing chat-stage behavior. Use
Supabase MCP, not the dashboard browser. Do not run tests. Give me role-based
manual checks and expected results. Do not commit or deploy.
```

## Task 11 — Professional UI polish

Before running: complete Tasks 4–10 and confirm the preferred visual direction.

```text
Follow AGENTS.md and docs/UI_AUDIT.md. Act as a principal product designer and
frontend engineer.

Polish Contestic without changing business logic: add a clear lifecycle tracker,
make final-entry/brief-unlock timing unambiguous, standardize status badges,
buttons, spacing, borders, empty/error/loading states and mobile layouts. Keep
prize, slots, deadline and primary action easy to scan. Work in small reversible
UI groups and do not touch payments, database authorization, cron or hosting.

Do not run visual tests or browser automation. Give me exact pages, roles,
viewport sizes and interactions to review after each UI group. Do not commit or
deploy.
```

## Task 12 — Netlify production readiness and controlled launch

Before running: Tasks 4–11 must be user-verified. Provide Netlify, DNS, OAuth,
Resend, Sentry and GitHub access as needed; keep live credential values hidden.

```text
Follow AGENTS.md and docs/DEPLOYMENT_NOTES.md. Act as a principal production and
Netlify operations engineer.

Prepare the final Netlify production configuration, replace Vercel-specific
cron behavior, validate the environment-variable contract by name only, create
rollback/runbook documentation, and prepare the final launch checklist. Remove
Vercel-specific files only when their Netlify replacements are complete.

Do not deploy, change DNS, enter live secrets, run builds/tests, commit or push.
Give me the exact commands and dashboard checks I must run, their expected
results, and the separate final approval prompt for production deployment.
```
