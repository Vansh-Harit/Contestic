import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
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

  const supabaseAdmin = createAdminClient()

  // Fetch all payout requests with contest + winner profile data
  const { data, error } = await supabaseAdmin
    .from('payout_requests')
    .select(`
      *,
      contests(title, prize_amount),
      profiles:winner_id(full_name, email, upi_id)
    `)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[Admin Payouts] Fetch failed:', error)
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 })
  }

  // Sort by status priority: pending_transfer → awaiting_upi → transferred → failed
  const statusOrder: Record<string, number> = {
    pending_transfer: 1,
    awaiting_upi: 2,
    transferred: 3,
    failed: 4,
  }

  const sorted = (data ?? []).sort((a, b) => {
    const aPriority = statusOrder[a.status] ?? 99
    const bPriority = statusOrder[b.status] ?? 99
    if (aPriority !== bPriority) return aPriority - bPriority
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return NextResponse.json({ payouts: sorted })
}
