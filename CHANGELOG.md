# Contestic — Changelog

### [34] - Backend / Server-Side R2 File Size Enforcement
- **Files:** `src/lib/r2.ts` -> Added `contentLength` param to `getUploadUrl()`, passes `ContentLength` to `PutObjectCommand`. R2 now rejects uploads where actual size ≠ declared size. `src/app/api/contests/[id]/upload-url/route.ts` -> Added strict type validation for `fileSize` (`typeof !== 'number' || <= 0`), passes `fileSize` through to `getUploadUrl()`.
- **Impact:** Closes bypass where a malicious client could lie about file size and upload >20MB directly to the presigned URL.

### [33] - Backend / Sentry Error Tracking
- **Files:** `sentry.client.config.ts` [NEW], `sentry.server.config.ts` [NEW], `sentry.edge.config.ts` [NEW] -> Sentry SDK init (production-only via `enabled: process.env.NODE_ENV === 'production'`). `next.config.ts` -> Wrapped export with `withSentryConfig()` (org: vansh-oc, project: javascript-nextjs). `src/app/global-error.tsx` [NEW] -> Root error boundary captures exceptions to Sentry. `src/app/api/contests/[id]/winner/route.ts` -> Added `Sentry.captureException` in RPC failure + R2 cleanup catch. `src/app/api/webhooks/razorpay/route.ts` -> Added Sentry captures at signature mismatch, amount mismatch, and DB error paths. `src/app/api/test-error/route.ts` [NEW] -> Temporary verification route (delete after confirming).
- **Impact:** All production errors now surface in Sentry dashboard with full stack traces instead of being lost in ephemeral Vercel logs.

### [32] - Backend / Upstash Redis Rate Limiting
- **Files:** `src/lib/ratelimit.ts` [NEW] -> 3 Upstash Redis rate limiters: `submitRatelimit` (5/10min), `enterRatelimit` (10/10min), `createContestRatelimit` (3/1min). `src/app/api/contests/[id]/submit/route.ts` -> Removed inline `Map` rate limiter, replaced with `submitRatelimit.limit(user.id)`. `src/app/api/contests/[id]/enter/route.ts` -> Added `enterRatelimit` (previously had zero rate limiting). `src/app/api/contests/route.ts` -> Replaced `rateLimit()`/`getClientIp()` with `createContestRatelimit`. `src/app/api/contests/[id]/winner/route.ts` + `end/route.ts` -> Migrated to `submitRatelimit`. `src/lib/rate-limit.ts` [DELETED] -> Old in-memory rate limiter removed.
- **Impact:** Rate limits now survive cold starts / redeployments via Redis persistence. Keyed by `user.id` instead of unreliable IP behind Vercel's proxy.

### [31] - UI & Mobile / Browse Page Text Overflow Fixes
- **Files:** `src/components/browse-client.tsx` -> Updated contest card layout: made the title wrap normally to multiple lines on mobile (`whitespace-normal break-words`) while remaining truncated on desktop (`md:truncate`). Also fixed the description slicing logic to properly append an ellipsis (`...`) if the text exceeds 120 characters, preventing abruptly cut-off words.
- **Impact:** Prevents text from being awkwardly clipped off the edge of the screen on mobile devices.

### [30] - Bugfix / Missing Google Sign-In in Auth Modal
- **Files:** `src/components/auth-modal.tsx` -> Added the Google OAuth "Continue with Google" button and "or" divider to the auth modal dialog, matching the login page's implementation. Previously only the standalone `/login` page had Google sign-in.
- **Impact:** Users who encounter the auth modal (e.g., from contest detail pages) can now sign in with Google.

### [29] - UI / Interactive Hover Button on Browse Page
- **Files:** `src/components/magicui/interactive-hover-button.tsx` [NEW] -> Custom MagicUI-inspired InteractiveHoverButton with brand gradient (indigo→purple) slide-in overlay and arrow icon on hover. `src/components/browse-client.tsx` -> Replaced the plain "View Details" button with the new InteractiveHoverButton component.
- **Impact:** Adds a polished micro-animation to browse page contest cards, improving visual engagement.

### [28] - Feature & Bugfix / Image Lightbox Download Option
- **Files:** `src/app/api/download/route.ts` [NEW], `src/components/submission-review-client.tsx` -> Added a prominent "Download" button to the top-right corner of the image lightbox view. Fixed the CORS issue with Cloudflare R2 by creating a Next.js API route (`/api/download`) that fetches the remote image server-side and streams it to the client with a `Content-Disposition: attachment` header, forcing a secure direct download.
- **Impact:** Improved reviewer experience when evaluating visual submissions by allowing direct file downloads without leaving the page or encountering CORS fetch errors.

### [27] - Bugfix / Contest Details ContestPhase Type Checking
- **Files:** `src/components/contest-detail-client.tsx` -> Replaced invalid `phase === 'ended'` checks (which caused type checker errors since `'ended'` is not a valid member of the `ContestPhase` union) with correct checks for `phase === 'completed' || phase === 'cancelled' || contest.status === 'completed'`.
- **Files:** Deleted `.next` cache directory to resolve compile-time cached type reference errors related to the deleted `/api/seed` route.
- **Impact:** Fixed all compile-time errors in the Contest Details client component, ensuring a clean and correct production build.

### [26] - UI / Match Review Submission Palette to Purple Brand Color
- **Files:** `src/components/submission-review-client.tsx` -> Replaced all occurrences of dark blue `primary` classes (borders, buttons, links, winner badges, and highlight states) with our brand's vibrant purple hex `#7C3AED` and hover violet styling.
- **Impact:** Unified the visual language of the submission review dashboard with the rest of the application's purple palette.

### [25] - UI & Validation / Subtle Card Borders & Deadline Validation
- **Files:** `src/components/contest-detail-client.tsx` -> Changed card border opacity from `border-black/5` to `border-black/10` for better visibility while maintaining subtlety.
- **Files:** `src/app/api/contests/route.ts` -> Added server-side validation to ensure submission deadline is at least `entry_window_hours + 2` hours in the future to prevent CHECK constraint violations.
- **Impact:** Enhanced visual UI structure and prevented runtime DB errors during contest creation.

### [24] - Bugfix / Payment Record RLS + Entry Deadline Clamp
- **Files:** `src/app/api/contests/route.ts` → Payment INSERT now uses admin client (bypasses RLS). The user-scoped client was silently blocked by RLS on the `payments` table, causing the webhook to find no matching record → contest stuck as draft forever.
- **Files:** `src/app/api/webhooks/razorpay/route.ts` → Entry deadline now clamped to `min(now + entry_window, submission_deadline - 1hr)` to avoid violating the `entry_before_submission` CHECK constraint.
- **Manual fix:** Activated stuck contest `dfe3228b` by inserting the missing payment record and setting entry_deadline correctly.
- **Impact:** Contests will now properly activate after payment. Previously, every new contest after the RLS policy was tightened would silently fail.

