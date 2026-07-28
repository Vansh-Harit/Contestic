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
    .from('contests_with_counts')
    .select('*')
    .eq('lister_id', user.id)
    .order('created_at', { ascending: false })

  if (queryError) {
    console.error('[ListerDashboard] Query failed:', queryError.message)
  }

  const contestList = contests ?? []

  console.log('[ListerDashboard] User:', user.id, '| Contests:', contestList.length)

  return (
    <ListerDashboardClient 
      contests={contestList} 
      userId={user.id} 
    />
  )
}
