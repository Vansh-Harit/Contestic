import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend'
import { contestLiveEmail } from '@/lib/email-templates'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  if (!signature) {
    console.error('[Webhook] Missing signature header')
    return Response.json({ error: 'Missing signature' }, { status: 400 })
  }

  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured')
    return Response.json({ error: 'Webhook configuration error' }, { status: 500 })
  }

  const crypto = await import('crypto')
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  if (expectedSignature !== signature) {
    Sentry.captureMessage('Razorpay webhook signature mismatch', { level: 'error' })
    console.error('[Webhook] Signature mismatch')
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)
  const supabase = createAdminClient()

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity
    const orderId = payment.order_id
    const paymentId = payment.id
    const paidAmount = payment.amount  // amount in paise, from Razorpay

    // IDEMPOTENCY — already processed, return 200 silently
    const { data: existing } = await supabase
      .from('payments')
      .select('id, payment_status, amount')
      .eq('razorpay_order_id', orderId)
      .single()

    if (existing?.payment_status === 'captured') {
      console.log('[Webhook] Already processed order:', orderId)
      return Response.json({ status: 'already_processed' }, { status: 200 })
    }

    // AMOUNT VERIFICATION — the amount Razorpay captured MUST match
    // what our own database expected for this order
    if (!existing) {
      console.error('[Webhook] No matching payment record for order:', orderId)
      return Response.json({ status: 'no_matching_record' }, { status: 200 })
    }

    if (paidAmount !== existing.amount) {
      console.error(
        '[Webhook] AMOUNT MISMATCH — possible tampering attempt.',
        'Order:', orderId,
        'Expected:', existing.amount,
        'Received:', paidAmount
      )
      Sentry.captureMessage('Razorpay amount mismatch — possible tampering', {
        level: 'error',
        extra: { orderId, expected: existing.amount, received: paidAmount },
      })

      // Mark this payment as failed rather than activating the contest
      await supabase
        .from('payments')
        .update({ payment_status: 'failed' })
        .eq('razorpay_order_id', orderId)

      // Alert admin via email
      void sendEmail(
        process.env.ADMIN_EMAIL ?? '',
        'SECURITY ALERT — Payment amount mismatch detected',
        `<p>Order ${orderId} was captured for ₹${paidAmount / 100} but 
        expected ₹${existing.amount / 100}. Contest was NOT activated. 
        Investigate immediately.</p>`
      )

      return Response.json({ status: 'amount_mismatch_flagged' }, { status: 200 })
    }

    // Fetch contest to get entry_window_hours and deadline
    const { data: draft, error: fetchError } = await supabase
      .from('contests')
      .select('id, entry_window_hours, deadline')
      .eq('razorpay_order_id', orderId)
      .single()

    if (fetchError || !draft) {
      Sentry.captureException(fetchError, { extra: { orderId } })
      console.error('[Webhook] Fetch draft failed:', fetchError)
      return Response.json({ status: 'db_error' }, { status: 200 })
    }

    const entryWindow = draft.entry_window_hours || 24
    const rawEntryDeadline = Date.now() + entryWindow * 60 * 60 * 1000
    // Clamp: entry_deadline must be before submission deadline (CHECK constraint)
    const submissionDeadline = new Date(draft.deadline).getTime()
    const clampedEntryDeadline = Math.min(rawEntryDeadline, submissionDeadline - 60 * 60 * 1000)
    const entryDeadline = new Date(clampedEntryDeadline).toISOString()

    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .update({ 
        status: 'active', 
        razorpay_payment_id: paymentId,
        entry_deadline: entryDeadline
      })
      .eq('razorpay_order_id', orderId)
      .select('id, lister_id, title')
      .single()

    if (contestError || !contest) {
      Sentry.captureException(contestError, { extra: { orderId } })
      console.error('[Webhook] Contest update failed:', contestError)
      return Response.json({ status: 'db_error' }, { status: 200 })
    }

    await supabase.from('payments')
      .update({ payment_status: 'captured', razorpay_payment_id: paymentId })
      .eq('razorpay_order_id', orderId)

    await supabase.from('notifications').insert({
      user_id: contest.lister_id,
      type: 'contest_live',
      title: 'Your contest is live!',
      message: `"${contest.title}" is now accepting submissions.`,
      contest_id: contest.id
    })

    // Fire-and-forget email to lister
    const { data: lister } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', contest.lister_id)
      .single()

    if (lister?.email) {
      void sendEmail(
        lister.email,
        `Your contest is live — ${contest.title}`,
        contestLiveEmail(
          lister.full_name ?? 'there',
          contest.title,
          `${process.env.NEXT_PUBLIC_APP_URL}/contest/${contest.id}`,
          String(entryWindow)
        )
      )
    }

    console.log('[Webhook] Contest activated:', contest.id)
    console.log('[Webhook] Entry deadline set:', contest.id, entryDeadline)
  }

  if (event.event === 'payment.failed') {
    const orderId = event.payload.payment.entity.order_id
    await supabase.from('contests')
      .update({ status: 'cancelled' })
      .eq('razorpay_order_id', orderId)
    await supabase.from('payments')
      .update({ payment_status: 'failed' })
      .eq('razorpay_order_id', orderId)
    console.log('[Webhook] Payment failed, order:', orderId)
  }

  return Response.json({ status: 'ok' }, { status: 200 })
}
