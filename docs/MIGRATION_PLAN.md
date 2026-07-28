# Production Cleanup Plan

Work in this order. Do not start a lower row until its dependencies are verified.

1. **Baseline and staging** — low risk, prerequisite. Keep `66a6dd6` recoverable, select the host, create staging resources, and populate staging environment variables from `.env.example`.
2. **Database reproducibility** — blocker, high risk. Export/commit schema migrations; recreate a blank staging database; audit RLS, views, functions, and Storage. Depends on Supabase access.
3. **Security and authorization** — high risk. Resolve C-03, then verify S-01/S-02/S-05 before changing APIs. Depends on a reproducible staging database.
4. **Payment and lifecycle correctness** — high risk. Test and harden webhook/reconciliation, contest transitions, refunds, winner selection, and payouts. Depends on test-mode Razorpay and database verification.
5. **Cron and external operations** — medium/high risk. Select host-specific scheduling, prove idempotency and batch behavior, test email and R2 cleanup. Depends on lifecycle correctness.
6. **Build quality and tests** — medium risk. Resolve lint/type drift, then add focused tests for irreversible flows. Depends on stable behavior from steps 2–5.
7. **Staging release and smoke test** — medium risk. Deploy preview/staging, run the required test matrix, inspect Sentry/logs/metrics. Depends on passing gates.
8. **Controlled production launch** — high impact. Apply production settings, deploy once, execute smoke tests, invite a small cohort. Requires explicit approval for deployment, DNS, and live Razorpay actions.
9. **UI polish** — low risk only after lifecycle and test gates are green. See `docs/UI_AUDIT.md`.

Do not refactor large components merely to improve structure during steps 1–8 unless a specific defect requires it.
