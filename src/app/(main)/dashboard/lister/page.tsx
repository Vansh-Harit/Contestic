import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ListerDashboardClient from '@/components/lister-dashboard-client'

export default async function ListerDashboardPage() {
  const supabase = await createClient()

  const {
    data: claimsData,
    error: authError
  } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (authError || !userId) {
    redirect('/login')
  }

  if (process.env.DASHBOARD_READ_PROJECTIONS_ENABLED === 'true') {
    const { data, error: projectionError } = await supabase.rpc(
      'get_hosted_contests_dashboard'
    )

    if (!projectionError && data) {
      return <ListerDashboardClient contests={data} />
    }

    console.error('[ListerDashboard] Read projection failed:', projectionError?.message)
  }

  const { data: contests, error: queryError } = await supabase
    .from('contests')
    .select('*, profiles!lister_id(full_name, avatar_url), submissions(count), contest_entries(count)')
    .eq('lister_id', userId)
    .order('created_at', { ascending: false })

  if (queryError) {
    console.error('[ListerDashboard] Query failed:', queryError.message)
  }

  const contestList = (contests ?? []).map((contest) => ({
    ...contest,
    submission_count: contest.submissions?.[0]?.count ?? 0,
    entry_count: contest.contest_entries?.[0]?.count ?? 0,
    lister_name: contest.profiles?.full_name ?? null,
    lister_avatar: contest.profiles?.avatar_url ?? null,
  }))

  return (
    <ListerDashboardClient 
      contests={contestList} 
    />
  )
}