### [23] - Security / Admin Role Unification
- **Files:** `middleware.ts`, `src/app/api/admin/payouts/route.ts`, `src/app/api/admin/payouts/[id]/route.ts`, `src/app/api/admin/payouts/[id]/upi/route.ts`, `src/app/(main)/admin/payouts/page.tsx`, `src/components/navbar.tsx`
- **DB:** Added `profiles.role` column (TEXT, CHECK `user`|`admin`, default `user`), backfilled from `is_admin`.
- **Impact:** All admin access checks now use a single source of truth (`profiles.role = 'admin'` in DB). Removed all `ADMIN_USER_ID` env var references and `is_admin` boolean usage. Supports multiple admins natively.

### [22] - Security / Production Hardening (4 fixes)
- **Files:** `middleware.ts` [NEW] → Auth session refresh on every navigation + route protection for `/post`, `/dashboard`, `/profile`, `/admin`.
- **Files:** `src/app/api/seed/route.ts` [DELETED] → Removed publicly-accessible seed route that used service role key.
- **Files:** `next.config.ts` → Added 5 security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS).
- **Files:** `src/app/api/webhooks/razorpay/route.ts` → Added payment amount verification before contest activation; mismatches flagged, payment marked failed, admin alerted.
- **Impact:** Closes 4 critical security gaps before production launch.

### [21] - UI / Lister Submissions & Contestant Notifications
- **Files:** `src/app/(main)/dashboard/lister/contest/[id]/page.tsx`, `src/components/submission-review-client.tsx`, `src/app/(main)/dashboard/contestant/page.tsx`, `src/components/contestant-dashboard-client.tsx`
- **Impact:** Persisted the horizontal 'Registered Entrants' list across all contest phases for Listers, replacing the old generic submissions grid with a focused entrant-by-entrant 'View Submission' flow. Relocated the lister's 'Text' button to a corner icon and added unread message notifications. Added equivalent unread message red-dot notifications to the 'Chat' button on the Contestant dashboard.

### [20] - UI / Entrants View (Lister Dashboard)
- **Files:** `src/app/(main)/dashboard/lister/contest/[id]/page.tsx`, `src/components/submission-review-client.tsx`
- **Impact:** Added a dedicated 'Registered Entrants' view for Listers during the `entry_open` phase. Replaced the empty "No submissions yet" state with a horizontal list of registered entrants, allowing the lister to proactively text them. Integrated unread message tracking, adding a dynamic red pinging notification dot to the 'Text' button if an entrant sends an unread message to the lister.

### [19] - UI / Tweaks
- **Files:** `src/components/contest-detail-client.tsx`
- **Impact:** Removed 'Brand Name' section, removed 'Contest Title:' prefix from the header, enclosed Public Brief and Full Brief in bordered boxes, added 'Listed by' text and a black border to the lister's avatar, and displayed the contest deadline directly under the 'Enter Contest' action button.

### [18] - UI / Layout Redesign
- **Files:** `src/components/contest-detail-client.tsx`
- **Impact:** Completely rewrote the Contest Details page layout to match the minimal Stitch reference. Replaced the two-column sidebar layout with a single centered column. Stripped redundant top headers. Added a clear top-right lister info banner with chat functionality. Replaced generic action buttons with a massive "Enter Contest" purple CTA. Included solid black separators. The Public Brief and Full Brief are clearly distinguished, with a locked purple banner protecting materials. Added a one-time onboarding toast notification teaching new contestants how to ask questions.

### [17] - UI / Form
- **Files:** `src/app/(main)/post/page.tsx`
- **Impact:** Removed the "Full Description" row from the final payment review step.

### [16] - UI / Config
- **Files:** `src/lib/constants.ts`, `src/app/(main)/post/page.tsx`
- **Impact:** Decreased platform fee from 15% to 2.5% across constants and UI presentation.

### [15] - UI / Form
- **Files:** `src/app/(main)/post/page.tsx`
- **Impact:** Simplified contest materials submission form by removing the "Text / Link" type selector and providing a unified "Resource URL / Content" textarea.

