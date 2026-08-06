import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import SubmissionReviewClient from '@/components/submission-review-client'
import type { ReviewEntrant } from '@/components/submission-review-client'
import { authorizeStoredAttachments } from '@/lib/submission-files'

type JoinedProfile = {
  full_name: string | null
  avatar_url: string | null
  email?: string | null
}

function normalizeJoinedProfile(
  profile: JoinedProfile | JoinedProfile[] | null | undefined
): JoinedProfile | null {
  return Array.isArray(profile) ? profile[0] ?? null : profile ?? null
}

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

  const { data: contestRow, error: contestError } = await supabase
    .from('contests')
    .select('*, profiles!lister_id(full_name, avatar_url), submissions(count), contest_entries(count)')
    .eq('id', params.id)
    .single()

  if (contestError || !contestRow) {
    return notFound()
  }

  const contest = {
    ...contestRow,
    submission_count: contestRow.submissions?.[0]?.count ?? 0,
    entry_count: contestRow.contest_entries?.[0]?.count ?? 0,
    lister_name: contestRow.profiles?.full_name ?? null,
    lister_avatar: contestRow.profiles?.avatar_url ?? null,
  }

  if (contest.lister_id !== user.id) {
    return notFound()
  }

  const admin = createAdminClient()
  const accessHasEnded =
    contest.status === 'completed' || contest.status === 'cancelled'

  // Never send completed-contest descriptions, uploads, or external links to
  // the browser. The rows remain in the database for the approved record.
  const { data: submissions, error: subError } = accessHasEnded
    ? { data: [], error: null }
    : await admin
        .from('submissions')
        .select('*, profiles:contestant_id(full_name, avatar_url, email)')
        .eq('contest_id', params.id)
        .order('submitted_at', { ascending: true })

  if (subError) {
    console.error('Failed to fetch submissions', subError)
  }

  let entrants: ReviewEntrant[] = []
  const unreadCounts: Record<string, number> = {}

  // Fetch entrants
  const { data: entryData, error: entryError } = await admin
    .from('contest_entries')
    .select('contestant_id, entered_at, profiles:contestant_id(full_name, avatar_url)')
    .eq('contest_id', params.id)
    .order('entered_at', { ascending: true })

  if (!entryError && entryData) {
    entrants = entryData.map((entry) => ({
      contestant_id: entry.contestant_id,
      profiles: normalizeJoinedProfile(entry.profiles),
    }))
  }

  // Fetch unread message counts for this lister regarding this contest
  const { data: messagesData } = accessHasEnded
    ? { data: [] }
    : await admin
        .from('messages')
        .select('sender_id')
        .eq('recipient_id', user.id)
        .is('read_at', null)
        .eq('contest_id', params.id)

  if (messagesData) {
    messagesData.forEach((msg) => {
      unreadCounts[msg.sender_id] = (unreadCounts[msg.sender_id] || 0) + 1
    })
  }

  // Also fetch full submissions data
  const authorizedSubmissions = (submissions ?? []).map((submission) => ({
    ...submission,
    profiles: normalizeJoinedProfile(submission.profiles),
    file_urls: authorizeStoredAttachments(
      params.id,
      submission.file_urls
    ),
  }))

  return (
    <SubmissionReviewClient 
      contest={contest} 
      submissions={authorizedSubmissions}
      userId={user.id}
      entrants={entrants}
      initialUnreadCounts={unreadCounts}
    />
  )
}
