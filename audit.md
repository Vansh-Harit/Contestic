# Contestic - UI Route Audit

An audit of all backend API routes and pages, checking whether each one has a corresponding button, link, or trigger in the frontend UI.

---

## Routes With No UI Trigger

### 1. Pick a Winner (CRITICAL)

- **Route:** `PUT /api/contests/[id]/winner`
- **What it does:** Lets the contest creator select a winning submission and close the contest.
- **UI trigger:** None. There is no "Pick Winner" button anywhere in the app.
- **Why it matters:** This is the entire point of the platform. Once a contest moves to judging, the creator has no way to actually choose a winner. The feature is fully built on the backend but completely invisible to the user.

---

### 2. End Contest Early (HIGH)

- **Route:** `PUT /api/contests/[id]/end`
- **What it does:** Lets the contest creator close their contest before the deadline and move it to the judging phase. Notifies all participants.
- **UI trigger:** None. There is no "End Contest" or "Close Early" button anywhere.
- **Why it matters:** If a creator gets enough good submissions before the deadline, they have no way to stop accepting entries and start judging. They are forced to wait until the deadline passes or the contest fills up.

---

### 3. Single Contest API (LOW)

- **Route:** `GET /api/contests/[id]`
- **What it does:** Returns a single contest's details with submission count via a REST API call.
- **UI trigger:** None. No frontend code calls this endpoint.
- **Why it matters:** Low impact. The contest detail page fetches data directly from Supabase in its server component instead of going through this API route. The route works but is unused. Could be removed or kept for future use.

---

## Pages That Exist But Are Empty or Static

### 4. Lister Contest Detail Page (CRITICAL)

- **Page:** `/dashboard/lister/contest/[id]`
- **What it is:** The page where a contest creator would manage a specific contest - view submissions, read entries, pick a winner, or end the contest early.
- **Current state:** The page component exists but renders absolutely nothing (`return null`). No other page links to it.
- **Why it matters:** This is where the "End Contest" and "Pick Winner" buttons would live. Without this page, the entire lister management flow is broken. A creator can post a contest and receive submissions, but can never review or act on them.

---

### 5. Lister Dashboard (HIGH)

- **Page:** `/dashboard/lister`
- **What it is:** The main dashboard for contest creators. Has tabs for Active, Drafts, and Completed contests, plus a "Top Submissions" sidebar.
- **Current state:** The page renders the tab UI and layout, but the contest list is hardcoded to an empty array (`const contests: any[] = []`). No data is fetched from the database. The tabs work visually but always show the "No active contests yet" empty state.
- **Why it matters:** Even if a creator has 10 active contests, this page will always say they have none. They cannot navigate to any of their contests from here.

---

### 6. Contestant Dashboard (HIGH)

- **Page:** `/dashboard/contestant`
- **What it is:** The dashboard for participants. Has sidebar sections for Explore, My Submissions, Won, and Earnings.
- **Current state:** The sidebar and layout render correctly, but submissions are hardcoded to an empty array. The user profile section shows a hardcoded name ("Alex Rivera") and title ("Pro Draftsman") instead of the real logged-in user's info.
- **Why it matters:** A contestant who has submitted entries to 5 contests will see "no submissions" here. They have no way to track what they submitted, whether they won, or any earnings.

---

## Summary

| Route / Page | Status | Criticality |
|---|---|---|
| Pick a Winner API | Backend ready, no UI button | CRITICAL |
| Lister Contest Detail Page | Page renders nothing, no links to it | CRITICAL |
| End Contest Early API | Backend ready, no UI button | HIGH |
| Lister Dashboard | UI shell only, no data fetched | HIGH |
| Contestant Dashboard | UI shell only, hardcoded empty data | HIGH |
| Single Contest API | Unused but harmless | LOW |

**Bottom line:** The contestant-facing flow works (browse, view contest, submit entry). The creator-facing flow is broken after contest creation. A lister can post and pay for a contest, but cannot view submissions, end the contest, or pick a winner.
