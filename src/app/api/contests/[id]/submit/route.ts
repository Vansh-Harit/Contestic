import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_SUBMISSION_CHARS, MIN_SUBMISSION_CHARS } from '@/lib/constants'
import { deliverPendingEmails, enqueueEmail } from '@/lib/email-delivery'
import { submitRatelimit } from '@/lib/ratelimit'
import { normalizeSubmissionAttachments } from '@/lib/submission-files'
import { createNotificationEvent } from '@/lib/notification-service'

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

  const admin = createAdminClient()

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
  const { data: contest, error: contestError } = await admin
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

  const { count: entryCount } = await admin
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
  const { count: totalSubmissions } = await admin
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
  let body: { content?: unknown; file_urls?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  let fileUrls
  try {
    fileUrls = normalizeSubmissionAttachments(
      contestId,
      user.id,
      body.file_urls ?? []
    )
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Invalid file data',
      },
      { status: 400 }
    )
  }

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

  // 7. Insert through the service-only database function. The function locks
  // the contest row and repeats stage, ownership, entry, capacity and duplicate
  // checks so concurrent requests cannot bypass the route preflight.
  let { data: submissionId, error: insertError } = await admin.rpc(
    'create_submission_authorized',
    {
      p_contest_id: contestId,
      p_contestant_id: user.id,
      p_content: content,
      p_file_urls: fileUrls,
    }
  )

  const rpcMissing =
    insertError?.code === 'PGRST202' ||
    insertError?.message?.includes('schema cache')

  // Development-only bridge while the coordinated migration awaits approval.
  // Production must use the contest-locking function.
  if (
    process.env.NODE_ENV !== 'production' &&
    rpcMissing
  ) {
    const fallback = await admin
      .from('submissions')
      .insert({
        contest_id: contestId,
        contestant_id: user.id,
        content,
        file_urls: fileUrls,
      })
      .select('id')
      .single()

    submissionId = fallback.data?.id ?? null
    insertError = fallback.error
  }

  if (insertError || !submissionId) {
    if (insertError?.message?.includes('duplicate_submission')) {
      return Response.json(
        { error: 'You have already submitted to this contest' },
        { status: 409 }
      )
    }
    if (
      insertError?.message?.includes('submission_not_open') ||
      insertError?.message?.includes('submission_capacity_reached')
    ) {
      return Response.json(
        { error: 'Contest is not accepting submissions' },
        { status: 400 }
      )
    }
    console.error('[Submit] Insert failed:', insertError)
    return Response.json({ error: 'Failed to create submission' }, { status: 500 })
  }

  // 8. Group creator updates into one stable UTC-hour event. A concurrent
  // submission cannot create a duplicate notification for the same hour.
  const hourBucket = new Date().toISOString().slice(0, 13)
  let notificationCreated = false
  try {
    notificationCreated = await createNotificationEvent({
      userId: contest.lister_id,
      type: 'new_submission',
      title: 'New submission received',
      message: `A new submission is ready to review for "${contest.title}".`,
      contestId,
      eventKey: `new-submission/${contestId}/${hourBucket}`,
    })
  } catch {
    console.error('[Submit] Creator notification failed')
  }

  if (notificationCreated) {

    // Queue one creator summary per hour. Delivery retries independently.
    const { data: lister } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', contest.lister_id)
      .single()

    if (lister?.email) {
      const submissionCount = (totalSubmissions ?? 0) + 1
      await enqueueEmail({
        idempotencyKey: `new-submission/${contestId}/${hourBucket}`,
        eventType: 'new_submission',
        contestId,
        userId: contest.lister_id,
        to: lister.email,
        payload: {
          listerName: lister.full_name ?? 'there',
          contestTitle: contest.title,
          submissionCount,
          maxSubmissions: contest.max_entries,
          reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/lister/contest/${contestId}`,
        },
      })
      await deliverPendingEmails(10)
    }
  }

  // The submission deadline is fixed. Receiving every expected submission
  // does not move the contest to judging early.

  // 9. Return created submission
  return Response.json({ submission_id: submissionId }, { status: 201 })
}
