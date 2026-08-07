import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getContestPhase } from '@/lib/utils'
import { canViewPrivateContestContent } from '@/lib/authorization'
import type { VisibleContest } from '@/lib/types'
import ContestDetailClient from '@/components/contest-detail-client'
import type { ContestMaterial } from '@/components/contest-detail-client'

export const dynamic = 'force-dynamic'

export default async function ContestDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()

  const [contestResult, authResult] = await Promise.all([
    supabase
      .rpc('get_visible_contests', { p_contest_id: params.id })
      .single(),
    supabase.auth.getClaims(),
  ])

  const contestData = contestResult.data

  const contest = contestData as VisibleContest | null

  if (!contest || contest.status === 'draft') return notFound()

  const userId = authResult.data?.claims?.sub
  const user = userId ? { id: userId } : null
  const admin = createAdminClient()

  let hasSubmitted = false
  let hasEntered = false
  if (user) {
    const [submissionResult, entryResult] = await Promise.all([
      supabase
        .from('submissions')
        .select('id')
        .eq('contest_id', params.id)
        .eq('contestant_id', user.id)
        .maybeSingle(),
      supabase
        .from('contest_entries')
        .select('id')
        .eq('contest_id', params.id)
        .eq('contestant_id', user.id)
        .maybeSingle(),
    ])
    hasSubmitted = !!submissionResult.data
    hasEntered = !!entryResult.data
  }

  // Determine contest phase
  const phase = getContestPhase(contest)

  // Fetch materials ONLY if user has entered AND entry phase is over
  const canSeeMaterials = !!user && canViewPrivateContestContent({
    isCreator: contest.lister_id === user.id,
    hasEntered,
    stage: phase === 'entry_closed' ? 'submission_open' : phase,
  })
  const [materialsResult, unreadResult] = await Promise.all([
    canSeeMaterials
      ? admin
          .from('contest_materials')
          .select('id, type, label, content')
          .eq('contest_id', params.id)
          .order('display_order', { ascending: true })
      : Promise.resolve({ data: [] }),
    user && hasEntered
      ? supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('contest_id', params.id)
          .eq('recipient_id', user.id)
          .is('read_at', null)
      : Promise.resolve({ count: 0 }),
  ])

  const materials = (materialsResult.data ?? []) as ContestMaterial[]
  const unreadCount = unreadResult.count ?? 0

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