### Step 48 — Feature: Multi-File/Link Submission via Cloudflare R2
- **Files:**
  - `src/lib/r2.ts` [NEW] → R2 S3-compatible client: presigned URLs, public URLs, bulk folder deletion.
  - `src/app/api/contests/[id]/upload-url/route.ts` [NEW] → Presigned PUT URL API for direct R2 uploads (auth, type/size validation).
  - `src/app/api/contests/[id]/submit/route.ts` → Accepts `file_urls` JSONB array alongside `content`. Server-side validation: max 10 items, 20MB total upload cap.
  - `src/components/submit-dialog.tsx` → Full rewrite: tabbed UI (Upload File / Add Drive Link), R2 presigned upload flow, file preview with remove, total size tracker, attached files list.
  - `src/components/contest-detail-client.tsx` → Passes `category` prop to SubmitDialog for contextual helper text.
  - `src/components/submission-review-client.tsx` → Auto-linked URLs in text, image thumbnails with fullscreen lightbox, PDF download links, Drive link chips.
  - `src/app/api/contests/[id]/winner/route.ts` → R2 folder cleanup after winner selection.
  - `src/app/api/cron/check-expired/route.ts` → R2 folder cleanup on contest cancellation.
  - `src/lib/utils.ts` → Added `formatBytes()` utility.
  - `.env.local` → Added 5 Cloudflare R2 env vars.
  - `package.json` → Added `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
- **Impact:** Contestants can now upload files (JPG/PNG/WebP/PDF, max 20MB) directly to Cloudflare R2 and attach Google Drive links to submissions. Listers see rich attachment previews with image lightbox. Files auto-cleaned on contest completion/cancellation.

### Step 47 — Feature & UI: Merged Script & Copywriting into Content Writing
- **Files:**
  - `src/lib/types.ts`, `src/app/api/contests/route.ts`, `src/app/api/seed/route.ts` → Replaced "Script" and "Copywriting" with "Content Writing".
  - `src/app/(main)/post/page.tsx` → Removed Script/Copywriting grid buttons, added unified "Content Writing" tile, updated grid to 5 columns.
  - `src/components/browse-client.tsx` → Merged the category filters and logic. Implemented `/category-content-writing.jpg` thumbnail with green color scheme.
- **Impact:** Consolidated writing categories into a single, unified "Content Writing" category across frontend layout, backend validation, and database seeding.

### Step 46 — Feature & UI: Added Video Editing Category and Browse Listings Thumbnails
- **Files:**
  - `src/lib/types.ts`, `src/app/api/contests/route.ts`, `src/app/(main)/post/page.tsx` → Added "Video Editing" as a core category.
  - `src/components/browse-client.tsx` → Added "Video Editing" filter pill. Updated the Contest Cards to display a large thumbnail image on the left (matching the new Stitch reference). The user-provided video editing illustration was implemented as `/category-video-editing.jpg`.
- **Impact:** Video editing is now fully supported. Browse page contest cards now sport a highly visual thumbnail layout mapped to the contest's category.

### Step 45 — UI: Host Contest Management Dashboard Redesign (Stitch Reference)
- **Files:**
  - `src/components/lister-dashboard-client.tsx` → Complete rewrite to match Stitch reference: solid purple left sidebar with "Active Contests" and "Past Winners" navigation tabs. Main content area updated to use a clean list view (table-style) showing Contest Title, Entries Received, Time Remaining, and View Details button. Removed old top tabs and preserved "Contestic" branding.
- **Impact:** Lister dashboard now perfectly matches the reference design layout with a clean list-based overview.

### Step 44 — UI: Contestant Dashboard Redesign (Stitch Reference)
- **Files:**
  - `src/components/contestant-dashboard-client.tsx` → Complete rewrite: left sidebar with filter tabs (All Submissions, Active, Submitted, Won, Completed) + Settings link + stats summary at bottom. Main content: search bar, "My Submissions" heading, 3-column card grid with countdown timers and purple "View Details" buttons. Empty state for no contests. Kept UPI modal and chat functionality.
- **Impact:** Contestant dashboard now matches the Stitch "Creator Submissions Dashboard" reference with sidebar navigation, search, and card grid layout.

### Step 43 — UI: Browse Page Redesign (Stitch Reference)
- **Files:**
  - `src/components/browse-client.tsx` → Full redesign: exact replica of Stitch reference with left-dominant constrained width layout (max 1050px, shifted left), light gradient hero banner with cropped exact replica trophy illustration, horizontal category pill filters, redesigned contest cards.
  - `src/components/navbar.tsx` → Added exact matching "+ Host a Contest" purple pill button to the navbar for both signed in and signed out users.
  - `public/hero-trophy.png` → [NEW] Cropped exact replica of the trophy illustration from the reference.
- **Impact:** Browse page layout now perfectly matches the Stitch reference proportions, resolving overlaps and matching the original UI structure.

### Step 42 — Feature: Profile Picture Upload
- **Files:**
  - `src/lib/constants.ts` → Added `MAX_AVATAR_SIZE_BYTES` (300KB) and `ALLOWED_AVATAR_TYPES` (JPG/PNG)
  - `src/app/api/profile/avatar/route.ts` → [NEW] POST (upload) and DELETE (remove) handlers for avatar. Validates type/size, stores in Supabase Storage `avatars` bucket, updates `profiles.avatar_url`
  - `src/app/(main)/settings/page.tsx` → [NEW] Server component for `/settings` route
  - `src/components/settings-client.tsx` → [NEW] Client component with avatar preview, hover overlay, upload progress, and remove button
  - `src/components/navbar.tsx` → Added "Settings" link to profile dropdown menu
- **Supabase:** Created `avatars` public storage bucket via MCP migration with RLS policies (user-scoped INSERT/UPDATE/DELETE, public SELECT)
- **Impact:** Users can now upload, replace, and remove custom profile pictures from the Settings page. Avatar displays across the app (navbar, submissions, contest detail) automatically reflect the new image.

### Step 41 — Feature: Display won contests missing entry records
- **Files:**
  - `src/app/(main)/dashboard/contestant/page.tsx` → Updated data fetching to include all won submissions regardless of entry presence, and fetch all payout requests. Merged into the main display list.
  - `src/components/contestant-dashboard-client.tsx` → Rendered a specialized "Won" banner above the tabs if there are pending payouts. Extracted `<AddUpiButton />` into a standalone, styled inline component.
  - `src/app/api/profile/upi/route.ts` → Added POST endpoint to validate and store UPI IDs, updating both the `profiles` table and any `awaiting_upi` `payout_requests` rows to `pending_transfer`.
- **Impact:** Contestants now reliably see all contests they won, even without explicit contest entry tracking rows, and have an intuitive prompt to claim their prizes by adding their UPI IDs.

### Step 40 — Fix: Dashboard Hydration Error & Add UPI Flow
- **Files:**
  - `src/components/contestant-dashboard-client.tsx` → Added `suppressHydrationWarning` to date texts to resolve `toLocaleDateString` hydration mismatch. Replaced 404 link for "Add UPI" with an inline modal that sends the UPI ID to `/api/profile/payout-contact`.
- **Impact:** Eliminates initial page load hydration errors and provides contestants with a working modal to enter their UPI details.

### Step 39 — UI: Winner Selection Workflow
- **Files:**
  - `src/components/submission-review-client.tsx` → Moved "Pick a Winner" button to individual submission cards, added a confirmation modal, and wired up `handleConfirmWinner` with explicit error handling and toast notifications.
- **Impact:** Listers can now correctly select a winning submission and see explicit feedback via the UI and logs.

### Step 38 — Fix: Payment row creation
- **Files:**
  - `src/app/api/contests/route.ts` → Added missing `payout_status: 'pending'` to the payments INSERT query on contest creation, and added a success log `[Contest] Payment row created for:`
- **Impact:** Webhooks will now find the existing payments row cleanly and payout logic can rely on this field.

### Step 37 — UI: Dashboard Chat Button and Detail Client Chat Coverage
- **Files:**
  - `src/components/contest-detail-client.tsx` → Show "Ask Lister" button during submission_open (pre-submit) and judging phases
  - `src/app/(main)/dashboard/contestant/page.tsx` → Selected `lister_id` and `profiles(full_name, avatar_url)` for entered contests
  - `src/components/contestant-dashboard-client.tsx` → Wired up `activeChat` state and rendered a "Chat" button directly on the contestant dashboard's contest cards
- **Impact:** Contestants can now access real-time chat directly from their dashboard cards and see it in all valid phases on the detail page.

### Step 36 — Transactional Email System Rewrite
- **Files:**
  - `src/lib/resend.ts` → Fixed dev-mode recipient redirect (was using `to` instead of `recipient`)
  - `src/lib/email-templates.ts` → Replaced with 7 templates + exported `base`/`btn` helpers for inline use
  - `src/app/api/contests/[id]/enter/route.ts` → Removed per-entry email to lister (anti-flood)
  - `src/app/api/contests/[id]/submit/route.ts` → Switched to inline `base`/`btn` template
  - `src/app/api/contests/[id]/winner/route.ts` → Rewired with `winnerEmail`, `notSelectedEmail`, admin alert via `base`/`btn`
  - `src/app/api/admin/payouts/[id]/route.ts` → UPI masking moved to route, `prizeSentEmail` now receives pre-masked string
  - `src/app/api/cron/check-expired/route.ts` → Two entry-closed variants (time/full) + lister notifications + `autoRefundEmail`
  - `.env.local` → Added `ADMIN_EMAIL`
- **Impact:** All 7 email triggers wired with correct templates, dev redirect fixed, per-entry flood removed.

### Step 35 — Feature: Contest-Scoped Real-Time Chat
- **Files:**
  - `src/lib/utils.ts` → Added `getChatChannelName()`
  - `src/app/api/messages/route.ts` → [NEW] POST handler for sending messages
  - `src/app/api/messages/[conversationId]/route.ts` → [NEW] GET handler for fetching history
  - `src/components/chat-panel.tsx` → [NEW] Real-time chat panel
  - `src/components/contest-detail-client.tsx` → Added "Ask Lister" button + ChatPanel
  - `src/components/submission-review-client.tsx` → Added "Message" button + ChatPanel for listers
  - `src/app/api/contests/[id]/winner/route.ts` → Deletes messages on winner selection
  - `src/app/api/cron/check-expired/route.ts` → Deletes messages on contest cancellation
- **Impact:** Full contest-scoped chat between listers and contestants.

### Step 33 — UI: Lister Action Button and Layout Cleanup
- **Files:** `src/components/contest-detail-client.tsx` -> Removed duplicate action button render below the lister profile card. Modified `renderActionButton` to display "You are the lister of the contest" inside the main prize card if the owner of the listing is viewing it.
- **Impact:** Cleans up the layout and provides lister-specific feedback on their active contests.

### Step 32 — Bug Fixes: Razorpay Auth & RLS Policy
- **Files:** `.env.local` → Removed accidental `Test Key Secret,` prefix from `RAZORPAY_KEY_SECRET` which caused `401 BAD_REQUEST_ERROR` during contest creation.
- **Database:** `contest_entries` RLS Policy → Fixed the `Authenticated users can enter active contests` policy. Changed `entry_deadline > now()` to `(entry_deadline IS NULL OR entry_deadline > now())` to prevent RLS violations when entering a contest that doesn't have an entry deadline.
- **Impact:** Contest creation (Razorpay orders) and contest entry insertions now work correctly without throwing 500 errors.

### Step 31 — Auth: Google OAuth Sign-In
- **Files:** `src/app/(auth)/login/page.tsx` → Added "Continue with Google" button using `signInWithOAuth({ provider: 'google' })` with redirect to `/api/auth/callback`. Added "or" divider between Google button and email/password form. Wrapped in `space-y-6` container.
- **Impact:** Users can now sign in/up via Google OAuth. Callback route already handles code exchange.

### Step 30 — Contest Detail: Enter Button Below Lister Card
- **Files:** `src/components/contest-detail-client.tsx`
  - Placed `renderActionButton()` in right sidebar directly below THE LISTER card
  - Toast: "You have entered the tournament" at `top-center`
  - Entered state: "You are already in" (was "Entered ✓")
- **Impact:** Enter flow matches spec — button under lister info in right column.

### Step 29 — Transactional Email System Rewrite
- **Files:**
  - `src/lib/resend.ts` → Replaced raw Resend export with safe `sendEmail(to, subject, html)` wrapper. Never re-throws — all errors logged only.
  - `src/lib/email-templates.ts` → Complete rewrite. Dark header bar, amber CTA buttons, inline-only CSS, 600px max-width. 7 exported templates: `contestLiveEmail`, `newEntryEmail`, `entryClosedEmail`, `newSubmissionEmail`, `winnerEmail`, `notSelectedEmail`, `prizeSentEmail`.
  - `src/app/api/webhooks/razorpay/route.ts` → Fire-and-forget `contestLiveEmail` to lister after contest activation.
  - `src/app/api/contests/[id]/enter/route.ts` → Fire-and-forget `newEntryEmail` to lister (debounced — only when notification inserted). Added `title` to contest select.
  - `src/app/api/contests/[id]/submit/route.ts` → Fire-and-forget `newSubmissionEmail` to lister (debounced). Added `title` to contest select.
  - `src/app/api/contests/[id]/winner/route.ts` → Replaced old Resend usage with `sendEmail` + `winnerEmail`/`notSelectedEmail` via `void Promise.allSettled(...)`. Sends to winner + all non-selected participants + operator alert.
  - `src/app/api/admin/payouts/[id]/route.ts` → Fire-and-forget `prizeSentEmail` with masked UPI.
  - `src/app/api/cron/check-expired/route.ts` → Updated imports to use `sendEmail` instead of direct `resend.emails.send`.
- **Impact:** All email sends are now non-blocking fire-and-forget via `sendEmail` which never throws. Templates are consistent with dark header + amber CTA design. `Resend` is no longer imported directly in any route.

### Step 28 — Cron Job: Complete Rewrite with Platform Policies
- **Files:**
  - `src/app/api/cron/check-expired/route.ts` → Full rewrite with 5 tasks: (1) Entry-closed notification + email via Resend to all entered participants. (2) Expired active contests: zero activity → Razorpay refund + cancel; any entries/submissions → move to judging, NO refund. (3) Lister reminders at 3/7/14 days in judging with no winner. (4) Auto-close full submission contests to judging. (5) Daily UPI reminder for winners with `awaiting_upi` payout status.
  - `src/lib/email-templates.ts` → Added `entryClosedEmail(recipientName, contestTitle, contestUrl, submissionDeadline)` template with CTA button.
- **Impact:** Enforces correct financial policies (refund only when zero entries AND zero submissions), adds entry-closed emails, lister judging reminders, and winner UPI reminders. Old WINNER_SELECTION_DEADLINE_DAYS auto-cancel logic removed.

### Step 27 — Wire Enter & Submit Contest Flows End-to-End
- **Files:**
  - `src/app/api/contests/[id]/enter/route.ts` -> Rewrote POST: added `title` to select, fixed lister block to 403, returns `{ entry_id, message }`, added contest-full notification + 60-min debounced `new_entry` notification via admin client. Added DELETE handler for withdrawal with phase/submission guards.
  - `src/components/contest-detail-client.tsx` -> Added `withdrawLoading` state + `handleWithdraw()` calling DELETE. Added "Withdraw" text link below "Entered ✓" badge. Added "You did not register" muted text below "Entry Period Closed" button.
  - `src/app/api/contests/[id]/submit/route.ts` -> Added `entry_deadline, entry_limit` to contest select. Added entry verification (403 if not entered). Added phase check blocking submissions during open entry period.
- **Impact:** Fully wires the enter → submit lifecycle: entry with withdraw support, entry-gated submissions, and phase-aware submission blocking.

### Step 26 — UI: Phase-Aware Browse Cards & Direct Navigation
- **Files:**
  - `src/components/browse-client.tsx` -> Imported `getContestPhase` and `cn`. Calculated contest phase for each card. Updated CTA buttons based on phase: "Enter Now →" (entry_open), "Submit Work →" (submission_open), "Under Review" (disabled for judging), and hidden for completed/cancelled. All clicks now navigate directly to `/contest/[id]`. Updated metadata row to display phase-specific details (entry counts/deadline, submission counts/deadline, or "Under review").
- **Impact:** Aligns the browse page cards with the two-phase registration and contest lifecycle model.

### Step 25 — Cron: Entry-Closed Notifications & Admin is_admin Flag
- **Files:**
  - `src/app/api/cron/check-expired/route.ts` -> Added TASK 0 before existing tasks. Finds active contests where entry period has closed (deadline passed or capacity full) and not yet notified. Bulk-inserts `entry_closed` notifications for all entered participants.
  - `src/components/navbar.tsx` -> Admin link now checks `profile.is_admin` instead of env var. Profile fetch includes `is_admin`.
  - `.env.local` -> Removed `NEXT_PUBLIC_ADMIN_USER_ID`.
  - **DB:** Added `is_admin BOOLEAN DEFAULT false` column to `profiles`. Set `true` for admin account.
- **Impact:** Participants are now automatically notified when the entry window closes (brief + materials revealed). Admin link visibility is driven by a DB flag instead of a client-exposed UUID.

### Step 24 — Admin Payout Dashboard & Contestant Payout Flow
- **Files:**
  - `src/lib/email-templates.ts` -> Added `winnerPaidEmail` template for confirming prize transfer to winners.
  - `src/app/api/admin/payouts/route.ts` -> [NEW] GET handler listing all `payout_requests` with contest + winner profile data, sorted by status priority.
  - `src/app/api/admin/payouts/[id]/route.ts` -> [NEW] POST handler to mark a payout as transferred (keyed on payout_request ID), updates `payments.payout_status`, sends notification + email.
  - `src/app/api/admin/payouts/[id]/upi/route.ts` -> [NEW] POST handler for admin to manually enter winner UPI, transitions status to `pending_transfer`.
  - `src/app/api/admin/payouts/[contestId]/route.ts` -> [DELETE] Removed old contest-ID-keyed route.
  - `src/app/api/profile/payout-contact/route.ts` -> Added 5–50 char length validation for UPI IDs.
  - `src/app/(main)/admin/payouts/page.tsx` -> [NEW] Server component with admin gate (redirects non-admins), fetches payouts via admin client.
  - `src/components/admin-payouts-client.tsx` -> [NEW] Tabbed dashboard UI (Pending Transfer / Awaiting UPI / Completed) with mark-transferred, copy UPI, admin UPI entry, and UTR input.
  - `src/app/(main)/dashboard/contestant/page.tsx` -> Refactored Won section to fetch from `payout_requests` instead of `payments`. Shows contextual banners: awaiting_upi (amber + UPI input), pending_transfer (progress + UPI shown), transferred (masked UPI ✓). Optimistic UI on UPI save.
- **Impact:** Complete admin payout workflow from tracking to confirmation, with email notification on transfer. Contestant dashboard now accurately reflects payout_request lifecycle states.

### Step 23 — Browse Card: Public Summary & Seed Teasers
- **Files:**
  - `src/components/browse-client.tsx` -> Card body now shows `public_summary` with fallback to truncated `description` (150 chars).
  - `src/app/api/seed/route.ts` -> All 6 seed contests now include realistic `public_summary` teasers and `entry_window_hours: 24`.
- **Impact:** Browse page cards now display the public teaser instead of full descriptions, aligning with the two-phase listing model.

### Step 22 — Phase-Based Contest Detail View & Entry API
- **Files:**
  - `src/lib/types.ts` -> Added `public_summary`, `entry_deadline`, `entry_limit`, `entry_window_hours`, and `entry_count` to the `Contest` type.
  - `src/lib/utils.ts` -> Added `getContestPhase` helper to calculate current lifecycle phase (`entry_open`, `submission_open`, `judging`, `completed`, `cancelled`).
  - `src/app/api/contests/[id]/enter/route.ts` -> Created POST endpoint to handle entering contests (validates active status, lister restrictions, deadlines, and capacity before inserting into `contest_entries`).
  - `src/app/(main)/contest/[id]/page.tsx` -> Updated server page to evaluate phase, fetch `contest_entries` status, and selectively load `contest_materials` only if the user has entered and the entry phase has closed.
  - `src/components/contest-detail-client.tsx` -> Rewritten to dynamically render content based on phase and access level (e.g., showing public teaser only during `entry_open`, gating full description and materials, and updating the CTA buttons from "Enter Contest" to "Submit Your Work").
- **Impact:** Core implementation of the two-phase contest model UI. Enforces viewing restrictions for materials and full descriptions while allowing users to register and transition seamlessly through the entry and submission phases.

### Step 21 — Post Wizard: Materials Configuration, Public Teaser & Webhook Entry Deadline
- **Files:**
  - `src/lib/types.ts` -> Updated `ContestFormData` interface to include `public_summary`, `entry_window_hours`, and `materials` list, removing old `entry_deadline` and `entry_limit`.
  - `src/app/(main)/post/page.tsx` -> Expanded wizard to 4 steps. Added "Contest Teaser (Public)" textarea to Step 1. Created Step 2 "Materials for Participants" for links/texts. Replaced Step 3 deadline picker with a 24h/48h "Entry Window" selector. Updated Step 4 review screen.
  - `src/app/api/contests/route.ts` -> POST handler parses, validates, and inserts `public_summary`, `entry_window_hours`, and inserts any associated materials into the `contest_materials` table.
  - `src/app/api/webhooks/razorpay/route.ts` -> Webhook `payment.captured` handler queries `entry_window_hours` and calculates the dynamic `entry_deadline` to activate the contest.
- **Impact:** Aligns the contest posting pipeline with the two-phase registration model, allowing listers to post public teasers, configure materials, and select the entry window, with the entry deadline auto-set upon payment capture.

### Step 20 — UI: Browse Contest Card Borders & Navbar Dropdown
- **Files:**
  - `src/components/browse-client.tsx` -> Added a sleek `border border-black/10` to contest cards with a hover style (`hover:border-black/25`) to darken the borders on hover.
  - `src/components/navbar.tsx` -> Replaced top bar links (Browse, Lister Dash, Contestant Dash, My Contests, My Submissions, Sign Out) with a dropdown menu triggered by the profile Avatar. Hidden the middle links on desktop when the user is logged in. Outside clicks now close the dropdown.
- **Impact:** Cleaned up desktop top bar header to follow a minimalist layout, wrapping all user actions and core navigation inside the profile avatar dropdown, while adding subtle visual separation between contest cards on the browse page with smooth hover states.

### Step 19 — Database Migration: Contest Materials & Public Summary
- **Files:**
  - `Supabase SQL` → Added `public_summary` and `entry_window_hours` columns to `contests`. Created `contest_materials` table with RLS policies allowing listers to manage their materials and entered participants to view them after entry closes. Updated `contests_with_counts` view to include new columns.
- **Impact:** Listers can now add exclusive materials (links/text) visible only to confirmed participants after the entry period. The contest listing shows a public summary initially, and the full description is locked behind entry.

### Step 18 — Manual Payout Flow & Winner Selection Simplification
- **Files:**
  - `src/app/api/contests/[id]/winner/route.ts` → **[REWRITTEN]** Uses `select_winner` RPC for atomic DB ops. Sends winner email via Resend. Sends operator alert email with payout details. No Razorpay X payout API. Added `winner_submission_id IS NULL` guard.
  - `src/app/api/admin/payouts/[contestId]/route.ts` → **[NEW]** Admin-only POST route to mark payout as completed. Verifies `ADMIN_USER_ID`, updates `payments.payout_status` to `completed`, sets `payout_requests.status` to `transferred`, notifies winner.
  - `src/app/api/profile/payout-contact/route.ts` → **[NEW]** Winners POST their UPI ID here. Updates `profiles.upi_id` and transitions `payout_requests` from `awaiting_upi` to `pending_transfer`.
  - `src/app/(main)/dashboard/contestant/page.tsx` → **[REWRITTEN]** Fetches real submissions + won contests with payout status. Shows payout badges (processing/completed). UPI collection form for winners without UPI. Earnings summary tab with totals.
  - `src/lib/types.ts` → Replaced `razorpay_contact_id`/`razorpay_fund_account_id` with `upi_id` in `Profile`.
  - `.env.local` → Removed `RAZORPAY_X_ACCOUNT_NUMBER`, added `ADMIN_USER_ID` and `OPERATOR_EMAIL`.
- **Impact:** Entire payout flow is now manual. No Razorpay X code. Operator gets email alert, manually sends prize, confirms via admin API. Winners provide UPI post-win.

### Step 17 — Simplified Date/Time Picker UI
- **Files:**
  - `src/app/(main)/post/page.tsx` → Replaced all `datetime-local` inputs with split date (`type="date"` with Calendar icon) + time (`<select>` dropdown with Clock icon, 30-min intervals, 12h AM/PM labels). Added helper functions: `timeSlots`, `formatTime12`, `splitDateTime`, `mergeDateTime`, `getTomorrowDate`. Applied to both Contest Deadline and Entry Deadline fields.
- **Impact:** Date/time selection is now intuitive and consistent across all browsers — no more janky native datetime-local widget.

### Step 16 — Entry Phase Fields in Post Wizard & API
- **Files:**
  - `src/lib/types.ts` → Added `entry_deadline: string | null`, `entry_limit: number | null` to `ContestFormData`.
  - `src/app/(main)/post/page.tsx` → Added `entryPhaseEnabled` toggle state, collapsible "Advanced Settings" section in Step 2 with entry deadline (`datetime-local`, min tomorrow, max 24h before submission deadline) and entry limit (`number`, 10–100) inputs. Client validation ensures entry_deadline is future and ≥24h before deadline. Review rows in Step 3 conditionally show entry fields.
  - `src/app/api/contests/route.ts` → Server-side validation for optional `entry_deadline` (future, before deadline) and `entry_limit` (10–100). Both included in DB insert as NULL when absent.
- **Impact:** Listers can optionally enable an entry/registration phase when creating contests.

### Step 15 — DB Migration: Entry Phase, Payouts & Winner Flow
- **Files:**
  - `profiles` table → Added `upi_id TEXT` column for winner UPI collection.
  - `contests` table → Added `entry_deadline TIMESTAMPTZ`, `entry_limit INTEGER CHECK(10..100)`, `entry_before_submission` constraint.
  - `contest_entries` table → **[NEW]** UUID PK, `contest_id`/`contestant_id` FKs, `entered_at`, unique pair, RLS enabled with 4 policies (lister view, contestant view, insert guard, delete), 2 indexes.
  - `payout_requests` table → **[NEW]** UUID PK, `contest_id` (unique FK), `winner_id` FK, `amount`, `contest_title`, `winner_name`, `winner_email`, `winner_upi`, `status` (enum check), `admin_note`, `created_at`, `transferred_at`, RLS with 2 policies (winner view, winner update), 2 indexes.
  - `select_winner` function → **[REPLACED]** Now fetches winner profile + contest details, creates `payout_request` row with conditional status (`awaiting_upi`/`pending_transfer`), updated notification message referencing UPI.
  - `contests_with_counts` view → **[REBUILT]** Added `LEFT JOIN contest_entries`, exposes `entry_deadline`, `entry_limit`, `entry_count`. Re-granted SELECT to `anon`/`authenticated`.
- **Impact:** Full entry-phase registration system and manual payout tracking pipeline. Winner selection now auto-creates payout requests for admin dashboard.

### Step 14 — Browse Card Borders & AI Policy Text Visibility
- **Files:**
  - `src/components/browse-client.tsx` -> Removed outer card borders (`border border-outline-variant` and `hover:border-primary`) from the contest listing rows.
  - `src/components/submit-dialog.tsx` -> Changed the AI Policy title color inside the banner from `text-on-primary-container` (white) to `text-primary` (navy blue) for visibility.
  - `src/components/contest-detail-client.tsx` -> Updated the AI Policy banner title to `text-primary` to resolve low-contrast white text.
- **Impact:** Card borders are removed specifically on the browse page listings for a sleeker look, and AI Policy alert banner titles are fully legible.

### Step 13 — Navy Blue Theme & Submit Button Hover
- **Files:**
  - `src/app/globals.css` -> Replaced yellowish-orange and warm amber variables (`--primary`, `--color-primary-container`, `--ring`, `--color-surface-tint`, `--color-on-primary-container`, `.active-tab`) with premium navy blue and royal blue.
  - `src/components/browse-client.tsx` -> Customized the "Submit Work" card button to render as a white button with black border normally, filling with solid navy blue on direct mouse hover.
  - `src/components/submit-dialog.tsx` -> Replaced warning banner yellowish background with translucent navy blue (`bg-primary-container/5 border border-primary-container/20`).
  - `src/components/contest-detail-client.tsx` -> Updated the contest detail page's AI Policy warning banner to use translucent navy blue background.
- **Impact:** Entire platform highlights, active tabs, focus states, and alert banners are transitioned to a professional navy/royal blue color scheme, and the submit button has a white-to-navy fill hover transition.

### Step 12 — Horizontal Contest Listings Layout
- **Files:**
  - `src/components/browse-client.tsx` -> Replaced vertical card grid with a horizontal flex column list. Embedded icons (Trophy, Clock, Users, Cpu, ArrowRight) and redesigned card to a wide flex layout with a right-aligned prize pool/CTA section. Added hover scale ([1.015]), outline, shadow, and slide-right arrow animations.
- **Impact:** Contest listings are arranged horizontally spanning the container width with a modern job-board look and interactive hover pop-out effects.

### Step 11 — Border Color Change
- **Files:**
  - `src/app/globals.css` -> Changed `--color-outline-variant`, `--border`, and `--input` from `#d8c3ad` (warm amber) to `#000000` (black).
