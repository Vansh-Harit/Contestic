# UI Audit — Post-Stabilization Suggestions

This is a recommendation list, not a confirmed defect list. Make these changes only after `docs/MIGRATION_BOARD.md` reaches its quality gate.

## Confirmed interface areas

- Browse: `src/components/browse-client.tsx`
- Contest detail and phase actions: `src/components/contest-detail-client.tsx`
- Contest-posting wizard: `src/app/(main)/post/page.tsx`
- Contestant and lister dashboards: `src/components/contestant-dashboard-client.tsx`, `src/components/lister-dashboard-client.tsx`
- Submission review: `src/components/submission-review-client.tsx`
- Payout administration: `src/components/admin-payouts-client.tsx`

## Recommended improvements

| Severity | Category | Suggestion | Rationale |
| --- | --- | --- | --- |
| medium | UI | Use one consistent status system for entry, submission, judging, completed, and cancelled states. | The contest lifecycle is the core product concept. |
| medium | UI | Add a compact phase tracker to contest detail pages. | Makes the entry-reveal-submission model understandable. |
| medium | UI | Keep prize, remaining slots, deadline, and primary action together at the top of contest detail. | Reduces scanning and action ambiguity. |
| low | UI | Standardize color, button, border, radius, and shadow tokens across browse, dashboards, and review. | Produces a more deliberate professional look. |
| low | UI | Improve skeleton, empty, retry, and failure states before decorative work. | Reliability feels more professional than ornament. |
| low | UI | Verify mobile interaction for the wizard, chat, attachments, winner confirmation, and payout tables. | These flows contain dense controls. |

Do not use UI work to hide lifecycle ambiguity. First make server state and user-visible state agree.
