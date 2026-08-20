import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { deliverPendingEmails, enqueueEmail } from '@/lib/email-delivery'
import { formatINR } from '@/lib/utils'
import { createNotificationEvent } from '@/lib/notification-service'

type PayoutProfile = {
  full_name: string | null
  email: string | null
}

function normalizePayoutProfile(
  value: PayoutProfile | PayoutProfile[] | null | undefined
): PayoutProfile | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  const supabase = await createClient()

  // Auth check — verify admin via database role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Parse body
  let transferReference = ''
  try {
    const body = (await request.json()) as { admin_note?: unknown }
    transferReference =
      typeof body.admin_note === 'string' ? body.admin_note.trim() : ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (transferReference.length < 3 || transferReference.length > 100) {
    return NextResponse.json(
      { error: 'A 3-100 character UPI/transaction reference is required' },
      { status: 400 }
    )
  }

  const supabaseAdmin = createAdminClient()

  // Fetch payout request
  const { data: payout, error: fetchError } = await supabaseAdmin
    .from('payout_requests')
    .select('*, contests(title, prize_amount), profiles:winner_id(full_name, email)')
    .eq('id', params.id)
    .single()

  if (fetchError || !payout) {
    return NextResponse.json({ error: 'Payout request not found' }, { status: 404 })
  }

  const queuePayoutConfirmation = async (reference: string) => {
    const winnerProfile = normalizePayoutProfile(payout.profiles)
    if (!winnerProfile?.email) return

    const winnerUpi = payout.winner_upi || ''
    const maskedUpi = winnerUpi.length > 6
      ? `${winnerUpi.slice(0, 3)}****${winnerUpi.slice(-3)}`
      : 'your saved UPI ID'
    const contestTitle = payout.contests?.title || 'Contest'
    const prizeAmount = payout.contests?.prize_amount || 0

    await enqueueEmail({
      idempotencyKey: `payout-transferred/${payout.contest_id}/${payout.id}`,
      eventType: 'payout_transferred',
      contestId: payout.contest_id,
      userId: payout.winner_id,
      to: winnerProfile.email,
      payload: {
        winnerName: winnerProfile.full_name ?? 'there',
        contestTitle,
        prizeFormatted: formatINR(prizeAmount),
        maskedUpi,
        transferReference: reference,
      },
    })
    await deliverPendingEmails(10)
  }

  const notifyPayoutComplete = async () => {
    try {
      await createNotificationEvent({
        userId: payout.winner_id,
        type: 'prize_sent',
        title: 'Your prize has been sent',
        message: 'Your prize transfer has been completed. Check your saved UPI or bank account.',
        contestId: payout.contest_id,
        eventKey: `payout-transferred/${payout.contest_id}/${payout.id}`,
      })
    } catch {
      console.error('[Admin Payouts] Winner notification failed')
    }
  }

  if (payout.status === 'transferred') {
    const { error: reconciliationError } = await supabaseAdmin
      .from('payments')
      .update({
        payout_status: 'completed',
        payout_transfer_id: payout.admin_note || transferReference,
      })
      .eq('contest_id', payout.contest_id)

    if (reconciliationError) {
      console.error('[Admin Payouts] Payment reconciliation failed', reconciliationError)
      return NextResponse.json(
        { error: 'Transfer is recorded; reconciliation is still pending' },
        { status: 500 }
      )
    }

    await Promise.all([
      queuePayoutConfirmation(payout.admin_note || transferReference),
      notifyPayoutComplete(),
    ])

    return NextResponse.json({ success: true, status: 'already_recorded' })
  }

  if (payout.status !== 'pending_transfer') {
    return NextResponse.json(
      { error: `Cannot transfer — current status is "${payout.status}"` },
      { status: 400 }
    )
  }

  // Mark payout as transferred
  const { data: transitioned, error: updateError } = await supabaseAdmin
    .from('payout_requests')
    .update({
      status: 'transferred',
      admin_note: transferReference,
      transferred_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('status', 'pending_transfer')
    .select('id')
    .maybeSingle()

  if (updateError || !transitioned) {
    console.error('[Admin Payouts] Update failed:', updateError)
    return NextResponse.json(
      { error: 'Payout state changed. Refresh before recording the transfer.' },
      { status: 409 }
    )
  }

  // Update payments payout_status
  const { error: paymentUpdateError } = await supabaseAdmin
    .from('payments')
    .update({
      payout_status: 'completed',
      payout_transfer_id: transferReference,
    })
    .eq('contest_id', payout.contest_id)

  if (paymentUpdateError) {
    console.error('[Admin Payouts] Payment reconciliation failed', paymentUpdateError)
    return NextResponse.json({ error: 'Transfer recorded; reconciliation pending' }, { status: 500 })
  }

  await Promise.all([
    queuePayoutConfirmation(transferReference),
    notifyPayoutComplete(),
  ])

  return NextResponse.json({ success: true })
}
