import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import SubmissionReviewClient from '@/components/submission-review-client'
import { getContestPhase } from '@/lib/utils'

export default async function ListerContestDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch contest with counts
  const { data: contest, error: contestError } = await supabase
    .from('contests_with_counts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (contestError || !contest) {
    return notFound()
  }

  if (contest.lister_id !== user.id) {
    return notFound()
  }

  const phase = getContestPhase(contest)

  // Fetch submissions with contestant profile info
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('*, profiles:contestant_id(full_name, avatar_url, email)')
    .eq('contest_id', params.id)
    .order('submitted_at', { ascending: true })

  if (subError) {
    console.error('Failed to fetch submissions', subError)
  }

  let entrants: any[] = []
  let unreadCounts: Record<string, number> = {}

  // Fetch entrants
  const { data: entryData, error: entryError } = await supabase
    .from('contest_entries')
    .select('contestant_id, entered_at, profiles:contestant_id(full_name, avatar_url)')
    .eq('contest_id', params.id)
    .order('entered_at', { ascending: true })

  if (!entryError && entryData) {
    entrants = entryData
  }

  // Fetch unread message counts for this lister regarding this contest
  const { data: messagesData } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('recipient_id', user.id)
    .is('read_at', null)
    .like('conversation_id', `%${params.id}%`)

  if (messagesData) {
    messagesData.forEach((msg) => {
      unreadCounts[msg.sender_id] = (unreadCounts[msg.sender_id] || 0) + 1
    })
  }

  // Also fetch full submissions data
  const { data: fullSubmissions } = await supabase
    .from('submissions')
    .select(`
      id,
      contestant_id,
      status,
      content,
      submitted_at,
      profiles(full_name, avatar_url)
    `)
    .eq('contest_id', params.id)
    .order('submitted_at', { ascending: false })

  return (
    <SubmissionReviewClient 
      contest={contest} 
      submissions={submissions || []}
      userId={user.id}
      entrants={entrants}
      initialUnreadCounts={unreadCounts}
    />
  )
}
