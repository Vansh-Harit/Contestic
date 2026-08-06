import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ListerDashboardClient from '@/components/lister-dashboard-client'

export default async function ListerDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: contests, error: queryError } = await supabase
    .from('contests')
    .select('*, profiles!lister_id(full_name, avatar_url), submissions(count), contest_entries(count)')
    .eq('lister_id', user.id)
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

  console.log('[ListerDashboard] User:', user.id, '| Contests:', contestList.length)

  return (
    <ListerDashboardClient 
      contests={contestList} 
    />
  )
}
