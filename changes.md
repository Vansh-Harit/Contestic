# Contestic - What Changed (Plain English)

A simple summary of every update made to the Contestic platform, written so anyone can understand what was done and why.

---

### Step 14 - Borderless Browse Cards & Visible AI Policy Text

**What changed:**
- Removed the default borders and hover border outlines from the contest cards specifically on the Browse page. This gives the listing rows a modern, floating, borderless look.
- Fixed a visibility issue where the AI Policy alert banner titles on the details page and submission forms were printed in white text on a very light background. The text is now written in navy blue, making it easy to read.

---

### Step 13 - Navy Blue Theme & Submit Button Hover Fill

**What changed:**
- Replaced the yellowish-orange highlight color with a premium navy blue color throughout the application (such as active navigation links, tabs, borders, and input focus rings).
- Redesigned the "Submit Work" button on listing cards so it stays white with a thin black border by default. When you hover your mouse pointer directly over the button, it fills with solid navy blue and the text changes to white.
- Replaced the yellowish/orange warning boxes for AI Policies on the submission form and contest details pages with a clean, translucent navy blue background and border.

---

### Step 12 - Horizontal Contest Listings Layout

**What changed:**
- Changed the contest browse page layout from a vertical grid of tall cards to a vertical stack of horizontal rows (like a standard jobs or internships list).
- Designed the rows to fill the full page width naturally on desktop without looking stretched or empty by organizing details into a left column (badges, title, description, details row) and a right column (prize pool, action button).
- Added visual icons for metadata: a trophy for prize pool, a clock for days left, users for the count of submissions, and a CPU icon for the AI policy.
- Added a hover effect: when you hover over any listing, the card expands slightly ("widens/pops out" of the screen), changes its border color, drops a shadow, and changes the mouse cursor to a pointer. The button's arrow also slides slightly to the right to invite interaction.

---

### Step 11 - Border Colors Made Black

**What changed:**
- Changed all border colors on the website (like borders around forms, inputs, and boxes) from a warm yellowish-orange color to solid black. This gives the site a sharper, cleaner, and more precise design.

---

### Step 10 - Submission & Contest Closing Overhaul

