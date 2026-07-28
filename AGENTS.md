# Contestic — Codex Working Rules

Read these first in a fresh session:

1. `docs/CODEX_CONTEXT_PACK.md`
2. `docs/ISSUE_REGISTER.md`
3. `docs/MIGRATION_BOARD.md`
4. The task-specific document in `docs/`

Rules:

- Keep production work staged, small, and reversible. Do not combine cleanup, UI work, and deployment changes.
- Do not handle live Razorpay payments, refunds, payouts, DNS, or production database writes without explicit approval for that action.
- Never print, commit, or copy values from `.env.local`. Update `.env.example` with placeholders only.
- Any Supabase change requires a staging verification, RLS review, and a committed migration. Do not rely on dashboard-only changes.
- Treat `docs/ISSUE_REGISTER.md` as the source of truth for known risks; update it when evidence changes.
- Run TypeScript, lint, and relevant tests after code changes. Record failures rather than suppressing them.
- Do not change application code for documentation-only tasks.
