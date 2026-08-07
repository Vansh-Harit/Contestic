import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ContestantDashboardClient from '@/components/contestant-dashboard-client'
import type {
  DashboardContest,
  DashboardSubmission,
} from '@/components/contestant-dashboard-client'
import { getContestPhase } from '@/lib/utils'

type DashboardProjectionRow = {
  entry_id: string
  entered_at: string
  contest_id: string
  lister_id: string
  title: string
  category: string
  prize_amount: number
  contest_status: DashboardContest['status']
  deadline: string
  entry_deadline: string | null
  entry_limit: number | null
  max_entries: number
  public_summary: string | null
  winner_submission_id: string | null
  lister_name: string | null
  lister_avatar: string | null
  submission_id: string | null
  submission_status: string | null
  payout_status: string | null
  payout_amount: number | null
  payout_transferred_at: string | null
  unread_count: number
}

export default async function ContestantDashboardPage() {
  const supabase = await createClient()

  const { data: claimsData, error: authError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (authError || !userId) redirect('/login')

  // This gate keeps deploys compatible while the additive migration is still
  // awaiting approval. When enabled, the dashboard needs one scoped read
  // instead of several service-role round trips.
  if (process.env.DASHBOARD_READ_PROJECTIONS_ENABLED === 'true') {
    const { data, error: projectionError } = await supabase.rpc(
      'get_my_contests_dashboard'
    )

    if (!projectionError && data) {
      const rows = data as DashboardProjectionRow[]
      const unreadCounts: Record<string, number> = {}
      const contestsWithStatus = rows.map((row) => {
        const contest: DashboardContest = {
          id: row.contest_id,
          lister_id: row.lister_id,
          title: row.title,
          category: row.category,
          prize_amount: row.prize_amount,
          status: row.contest_status,
          deadline: row.deadline,
          entry_deadline: row.entry_deadline,
          entry_limit: row.entry_limit,
          max_entries: row.max_entries,
          profiles: {
            full_name: row.lister_name,
            avatar_url: row.lister_avatar,
          },
        }
        const submission: DashboardSubmission | null = row.submission_id
          ? {
              id: row.submission_id,
              contest_id: row.contest_id,
              status: row.submission_status ?? 'submitted',
            }
          : null

        unreadCounts[row.contest_id] = Number(row.unread_count ?? 0)
        return {
          entryId: row.entry_id,
          enteredAt: row.entered_at,
          contest,
          phase: getContestPhase({ ...contest, entry_count: 0 }),
          submission,
          payout: row.payout_status ? { status: row.payout_status } : null,
        }
      })

      return (
        <ContestantDashboardClient
          contestsWithStatus={contestsWithStatus}
          stats={{
            totalEntered: contestsWithStatus.length,
            totalSubmitted: contestsWithStatus.filter((item) => item.submission).length,
            totalWon: contestsWithStatus.filter((item) => item.submission?.status === 'winner').length,
            totalEarned: rows
              .filter((row) => row.payout_status === 'transferred')
              .reduce((sum, row) => sum + (row.payout_amount ?? 0), 0),
          }}
          userId={userId}
          initialUnreadCounts={unreadCounts}
        />
      )
    }

    console.error('[ContestantDashboard] Read projection failed:', projectionError?.message)
  }

  const admin = createAdminClient()

  // Fetch all contests the user has entered with submission status
  const { data: entries, error } = await admin
    .from('contest_entries')
    .select(`
      id,
      entered_at,
      contest_id,
      contests (
        id,
        lister_id,
        title,
        category,
        prize_amount,
        status,
        deadline,
        entry_deadline,
        entry_limit,
        max_entries,
        public_summary,
        winner_submission_id,
        profiles(full_name, avatar_url)
      )
    `)
    .eq('contestant_id', userId)
    .order('entered_at', { ascending: false })

  if (error) console.error('[ContestantDashboard] Entries error:', error.message)

  const contestIds = (entries ?? [])
    .map(e => e.contest_id)
    .filter(Boolean)

  const submissionsPromise = contestIds.length > 0
    ? admin
      .from('submissions')
      .select('id, contest_id, status, content, submitted_at')
      .eq('contestant_id', userId)
      .in('contest_id', contestIds)
    : Promise.resolve({ data: [] as DashboardSubmission[] })

  const payoutsPromise = admin
    .from('payout_requests')
    .select('contest_id, status, winner_upi, amount, transferred_at')
    .eq('winner_id', userId)

  const messagesPromise = contestIds.length > 0
    ? admin
      .from('messages')
      .select('conversation_id')
      .eq('recipient_id', userId)
      .is('read_at', null)
    : Promise.resolve({ data: [] as Array<{ conversation_id: string }> })

  const wonSubmissionsPromise = admin
    .from('submissions')
    .select(`
      id,
      contest_id,
      contestant_id,
      status,
      submitted_at,
      contests (
        id,
        title,
        category,
        prize_amount,
        status,
        deadline,
        entry_deadline,
        entry_limit,
        max_entries,
        public_summary,
        winner_submission_id,
        profiles(full_name, avatar_url)
      )
    `)
    .eq('contestant_id', userId)
    .eq('status', 'winner')

  const [submissionsResult, payoutsResult, messagesResult, wonSubmissionsResult] = await Promise.all([
    submissionsPromise,
    payoutsPromise,
    messagesPromise,
    wonSubmissionsPromise,
  ])

  const submissions = submissionsResult.data ?? []
  const payoutRequests = payoutsResult.data ?? []

  // Build unread counts after the independent reads finish together.
  const unreadCounts: Record<string, number> = {}
  const messagesData = messagesResult.data

  if (messagesData) {
    messagesData.forEach((msg) => {
      for (const cid of contestIds) {
        if (msg.conversation_id.includes(cid)) {
          unreadCounts[cid] = (unreadCounts[cid] || 0) + 1
          break
        }
      }
    })
  }

  // Build a combined data structure
  const existingContestsWithStatus = (entries ?? []).map(entry => {
    const contest = entry.contests as unknown as DashboardContest
    const submission = submissions.find(s => s.contest_id === entry.contest_id)
    const payout = payoutRequests.find(p => p.contest_id === entry.contest_id)
    const phase = getContestPhase({
      ...contest,
      entry_count: 0 // not needed for phase calc here
    })

    return {
      entryId: entry.id,
      enteredAt: entry.entered_at,
      contest,
      phase,
      submission: submission ?? null,
      payout: payout ?? null,
    }
  })

  const wonSubmissions = wonSubmissionsResult.data

  const enteredContestIds = new Set(
    (entries ?? []).map(e => e.contest_id)
  )

  const wonNotInEntries = (wonSubmissions ?? [])
    .filter(s => !enteredContestIds.has(s.contest_id))
    .map(s => {
      const contest = s.contests as unknown as DashboardContest
      const payout = payoutRequests.find(
        p => p.contest_id === s.contest_id
      )
      return {
        entryId: s.id,
        enteredAt: s.submitted_at,
        contest,
        phase: 'completed' as const,
        submission: s,
        payout: payout ?? null,
      }
    })

  const contestsWithStatus = [
    ...existingContestsWithStatus,
    ...wonNotInEntries
  ]

  // Compute stats
  const totalEntered = contestsWithStatus.length
  const totalSubmitted = contestsWithStatus.filter(c => c.submission).length
  const totalWon = contestsWithStatus.filter(
    c => c.submission?.status === 'winner'
  ).length
  const totalEarned = payoutRequests
    .filter(p => p.status === 'transferred')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)

  return (
    <ContestantDashboardClient
      contestsWithStatus={contestsWithStatus}
      stats={{ totalEntered, totalSubmitted, totalWon, totalEarned }}
      userId={userId}
      initialUnreadCounts={unreadCounts}
    />
  )
}
