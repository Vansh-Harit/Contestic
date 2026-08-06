import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { formatINR } from '@/lib/utils'
import { submitRatelimit } from '@/lib/ratelimit'
import * as Sentry from '@sentry/nextjs'
import { deliverPendingEmails, enqueueEmail } from '@/lib/email-delivery'
import { completeContestSubmissionCleanup } from '@/lib/contest-cleanup'

type JoinedEmailProfile = {
  email: string | null
  full_name: string | null
}

function normalizeJoinedProfile(
  profile: JoinedEmailProfile | JoinedEmailProfile[] | null | undefined
): JoinedEmailProfile | null {
  return Array.isArray(profile) ? profile[0] ?? null : profile ?? null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contestId } = await params
  const supabase = await createClient()

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limiting (Upstash Redis)
  const { success, reset } = await submitRatelimit.limit(user.id)
  if (!success) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      { status: 429 }
    )
  }

  const body = await request.json()
  const { submission_id } = body

  if (!submission_id) {
    return NextResponse.json(
      { error: 'submission_id is required' },
      { status: 400 }
    )
  }

  // 2. Fetch contest — verify lister_id = user.id
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('id, lister_id, title, status, deadline, prize_amount, winner_submission_id')
    .eq('id', contestId)
    .single()

  if (contestError || !contest) {
    return NextResponse.json({ error: 'Contest not found' }, { status: 404 })
  }

  if (contest.lister_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the contest owner can select a winner' },
      { status: 403 }
    )
  }

  // An expired active contest is logically in judging even if the scheduled
  // lifecycle reconciliation has not persisted the status yet.
  const deadlinePassed = new Date(contest.deadline).getTime() <= Date.now()
  if (
    contest.status !== 'judging' &&
    !(contest.status === 'active' && deadlinePassed)
  ) {
    return NextResponse.json(
      { error: 'Contest is not in a valid state for winner selection' },
      { status: 400 }
    )
  }

  // 4. Verify winner not already selected
  if (contest.winner_submission_id) {
    return NextResponse.json(
      { error: 'A winner has already been selected for this contest' },
      { status: 400 }
    )
  }

  const supabaseAdmin = createAdminClient()

  // 5. Validate submission belongs to this contest before changing lifecycle
  // state, so a malformed request cannot move an empty contest to judging.
  const { data: submission, error: subError } = await supabaseAdmin
    .from('submissions')
    .select('id, contest_id, contestant_id')
    .eq('id', submission_id)
    .eq('contest_id', contestId)
    .single()

  if (subError || !submission) {
    return NextResponse.json(
      { error: 'Submission not found in this contest' },
      { status: 404 }
    )
  }

  if (contest.status === 'active') {
    const now = new Date().toISOString()
    const { data: transitioned, error: transitionError } = await supabaseAdmin
      .from('contests')
      .update({ status: 'judging', updated_at: contest.deadline })
      .eq('id', contest.id)
      .eq('status', 'active')
      .lte('deadline', now)
      .select('id')
      .maybeSingle()

    if (transitionError) {
      Sentry.captureException(transitionError, { extra: { contestId } })
      return NextResponse.json(
        { error: 'Could not open winner selection. Please try again.' },
        { status: 500 }
      )
    }

    if (!transitioned) {
      const { data: currentContest } = await supabaseAdmin
        .from('contests')
        .select('status, winner_submission_id')
        .eq('id', contest.id)
        .single()

      if (currentContest?.winner_submission_id) {
        return NextResponse.json(
          { error: 'A winner has already been selected for this contest' },
          { status: 409 }
        )
      }
      if (currentContest?.status !== 'judging') {
        return NextResponse.json(
          { error: 'Contest state changed. Refresh and try again.' },
          { status: 409 }
        )
      }
    }
  }

  // 6. Fetch winner profile
  const { data: winnerProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', submission.contestant_id)
    .single()

  if (profileError || !winnerProfile) {
    return NextResponse.json(
      { error: 'Winner profile not found' },
      { status: 500 }
    )
  }

  // Run atomic DB function
  const { error: rpcError } = await supabaseAdmin.rpc('select_contest_winner', {
    p_contest_id: contest.id,
    p_submission_id: submission.id,
    p_actor_id: user.id,
    // The real UPI/UTR reference is recorded only after the admin sends money.
    p_payout_id: null,
  })

  if (rpcError) {
    Sentry.captureException(rpcError, { extra: { contestId, submissionId: submission.id } })
    console.error('[Winner] select_winner RPC failed:', rpcError)
    return NextResponse.json(
      { error: 'Failed to select winner. Please try again.' },
      { status: 500 }
    )
  }

  // Queue winner, participant, and administrator emails. Delivery is retried
  // independently so a Resend outage cannot roll back winner selection.
  const prizeFormatted = formatINR(contest.prize_amount)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const { data: allEntrants } = await supabaseAdmin
    .from('contest_entries')
    .select('contestant_id, profiles(email, full_name)')
    .eq('contest_id', contestId)

  if (winnerProfile.email) {
    await enqueueEmail({
      idempotencyKey: `winner-selected/${contestId}/${winnerProfile.id}`,
      eventType: 'winner_selected',
      contestId,
      userId: winnerProfile.id,
      to: winnerProfile.email,
      payload: {
        winnerName: winnerProfile.full_name ?? 'there',
        contestTitle: contest.title,
        prizeFormatted,
        dashboardUrl: `${appUrl}/dashboard/contestant`,
      },
    })
  }

  for (const entrant of allEntrants ?? []) {
    if (entrant.contestant_id === winnerProfile.id) continue
    const profile = normalizeJoinedProfile(entrant.profiles)
    if (!profile?.email) continue

    await enqueueEmail({
      idempotencyKey: `winner-not-selected/${contestId}/${entrant.contestant_id}`,
      eventType: 'winner_not_selected',
      contestId,
      userId: entrant.contestant_id,
      to: profile.email,
      payload: {
        participantName: profile.full_name ?? 'there',
        contestTitle: contest.title,
        browseUrl: appUrl,
      },
    })
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim()
  if (adminEmail) {
    await enqueueEmail({
      idempotencyKey: `admin-payout-required/${contestId}`,
      eventType: 'admin_payout_required',
      contestId,
      to: adminEmail,
      payload: {
        contestTitle: contest.title,
        winnerName: winnerProfile.full_name ?? 'Unknown',
        winnerEmail: winnerProfile.email ?? 'Unavailable',
        prizeFormatted,
        contestId,
        payoutUrl: `${appUrl}/admin/payouts`,
      },
    })
  }

  await deliverPendingEmails(25)

  // Winner selection has already locked chat, submissions, and stored links.
  // R2 cleanup is best-effort here and remains pending for the cron retry path.
  try {
    await completeContestSubmissionCleanup(contestId)
  } catch (err) {
    console.error('[Winner cleanup] Submission cleanup remains pending:', contestId, err)
  }

  return NextResponse.json({ success: true })
}
