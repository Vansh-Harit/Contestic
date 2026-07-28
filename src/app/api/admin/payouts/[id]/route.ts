import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/resend'
import { prizeSentEmail } from '@/lib/email-templates'
import { formatINR } from '@/lib/utils'

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
  let adminNote = ''
  try {
    const body = await request.json()
    adminNote = body.admin_note || ''
  } catch {
    // No body is fine
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

  if (payout.status !== 'pending_transfer') {
    return NextResponse.json(
      { error: `Cannot transfer — current status is "${payout.status}"` },
      { status: 400 }
    )
  }

  // Mark payout as transferred
  const { error: updateError } = await supabaseAdmin
    .from('payout_requests')
    .update({
      status: 'transferred',
      admin_note: adminNote || null,
      transferred_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (updateError) {
    console.error('[Admin Payouts] Update failed:', updateError)
    return NextResponse.json({ error: 'Failed to update payout' }, { status: 500 })
  }

  // Update payments payout_status
  await supabaseAdmin
    .from('payments')
    .update({ payout_status: 'completed' })
    .eq('contest_id', payout.contest_id)

  // Notify winner
  await supabaseAdmin.from('notifications').insert({
    user_id: payout.winner_id,
    type: 'prize_sent',
    title: 'Your prize has been sent!',
    message: 'Your prize money has been transferred. Check your UPI or bank account.',
    contest_id: payout.contest_id,
  })

  // Fire-and-forget email to winner
  const winnerEmailAddr = payout.profiles?.email
  const contestTitle = payout.contests?.title || 'Contest'
  const prizeAmount = payout.contests?.prize_amount || 0
  const winnerUpi = payout.winner_upi || ''

  if (winnerEmailAddr) {
    const maskedUpi = winnerUpi.length > 6
      ? `${winnerUpi.slice(0, 3)}****${winnerUpi.slice(-3)}`
      : 'your UPI'

    void sendEmail(
      winnerEmailAddr,
      `Your prize has been sent — ${formatINR(prizeAmount)}`,
      prizeSentEmail(
        payout.profiles?.full_name ?? 'there',
        contestTitle,
        formatINR(prizeAmount),
        maskedUpi
      )
    )
  }

  return NextResponse.json({ success: true })
}
