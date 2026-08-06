import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ContestantDashboardClient from '@/components/contestant-dashboard-client'
import type {
  DashboardContest,
  DashboardSubmission,
} from '@/components/contestant-dashboard-client'
import { getContestPhase } from '@/lib/utils'

export default async function ContestantDashboardPage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')
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
    .eq('contestant_id', user.id)
    .order('entered_at', { ascending: false })

  if (error) console.error('[ContestantDashboard] Entries error:', error.message)

  const contestIds = (entries ?? [])
    .map(e => e.contest_id)
    .filter(Boolean)

  // Fetch submissions for all entered contests
  let submissions: DashboardSubmission[] = []
  if (contestIds.length > 0) {
    const { data: subs } = await admin
      .from('submissions')
      .select('id, contest_id, status, content, submitted_at')
      .eq('contestant_id', user.id)
      .in('contest_id', contestIds)
    submissions = subs ?? []
  }

  // Fetch payout requests for won contests
  const { data: payouts } = await admin
    .from('payout_requests')
    .select('contest_id, status, winner_upi, amount, transferred_at')
    .eq('winner_id', user.id)
  const payoutRequests = payouts ?? []

  // Fetch unread messages for the contestant
  const unreadCounts: Record<string, number> = {}
  if (contestIds.length > 0) {
    const { data: messagesData } = await admin
      .from('messages')
      .select('conversation_id')
      .eq('recipient_id', user.id)
      .is('read_at', null)

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

  const { data: wonSubmissions } = await admin
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
    .eq('contestant_id', user.id)
    .eq('status', 'winner')

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
      userId={user.id}
      initialUnreadCounts={unreadCounts}
    />
  )
}
