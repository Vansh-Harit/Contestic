import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { formatINR } from '@/lib/utils'
import { submitRatelimit } from '@/lib/ratelimit'
import * as Sentry from '@sentry/nextjs'
import { sendEmail } from '@/lib/resend'
import { winnerEmail, notSelectedEmail, base, btn } from '@/lib/email-templates'
import { deleteContestFolder } from '@/lib/r2'

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
    .select('id, lister_id, title, status, prize_amount, winner_submission_id')
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

  // 3. Verify contest status
  if (contest.status !== 'active' && contest.status !== 'judging') {
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

  // 5. Validate submission belongs to this contest
  const { data: submission, error: subError } = await supabase
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

  // 6. Fetch winner profile
  const supabaseAdmin = createAdminClient()
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
  const { error: rpcError } = await supabaseAdmin.rpc('select_winner', {
    p_contest_id: contest.id,
    p_submission_id: submission.id,
    p_contestant_id: submission.contestant_id,
    p_payout_id: 'manual_' + Date.now(),
  })

  if (rpcError) {
    Sentry.captureException(rpcError, { extra: { contestId, submissionId: submission.id } })
    console.error('[Winner] select_winner RPC failed:', rpcError)
    return NextResponse.json(
      { error: 'Failed to select winner. Please try again.' },
      { status: 500 }
    )
  }

  // Send emails to winner + non-selected participants (non-blocking)
  const prizeFormatted = formatINR(contest.prize_amount)
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/contestant`
  const browseUrl = `${process.env.NEXT_PUBLIC_APP_URL}`

  // Fetch all submissions with profiles for this contest
  const { data: allSubmissions } = await supabaseAdmin
    .from('submissions')
    .select('id, contestant_id, status, profiles(email, full_name)')
    .eq('contest_id', contestId)

  if (allSubmissions && allSubmissions.length > 0) {
    const winnerSub: any = allSubmissions.find((s: any) => s.id === submission_id)
    const otherSubs: any[] = allSubmissions.filter((s: any) => s.id !== submission_id)

    await Promise.allSettled([
      // Winner email
      winnerSub?.profiles?.email
        ? sendEmail(
            winnerSub.profiles.email,
            `You won ${prizeFormatted}!`,
            winnerEmail(
              winnerSub.profiles.full_name ?? 'there',
              contest.title,
              prizeFormatted,
              dashboardUrl
            )
          )
        : Promise.resolve(),
      // Not-selected emails
      ...otherSubs.map((s: any) =>
        s.profiles?.email
          ? sendEmail(
              s.profiles.email,
              `Results are in for: ${contest.title}`,
              notSelectedEmail(
                s.profiles.full_name ?? 'there',
                contest.title,
                browseUrl
              )
            )
          : Promise.resolve()
      ),
      // Admin payout alert
      sendEmail(
        process.env.ADMIN_EMAIL ?? '',
        `Manual payout needed — ${contest.title}`,
        base(`
          <p style="color:#374151;font-size:15px;line-height:1.6;"><strong>Contest:</strong> ${contest.title}</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;"><strong>Winner:</strong> ${winnerSub?.profiles?.full_name ?? 'Unknown'}</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;"><strong>Winner email:</strong> ${winnerSub?.profiles?.email ?? 'N/A'}</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;"><strong>Prize:</strong> ${prizeFormatted}</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;"><strong>Contest ID:</strong> ${contestId}</p>
          ${btn('Go to Payout Dashboard',
            process.env.NEXT_PUBLIC_APP_URL + '/admin/payouts'
          )}
        `)
      )
    ])
  }

  // Clean up chat messages for this completed contest
  await supabaseAdmin
    .from('messages')
    .delete()
    .eq('contest_id', contestId)
  console.log('[Chat] Messages deleted for completed contest:', contestId)

  // Clean up R2 submission files
  try {
    await deleteContestFolder(contestId)
    console.log('[R2] Submission files deleted for contest:', contestId)
  } catch (err) {
    Sentry.captureException(err, { extra: { contestId } })
    console.error('[R2] Failed to delete files for contest:', contestId, err)
  }

  return NextResponse.json({ success: true })
}