- **Impact:** All UI borders and input outlines are now black instead of the yellowish-orange shade.

### Step 10 — Submit & End Contest: Production Rewrites
- **Files:**
  - `src/app/api/contests/[id]/submit/route.ts` -> Full rewrite. 10-step validation pipeline: auth, contest fetch, status/deadline/lister guards, duplicate check, entry limit, content validation with specific char-count messages, notification debounce (60-min window), auto-move to judging when contest fills, IP-based rate limiting (5/10min). Uses `createAdminClient` for notification inserts.
  - `src/app/api/contests/[id]/end/route.ts` -> Full rewrite. Changed POST to PUT. Added zero-submission guard, batch contestant notifications on early close, structured logging. Uses `createAdminClient` for cross-user notification inserts.
- **Impact:** Both endpoints are now production-grade with comprehensive validation, specific error codes/messages for frontend, notification support, and abuse prevention.

### Step 9 — Razorpay Webhook: Idempotent Production Rewrite
- **Files:**
  - `src/app/api/webhooks/razorpay/route.ts` -> Full rewrite. Added idempotency check (skips already-captured orders), returns 200 on internal DB errors to prevent Razorpay retries, cancels contest on `payment.failed`, inserts notification on activation, structured `[Webhook]` logging on every branch, dynamic `crypto` import.
