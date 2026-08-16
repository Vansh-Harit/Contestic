# PostHog Analytics Contract

Last updated: 2026-08-16

Contestic uses PostHog for privacy-limited product analytics. Initialization is
in `src/instrumentation-client.ts`; typed capture helpers are in
`src/lib/analytics.ts`.

## Privacy defaults

- Automatic click/form capture, session replay, heatmaps, performance capture,
  exception capture and automatic pageviews are disabled.
- Browser Do Not Track preferences are respected.
- Every event sets `$geoip_disable=true`, preventing IP-derived location
  enrichment for new events.
- Pageviews contain the origin and pathname only. Query strings and fragments
  are not sent.
- Signed-in users are identified only by their stable Supabase user UUID.
- Never send email, name, bio, brief or submission text, chat, filenames,
  external links, UPI/UTR values, or Razorpay identifiers.
- Analytics failure must never block an application action.

## Events

| Event | Safe properties | Trigger |
| --- | --- | --- |
| `$pageview` | `path`, query-free `$current_url` | pathname changes |
| `contest_viewed` | contest ID, category, phase, viewer relationship | contest detail rendered |
| `contest_entered` | contest ID, category | entry API succeeds |
| `submission_started` | contest ID, category | eligible contestant opens submission dialog |
| `submission_completed` | contest ID, category, attachment count/types, description-present boolean | submission API succeeds |
| `contest_creation_step_completed` | step number, category | a valid contest-creation step advances |
| `contest_checkout_opened` | contest ID, category, advertised prize | Razorpay opens |
| `contest_checkout_dismissed` | contest ID | Razorpay modal is dismissed |
| `contest_payment_verified` | contest ID, category, advertised prize | server verification succeeds |
| `winner_selected` | contest ID, submission count | winner API succeeds |
| `profile_updated` | update kind, optional bio-present boolean | profile API succeeds |

## Configuration

Set `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` in the
target deploy context. The project token is browser-visible by design; never
use a PostHog personal API key. If the variables are absent, analytics stays
disabled without affecting Contestic.

## PostHog workspace

- Dashboard: [Contestic Product Health](https://us.posthog.com/project/560832/dashboard/2001340)
- Initial saved insight: daily pageviews and unique visitors.
- Contestant and host conversion funnels must be created only after their new
  custom events have been ingested and their schemas can be verified.
