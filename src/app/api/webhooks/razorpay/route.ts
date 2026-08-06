import { createAdminClient } from '@/lib/supabase/admin'
import { enqueueAndAttemptEmail } from '@/lib/email-delivery'
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay-signature'
import * as Sentry from '@sentry/nextjs'

interface PaymentEntity {
  id: string
  order_id: string
  amount: number
  currency: string
}

interface WebhookEvent {
  event: string
  payload?: {
    payment?: {
      entity?: PaymentEntity
    }
    refund?: {
      entity?: RefundEntity
    }
  }
}

interface RefundEntity {
  id: string
  payment_id: string
  amount: number
  status: string
  notes?: { reason?: string }
}

function paymentFromEvent(event: WebhookEvent): PaymentEntity | null {
  const payment = event.payload?.payment?.entity
  if (
    !payment ||
    typeof payment.id !== 'string' ||
    typeof payment.order_id !== 'string' ||
    typeof payment.amount !== 'number' ||
    typeof payment.currency !== 'string'
  ) {
    return null
  }
  return payment
}

function refundFromEvent(event: WebhookEvent): RefundEntity | null {
  const refund = event.payload?.refund?.entity
  if (
    !refund ||
    typeof refund.id !== 'string' ||
    typeof refund.payment_id !== 'string' ||
    typeof refund.amount !== 'number' ||
    typeof refund.status !== 'string'
  ) {
    return null
  }
  return refund
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature')
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 400 })
  }
  if (!webhookSecret) {
    console.error('[Webhook] Razorpay webhook secret is not configured')
    return Response.json({ error: 'Webhook configuration error' }, { status: 500 })
  }
  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    Sentry.captureMessage('Razorpay webhook signature mismatch', { level: 'error' })
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: WebhookEvent
  try {
    event = JSON.parse(rawBody) as WebhookEvent
  } catch {
    return Response.json({ error: 'Invalid webhook body' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (event.event === 'payment.captured') {
    const payment = paymentFromEvent(event)
    if (!payment || payment.currency !== 'INR') {
      return Response.json({ error: 'Invalid payment payload' }, { status: 400 })
    }

    const { data: existing, error: paymentLookupError } = await supabase
      .from('payments')
      .select('id, contest_id, payment_status, amount, razorpay_payment_id')
      .eq('razorpay_order_id', payment.order_id)
      .single()

    if (paymentLookupError || !existing) {
      Sentry.captureException(paymentLookupError, {
        extra: { eventType: event.event },
      })
      return Response.json({ error: 'Payment record unavailable' }, { status: 500 })
    }

    if (
      existing.payment_status === 'captured' &&
      existing.razorpay_payment_id &&
      existing.razorpay_payment_id !== payment.id
    ) {
      Sentry.captureMessage('Conflicting captured payments for one Razorpay order', {
        level: 'error',
      })
      return Response.json({ status: 'payment_conflict_flagged' }, { status: 200 })
    }

    if (payment.amount !== existing.amount) {
      if (existing.payment_status !== 'captured') {
        await supabase
          .from('payments')
          .update({ payment_status: 'failed' })
          .eq('id', existing.id)
          .in('payment_status', ['pending', 'failed'])
      }
      Sentry.captureMessage('Razorpay captured amount mismatch', { level: 'error' })
      return Response.json({ status: 'amount_mismatch_flagged' }, { status: 200 })
    }

    const { data: contest, error: contestLookupError } = await supabase
      .from('contests')
      .select('id, lister_id, title, status, deadline, entry_window_hours, razorpay_payment_id')
      .eq('id', existing.contest_id)
      .eq('razorpay_order_id', payment.order_id)
      .single()

    if (contestLookupError || !contest) {
      Sentry.captureException(contestLookupError, {
        extra: { eventType: event.event },
      })
      return Response.json({ error: 'Contest record unavailable' }, { status: 500 })
    }

    if (!['draft', 'active'].includes(contest.status)) {
      Sentry.captureMessage('Captured payment received for closed contest', {
        level: 'error',
        extra: { contestStatus: contest.status },
      })
      return Response.json({ status: 'closed_contest_flagged' }, { status: 200 })
    }

    const entryWindow = contest.entry_window_hours || 24
    const rawEntryDeadline = Date.now() + entryWindow * 60 * 60 * 1000
    const submissionDeadline = new Date(contest.deadline).getTime()
    const entryDeadline = new Date(
      Math.min(rawEntryDeadline, submissionDeadline - 60 * 60 * 1000)
    ).toISOString()

    if (contest.status === 'draft') {
      const { error: contestUpdateError } = await supabase
        .from('contests')
        .update({
          status: 'active',
          razorpay_payment_id: payment.id,
          entry_deadline: entryDeadline,
        })
        .eq('id', contest.id)
        .eq('status', 'draft')

      if (contestUpdateError) {
        Sentry.captureException(contestUpdateError, {
          extra: { eventType: event.event },
        })
        return Response.json({ error: 'Contest activation failed' }, { status: 500 })
      }
    } else {
      if (
        contest.razorpay_payment_id &&
        contest.razorpay_payment_id !== payment.id
      ) {
        Sentry.captureMessage('Contest has conflicting Razorpay payment identifier', {
          level: 'error',
        })
        return Response.json({ status: 'payment_conflict_flagged' }, { status: 200 })
      }
      if (!contest.razorpay_payment_id) {
        const { error: contestReconcileError } = await supabase
          .from('contests')
          .update({ razorpay_payment_id: payment.id })
          .eq('id', contest.id)
          .eq('status', 'active')

        if (contestReconcileError) {
          return Response.json({ error: 'Contest reconciliation failed' }, { status: 500 })
        }
      }
    }

    if (existing.payment_status !== 'captured') {
      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({
          payment_status: 'captured',
          razorpay_payment_id: payment.id,
        })
        .eq('id', existing.id)
        .in('payment_status', ['pending', 'failed'])

      if (paymentUpdateError) {
        Sentry.captureException(paymentUpdateError, {
          extra: { eventType: event.event },
        })
        return Response.json({ error: 'Payment reconciliation failed' }, { status: 500 })
      }
    }

    const { data: existingNotification } = await supabase
      .from('notifications')
      .select('id')
      .eq('contest_id', contest.id)
      .eq('type', 'contest_live')
      .limit(1)

    if (!existingNotification?.length) {
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: contest.lister_id,
        type: 'contest_live',
        title: 'Your contest is live!',
        message: `"${contest.title}" is now accepting entries.`,
        contest_id: contest.id,
      })

      if (notificationError) {
        console.error('[Webhook] Contest-live notification failed')
      }
    }

    const { data: lister } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', contest.lister_id)
      .single()

    if (lister?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      await enqueueAndAttemptEmail({
        idempotencyKey: `contest-live/${contest.id}/${contest.lister_id}`,
        eventType: 'contest_live',
        contestId: contest.id,
        userId: contest.lister_id,
        to: lister.email,
        payload: {
          listerName: lister.full_name ?? 'there',
          contestTitle: contest.title,
          contestUrl: `${appUrl}/contest/${contest.id}`,
          entryWindowHours: String(entryWindow),
        },
      })
    }

    return Response.json(
      {
        status:
          existing.payment_status === 'captured'
            ? 'already_processed'
            : 'captured',
      },
      { status: 200 }
    )
  }

  if (event.event === 'payment.failed') {
    // One Razorpay order may have multiple payment attempts. A failed attempt
    // must never cancel a funded contest or block a later captured attempt.
    return Response.json({ status: 'failed_attempt_acknowledged' }, { status: 200 })
  }

  if (event.event === 'refund.processed') {
    const refund = refundFromEvent(event)
    if (
      !refund ||
      !['no_submissions', 'no_valid_submissions'].includes(
        refund.notes?.reason ?? ''
      )
    ) {
      return Response.json({ status: 'refund_ignored' }, { status: 200 })
    }

    const { data: paymentRecord, error: refundLookupError } = await supabase
      .from('payments')
      .select('id, amount, payment_status')
      .eq('razorpay_payment_id', refund.payment_id)
      .single()

    if (refundLookupError || !paymentRecord) {
      return Response.json({ error: 'Refund payment unavailable' }, { status: 500 })
    }
    if (refund.amount !== paymentRecord.amount) {
      Sentry.captureMessage('Razorpay refund amount mismatch', { level: 'error' })
      return Response.json({ status: 'refund_mismatch_flagged' }, { status: 200 })
    }
    if (paymentRecord.payment_status !== 'refunded') {
      const { error: refundUpdateError } = await supabase
        .from('payments')
        .update({ payment_status: 'refunded' })
        .eq('id', paymentRecord.id)
        .eq('payment_status', 'captured')

      if (refundUpdateError) {
        return Response.json({ error: 'Refund reconciliation failed' }, { status: 500 })
      }
    }
    return Response.json({ status: 'refund_reconciled' }, { status: 200 })
  }

  if (event.event === 'refund.failed') {
    Sentry.captureMessage('Razorpay refund failed', { level: 'error' })
    return Response.json({ status: 'refund_failure_recorded' }, { status: 200 })
  }

  return Response.json({ status: 'ignored' }, { status: 200 })
}