- **Impact:** Webhook is now safe against duplicate deliveries, silent failures on money ops, and retry storms.

### Step 8 — DB: Fix contests_with_counts View (security_invoker)
- **Files:**
  - Supabase migration `fix_contests_with_counts_security_invoker` -> Dropped and recreated `contests_with_counts` view with `security_invoker = false` so submission counts bypass RLS and return correct totals for all users. Granted `SELECT` to `anon` and `authenticated` roles.
- **Impact:** Browse page now shows accurate submission_count for anonymous and authenticated users. All existing API queries already had explicit status filters — no code changes required.

### Step 7 — Security Audit, Rate Limiting & GitHub Preparation
- **Files:**
  - `.env.example` -> Created environment variables template file with placeholders.
  - `src/lib/rate-limit.ts` -> Implemented in-memory sliding-window rate limiter with lazy GC.
  - `src/app/api/contests/route.ts` -> Added rate limiting (5 req/min) to contest creation POST handler.
  - `src/app/api/contests/[id]/submit/route.ts` -> Added rate limiting (10 req/min) to entry submission POST handler.
  - `src/app/api/contests/[id]/winner/route.ts` -> Added rate limiting (5 req/min) to winner selection POST handler.
  - `src/app/api/contests/[id]/end/route.ts` -> Added rate limiting (5 req/min) to end contest POST handler.
  - `src/app/api/seed/route.ts` -> Restricted database seeding to development mode only.
  - `src/app/api/cron/check-expired/route.ts` -> Enforced authorization check to fail closed if cron secret is missing.
  - `src/app/api/webhooks/razorpay/route.ts` -> Added safety check for missing Razorpay webhook secret.