**What changed:**
- The way users submit entries to a contest was completely rebuilt from scratch. It now checks everything in order: Are you logged in? Does the contest exist? Is it still open? Has the deadline passed? Are you the one who created it (you can't enter your own contest)? Have you already submitted? Is the contest full? Is your entry the right length?
- Each of these checks gives you a clear, specific error message instead of a vague "something went wrong."
- If your entry fills the last remaining spot, the contest automatically moves to the judging phase and the contest creator gets notified.
- The contest creator only gets notified about new entries once per hour (not spammed on every single submission).
- Contest creators can now close their contest early to start picking a winner, but only if at least one person has submitted. When they do, every participant gets a notification that the contest ended early.
- There is a speed limit: you can only submit 5 times in 10 minutes from the same device to prevent spam.

---

### Step 9 - Payment Confirmation Made Bulletproof

**What changed:**
- When someone pays to create a contest, Razorpay (the payment gateway) sends a confirmation to our server. This confirmation handler was completely rewritten.
- It now checks if a payment was already processed before doing anything, so if Razorpay accidentally sends the same confirmation twice, nothing breaks or duplicates.
- If something goes wrong on our end (like a database hiccup), we still tell Razorpay "got it" so they don't keep retrying and flooding our system.
- When a payment fails, the contest is automatically cancelled.
- When a payment succeeds, the contest goes live and the creator gets a notification saying their contest is now accepting entries.
- Every action is logged with clear labels so problems can be diagnosed quickly.

---

### Step 8 - Fixed Entry Count Display

**What changed:**
- There was a bug where the browse page showed wrong numbers for how many entries each contest had received. Anonymous visitors would always see "0 entries," and logged-in users would only see their own entry count (0 or 1) instead of the real total.
- This happened because of a database security setting that was too restrictive. It was fixed so the entry count now shows the correct total for everyone.

---

### Step 7 - Security Sweep Before Going Public

**What changed:**
- Created a template file (`.env.example`) that shows what settings the app needs without revealing any actual passwords or secret keys. This way the code can be safely shared on GitHub.
- Added speed limits to prevent abuse: you can only create 5 contests per minute, submit 10 entries per minute, and pick a winner 5 times per minute. This stops bots and spam.
- The test data route (used during development to fill the database with sample contests) is now blocked in production so no one can accidentally or maliciously create fake contests on the live site.
- The scheduled task that checks for expired contests will now refuse to run if its security password is missing, instead of running without protection.
- The payment confirmation handler will now gracefully report an error if its security key is missing, instead of crashing.

---

### Step 6 - Visual Cleanup

**What changed:**
- Changed the font across the entire site to Arial for a clean, universal look.
- Moved the logo and login button to the far edges of the navigation bar instead of being centered.
- Removed the "Active Contests" and "Total Prize Pool" stat cards from the contest creator dashboard to keep the interface cleaner and less cluttered.

---

### Step 5 - Contest Creation & Payment Flow

**What changed:**
- The "Post a Contest" page now works end-to-end. It walks you through three steps: fill in your contest details, review the pricing breakdown, and pay via Razorpay.
- The form validates everything: title must be 10-100 characters, description at least 50 characters, prize within allowed range, and deadline must be in the future.
- The platform fee (15%) and total cost are calculated on the server, not in your browser, so no one can tamper with the price.
- The payment order is created with Razorpay first, and only then is the contest saved to the database. If the database save fails, the orphaned payment order is logged for manual cleanup.

---

### Step 4 - Connecting the Pages to Real Data

**What changed:**
- The browse page now shows real contests from the database instead of placeholder content. You can filter by category (Script, Naming, Copywriting, Design).
- Each contest page loads its actual details, shows who created it, displays a live countdown timer to the deadline, and lets you submit an entry.
- The submission form enforces character limits (50-5000 characters) and shows AI policy warnings depending on the contest rules.
- A test data route was created so developers can quickly populate the database with 6 sample contests for testing.
- All references to the old project name "CrowdDraft" were replaced with "Contestic."

---

### Step 3 - Login & Account System

**What changed:**
- The login page now works: you can create an account or sign in with your email and password.
- A popup login form was added so you can sign in without leaving the page you're on (for example, when you try to submit an entry while not logged in).
- The navigation bar updates in real time: when you log in, it shows your name and avatar; when you log out, it shows the login button again.
- Protected pages like the dashboard and contest creation form will redirect you to log in if you're not already signed in.

---

### Step 2 - Building the User Interface

**What changed:**
- All the main pages were built and styled with a clean, professional light-mode theme:
  - **Browse page** - where you find and filter open contests
  - **Contest detail page** - shows the full brief, deadline countdown, and submission button
  - **Post a contest page** - step-by-step form for creating a new contest
  - **Creator dashboard** - where contest creators manage their listings
  - **Participant dashboard** - where contestants track their submissions
  - **Login page** - standalone sign-in and sign-up form
- A sticky navigation bar was built with links to all major sections.
- A live countdown timer component was created that ticks down to each contest's deadline.
- 13 reusable UI components were installed (buttons, inputs, dialogs, cards, badges, etc.).

---

### Step 1 - Project Foundation

**What changed:**
- The entire project was created from scratch, including all the behind-the-scenes plumbing that makes the app work:
  - **Database connections** - secure connections to Supabase (the database) for both regular users and admin operations
  - **Payment integration** - connection to Razorpay for handling contest creation payments
  - **Email system** - templates for sending notifications about contest updates, winner announcements, and more
  - **Authentication** - login system that protects private pages and refreshes your session automatically
  - **API routes** - all the server endpoints for creating contests, submitting entries, picking winners, ending contests, and processing payments
  - **Scheduled tasks** - an automatic check that runs every 6 hours to find expired contests and move them to the judging phase
  - **Helper utilities** - currency formatting (INR), fee calculations, text truncation, and other shared tools
  - **Type definitions** - a complete data dictionary describing every object the app works with (contests, submissions, payments, profiles)
  - **Configuration** - environment variable setup, deployment config for Vercel, and project settings
