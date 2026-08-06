# Contestic — Product State

## Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript, src/ dir)
- **Styling:** Tailwind CSS v4 + shadcn/ui (Default style, Slate base, CSS variables)
- **Auth:** Supabase Auth (OAuth callback via @supabase/ssr)
- **Database:** Supabase (PostgreSQL)
- **Payments:** Razorpay (orders, webhooks, payouts)
- **Email:** Resend
- **File Storage:** Cloudflare R2 (S3-compatible, presigned uploads, server-side ContentLength enforcement)
- **Rate Limiting:** Upstash Redis (sliding window, user-ID keyed, survives cold starts)
- **Error Tracking:** Sentry (client + server + edge, production-only)
- **Forms:** react-hook-form + zod + @hookform/resolvers
- **Deployment target:** Netlify (configuration prepared locally; not deployed)

## Active Database Schemas
- `profiles` — user identity, razorpay contact/fund IDs, `upi_id`, `role` (TEXT: `user`|`admin`, default `user`)
- `contests` — listings with category, prize, deadline, AI policy, status, `entry_deadline`, `entry_limit`
- `submissions` — entries per contest per contestant, `file_urls` JSONB (upload/drive_link attachments)
- `payments` — razorpay order/payment tracking, payout status
- `contest_entries` — registration records (contest_id + contestant_id unique), RLS (4 policies)
- `contest_materials` — exclusive text/link resources per contest, visible after entry closes, RLS enabled
- `payout_requests` — manual payout tracking per contest winner, status workflow (`awaiting_upi` → `pending_transfer` → `transferred`/`failed`), RLS (2 policies)
- `messages` — contest-scoped chat messages (conversation_id, sender_id, recipient_id, contest_id, content, read_at), auto-deleted on contest end
- `storage.avatars` — public Supabase Storage bucket for user profile pictures (300KB max, JPG/PNG only, user-scoped RLS)
- `contests_with_counts` — view joining contests + submission_count + entry_count + lister profile
- `select_winner()` — SECURITY DEFINER function: marks winner, notifies, auto-creates payout_request

## Feature Completion Status
| Feature | Status |
|---|---|
| Project scaffolding | ✅ Done |
| Folder structure | ✅ Done |
| Type definitions | ✅ Done |
| Supabase clients (browser/server/admin) | ✅ Done |
| Middleware (auth session refresh + route protection) | ✅ Done (middleware.ts at project root) |
| API: Contests CRUD | ✅ Done |
| API: Submissions | ✅ Done |
| API: Winner selection | ✅ Done |
| API: End contest | ✅ Done |
| API: Razorpay webhook | ✅ Done |
| API: Cron check-expired | ✅ Done |
| API: Seed (dev only) | ✅ Done |
| Auth callback route | ✅ Done |
| Supabase password recovery | 🟡 Implemented locally; custom SMTP and manual verification pending |
| shadcn/ui components (13) | ✅ Done |
| Email templates | ✅ Done |
| Utility functions | ✅ Done |
| Constants | ✅ Done |
| Netlify build + fail-closed scheduled cron adapters | 🟡 Implemented locally; deployment verification pending |
| .env.local template | ✅ Done |
| UI pages / styling | ✅ Done (Luminous Precision light-mode theme) |
| Auth UI Logic Wiring | ✅ Done |
| Browse & Contest Data Integration | ✅ Done |
| Post Contest Wizard & Razorpay Payment Flow | ✅ Done |
| Rate Limiting (Upstash Redis) | ✅ Done (replaced in-memory Map with Redis-backed sliding window) |
| Sentry Error Tracking | ✅ Done (client/server/edge configs, global-error boundary, payment route captures) |
| R2 Server-Side File Size Enforcement | ✅ Done (ContentLength in PutObjectCommand, strict type validation) |
| DB: Entry phase (contest_entries + entry columns) | ✅ Done |
| DB: Payout requests table & RLS | ✅ Done |
| DB: select_winner auto-creates payout | ✅ Done |
| DB: contests_with_counts view (entry_count, public_summary, entry_window_hours) | ✅ Done |
| DB: contest_materials table & RLS | ✅ Done |
| Post Wizard: 4-step wizard (teaser, materials, window, payment) | ✅ Done |
| Winner selection: atomic RPC + email alerts | ✅ Done |
| Admin payout confirmation route | ✅ Done |
| Winner UPI collection API | ✅ Done |
| Contestant dashboard: real data + payout status | ✅ Done |
| Razorpay X removal (manual payout only) | ✅ Done |
| UI: Phase-Based Contest Details & Entry Flow | ✅ Done |
| Browse cards: public_summary with truncated fallback | ✅ Done |
| Admin Payout Dashboard (tabbed UI + mark-transferred + UPI entry) | ✅ Done |
| Contestant dashboard: payout_request-aware UPI banners | ✅ Done |
| Cron TASK 0: entry-closed participant notifications | ✅ Done |
| Admin navbar link via `is_admin` profile flag | ✅ Done |
| UI: Phase-Aware Browse Cards & Direct Navigation | ✅ Done |
| Enter/Submit flows wired E2E (entry + withdraw + phase-gated submit) | ✅ Done |
| Cron job: 5-task policy-correct automation (entry-closed, refund/judging, reminders, UPI) | ✅ Done |
| Transactional email system: sendEmail wrapper + 7 templates + wired into all routes | ✅ Done |
| Contest-scoped real-time chat (Supabase Realtime + DB hybrid, auto-delete on end) | ✅ Done |
| Profile picture upload (Supabase Storage, 300KB JPG/PNG, Settings page) | ✅ Done |
| Multi-file/link submissions via Cloudflare R2 (presigned uploads, Drive links, lightbox review) | ✅ Done |

## Current Deployment Environment
- **Local:** `npm run dev` → http://localhost:3000
- **Production:** Netlify selected; no production deployment or domain cutover yet
