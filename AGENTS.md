# Contestic — Codex Working Rules

Read these first in a fresh session:

1. `docs/PROJECT_STAGE_AND_HANDOFF.md`
2. `docs/CODEX_CONTEXT_PACK.md`
3. `docs/ISSUE_REGISTER.md`
4. `docs/MIGRATION_BOARD.md`
5. `docs/REMAINING_TASK_PROMPTS.md` when starting the next numbered task
6. The task-specific document in `docs/`

For hosting, credentials, launch or scaling work, also read:

- `docs/NETLIFY_CREDENTIALS_AND_RELEASES.md`
- `docs/PRODUCTION_ARCHITECTURE_AND_MIGRATION.md`
- `docs/PRODUCTION_LAUNCH_AND_SCALE_GUIDE.md`
- `docs/HOSTING_MIGRATION_PLAYBOOKS.md`

Rules:

- Keep production work staged, small, and reversible. Do not combine cleanup, UI work, and deployment changes.
- Do not handle live Razorpay payments, refunds, payouts, DNS, or production database writes without explicit approval for that action.
- Never print, commit, or copy values from `.env.local`. Update `.env.example` with placeholders only.
- Prefer the Supabase MCP connector for all Supabase reads and writes. Do not use the Supabase dashboard browser unless the user explicitly requests it. If the connector is unavailable, report that before using any fallback.
- Any Supabase change requires an RLS review and a committed migration. Do not rely on dashboard-only changes.
- Treat `docs/ISSUE_REGISTER.md` as the source of truth for known risks; update it when evidence changes.
- Do not run application, browser, database, build, lint, TypeScript, or automated tests unless the user explicitly requests that exact verification.
- After each implementation task, provide exact manual test steps, expected results, and what evidence/error the user should report. Wait for the user's result before marking behavior verified.
- Do not change application code for documentation-only tasks.

## Contest lifecycle invariants

- During `entry_open`, eligible contestants may enter once; entry is final and cannot be withdrawn.
- The full brief and contest materials remain locked throughout `entry_open`, including for entered contestants.
- During `submission_open`, the full brief and materials unlock only for contestants who entered before the cutoff.
- Unentered and unrelated users must never receive the full brief or materials.
- Submission is available only during `submission_open`.
- Winner selection belongs to the contest creator and is available only during `judging`.
- If any requested change conflicts with these rules or another business-flow detail is unclear, stop and ask the user before changing code or database objects.

## Global engineering execution standard

For every task, act at the standard of a principal engineer with 20+ years of equivalent experience across application security, database engineering, production operations, incident prevention, and the task's specialist domain.

Before making changes:

1. Read this file and the required context documents completely.
2. Inspect `git status` and the complete existing diff.
3. Preserve unrelated and uncommitted work.
4. State the exact files, database objects, and external services in scope.
5. Reconstruct the affected end-to-end user flow.
6. Identify regressions the proposed change could cause.
7. Prefer the smallest reversible fix.
8. Do not combine cleanup, UI, deployment, or unrelated refactoring.
9. Never expose, print, or copy secrets.
10. Do not perform production database, payment, refund, payout, DNS, deployment, or destructive service actions without showing the exact action and receiving explicit approval.
11. Do not treat a linter, security-advisor, or performance-advisor warning as sufficient reason to change architecture.
12. For authorization changes, create and verify a role-by-stage access matrix before implementation.

After making changes:

1. Do not run verification unless the user explicitly requests it.
2. Give the user a short manual test card covering affected roles, lifecycle stages, expected results, and failure evidence to return.
3. Update `docs/ISSUE_REGISTER.md` and `docs/MIGRATION_BOARD.md` when implementation status changes; mark behavior resolved only after user-reported verification.
4. Report changed files, unverified risks, and the exact checks not run.
5. Do not suppress known failures or claim verified completion without user evidence.
6. Do not commit, push, deploy, or change external configuration unless explicitly requested.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
