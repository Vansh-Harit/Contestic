import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminPayoutsClient from '@/components/admin-payouts-client'

export const dynamic = 'force-dynamic'

export default async function AdminPayoutsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Redirect non-admin users (check database role)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  // Fetch payouts directly with admin client
  const supabaseAdmin = createAdminClient()

  const { data } = await supabaseAdmin
    .from('payout_requests')
    .select(`
      *,
      contests(title, prize_amount),
      profiles:winner_id(full_name, email, upi_id)
    `)
    .order('created_at', { ascending: true })

  // Sort by status priority
  const statusOrder: Record<string, number> = {
    pending_transfer: 1,
    awaiting_upi: 2,
    transferred: 3,
    failed: 4,
  }

  const payouts = (data ?? []).sort((a: any, b: any) => {
    const aPriority = statusOrder[a.status] ?? 99
    const bPriority = statusOrder[b.status] ?? 99
    if (aPriority !== bPriority) return aPriority - bPriority
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return <AdminPayoutsClient initialPayouts={payouts} />
}
