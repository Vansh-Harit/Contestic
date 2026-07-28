import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitRatelimit } from '@/lib/ratelimit'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contestId } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Rate limiting (Upstash Redis)
  const { success, reset } = await submitRatelimit.limit(user.id)
  if (!success) {
    return Response.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      { status: 429 }
    )
  }

  // Fetch contest and verify ownership
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('id, lister_id, status, title')
    .eq('id', contestId)
    .single()

  if (contestError || !contest) {
    return Response.json({ error: 'Contest not found' }, { status: 404 })
  }

  if (contest.lister_id !== user.id) {
    return Response.json(
      { error: 'Only the contest owner can end the contest' },
      { status: 403 }
    )
  }

  if (contest.status !== 'active') {
    return Response.json(
      { error: 'Contest is not active' },
      { status: 400 }
    )
  }

  // Check submission count — cannot close with zero submissions
  const { count: submissionCount } = await supabase
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('contest_id', contestId)

  if (!submissionCount || submissionCount === 0) {
    return Response.json(
      { error: 'Cannot close a contest with no submissions' },
      { status: 400 }
    )
  }

  // Move to judging
  const { error: updateError } = await supabase
    .from('contests')
    .update({ status: 'judging', updated_at: new Date().toISOString() })
    .eq('id', contestId)

  if (updateError) {
    console.error('[EndContest] Update failed:', updateError)
    return Response.json({ error: 'Failed to update contest' }, { status: 500 })
  }

  // Notify all contestants
  const admin = createAdminClient()

  const { data: contestants } = await admin
    .from('submissions')
    .select('contestant_id')
    .eq('contest_id', contestId)

  if (contestants && contestants.length > 0) {
    const uniqueIds = [...new Set(contestants.map((s) => s.contestant_id))]

    const notifications = uniqueIds.map((contestantId) => ({
      user_id: contestantId,
      type: 'contest_ended',
      title: 'Contest ended early',
      message: `"${contest.title}" has ended early. A winner will be picked soon.`,
      contest_id: contestId,
    }))

    await admin.from('notifications').insert(notifications)
  }

  console.log('[EndContest] Contest moved to judging:', contestId)
  return Response.json({ message: 'Contest moved to judging phase' }, { status: 200 })
}
