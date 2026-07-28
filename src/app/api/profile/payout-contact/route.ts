import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { upi_id?: string; prefer_email?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { upi_id, prefer_email } = body

  if (!upi_id && !prefer_email) {
    return NextResponse.json(
      { error: 'Please provide a UPI ID or select email preference' },
      { status: 400 }
    )
  }

  // Validate UPI format: must contain @ and be 5-50 chars
  if (upi_id && (!upi_id.includes('@') || upi_id.length < 5 || upi_id.length > 50)) {
    return NextResponse.json(
      { error: 'Invalid UPI ID. Must be 5-50 characters and contain @' },
      { status: 400 }
    )
  }

  // Update profile with UPI ID
  const updateData: Record<string, any> = {}
  if (upi_id) {
    updateData.upi_id = upi_id.trim()
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (error) {
    console.error('[PayoutContact] Failed to update profile:', error)
    return NextResponse.json(
      { error: 'Failed to save payout details' },
      { status: 500 }
    )
  }

  // Also update any pending payout_requests for this winner
  if (upi_id) {
    await supabase
      .from('payout_requests')
      .update({
        winner_upi: upi_id.trim(),
        status: 'pending_transfer',
      })
      .eq('winner_id', user.id)
      .eq('status', 'awaiting_upi')
  }

  return NextResponse.json({ success: true })
}
