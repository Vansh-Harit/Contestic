import { createAdminClient } from '@/lib/supabase/admin'
import {
  deliverPendingEmails,
  enqueueEmail,
  getExistingEmailDeliveryKeysForContests,
} from '@/lib/email-delivery'
import { formatINR } from '@/lib/utils'
import { deleteContestFolder } from '@/lib/r2'
import { createIdempotentRefund } from '@/lib/razorpay-refund'
import { completeContestSubmissionCleanup } from '@/lib/contest-cleanup'
import {
  createNotificationEvent,
  getExistingNotificationEventKeysForContests,
} from '@/lib/notification-service'
import { shouldRefundZeroEntryContest } from '@/lib/contest-refund-policy'

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
  const { data: leaseToken, error: leaseError } = await supabase.rpc(
    'acquire_cron_lease',
    {
      p_name: 'check-expired',
      p_lease_seconds: 90,
    }
  )

  if (leaseError) {
    console.error('[Cron] Could not acquire execution lease')
    return Response.json(
      { success: false, error: 'cron_lease_unavailable' },
      { status: 503 }
    )
  }

  if (typeof leaseToken !== 'string') {
    return Response.json({ success: true, status: 'already_running' })
  }

  try {
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

  // Recover pending or stale deliveries before lifecycle work. A second pass
  // below sends events created during this invocation.
  const recoveredEmailDelivery = await deliverPendingEmails(25)
  if (recoveredEmailDelivery.claimFailed || recoveredEmailDelivery.failed > 0) {
    failures.push('email_recovery')
  }

  const ensureNotification = async (input: {
    userId: string
    contestId: string
    type: string
    title: string
    message: string
    eventKey: string
  }) => {
    return createNotificationEvent({
      userId: input.userId,
      contestId: input.contestId,
      type: input.type,
      title: input.title,
      message: input.message,
      eventKey: input.eventKey,
    })
  }

  const refundEmptyContest = async (input: {
    contest: {
      id: string
      lister_id: string
      title: string
      prize_amount: number
      entry_count: number | null
    }
    reason: 'no_entries' | 'no_submissions'
    closedAt: string
    closeColumn: 'entry_deadline' | 'deadline'
  }): Promise<boolean> => {
    const { contest, reason, closedAt, closeColumn } = input

    if (reason === 'no_entries') {
      const [{ data: eligibleContest, error: eligibilityError }, entryResult] =
        await Promise.all([
          supabase
            .from('contests')
            .select('id')
            .eq('id', contest.id)
            .eq('status', 'active')
            .lte('entry_deadline', nowIso)
            .maybeSingle(),
          supabase
            .from('contest_entries')
            .select('id', { count: 'exact', head: true })
            .eq('contest_id', contest.id),
        ])

      if (eligibilityError || entryResult.error) {
        throw eligibilityError ?? entryResult.error
      }
      if (!eligibleContest || (entryResult.count ?? 0) !== 0) return false
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, razorpay_payment_id, amount, prize_amount, platform_fee, payment_status')
      .eq('contest_id', contest.id)
      .single()
    if (paymentError || !payment?.razorpay_payment_id) {
      throw paymentError || new Error('Refundable payment was not found')
    }

    const refundAmount = Number(payment.prize_amount)
    const retainedFee = Number(payment.platform_fee)
    const chargedAmount = Number(payment.amount)
    if (
      !Number.isSafeInteger(refundAmount) ||
      refundAmount <= 0 ||
      !Number.isSafeInteger(retainedFee) ||
      retainedFee < 0 ||
      refundAmount + retainedFee !== chargedAmount ||
      refundAmount !== Number(contest.prize_amount)
    ) {
      throw new Error('Stored refund amounts are inconsistent')
    }

    if (payment.payment_status !== 'refunded') {
      if (payment.payment_status !== 'captured') {
        throw new Error('Payment is not in a refundable state')
      }
      const refund = await createIdempotentRefund({
        paymentId: payment.razorpay_payment_id,
        amount: refundAmount,
        // Preserve the established key across retries and both empty-contest
        // outcomes so Razorpay can never issue two refunds for one contest.
        idempotencyKey: `contest_${contest.id}_full_refund`,
        reason,
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

    let transition = supabase
      .from('contests')
      .update({ status: 'cancelled', updated_at: closedAt })
      .eq('id', contest.id)
      .eq('status', 'active')
    transition = closeColumn === 'entry_deadline'
      ? transition.lte('entry_deadline', nowIso)
      : transition.lte('deadline', nowIso)
    const { data: transitioned, error: contestUpdateError } = await transition
      .select('id')
      .maybeSingle()
    if (contestUpdateError) throw contestUpdateError
    if (!transitioned) return false

    const outcome = reason === 'no_entries'
      ? 'received no entries before the entry period closed'
      : 'received no submissions before the submission deadline'
    await ensureNotification({
      userId: contest.lister_id,
      contestId: contest.id,
      type: 'auto_refund',
      title: 'Contest closed - prize refund initiated',
      message: `"${contest.title}" ${outcome}. Your ${formatINR(refundAmount)} prize refund has been initiated. The ${formatINR(retainedFee)} platform fee is non-refundable.`,
      eventKey: `auto-refund/${contest.id}/${contest.lister_id}`,
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
          refundAmount: formatINR(refundAmount),
          retainedFee: formatINR(retainedFee),
          reason,
        },
      })
    }

    await supabase.from('messages').delete().eq('contest_id', contest.id)
    try {
      await deleteContestFolder(contest.id)
    } catch (r2Error) {
      console.error('[Cron] Cancelled-contest file cleanup failed:', contest.id, r2Error)
    }

    return true
  }

  // 1. Entry closure reveals the brief. Capacity may close entry early, but it
  // never changes the fixed submission deadline.
  const { data: activeContests, error: activeError } = await supabase
    .from('contests_with_counts')
    .select('id, lister_id, title, prize_amount, deadline, entry_deadline, entry_limit, max_entries, entry_count')
    .eq('status', 'active')
    .not('entry_deadline', 'is', null)
    .order('entry_deadline', { ascending: true })
    .limit(100)

  if (activeError) {
    failures.push('active_contest_scan')
  } else {
    const readyContests = (activeContests ?? []).filter((contest) => {
      const effectiveLimit = contest.entry_limit ?? contest.max_entries
      const entryDeadlinePassed = new Date(contest.entry_deadline) <= now
      const entryFull = (contest.entry_count ?? 0) >= effectiveLimit
      return entryDeadlinePassed || entryFull
    })
    const readyContestIds = readyContests.map((contest) => contest.id)
    const readyListerIds = [...new Set(readyContests.map((contest) => contest.lister_id))]
    const entriesByContest = new Map<string, Array<{
      contestant_id: string
      profiles: JoinedProfile | JoinedProfile[] | null
    }>>()
    const listersById = new Map<string, JoinedProfile>()
    let existingNotificationKeys = new Set<string>()
    let existingEmailKeys = new Set<string>()
    let batchReadFailed = false

    if (readyContestIds.length > 0) {
      try {
        const [entriesResult, listersResult, notificationKeys, emailKeys] = await Promise.all([
          supabase
            .from('contest_entries')
            .select('contest_id, contestant_id, profiles(email, full_name)')
            .in('contest_id', readyContestIds),
          supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', readyListerIds),
          getExistingNotificationEventKeysForContests(readyContestIds),
          getExistingEmailDeliveryKeysForContests(readyContestIds),
        ])

        if (entriesResult.error || listersResult.error) {
          throw entriesResult.error ?? listersResult.error
        }

        for (const entry of entriesResult.data ?? []) {
          const current = entriesByContest.get(entry.contest_id) ?? []
          current.push({
            contestant_id: entry.contestant_id,
            profiles: entry.profiles,
          })
          entriesByContest.set(entry.contest_id, current)
        }
        for (const lister of listersResult.data ?? []) {
          listersById.set(lister.id, lister)
        }
        existingNotificationKeys = notificationKeys
        existingEmailKeys = emailKeys
      } catch {
        failures.push('entry_close_batch_read')
        batchReadFailed = true
      }
    }

    for (const contest of batchReadFailed ? [] : readyContests) {
      const effectiveLimit = contest.entry_limit ?? contest.max_entries
      const entryFull = (contest.entry_count ?? 0) >= effectiveLimit

      try {
        if (
          shouldRefundZeroEntryContest({
            entryDeadline: contest.entry_deadline,
            entryCount: contest.entry_count,
            now,
          })
        ) {
          const refunded = await refundEmptyContest({
            contest,
            reason: 'no_entries',
            closedAt: contest.entry_deadline,
            closeColumn: 'entry_deadline',
          })
          if (refunded) counts.refunded_empty++
          continue
        }

        if (entryFull) {
          const contestFullKey = `contest-full/${contest.id}/${contest.lister_id}`
          if (!existingNotificationKeys.has(contestFullKey)) {
            const created = await ensureNotification({
              userId: contest.lister_id,
              contestId: contest.id,
              type: 'contest_full',
              title: 'Your contest is full!',
              message: `All ${effectiveLimit} spots are taken for "${contest.title}". The submission window is now open for participants.`,
              eventKey: contestFullKey,
            })
            if (created) existingNotificationKeys.add(contestFullKey)
          }
        }

        const entries = entriesByContest.get(contest.id) ?? []
        const deadline = formatDateTime(contest.deadline)
        for (const entry of entries) {
          const submissionOpenKey = `submission-open/${contest.id}/${entry.contestant_id}`
          if (!existingNotificationKeys.has(submissionOpenKey)) {
            const created = await ensureNotification({
              userId: entry.contestant_id,
              contestId: contest.id,
              type: 'entry_closed',
              title: 'Submission window open',
              message: `Entry for "${contest.title}" has closed. The full brief and materials are now available.`,
              eventKey: submissionOpenKey,
            })
            if (created) existingNotificationKeys.add(submissionOpenKey)
          }

          const profile = normalizeProfile(entry.profiles)
          if (!profile?.email || existingEmailKeys.has(submissionOpenKey)) continue
          const queued = await enqueueEmail({
            idempotencyKey: submissionOpenKey,
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
          if (queued) existingEmailKeys.add(submissionOpenKey)
        }

        const lister = listersById.get(contest.lister_id)
        const listerEmailKey = `entry-closed-lister/${contest.id}/${contest.lister_id}`
        if (lister?.email && !existingEmailKeys.has(listerEmailKey)) {
          const queued = await enqueueEmail({
            idempotencyKey: listerEmailKey,
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
          if (queued) existingEmailKeys.add(listerEmailKey)
        }
        counts.entry_closed_notified++
      } catch (error) {
        console.error('[Cron] Entry-close reconciliation failed:', contest.id, error)
        failures.push(`entry_close:${contest.id}`)
      }
    }
  }

  // 2. The fixed submission deadline either opens judging or refunds only the
  // advertised prize when there are zero submissions. The 5% platform fee is
  // retained in both the zero-entry and entered-without-submission cases.
  const { data: expiredContests, error: expiredError } = await supabase
    .from('contests_with_counts')
    .select('id, lister_id, title, prize_amount, deadline, entry_count, submission_count')
    .eq('status', 'active')
    .lte('deadline', nowIso)
    .order('deadline', { ascending: true })
    .limit(25)

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
        const refunded = await refundEmptyContest({
          contest,
          reason: (contest.entry_count ?? 0) === 0 ? 'no_entries' : 'no_submissions',
          closedAt: contest.deadline,
          closeColumn: 'deadline',
        })
        if (refunded) counts.refunded_empty++
      } catch (error) {
        console.error('[Cron] Empty-contest refund failed:', contest.id, error)
        failures.push(`refund:${contest.id}`)
      }
    }
  }

  // 3. Reconcile judging notifications and the single three-day admin alert.
  const { data: judgingContests, error: judgingError } = await supabase
    .from('contests_with_counts')
    .select('id, lister_id, title, updated_at, submission_count')
    .eq('status', 'judging')
    .is('winner_submission_id', null)
    .order('updated_at', { ascending: true })
    .limit(25)

  if (judgingError) {
    failures.push('judging_scan')
  } else {
    const judgingContestIds = (judgingContests ?? []).map((contest) => contest.id)
    const judgingListerIds = [...new Set((judgingContests ?? []).map((contest) => contest.lister_id))]
    const listersById = new Map<string, JoinedProfile>()
    let existingNotificationKeys = new Set<string>()
    let existingEmailKeys = new Set<string>()
    let batchReadFailed = false

    if (judgingContestIds.length > 0) {
      try {
        const [listersResult, notificationKeys, emailKeys] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', judgingListerIds),
          getExistingNotificationEventKeysForContests(judgingContestIds),
          getExistingEmailDeliveryKeysForContests(judgingContestIds),
        ])
        if (listersResult.error) throw listersResult.error
        for (const lister of listersResult.data ?? []) {
          listersById.set(lister.id, lister)
        }
        existingNotificationKeys = notificationKeys
        existingEmailKeys = emailKeys
      } catch {
        failures.push('judging_batch_read')
        batchReadFailed = true
      }
    }

    for (const contest of batchReadFailed ? [] : (judgingContests ?? [])) {
      try {
        const lister = listersById.get(contest.lister_id)
        const judgingOpenKey = `judging-open/${contest.id}/${contest.lister_id}`
        if (!existingNotificationKeys.has(judgingOpenKey)) {
          const created = await ensureNotification({
            userId: contest.lister_id,
            contestId: contest.id,
            type: 'deadline_passed',
            title: 'Submissions ready for review',
            message: `"${contest.title}" has ${contest.submission_count ?? 0} submission(s). Review them and select a winner.`,
            eventKey: judgingOpenKey,
          })
          if (created) existingNotificationKeys.add(judgingOpenKey)
        }

        if (lister?.email && !existingEmailKeys.has(judgingOpenKey)) {
          const queued = await enqueueEmail({
            idempotencyKey: judgingOpenKey,
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
          if (queued) {
            existingEmailKeys.add(judgingOpenKey)
            counts.judging_emails_queued++
          }
        }

        const judgingStartedAt = new Date(contest.updated_at)
        const daysInJudging = Math.floor(
          (now.getTime() - judgingStartedAt.getTime()) / (24 * 60 * 60 * 1000)
        )

        const overdueAdminKey = `admin-judging-overdue/${contest.id}`
        if (
          daysInJudging >= 3 &&
          adminEmail &&
          !existingEmailKeys.has(overdueAdminKey)
        ) {
          const queued = await enqueueEmail({
            idempotencyKey: overdueAdminKey,
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
          if (queued) {
            existingEmailKeys.add(overdueAdminKey)
            counts.overdue_admin_alerts_queued++
          }
        }

        if (daysInJudging >= 3) {
          const reminderKey = `judging-reminder-3/${contest.id}/${contest.lister_id}`
          if (!existingNotificationKeys.has(reminderKey)) {
            const created = await ensureNotification({
              userId: contest.lister_id,
              contestId: contest.id,
              type: 'judging_reminder_3',
              title: `Select a winner for "${contest.title}"`,
              message: 'Three days have passed. Review the submissions and select a winner.',
              eventKey: reminderKey,
            })
            if (created) {
              existingNotificationKeys.add(reminderKey)
              counts.reminders_sent++
            }
          }
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
    .select('id, title, prize_amount, winner_submission_id, updated_at')
    .eq('status', 'completed')
    .not('winner_submission_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(25)

  if (completedError) {
    failures.push('completed_contest_scan')
  } else {
    const completedContestIds = (completedContests ?? []).map((contest) => contest.id)
    const winnerSubmissionIds = (completedContests ?? [])
      .map((contest) => contest.winner_submission_id)
      .filter((id): id is string => typeof id === 'string')
    const winnerSubmissionsById = new Map<string, {
      contestant_id: string
      profiles: JoinedProfile | JoinedProfile[] | null
    }>()
    const entrantsByContest = new Map<string, Array<{
      contestant_id: string
      profiles: JoinedProfile | JoinedProfile[] | null
    }>>()
    let existingWinnerEmailKeys = new Set<string>()
    let completedBatchReadFailed = false

    if (completedContestIds.length > 0) {
      try {
        if (winnerSubmissionIds.length !== completedContestIds.length) {
          throw new Error('Completed contest is missing its winner submission')
        }
        const [winnerResult, entrantsResult, emailKeys] = await Promise.all([
          supabase
            .from('submissions')
            .select('id, contestant_id, profiles(email, full_name)')
            .in('id', winnerSubmissionIds),
          supabase
            .from('contest_entries')
            .select('contest_id, contestant_id, profiles(email, full_name)')
            .in('contest_id', completedContestIds),
          getExistingEmailDeliveryKeysForContests(completedContestIds),
        ])
        if (winnerResult.error || entrantsResult.error) {
          throw winnerResult.error ?? entrantsResult.error
        }
        for (const submission of winnerResult.data ?? []) {
          winnerSubmissionsById.set(submission.id, {
            contestant_id: submission.contestant_id,
            profiles: submission.profiles,
          })
        }
        for (const entrant of entrantsResult.data ?? []) {
          const current = entrantsByContest.get(entrant.contest_id) ?? []
          current.push({
            contestant_id: entrant.contestant_id,
            profiles: entrant.profiles,
          })
          entrantsByContest.set(entrant.contest_id, current)
        }
        existingWinnerEmailKeys = emailKeys
      } catch {
        failures.push('completed_email_batch_read')
        completedBatchReadFailed = true
      }
    }

    for (const contest of completedBatchReadFailed ? [] : (completedContests ?? [])) {
      try {
        let reconciled = false
        const winnerSubmission = winnerSubmissionsById.get(contest.winner_submission_id)
        if (!winnerSubmission) throw new Error('Winner submission unavailable')

        const winnerProfile = normalizeProfile(winnerSubmission.profiles)
        const prize = formatINR(contest.prize_amount)
        const winnerKey = `winner-selected/${contest.id}/${winnerSubmission.contestant_id}`
        if (winnerProfile?.email && !existingWinnerEmailKeys.has(winnerKey)) {
          const queued = await enqueueEmail({
            idempotencyKey: winnerKey,
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
          if (queued) {
            existingWinnerEmailKeys.add(winnerKey)
            reconciled = true
          }
        }

        for (const entrant of entrantsByContest.get(contest.id) ?? []) {
          if (entrant.contestant_id === winnerSubmission.contestant_id) continue
          const profile = normalizeProfile(entrant.profiles)
          if (!profile?.email) continue
          const notSelectedKey = `winner-not-selected/${contest.id}/${entrant.contestant_id}`
          if (existingWinnerEmailKeys.has(notSelectedKey)) continue
          const queued = await enqueueEmail({
            idempotencyKey: notSelectedKey,
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
          if (queued) {
            existingWinnerEmailKeys.add(notSelectedKey)
            reconciled = true
          }
        }

        const adminKey = `admin-payout-required/${contest.id}`
        if (adminEmail && !existingWinnerEmailKeys.has(adminKey)) {
          const queued = await enqueueEmail({
            idempotencyKey: adminKey,
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
          if (queued) {
            existingWinnerEmailKeys.add(adminKey)
            reconciled = true
          }
        }
        if (reconciled) counts.winner_emails_reconciled++
      } catch (error) {
        console.error('[Cron] Winner email reconciliation failed:', contest.id, error)
        failures.push(`winner_email:${contest.id}`)
      }
    }
  }

  // 5. Reconcile payment-confirmation emails with the stored UTR/reference.
  const { data: transferredPayouts, error: payoutError } = await supabase
    .from('payout_requests')
    .select('id, contest_id, contest_title, winner_id, winner_name, winner_email, winner_upi, amount, admin_note, status, transferred_at')
    .eq('status', 'transferred')
    .not('admin_note', 'is', null)
    .order('transferred_at', { ascending: false })
    .limit(25)

  if (payoutError) {
    failures.push('transferred_payout_scan')
  } else {
    let existingPayoutEmailKeys = new Set<string>()
    let payoutKeyScanFailed = false
    try {
      existingPayoutEmailKeys = await getExistingEmailDeliveryKeysForContests(
        (transferredPayouts ?? []).map((payout) => payout.contest_id)
      )
    } catch {
      failures.push('payout_email_key_scan')
      payoutKeyScanFailed = true
    }

    for (const payout of payoutKeyScanFailed ? [] : (transferredPayouts ?? [])) {
      const payoutKey = `payout-transferred/${payout.contest_id}/${payout.id}`
      if (existingPayoutEmailKeys.has(payoutKey)) continue
      const winnerUpi = payout.winner_upi || ''
      const maskedUpi = winnerUpi.length > 6
        ? `${winnerUpi.slice(0, 3)}****${winnerUpi.slice(-3)}`
        : 'your saved UPI ID'
      const queued = await enqueueEmail({
        idempotencyKey: payoutKey,
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
      if (queued) {
        existingPayoutEmailKeys.add(payoutKey)
        counts.payout_emails_reconciled++
      }
    }
  }

  // 6. Keep the existing in-app UPI reminder, at most once per calendar day.
  const { data: awaitingUpi, error: upiError } = await supabase
    .from('payout_requests')
    .select('contest_id, winner_id, amount, contest_title, created_at')
    .eq('status', 'awaiting_upi')
    .order('created_at', { ascending: true })
    .limit(25)

  if (upiError) {
    failures.push('upi_reminder_scan')
  } else {
    const today = nowIso.slice(0, 10)
    let existingUpiReminderKeys = new Set<string>()
    let reminderKeyScanFailed = false
    try {
      existingUpiReminderKeys = await getExistingNotificationEventKeysForContests(
        (awaitingUpi ?? []).map((payout) => payout.contest_id)
      )
    } catch {
      failures.push('upi_reminder_key_scan')
      reminderKeyScanFailed = true
    }

    for (const payout of reminderKeyScanFailed ? [] : (awaitingUpi ?? [])) {
      const reminderKey = `upi-reminder/${payout.contest_id}/${payout.winner_id}/${today}`
      if (existingUpiReminderKeys.has(reminderKey)) continue

      const created = await ensureNotification({
        userId: payout.winner_id,
        contestId: payout.contest_id,
        type: 'upi_reminder',
        title: 'Add your UPI ID to receive your prize',
        message: `Your prize of ${formatINR(payout.amount)} for "${payout.contest_title}" is waiting for your UPI ID.`,
        eventKey: reminderKey,
      })
      if (created) {
        existingUpiReminderKeys.add(reminderKey)
        counts.upi_reminders_sent++
      }
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

  const currentEmailDelivery = await deliverPendingEmails(25)
  if (currentEmailDelivery.claimFailed || currentEmailDelivery.failed > 0) {
    failures.push('email_delivery')
  }

  const emailDelivery = {
    claimed: recoveredEmailDelivery.claimed + currentEmailDelivery.claimed,
    sent: recoveredEmailDelivery.sent + currentEmailDelivery.sent,
    failed: recoveredEmailDelivery.failed + currentEmailDelivery.failed,
    claimFailed:
      recoveredEmailDelivery.claimFailed || currentEmailDelivery.claimFailed,
  }

  const payload = {
    success: failures.length === 0,
    ...counts,
    email_delivery: emailDelivery,
    failures,
    timestamp: new Date().toISOString(),
  }

  return Response.json(payload, { status: failures.length ? 500 : 200 })
  } finally {
    const { error: releaseError } = await supabase.rpc('release_cron_lease', {
      p_name: 'check-expired',
      p_lease_token: leaseToken,
    })
    if (releaseError) {
      console.error('[Cron] Could not release execution lease')
    }
  }
}
