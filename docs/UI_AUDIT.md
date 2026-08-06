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
| high | UI | Ensure locked-brief copy says entry is final and the brief unlocks after the entry period ends only for entered contestants. | Prevents users from assuming entry immediately reveals private requirements. |
| medium | UI | Keep prize, remaining slots, deadline, and primary action together at the top of contest detail. | Reduces scanning and action ambiguity. |
| low | UI | Standardize color, button, border, radius, and shadow tokens across browse, dashboards, and review. | Produces a more deliberate professional look. |
| low | UI | Improve skeleton, empty, retry, and failure states before decorative work. | Reliability feels more professional than ornament. |
| low | UI | Verify mobile interaction for the wizard, chat, attachments, winner confirmation, and payout tables. | These flows contain dense controls. |

Do not use UI work to hide lifecycle ambiguity. First make server state and user-visible state agree.

## Task 11 implementation status

Implemented locally on 2026-08-03 and awaiting user verification. Browse remains the visual baseline; the shared shell, contest lifecycle presentation, separate dashboards with retained sidebars, wizard, submission/review/chat surfaces, profiles and payouts now use the approved restrained system. A follow-up pass moves Browse and dashboard navigation into the signed-in profile menu, replaces footer Browse with working Terms and Privacy destinations, enlarges contestant-card information, removes the decorative winner border and turns the wizard's final step into a structured payment summary without the public description. No application behavior, database object or external service was changed as part of this UI task.
