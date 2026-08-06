import { createAdminClient } from '@/lib/supabase/admin'
import { deliverPendingEmails, enqueueEmail } from '@/lib/email-delivery'
import { formatINR } from '@/lib/utils'
import { deleteContestFolder } from '@/lib/r2'
import { createIdempotentFullRefund } from '@/lib/razorpay-refund'
import { completeContestSubmissionCleanup } from '@/lib/contest-cleanup'

type JoinedProfile = {
  email: string | null
  full_name: string | null
}

function normalizeProfile(
  value: JoinedProfile | JoinedProfile[] | null | undefined
): JoinedProfile | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const adminEmail = process.env.ADMIN_EMAIL?.trim()
  const failures: string[] = []
  const counts = {
    entry_closed_notified: 0,
    refunded_empty: 0,
    moved_to_judging: 0,
    judging_emails_queued: 0,
    overdue_admin_alerts_queued: 0,
    winner_emails_reconciled: 0,
    payout_emails_reconciled: 0,
    reminders_sent: 0,
    upi_reminders_sent: 0,
    submission_cleanups_completed: 0,
    chat_histories_purged: 0,
  }

  const ensureNotification = async (input: {
    userId: string
    contestId: string
    type: string
    title: string
    message: string
  }) => {
    const { data: existing, error: lookupError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', input.userId)
      .eq('contest_id', input.contestId)
      .eq('type', input.type)
      .limit(1)

    if (lookupError) throw lookupError
    if (existing?.length) return false

    const { error: insertError } = await supabase.from('notifications').insert({
      user_id: input.userId,
      contest_id: input.contestId,
      type: input.type,
      title: input.title,
      message: input.message,
    })
    if (insertError) throw insertError
    return true
  }

  // 1. Entry closure reveals the brief. Capacity may close entry early, but it
  // never changes the fixed submission deadline.
  const { data: activeContests, error: activeError } = await supabase
    .from('contests_with_counts')
    .select('*')
    .eq('status', 'active')
    .not('entry_deadline', 'is', null)

  if (activeError) {
    failures.push('active_contest_scan')
  } else {
    for (const contest of activeContests ?? []) {
      const effectiveLimit = contest.entry_limit ?? contest.max_entries
      const entryDeadlinePassed = new Date(contest.entry_deadline) <= now
      const entryFull = (contest.entry_count ?? 0) >= effectiveLimit
      if (!entryDeadlinePassed && !entryFull) continue

      try {
        const { data: entries, error: entriesError } = await supabase
          .from('contest_entries')
          .select('contestant_id, profiles(email, full_name)')
          .eq('contest_id', contest.id)
        if (entriesError) throw entriesError

        const deadline = formatDateTime(contest.deadline)
        for (const entry of entries ?? []) {
          await ensureNotification({
            userId: entry.contestant_id,
            contestId: contest.id,
            type: 'entry_closed',
            title: 'Submission window open',
            message: `Entry for "${contest.title}" has closed. The full brief and materials are now available.`,
          })

          const profile = normalizeProfile(entry.profiles)
          if (!profile?.email) continue
          await enqueueEmail({
            idempotencyKey: `submission-open/${contest.id}/${entry.contestant_id}`,
            eventType: 'submission_open',
            contestId: contest.id,
            userId: entry.contestant_id,
            to: profile.email,
            payload: {
              participantName: profile.full_name ?? 'there',
              contestTitle: contest.title,
              totalSlots: effectiveLimit,
              entryCount: contest.entry_count ?? 0,
              openedEarly: String(entryFull),
              contestUrl: `${appUrl}/contest/${contest.id}`,
              submissionDeadline: deadline,
            },
          })
        }

        const { data: lister } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', contest.lister_id)
          .single()
        if (lister?.email) {
          await enqueueEmail({
            idempotencyKey: `entry-closed-lister/${contest.id}/${contest.lister_id}`,
            eventType: 'entry_closed_lister',
            contestId: contest.id,
            userId: contest.lister_id,
            to: lister.email,
            payload: {
              listerName: lister.full_name ?? 'there',
              contestTitle: contest.title,
              entryCount: contest.entry_count ?? 0,
              openedEarly: String(entryFull),
              reviewUrl: `${appUrl}/dashboard/lister/contest/${contest.id}`,
            },
          })
        }
        counts.entry_closed_notified++
      } catch (error) {
        console.error('[Cron] Entry-close reconciliation failed:', contest.id, error)
        failures.push(`entry_close:${contest.id}`)
      }
    }
  }

  // 2. The fixed submission deadline either opens judging or triggers the
  // already-approved full refund when there are zero submissions.
  const { data: expiredContests, error: expiredError } = await supabase
    .from('contests_with_counts')
    .select('*')
    .eq('status', 'active')
    .lte('deadline', nowIso)

  if (expiredError) {
    failures.push('expired_contest_scan')
  } else {
    for (const contest of expiredContests ?? []) {
      const hasSubmissions = (contest.submission_count ?? 0) > 0

      if (hasSubmissions) {
        const { data: transitioned, error: transitionError } = await supabase
          .from('contests')
          .update({ status: 'judging', updated_at: contest.deadline })
          .eq('id', contest.id)
          .eq('status', 'active')
          .lte('deadline', nowIso)
          .select('id')
          .maybeSingle()

        if (transitionError) {
          failures.push(`judging_transition:${contest.id}`)
        } else if (transitioned) {
          counts.moved_to_judging++
        }
        continue
      }

      try {
        const { data: payment, error: paymentError } = await supabase
          .from('payments')
          .select('id, razorpay_payment_id, amount, payment_status')
          .eq('contest_id', contest.id)
          .single()
        if (paymentError || !payment?.razorpay_payment_id) {
          throw paymentError || new Error('Refundable payment was not found')
        }

        if (payment.payment_status !== 'refunded') {
          if (payment.payment_status !== 'captured') {
            throw new Error('Payment is not in a refundable state')
          }
          const refund = await createIdempotentFullRefund({
            paymentId: payment.razorpay_payment_id,
            amount: payment.amount,
            idempotencyKey: `contest_${contest.id}_full_refund`,
            reason: 'no_submissions',
          })
          if (refund.status !== 'processed') {
            throw new Error('Razorpay refund is still pending')
          }

          const { error: paymentUpdateError } = await supabase
            .from('payments')
            .update({ payment_status: 'refunded' })
            .eq('id', payment.id)
            .eq('payment_status', 'captured')
          if (paymentUpdateError) throw paymentUpdateError
        }

        const { data: transitioned, error: contestUpdateError } = await supabase
          .from('contests')
          .update({ status: 'cancelled', updated_at: contest.deadline })
          .eq('id', contest.id)
          .eq('status', 'active')
          .lte('deadline', nowIso)
          .select('id')
          .maybeSingle()
        if (contestUpdateError) throw contestUpdateError

        await ensureNotification({
          userId: contest.lister_id,
          contestId: contest.id,
          type: 'auto_refund',
          title: 'Contest closed - full refund initiated',
          message: `"${contest.title}" received no submissions. Your full payment refund has been initiated.`,
        })

        const { data: lister } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', contest.lister_id)
          .single()
        if (lister?.email) {
          await enqueueEmail({
            idempotencyKey: `empty-contest-refund/${contest.id}/${contest.lister_id}`,
            eventType: 'empty_contest_refund',
            contestId: contest.id,
            userId: contest.lister_id,
            to: lister.email,
            payload: {
              listerName: lister.full_name ?? 'there',
              contestTitle: contest.title,
              refundAmount: formatINR(payment.amount),
              reason: (contest.entry_count ?? 0) === 0
                ? 'no_entries'
                : 'no_submissions',
            },
          })
        }

        if (transitioned) counts.refunded_empty++
        await supabase.from('messages').delete().eq('contest_id', contest.id)
        try {
          await deleteContestFolder(contest.id)
        } catch (r2Error) {
          console.error('[Cron] Cancelled-contest file cleanup failed:', contest.id, r2Error)
        }
      } catch (error) {
        console.error('[Cron] Empty-contest refund failed:', contest.id, error)
        failures.push(`refund:${contest.id}`)
      }
    }
  }

  // 3. Reconcile judging notifications and the single three-day admin alert.
  const { data: judgingContests, error: judgingError } = await supabase
    .from('contests_with_counts')
    .select('*')
    .eq('status', 'judging')
    .is('winner_submission_id', null)

  if (judgingError) {
    failures.push('judging_scan')
  } else {
    for (const contest of judgingContests ?? []) {
      try {
        const { data: lister } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', contest.lister_id)
          .single()

        await ensureNotification({
          userId: contest.lister_id,
          contestId: contest.id,
          type: 'deadline_passed',
          title: 'Submissions ready for review',
          message: `"${contest.title}" has ${contest.submission_count ?? 0} submission(s). Review them and select a winner.`,
        })

        if (lister?.email) {
          const queued = await enqueueEmail({
            idempotencyKey: `judging-open/${contest.id}/${contest.lister_id}`,
            eventType: 'judging_open',
            contestId: contest.id,
            userId: contest.lister_id,
            to: lister.email,
            payload: {
              listerName: lister.full_name ?? 'there',
              contestTitle: contest.title,
              submissionCount: contest.submission_count ?? 0,
              reviewUrl: `${appUrl}/dashboard/lister/contest/${contest.id}`,
            },
          })
          if (queued) counts.judging_emails_queued++
        }

        const judgingStartedAt = new Date(contest.updated_at)
        const daysInJudging = Math.floor(
          (now.getTime() - judgingStartedAt.getTime()) / (24 * 60 * 60 * 1000)
        )

        if (daysInJudging >= 3 && adminEmail) {
          const queued = await enqueueEmail({
            idempotencyKey: `admin-judging-overdue/${contest.id}`,
            eventType: 'admin_judging_overdue',
            contestId: contest.id,
            to: adminEmail,
            payload: {
              contestTitle: contest.title,
              contestId: contest.id,
              submissionCount: contest.submission_count ?? 0,
              payoutUrl: `${appUrl}/admin/payouts`,
            },
          })
          if (queued) counts.overdue_admin_alerts_queued++
        }

        if ([3, 7, 14].includes(daysInJudging)) {
          const created = await ensureNotification({
            userId: contest.lister_id,
            contestId: contest.id,
            type: `judging_reminder_${daysInJudging}`,
            title: `Select a winner for "${contest.title}"`,
            message: `${daysInJudging} days have passed. ${contest.submission_count ?? 0} submission(s) are awaiting your decision.`,
          })
          if (created) counts.reminders_sent++
        }
      } catch (error) {
        console.error('[Cron] Judging reconciliation failed:', contest.id, error)
        failures.push(`judging:${contest.id}`)
      }
    }
  }

  // 4. Reconcile winner-result and admin-payout emails even if the request that
  // selected the winner ended after the database transaction committed.
  const { data: completedContests, error: completedError } = await supabase
    .from('contests')
    .select('id, title, prize_amount, winner_submission_id')
    .eq('status', 'completed')
    .not('winner_submission_id', 'is', null)

  if (completedError) {
    failures.push('completed_contest_scan')
  } else {
    for (const contest of completedContests ?? []) {
      try {
        const { data: winnerSubmission, error: winnerError } = await supabase
          .from('submissions')
          .select('contestant_id, profiles(email, full_name)')
          .eq('id', contest.winner_submission_id)
          .single()
        if (winnerError || !winnerSubmission) throw winnerError

        const winnerProfile = normalizeProfile(winnerSubmission.profiles)
        const prize = formatINR(contest.prize_amount)
        if (winnerProfile?.email) {
          await enqueueEmail({
            idempotencyKey: `winner-selected/${contest.id}/${winnerSubmission.contestant_id}`,
            eventType: 'winner_selected',
            contestId: contest.id,
            userId: winnerSubmission.contestant_id,
            to: winnerProfile.email,
            payload: {
              winnerName: winnerProfile.full_name ?? 'there',
              contestTitle: contest.title,
              prizeFormatted: prize,
              dashboardUrl: `${appUrl}/dashboard/contestant`,
            },
          })
        }

        const { data: entrants, error: entrantsError } = await supabase
          .from('contest_entries')
          .select('contestant_id, profiles(email, full_name)')
          .eq('contest_id', contest.id)
        if (entrantsError) throw entrantsError

        for (const entrant of entrants ?? []) {
          if (entrant.contestant_id === winnerSubmission.contestant_id) continue
          const profile = normalizeProfile(entrant.profiles)
          if (!profile?.email) continue
          await enqueueEmail({
            idempotencyKey: `winner-not-selected/${contest.id}/${entrant.contestant_id}`,
            eventType: 'winner_not_selected',
            contestId: contest.id,
            userId: entrant.contestant_id,
            to: profile.email,
            payload: {
              participantName: profile.full_name ?? 'there',
              contestTitle: contest.title,
              browseUrl: appUrl,
            },
          })
        }

        if (adminEmail) {
          await enqueueEmail({
            idempotencyKey: `admin-payout-required/${contest.id}`,
            eventType: 'admin_payout_required',
            contestId: contest.id,
            to: adminEmail,
            payload: {
              contestTitle: contest.title,
              winnerName: winnerProfile?.full_name ?? 'Unknown',
              winnerEmail: winnerProfile?.email ?? 'Unavailable',
              prizeFormatted: prize,
              contestId: contest.id,
              payoutUrl: `${appUrl}/admin/payouts`,
            },
          })
        }
        counts.winner_emails_reconciled++
      } catch (error) {
        console.error('[Cron] Winner email reconciliation failed:', contest.id, error)
        failures.push(`winner_email:${contest.id}`)
      }
    }
  }

  // 5. Reconcile payment-confirmation emails with the stored UTR/reference.
  const { data: transferredPayouts, error: payoutError } = await supabase
    .from('payout_requests')
    .select('id, contest_id, contest_title, winner_id, winner_name, winner_email, winner_upi, amount, admin_note, status')
    .eq('status', 'transferred')
    .not('admin_note', 'is', null)

  if (payoutError) {
    failures.push('transferred_payout_scan')
  } else {
    for (const payout of transferredPayouts ?? []) {
      const winnerUpi = payout.winner_upi || ''
      const maskedUpi = winnerUpi.length > 6
        ? `${winnerUpi.slice(0, 3)}****${winnerUpi.slice(-3)}`
        : 'your saved UPI ID'
      const queued = await enqueueEmail({
        idempotencyKey: `payout-transferred/${payout.contest_id}/${payout.id}`,
        eventType: 'payout_transferred',
        contestId: payout.contest_id,
        userId: payout.winner_id,
        to: payout.winner_email,
        payload: {
          winnerName: payout.winner_name || 'there',
          contestTitle: payout.contest_title,
          prizeFormatted: formatINR(payout.amount),
          maskedUpi,
          transferReference: payout.admin_note,
        },
      })
      if (queued) counts.payout_emails_reconciled++
    }
  }

  // 6. Keep the existing in-app UPI reminder, at most once per calendar day.
  const { data: awaitingUpi, error: upiError } = await supabase
    .from('payout_requests')
    .select('contest_id, winner_id, amount, contest_title')
    .eq('status', 'awaiting_upi')

  if (upiError) {
    failures.push('upi_reminder_scan')
  } else {
    const today = nowIso.slice(0, 10)
    for (const payout of awaitingUpi ?? []) {
      const { data: recent } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', payout.winner_id)
        .eq('contest_id', payout.contest_id)
        .eq('type', 'upi_reminder')
        .gte('created_at', today)
        .limit(1)
      if (recent?.length) continue

      const { error } = await supabase.from('notifications').insert({
        user_id: payout.winner_id,
        contest_id: payout.contest_id,
        type: 'upi_reminder',
        title: 'Add your UPI ID to receive your prize',
        message: `Your prize of ${formatINR(payout.amount)} for "${payout.contest_title}" is waiting for your UPI ID.`,
      })
      if (!error) counts.upi_reminders_sent++
    }
  }

  // 7. Retry only cleanup jobs explicitly scheduled by a successful winner
  // selection. Existing completed contests retain the default not_required
  // state and are never picked up retroactively.
  const { data: pendingCleanups, error: cleanupScanError } = await supabase
    .from('contests')
    .select('id')
    .eq('status', 'completed')
    .eq('submission_cleanup_status', 'pending')
    .order('updated_at', { ascending: true })
    .limit(25)

  if (cleanupScanError) {
    failures.push('submission_cleanup_scan')
  } else {
    for (const contest of pendingCleanups ?? []) {
      try {
        await completeContestSubmissionCleanup(contest.id)
        counts.submission_cleanups_completed++
      } catch (error) {
        console.error(
          '[Cron] Submission cleanup remains pending:',
          contest.id,
          error
        )
        failures.push(`submission_cleanup:${contest.id}`)
      }
    }
  }

  // 8. Chat is inaccessible immediately after completion but retained for the
  // approved 90-day dispute window. Purge in small batches to keep cron load
  // bounded even as the number of contests grows.
  const { data: dueChatPurges, error: chatPurgeScanError } = await supabase
    .from('contests')
    .select('id')
    .eq('status', 'completed')
    .lte('chat_purge_after', nowIso)
    .is('chat_purged_at', null)
    .order('chat_purge_after', { ascending: true })
    .limit(25)

  if (chatPurgeScanError) {
    failures.push('chat_purge_scan')
  } else {
    for (const contest of dueChatPurges ?? []) {
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('contest_id', contest.id)

      if (deleteError) {
        failures.push(`chat_purge:${contest.id}`)
        continue
      }

      const { error: markError } = await supabase
        .from('contests')
        .update({ chat_purged_at: nowIso })
        .eq('id', contest.id)
        .is('chat_purged_at', null)

      if (markError) {
        failures.push(`chat_purge_mark:${contest.id}`)
        continue
      }
      counts.chat_histories_purged++
    }
  }

  const emailDelivery = await deliverPendingEmails(25)
  if (emailDelivery.claimFailed || emailDelivery.failed > 0) {
    failures.push('email_delivery')
  }

  const payload = {
    success: failures.length === 0,
    ...counts,
    email_delivery: emailDelivery,
    failures,
    timestamp: new Date().toISOString(),
  }

  return Response.json(payload, { status: failures.length ? 500 : 200 })
}
