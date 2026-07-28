import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend'
import { entryClosedTimeEmail, entryClosedFullEmail, autoRefundEmail, base, btn } from '@/lib/email-templates'
import { formatINR } from '@/lib/utils'
import { deleteContestFolder } from '@/lib/r2'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const counts = {
    entry_closed_notified: 0,
    refunded_empty: 0,
    moved_to_judging: 0,
    reminders_sent: 0,
    upi_reminders_sent: 0,
  }

  // ═══════════════════════════════════════
  // TASK 1 — DETECT AND NOTIFY ENTRY PHASE CLOSURE
  // ═══════════════════════════════════════
  const { data: activeContests } = await supabase
    .from('contests_with_counts')
    .select('*')
    .eq('status', 'active')
    .not('entry_deadline', 'is', null)

  for (const contest of activeContests ?? []) {
    const now = new Date()
    const entryDeadlinePassed = new Date(contest.entry_deadline) < now
    const effectiveLimit = contest.entry_limit ?? contest.max_entries
    const entryFull = (contest.entry_count ?? 0) >= effectiveLimit

    if (!entryDeadlinePassed && !entryFull) continue

    // Check if we already sent entry_closed notification for this contest
    const { data: alreadyNotified } = await supabase
      .from('notifications')
      .select('id')
      .eq('contest_id', contest.id)
      .eq('type', 'entry_closed')
      .limit(1)

    if (alreadyNotified && alreadyNotified.length > 0) continue

    // Entry just closed — fetch all entered participants with profiles
    const { data: entries } = await supabase
      .from('contest_entries')
      .select('contestant_id, profiles(email, full_name)')
      .eq('contest_id', contest.id)

    if (!entries || entries.length === 0) continue

    // Notify all participants
    await supabase.from('notifications').insert(
      entries.map((e: any) => ({
        user_id: e.contestant_id,
        type: 'entry_closed',
        title: 'Brief revealed — start working!',
        message: `Entry for "${contest.title}" has closed. The full brief and materials are now available. Submit your work before the deadline.`,
        contest_id: contest.id,
      }))
    )

    // Send emails — determine which variant
    const contestUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://contestic.com'}/contest/${contest.id}`
    const submissionDeadlineFormatted = new Date(contest.deadline).toLocaleDateString(
      'en-IN',
      { day: 'numeric', month: 'long', year: 'numeric' }
    )

    // Fetch lister profile for lister notification
    const { data: listerProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', contest.lister_id)
      .single()

    if (entryFull) {
      // Slots filled before time
      await Promise.allSettled(
        entries.map((e: any) => {
          const email = e.profiles?.email
          if (!email) return Promise.resolve()
          return sendEmail(
            email,
            `All spots filled — "${contest.title}" brief is now live`,
            entryClosedFullEmail(
              e.profiles?.full_name ?? 'there',
              contest.title,
              effectiveLimit,
              contestUrl,
              submissionDeadlineFormatted
            )
          )
        })
      )

      // Notify lister
      if (listerProfile?.email) {
        void sendEmail(
          listerProfile.email,
          `Your contest is full — all ${effectiveLimit} spots taken`,
          base(`
            <p style="color:#374151;font-size:15px;line-height:1.6;">Hi ${listerProfile.full_name ?? 'there'},</p>
            <p style="color:#374151;font-size:15px;line-height:1.6;">
              All <strong>${effectiveLimit} spots</strong> for 
              <strong>"${contest.title}"</strong> have been filled. 
              The submission window is now open for all participants.
            </p>
            ${btn('View Contest', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/lister')}
          `)
        )
      }
    } else {
      // Time expired with partial slots
      await Promise.allSettled(
        entries.map((e: any) => {
          const email = e.profiles?.email
          if (!email) return Promise.resolve()
          return sendEmail(
            email,
            `Brief revealed — "${contest.title}" submission window is open`,
            entryClosedTimeEmail(
              e.profiles?.full_name ?? 'there',
              contest.title,
              contest.entry_count ?? 0,
              effectiveLimit,
              contestUrl,
              submissionDeadlineFormatted
            )
          )
        })
      )

      // Notify lister
      if (listerProfile?.email) {
        void sendEmail(
          listerProfile.email,
          `Entry period ended — ${contest.entry_count ?? 0} participants registered`,
          base(`
            <p style="color:#374151;font-size:15px;line-height:1.6;">Hi ${listerProfile.full_name ?? 'there'},</p>
            <p style="color:#374151;font-size:15px;line-height:1.6;">
              The entry period for <strong>"${contest.title}"</strong> 
              has ended. <strong>${contest.entry_count ?? 0} out of 
              ${effectiveLimit}</strong> spots were filled.
            </p>
            <p style="color:#374151;font-size:15px;line-height:1.6;">
              All registered participants have been notified and 
              the submission window is now open.
            </p>
            ${btn('View Contest', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/lister')}
          `)
        )
      }
    }

    counts.entry_closed_notified++
    console.log(
      '[Cron] Entry closed, participants notified:',
      contest.id,
      entries.length
    )
  }

  // ═══════════════════════════════════════
  // TASK 2 — HANDLE EXPIRED ACTIVE CONTESTS (SUBMISSION DEADLINE)
  // ═══════════════════════════════════════
  const { data: expiredContests } = await supabase
    .from('contests_with_counts')
    .select('*')
    .eq('status', 'active')
    .lt('deadline', new Date().toISOString())

  for (const contest of expiredContests ?? []) {
    const hasActivity =
      (contest.submission_count ?? 0) > 0 || (contest.entry_count ?? 0) > 0

    if (!hasActivity) {
      // ZERO entries AND zero submissions → refund lister
      try {
        const { data: payment } = await supabase
          .from('payments')
          .select('razorpay_payment_id, amount')
          .eq('contest_id', contest.id)
          .single()

        if (!payment?.razorpay_payment_id) {
          console.error('[Cron] No payment found for contest:', contest.id)
          continue
        }

        const authHeaderRazorpay =
          'Basic ' +
          Buffer.from(
            `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
          ).toString('base64')

        const refundRes = await fetch(
          `https://api.razorpay.com/v1/payments/${payment.razorpay_payment_id}/refund`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeaderRazorpay,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: payment.amount,
              notes: { reason: 'no_participants_or_submissions' },
            }),
          }
        )
        const refund = await refundRes.json()
        if (!refund.id)
          throw new Error(`Refund failed: ${JSON.stringify(refund)}`)

        await supabase
          .from('contests')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', contest.id)

        await supabase
          .from('payments')
          .update({ payment_status: 'refunded' })
          .eq('contest_id', contest.id)

        // Clean up chat messages for cancelled contest
        await supabase
          .from('messages')
          .delete()
          .eq('contest_id', contest.id)

        const refundAmountFormatted = (payment.amount / 100).toLocaleString(
          'en-IN'
        )
        await supabase.from('notifications').insert({
          user_id: contest.lister_id,
          type: 'auto_refund',
          title: 'Contest cancelled — full refund initiated',
          message: `"${contest.title}" received no participants and has been cancelled. Your refund of ₹${refundAmountFormatted} has been initiated (5-7 business days).`,
          contest_id: contest.id,
        })

        // Send refund email to lister
        const { data: refundLister } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', contest.lister_id)
          .single()

        if (refundLister?.email) {
          void sendEmail(
            refundLister.email,
            `Contest cancelled — refund initiated for "${contest.title}"`,
            autoRefundEmail(
              refundLister.full_name ?? 'there',
              contest.title,
              formatINR(payment.amount)
            )
          )
        }

        counts.refunded_empty++
        console.log('[Cron] Refunded empty contest:', contest.id)

        // Clean up R2 submission files
        try {
          await deleteContestFolder(contest.id)
          console.log('[R2] Files deleted for cancelled contest:', contest.id)
        } catch (r2Err) {
          console.error('[R2] Failed to delete files for contest:', contest.id, r2Err)
        }
      } catch (error) {
        console.error('[Cron] Refund failed for contest:', contest.id, error)
        // Do not update status — retry next cron run
      }
    } else {
      // Has entries or submissions → move to judging, NO refund ever
      await supabase
        .from('contests')
        .update({ status: 'judging', updated_at: new Date().toISOString() })
        .eq('id', contest.id)

      await supabase.from('notifications').insert({
        user_id: contest.lister_id,
        type: 'deadline_passed',
        title: 'Submission deadline passed',
        message: `"${contest.title}" has ${contest.submission_count ?? 0} submission(s). Review them and pick a winner.`,
        contest_id: contest.id,
      })

      counts.moved_to_judging++
      console.log(
        '[Cron] Moved to judging:',
        contest.id,
        'submissions:',
        contest.submission_count
      )
    }
  }

  // ═══════════════════════════════════════
  // TASK 3 — LISTER REMINDERS (JUDGING, NO WINNER)
  // ═══════════════════════════════════════
  const { data: judgingContests } = await supabase
    .from('contests_with_counts')
    .select('*')
    .eq('status', 'judging')
    .is('winner_submission_id', null)

  for (const contest of judgingContests ?? []) {
    const updatedAt = new Date(contest.updated_at)
    const daysInJudging = Math.floor(
      (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    )

    const shouldRemind = [3, 7, 14].includes(daysInJudging)
    if (!shouldRemind) continue

    // Check if we already sent a reminder today
    const today = new Date().toISOString().split('T')[0]
    const { data: recentReminder } = await supabase
      .from('notifications')
      .select('id')
      .eq('contest_id', contest.id)
      .eq('type', 'judging_reminder')
      .gte('created_at', today)
      .limit(1)

    if (recentReminder && recentReminder.length > 0) continue

    const urgency = daysInJudging === 14 ? 'Urgent: ' : ''
    await supabase.from('notifications').insert({
      user_id: contest.lister_id,
      type: 'judging_reminder',
      title: `${urgency}Pick a winner for "${contest.title}"`,
      message: `${daysInJudging} days have passed. ${contest.submission_count ?? 0} submission(s) are waiting for your decision.`,
      contest_id: contest.id,
    })

    counts.reminders_sent++
    console.log(
      '[Cron] Reminder sent to lister:',
      contest.lister_id,
      'days:',
      daysInJudging
    )
  }

  // ═══════════════════════════════════════
  // TASK 4 — AUTO-CLOSE FULL SUBMISSION CONTESTS
  // ═══════════════════════════════════════
  const { data: fullContests } = await supabase
    .from('contests_with_counts')
    .select('*')
    .eq('status', 'active')

  for (const contest of fullContests ?? []) {
    const effectiveLimit = contest.max_entries
    if ((contest.submission_count ?? 0) < effectiveLimit) continue

    // Verify entry phase is actually over before closing submissions
    const now = new Date()
    const entryOpen = contest.entry_deadline
      ? now < new Date(contest.entry_deadline)
      : false
    if (entryOpen) continue

    await supabase
      .from('contests')
      .update({ status: 'judging', updated_at: now.toISOString() })
      .eq('id', contest.id)

    await supabase.from('notifications').insert({
      user_id: contest.lister_id,
      type: 'contest_full',
      title: 'Contest full — pick a winner',
      message: `All ${contest.submission_count} submission slots for "${contest.title}" are filled. Review and pick a winner.`,
      contest_id: contest.id,
    })

    console.log('[Cron] Full contest moved to judging:', contest.id)
  }

  // ═══════════════════════════════════════
  // TASK 5 — REMIND WINNERS AWAITING UPI
  // ═══════════════════════════════════════
  const { data: awaitingUpi } = await supabase
    .from('payout_requests')
    .select('*, contests(title, prize_amount)')
    .eq('status', 'awaiting_upi')

  for (const pr of awaitingUpi ?? []) {
    // Only remind once per day max
    const today = new Date().toISOString().split('T')[0]
    const { data: recentReminder } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', pr.winner_id)
      .eq('type', 'upi_reminder')
      .eq('contest_id', pr.contest_id)
      .gte('created_at', today)
      .limit(1)

    if (recentReminder && recentReminder.length > 0) continue

    const contestTitle = pr.contests?.title || 'your contest'
    const prizeAmount = pr.contests?.prize_amount || 0
    const amountFormatted = (prizeAmount / 100).toLocaleString('en-IN')

    await supabase.from('notifications').insert({
      user_id: pr.winner_id,
      type: 'upi_reminder',
      title: 'Add your UPI to receive your prize',
      message: `Your prize of ₹${amountFormatted} for "${contestTitle}" is waiting. Add your UPI ID to receive it.`,
      contest_id: pr.contest_id,
    })

    counts.upi_reminders_sent++
  }

  return Response.json({
    success: true,
    ...counts,
    timestamp: new Date().toISOString(),
  })
}
