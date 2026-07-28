import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContestPhase } from '@/lib/utils'
import ContestDetailClient from '@/components/contest-detail-client'

export const dynamic = 'force-dynamic'

export default async function ContestDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()

  const { data: contest } = await supabase
    .from('contests_with_counts')
    .select('*, profiles(full_name, avatar_url)')
    .eq('id', params.id)
    .single()

  if (!contest || contest.status === 'draft') return notFound()

  const { data: { user } } = await supabase.auth.getUser()

  let hasSubmitted = false
  if (user) {
    const { data } = await supabase
      .from('submissions')
      .select('id')
      .eq('contest_id', params.id)
      .eq('contestant_id', user.id)
      .single()
    hasSubmitted = !!data
  }

  // Check if current user has entered this contest
  let hasEntered = false
  if (user) {
    const { data: entry } = await supabase
      .from('contest_entries')
      .select('id')
      .eq('contest_id', params.id)
      .eq('contestant_id', user.id)
      .single()
    hasEntered = !!entry
  }

  // Determine contest phase
  const phase = getContestPhase(contest)

  // Fetch materials ONLY if user has entered AND entry phase is over
  const canSeeMaterials = hasEntered && phase !== 'entry_open'
  let materials: any[] = []
  if (canSeeMaterials) {
    const { data } = await supabase
      .from('contest_materials')
      .select('*')
      .eq('contest_id', params.id)
      .order('display_order', { ascending: true })
    materials = data ?? []
  }

  // Fetch unread messages
  let unreadCount = 0
  if (user && hasEntered) {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('contest_id', params.id)
      .eq('recipient_id', user.id)
      .eq('read', false)
    unreadCount = count ?? 0
  }

  return (
    <ContestDetailClient
      contest={contest}
      user={user}
      hasSubmitted={hasSubmitted}
      hasEntered={hasEntered}
      phase={phase}
      canSeeMaterials={canSeeMaterials}
      materials={materials}
      initialUnreadCount={unreadCount}
    />
  )
}