- **Impact:** Codebase is fully secured against hardcoded API credentials, endpoint abuse, and unauthorized production data seeding, making it ready for a safe public GitHub push.

### Step 6 — Font, Navbar, Dashboard Cleanup
- **Files:**
  - `src/app/globals.css` -> Replaced Syne/Outfit/Space Mono font vars with Arial.
  - `src/app/layout.tsx` -> Removed Google Font imports and CSS variable class names.
  - `src/components/navbar.tsx` -> Removed `max-w-7xl mx-auto` so logo and buttons sit at screen edges.
  - `src/app/(main)/dashboard/lister/page.tsx` -> Removed Active Contests and Total Prize Pool stat cards.
- **Impact:** Font is now Arial globally, navbar items are at edges, lister dashboard is cleaner.

### Step 5 — Payment Flow & Post Contest Wizard
- **Files:**
  - `src/app/(main)/post/page.tsx` -> Wired 3-step wizard with `ContestFormData` state, validation (title 10-100 chars, desc min 50, prize/entries/deadline ranges), fee computation via `calcPlatformFee`/`calcTotal`, review summary, and Razorpay checkout handler.
  - `src/app/api/contests/route.ts` -> Rewrote POST handler: server-side validation, server-computed amounts (never trust client), Razorpay order creation before DB insert, orphaned order logging on DB failure, payment record insertion.
  - `src/lib/razorpay.ts` -> Already existed, verified correct.
  - `src/components/browse-client.tsx` -> Fixed AuthModal prop `open` to `isOpen`.
  - `src/components/contest-detail-client.tsx` -> Fixed AuthModal prop `open` to `isOpen`.
