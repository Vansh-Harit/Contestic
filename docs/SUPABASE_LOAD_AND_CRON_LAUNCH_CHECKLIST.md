# Supabase Load and Cron Launch Checklist

Last audited: 2026-08-20. This began as a read-only source and live Supabase
audit. The approved cron and notification-centre changes are now implemented
locally, but the migration is not applied and behavior remains unverified until
the manual checks below are completed.

## Current baseline

- Database size is about 13.6 MB. The largest public table is under 181 KB.
- Live estimates: 7 contests, 24 entries, 63 email-delivery rows and 6 profiles.
- Connections: 7 total, 1 active, 5 idle and 0 idle in transaction.
- Cached Browse uses `src/lib/public-contests.ts`; the main
  `get_visible_contests()` workload averages about 10 ms.
- There is no current Supabase capacity emergency and no evidence that a paid
  database upgrade is needed for the controlled beta.

## Confirmed findings

| Severity | Category | Finding | Evidence |
| --- | --- | --- | --- |
| high | cron, performance | The six-hour cron has no whole-job single-flight lock. Overlapping scheduled/manual runs can repeat reconciliation and external cleanup work. | `netlify/functions/check-expired.mjs`; `netlify/functions/check-expired-background.mjs`; `src/app/api/cron/check-expired/route.ts` |
| high | cron, database | Historical completed contests and transferred payouts are rescanned every run. Email uniqueness prevents duplicate rows, but the database still receives duplicate insert attempts: 1,040 email-delivery upserts produced 63 live delivery rows. | `src/app/api/cron/check-expired/route.ts`; `src/lib/email-delivery.ts`; live `pg_stat_statements` 2026-08-20 |
| high | cron, database | Notification deduplication is check-then-insert without a unique dedupe key. Concurrent runs can create duplicate in-app notifications. Live stats show 349 dedupe lookups and 70 inserts. | `src/app/api/cron/check-expired/route.ts`; `src/app/api/webhooks/razorpay/route.ts`; `public.notifications` constraints |
| high | cron, performance | Cron performs per-contest and per-entrant queries and email enqueue requests. It also uses three wide `select('*')` scans of `contests_with_counts`, whose definition joins entries and submissions before distinct counts. This grows poorly and risks the 55-second dispatcher timeout. | `src/app/api/cron/check-expired/route.ts`; `supabase/migrations/20260610081812_create_profiles_table.sql`; `netlify/functions/check-expired-background.mjs` |
| medium | database, performance | The local dashboard projection migration is not present in live migration history and its functions are absent live. The compatibility flag must remain false/unset until the separately approved migration workflow is completed. | `supabase/migrations/20260807142130_optimize_authenticated_dashboard_reads.sql`; `.env.example`; live function/migration inventory 2026-08-20 |
| low | database, performance | The performance advisor reports an unindexed `email_deliveries.user_id` foreign key, two multiple-permissive-policy warnings, and several unused indexes. Current tables are tiny; these warnings are not evidence of a launch bottleneck and do not justify immediate RLS/index changes. | Supabase performance advisor 2026-08-20 |

## Idempotency assessment

| Operation | Current protection | Assessment |
| --- | --- | --- |
| Email delivery | Unique `idempotency_key`, `FOR UPDATE SKIP LOCKED`, retry state and Resend idempotency key | Strong; still wastes calls by re-enqueuing old events |
| Lifecycle transitions | Status/deadline predicates on updates | Idempotent under ordinary retries |
| Empty-contest refund | Stored payment state plus deterministic Razorpay idempotency key | Designed idempotently; duplicate/timeout behavior still needs controlled Razorpay test evidence |
| In-app notifications | Lookup followed by insert, no unique dedupe key | Not concurrency-safe |
| R2 submission cleanup | Pending/completed state and repeat-safe prefix deletion | Eventually safe, but overlapping runs can duplicate R2 work because jobs are not claimed |
| Chat purge | Repeat-safe delete and conditional completion marker | Idempotent, but overlapping runs can duplicate work |
| Whole cron run | Production/feature-flag/secret checks only | No overlap protection |

## Required before general public traffic

- [x] Implement locally a short-lived whole-cron lease/single-flight guard. A second run must
      exit successfully as `already_running`, not start another reconciliation.
- [x] Implement locally bounded worksets and missing-outbox checks for historical reconciliation. Scan
      only due lifecycle rows and events whose delivery/notification state is
      missing; cap each section per run.
- [x] Implement locally atomic notification event keys instead of check-then-insert.
      Preserve intentional daily UPI reminders by including the reminder date
      in the dedupe key.
- [x] Stop selecting all columns from `contests_with_counts` in cron and batch associated profile/entry reads. Return
      only the fields/counts required by each transition and avoid the
      entry-by-submission multiplication in the legacy view.
- [x] Keep external calls outside database locks and preserve existing
      conditional state updates, email outbox keys and Razorpay idempotency.
- [x] Run rollback-only forward/reverse validation for migration
      `20260820155548_add_cron_lease_and_notification_events.sql`. Lease overlap,
      release/reacquisition, partial notification uniqueness, RLS and function
      grants passed on 2026-08-20; a final live read confirmed no objects
      persisted. Live baseline advisors were reviewed separately.
- [ ] Ensure `DASHBOARD_READ_PROJECTIONS_ENABLED` is `false` or unset in live
      Netlify until M-25a is separately approved and applied.
- [ ] Run one controlled cron fixture twice sequentially and once with
      overlapping invocations. Expected: one refund, one email/event, one
      notification, one state transition and one cleanup claim.
- [ ] Confirm one real scheduled run completes below 55 seconds and inspect its
      result counts/failures. The schedule is four runs per day; function
      duration and duplicate external work matter more than request count.

## Safe to defer during the controlled beta

- [ ] Add cursor pagination before Browse, dashboards, review, messages or
      payouts regularly exceed roughly 100 rows for one view/user.
- [ ] Evaluate an index on `email_deliveries.user_id` when user deletion or
      user-scoped delivery lookup becomes common.
- [ ] Re-evaluate the two multiple-permissive RLS warnings only with the
      approved role-by-stage matrix; do not merge policies solely for speed.
- [ ] Re-evaluate unused indexes after representative production traffic and
      a stable statistics window; do not drop them now.
- [ ] Consider the prepared dashboard projections only after deployed timing
      evidence shows the fallback reads are material.

## Monitoring during the first week

- [ ] Record cron duration, rows scanned/claimed, emails claimed/sent/failed,
      refunds requested, cleanup retries and failures for every run.
- [ ] Review `pg_stat_statements` by total time and calls after representative
      traffic; do not optimize from one slow request alone.
- [ ] Alert on a cron duration above 40 seconds, any overlapping-run skip,
      repeated refund attempt, exhausted email retry, or growing cleanup queue.
- [ ] Review Supabase database size, connections, API egress and advisors daily
      for the first week, then weekly.
