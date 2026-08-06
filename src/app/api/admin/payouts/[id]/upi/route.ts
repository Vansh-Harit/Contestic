import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

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

  let body: { upi_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const upiId = typeof body.upi_id === 'string' ? body.upi_id.trim() : ''
  if (!upiId || !upiId.includes('@') || upiId.length < 5 || upiId.length > 50) {
    return NextResponse.json(
      { error: 'Invalid UPI ID. Must be 5-50 characters and contain @' },
      { status: 400 }
    )
  }

  const supabaseAdmin = createAdminClient()

  // Fetch payout request to get winner_id
  const { data: payout, error: fetchError } = await supabaseAdmin
    .from('payout_requests')
    .select('id, winner_id, status')
    .eq('id', params.id)
    .single()

  if (fetchError || !payout) {
    return NextResponse.json({ error: 'Payout request not found' }, { status: 404 })
  }

  if (!['awaiting_upi', 'pending_transfer'].includes(payout.status)) {
    return NextResponse.json(
      { error: 'UPI cannot be changed after this payout is closed' },
      { status: 409 }
    )
  }

  // Update payout request with UPI and transition to pending_transfer
  const { error: payoutUpdateError } = await supabaseAdmin
    .from('payout_requests')
    .update({
      winner_upi: upiId,
      status: 'pending_transfer',
    })
    .eq('id', params.id)
    .in('status', ['awaiting_upi', 'pending_transfer'])

  if (payoutUpdateError) {
    return NextResponse.json({ error: 'Failed to update payout UPI' }, { status: 500 })
  }

  // Also update the winner's profile upi_id
  const { error: profileUpdateError } = await supabaseAdmin
    .from('profiles')
    .update({ upi_id: upiId })
    .eq('id', payout.winner_id)

  if (profileUpdateError) {
    return NextResponse.json(
      { error: 'Payout UPI saved; profile synchronization pending' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