- **Impact:** End-to-end contest creation and payment flow is functional. Razorpay order is created before any DB records, preventing orphaned data.

### Step 4 — Database Wiring & Frontend Implementation
- **Files:**
  - `src/app/api/seed/route.ts` -> Created GET route to insert test contests and mapping razorpay_order_id.
  - `src/app/(main)/page.tsx` -> Converted to server component to fetch contests from `contests_with_counts` view and pass user session.
  - `src/components/browse-client.tsx` -> Created client component for contest grid with stats bar and category filtering, replaced static HTML.
  - `src/app/(main)/contest/[id]/page.tsx` -> Fetches contest details, lister profile, and user submission state.
  - `src/components/contest-detail-client.tsx` -> Replaced static details placeholder with live data, integrated countdown and dynamic submission buttons.
  - `src/components/countdown-timer.tsx` -> Implemented live countdown timer for contest deadlines.
  - `src/components/submit-dialog.tsx` -> Created Shadcn dialog form for entry submissions with AI policy alerts and character limits.
  - `src/components/browse-client.tsx` -> Removed the Stats Bar section to simplify the UI and remove generated placeholder look.
  - `src/components/contest-detail-client.tsx` -> Replaced placeholder 'CrowdDraft' with actual brand name 'Contestic' in the AI policy section.
- **Impact:** Dynamic data fetching for Browse and Contest Detail pages is fully integrated with Supabase and all logic endpoints are functional.

### Step 3 — Authentication Logic Integration
- **Files:**
  - `src/app/(auth)/login/page.tsx` -> Wired up Supabase `signInWithPassword` and `signUp` using `@supabase/ssr` browser client. Added `react-hot-toast` for success/error handling.
  - `src/components/auth-modal.tsx` -> Copied identical auth submission logic for `signIn` and `signUp` with `react-hot-toast` handling.
  - `src/components/navbar.tsx` -> Integrated `supabase.auth.getSession()` and `onAuthStateChange` to render logged-in/out states dynamically. Added `fetchProfile` to load avatar and full name.
  - `src/proxy.ts` -> Renamed from `src/middleware.ts` to comply with Next.js 16.2 deprecation.
- **Impact:** Authentication is fully functional and dynamically drives UI elements like Navbar and dashboard protection routes.

