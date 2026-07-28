import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_SUBMISSION_CHARS, MIN_SUBMISSION_CHARS } from '@/lib/constants'
import { sendEmail } from '@/lib/resend'
import { base, btn } from '@/lib/email-templates'
import { submitRatelimit } from '@/lib/ratelimit'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contestId } = await params

  // 1. Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2. Rate limiting (Upstash Redis — survives cold starts)
  const { success, reset } = await submitRatelimit.limit(user.id)
  if (!success) {
    return Response.json(
      {
        error: 'Too many submission attempts. Please wait before trying again.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      { status: 429 }
    )
  }

  // 2. Fetch contest
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('id, lister_id, status, deadline, max_entries, entry_deadline, entry_limit, title')
    .eq('id', contestId)
    .single()

  if (contestError || !contest) {
    return Response.json({ error: 'Contest not found' }, { status: 404 })
  }

  if (contest.status !== 'active') {
    return Response.json(
      { error: 'Contest is not accepting submissions' },
      { status: 400 }
    )
  }

  if (new Date(contest.deadline) < new Date()) {
    return Response.json(
      { error: 'Contest deadline has passed' },
      { status: 400 }
    )
  }

  // 3. Block lister from submitting to own contest
  if (contest.lister_id === user.id) {
    return Response.json(
      { error: 'Cannot submit to own contest' },
      { status: 403 }
    )
  }

  // 3b. Entry verification — if contest uses entry system, user must have entered
  if (contest.entry_deadline) {
    const { data: entry } = await supabase
      .from('contest_entries')
      .select('id')
      .eq('contest_id', contestId)
      .eq('contestant_id', user.id)
      .single()

    if (!entry) {
      return Response.json(
        {
          error: 'not_entered',
          message: 'You must enter this contest before submitting work.',
        },
        { status: 403 }
      )
    }
  }

  // 3c. Phase check — block submissions if entry period is still open
  const currentTime = new Date()
  const entryDeadline = contest.entry_deadline
    ? new Date(contest.entry_deadline)
    : null
  const isEntryPhase = entryDeadline && currentTime < entryDeadline

  const { count: entryCount } = await supabase
    .from('contest_entries')
    .select('*', { count: 'exact', head: true })
    .eq('contest_id', contestId)

  const effectiveLimit = contest.entry_limit ?? contest.max_entries
  const entryFull = (entryCount ?? 0) >= effectiveLimit

  if (isEntryPhase && !entryFull) {
    return Response.json(
      { error: 'Entry period is still open. Submission window has not started yet.' },
      { status: 400 }
    )
  }

  // 4. Duplicate check
  const { data: existingSub } = await supabase
    .from('submissions')
    .select('id')
    .eq('contest_id', contestId)
    .eq('contestant_id', user.id)
    .single()

  if (existingSub) {
    return Response.json(
      { error: 'You have already submitted to this contest' },
      { status: 409 }
    )
  }

  // 5. Entry limit check
  const { count: totalSubmissions } = await supabase
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('contest_id', contestId)

  if (totalSubmissions !== null && totalSubmissions >= contest.max_entries) {
    return Response.json(
      { error: 'This contest has reached its entry limit' },
      { status: 400 }
    )
  }

  // 6. Validate content
  let body: { content?: string; file_urls?: any[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const file_urls = body.file_urls ?? []

  if (content.length < MIN_SUBMISSION_CHARS) {
    return Response.json(
      { error: `Submission must be at least ${MIN_SUBMISSION_CHARS} characters. Currently ${content.length}.` },
      { status: 400 }
    )
  }

  if (content.length > MAX_SUBMISSION_CHARS) {
    return Response.json(
      { error: `Submission must be under ${MAX_SUBMISSION_CHARS} characters. Currently ${content.length}.` },
      { status: 400 }
    )
  }

  // 6b. Validate file_urls
  if (!Array.isArray(file_urls)) {
    return Response.json({ error: 'Invalid file data' }, { status: 400 })
  }
  if (file_urls.length > 10) {
    return Response.json(
      { error: 'Maximum 10 attachments per submission' },
      { status: 400 }
    )
  }
  const totalUploadBytes = file_urls
    .filter((f: any) => f.type === 'upload')
    .reduce((sum: number, f: any) => sum + (f.size_bytes ?? 0), 0)
  if (totalUploadBytes > 20 * 1024 * 1024) {
    return Response.json(
      { error: 'Total file size exceeds 20MB limit' },
      { status: 400 }
    )
  }

  // 7. Insert submission
  const { data: submission, error: insertError } = await supabase
    .from('submissions')
    .insert({
      contest_id: contestId,
      contestant_id: user.id,
      content,
      file_urls,
    })
    .select('id')
    .single()

  if (insertError || !submission) {
    console.error('[Submit] Insert failed:', insertError)
    return Response.json({ error: 'Failed to create submission' }, { status: 500 })
  }

  const admin = createAdminClient()

  // 8. Notification debounce — only notify lister if no notification of type
  //    'new_submission' for this contest was created in the last 60 minutes
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recentNotif } = await admin
    .from('notifications')
    .select('id')
    .eq('user_id', contest.lister_id)
    .eq('type', 'new_submission')
    .eq('contest_id', contestId)
    .gt('created_at', sixtyMinutesAgo)
    .limit(1)
    .single()

  if (!recentNotif) {
    await admin.from('notifications').insert({
      user_id: contest.lister_id,
      type: 'new_submission',
      title: 'New submission received',
      message: `Your contest received a new entry.`,
      contest_id: contestId,
    })

    // Fire-and-forget email to lister
    const { data: lister } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', contest.lister_id)
      .single()

    if (lister?.email) {
      const submissionCount = (totalSubmissions ?? 0) + 1
      void sendEmail(
        lister.email,
        `New submission on "${contest.title}"`,
        base(`
          <p style="color:#374151;font-size:15px;line-height:1.6;">Hi ${lister.full_name ?? 'there'},</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;">
            A new submission has been received for 
            <strong>"${contest.title}"</strong>.
          </p>
          <p style="color:#374151;font-size:15px;line-height:1.6;">
            Total submissions so far: <strong>${submissionCount}</strong> 
            / ${contest.max_entries}
          </p>
          ${btn('Review Submissions',
            process.env.NEXT_PUBLIC_APP_URL + 
            '/dashboard/lister/contest/' + contestId
          )}
        `)
      )
    }
  }

  // 9. Auto-move to judging if contest is now full
  const currentCount = (totalSubmissions ?? 0) + 1
  if (currentCount >= contest.max_entries) {
    await admin
      .from('contests')
      .update({ status: 'judging', updated_at: new Date().toISOString() })
      .eq('id', contestId)

    await admin.from('notifications').insert({
      user_id: contest.lister_id,
      type: 'contest_full',
      title: 'Contest is full',
      message: 'Your contest has reached its entry limit. Pick a winner!',
      contest_id: contestId,
    })
  }

  // 10. Return created submission
  return Response.json({ submission_id: submission.id }, { status: 201 })
}
