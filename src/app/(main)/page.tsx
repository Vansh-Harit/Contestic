import { createClient } from '@/lib/supabase/server'
import BrowseClient from '@/components/browse-client'

export const dynamic = 'force-dynamic'

export default async function BrowseContestsPage() {
  const supabase = await createClient()

  const { data: contests, error } = await supabase
    .rpc('get_visible_contests')
    .in('status', ['active', 'judging'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Browse fetch error:', error)
  }

  const { data: { user } } = await supabase.auth.getUser()
  const contestList = contests ?? []

  return <BrowseClient initialContests={contestList} user={user} />
}