### Step 2 — UI & Styling
- **Files:**
  - `src/app/globals.css` -> Defined Luminous Precision theme variables and configured Tailwind v4 / shadcn integrations.
  - `src/app/layout.tsx` -> Added Google Font loader configurations for Syne, Outfit, and Space Mono.
  - `src/components/navbar.tsx` -> Built responsive sticky header with Next.js navigation.
  - `src/components/countdown-timer.tsx` -> Implemented live countdown component in monospace font.
  - `src/components/auth-modal.tsx` -> Built dialog form template for login and sign-up.
  - `src/app/(main)/layout.tsx` -> Configured main route wrapper with header and footer.
  - `src/app/(main)/page.tsx` -> Implemented browse page with search and empty states.
  - `src/app/(main)/contest/[id]/page.tsx` -> Implemented single contest brief and details view.
  - `src/app/(main)/post/page.tsx` -> Implemented step-by-step contest creation form.
  - `src/app/(main)/dashboard/lister/page.tsx` -> Implemented client dashboard with stats and empty states.
  - `src/app/(main)/dashboard/contestant/page.tsx` -> Implemented participant dashboard with sidebar and empty states.
  - `src/app/(auth)/login/page.tsx` -> Implemented standalone login interface.
  - `src/types/razorpay.d.ts` -> Created type declarations for Razorpay package.
  - `src/app/api/seed/route.ts` -> Widened sample contests type to resolve narrowing issue.
  - `src/lib/supabase/server.ts` -> Marked createClient async to support cookies() in Next.js 16.
  - `package.json` -> Updated `dev` script to use Webpack due to native Turbopack binding issues.
- **Impact:** Completed light-mode UI pages matching the approved Luminous Precision design system with no fake listings. All compilation issues are fixed and project compiles cleanly.

### Step 1 — Project Scaffolding & Full Architecture Setup
- **Files:** All files under `src/` created from scratch (see PRODUCT_STATE.md for full list)
- `src/lib/types.ts` → 6 type aliases + 5 interfaces + global Window augmentation
- `src/lib/constants.ts` → 8 platform constants (fees, limits, deadlines)
- `src/lib/utils.ts` → cn, formatINR, rupeesToPaise, paiseToRupees, calcPlatformFee, calcTotal, truncate, daysUntil
- `src/lib/supabase/client.ts` → browser Supabase client via @supabase/ssr
- `src/lib/supabase/server.ts` → server Supabase client with Next.js cookie bridge
- `src/lib/supabase/admin.ts` → service-role admin client (bypasses RLS)
- `src/lib/razorpay.ts` → Razorpay SDK singleton
- `src/lib/resend.ts` → Resend SDK singleton
- `src/lib/email-templates.ts` → 5 transactional email generators
- `src/middleware.ts` → auth session refresh + /dashboard, /post route protection
- `src/app/api/auth/callback/route.ts` → OAuth code exchange
- `src/app/api/contests/route.ts` → GET (list active) + POST (create draft)
- `src/app/api/contests/[id]/route.ts` → GET single contest with submission count
- `src/app/api/contests/[id]/submit/route.ts` → POST submission with validation
- `src/app/api/contests/[id]/winner/route.ts` → POST winner selection
- `src/app/api/contests/[id]/end/route.ts` → POST move to judging
- `src/app/api/webhooks/razorpay/route.ts` → HMAC-verified webhook handler
- `src/app/api/cron/check-expired/route.ts` → auto-expire/cancel cron
- `src/app/api/seed/route.ts` → dev-only seed data
- `src/app/layout.tsx` → root layout with Toaster + metadata
- `src/app/not-found.tsx` → 404 page
- `src/app/(auth)/login/page.tsx` → stub
- `src/app/(main)/layout.tsx` → main route group layout stub
- `src/app/(main)/page.tsx` → home page stub
- `src/app/(main)/contest/[id]/page.tsx` → contest detail stub
- `src/app/(main)/post/page.tsx` → post contest stub
- `src/app/(main)/dashboard/lister/page.tsx` → lister dashboard stub
- `src/app/(main)/dashboard/lister/contest/[id]/page.tsx` → lister contest detail stub
- `src/app/(main)/dashboard/contestant/page.tsx` → contestant dashboard stub
- `src/components/navbar.tsx` → stub
- `src/components/auth-modal.tsx` → stub
- `src/components/countdown-timer.tsx` → stub
- `src/components/ui/` → 13 shadcn components (button, input, textarea, label, select, dialog, badge, progress, tabs, card, separator, avatar, dropdown-menu)
- `.env.local` → 11 env vars (keys only)
- `vercel.json` → cron schedule (every 6h)
- **Impact:** Complete project scaffold ready for UI import. All backend logic, types, utilities, and configs are production-grade and fully implemented.
# Contestic — Changelog

### Step 32 — Global: Add Others Category
- **Files:** `src/lib/types.ts`, `src/app/api/contests/route.ts`, `src/components/browse-client.tsx`, `src/components/contest-detail-client.tsx`, `src/app/(main)/post/page.tsx`
  - Added 'Others' to ContestCategory type and API validation.
  - Added 'Others' filter pill to the browse page with custom #6B7280 background.
  - Updated category pills in contest cards and detail page to use #6B7280 when category is 'Others'.
  - Added 'Others' card with LayoutGrid icon to post contest wizard, including helper text when selected.

### Step 33 — Contestant Dashboard: Restructure to Contest-centric
- **Files:** `src/app/(main)/dashboard/contestant/page.tsx`, `src/components/contestant-dashboard-client.tsx`
  - Replaced contestant dashboard page to fetch entered contests instead of submissions.
  - Created `ContestantDashboardClient` to display a unified view of entered contests and their submission statuses.


### Step 34 — Fix Runtime Errors
- **Files:** `src/app/(main)/dashboard/contestant/page.tsx`, `src/app/(main)/dashboard/lister/contest/[id]/page.tsx`
  - Added missing wait to createClient() call in contestant dashboard server component.
  - Fixed query error in lister contest review page by ordering submissions by submitted_at instead of created_at.

### [12] - UI
- **Files:** src/app/(main)/page.tsx, src/components/browse-client.tsx
- **Impact:** Added lister profile picture to the top right of contest cards on the browse page.
### [13] - UI / State
- **Files:** src/app/(main)/post/page.tsx
- **Impact:** Added automatic client-side draft saving to localStorage with a 2-day expiration. Draft is cleared on successful payment.
### [14] - UI / State
- **Files:** src/app/(main)/post/page.tsx, src/components/lister-dashboard-client.tsx
- **Impact:** Added a 'Drafts' tab in the lister dashboard, showing saved drafts with a 2-day expiration notice. Restored drafts only load if clicking 'Continue' from the dashboard (appended load_draft query parameter); clicking 'Host a Contest' starts fresh and clears any previous draft. Added a draft info banner on the payment step.
