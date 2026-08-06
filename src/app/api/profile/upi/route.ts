import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 2. Parse body
  let body: { upi_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const upiId = typeof body.upi_id === 'string' ? body.upi_id.trim() : ''

  // 3. Validate
  if (!upiId || !upiId.includes('@') || upiId.length < 5 || upiId.length > 50) {
    return NextResponse.json({ error: 'Invalid UPI ID format' }, { status: 400 })
  }

  // 4. Update profiles
  const { error: profileError } = await admin
    .from('profiles')
    .update({ upi_id: upiId })
    .eq('id', user.id)

  if (profileError) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  // 5. Update payout_requests
  const { error: payoutError } = await admin
    .from('payout_requests')
    .update({
      winner_upi: upiId,
      status: 'pending_transfer'
    })
    .eq('winner_id', user.id)
    .eq('status', 'awaiting_upi')

  if (payoutError) {
    console.error('Failed to update payout requests with new UPI:', payoutError)
    // Non-fatal if no awaiting_upi payouts exist or if this specific update fails, 
    // the UPI is at least saved in the profile.
  }

  // 6. Return success
  return NextResponse.json({ success: true })
}
