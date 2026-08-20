import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { enterRatelimit } from '@/lib/ratelimit'
import { evaluateContestEntry } from '@/lib/contest-entry'
import {
  deliverPendingEmails,
  enqueueEmail,
} from '@/lib/email-delivery'
import {
  createNotificationEvent,
  createNotificationEvents,
} from '@/lib/notification-service'

type JoinedEntryProfile = {
  email: string | null
  full_name: string | null
}

function normalizeEntryProfile(
  value: JoinedEntryProfile | JoinedEntryProfile[] | null | undefined
): JoinedEntryProfile | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Rate limiting (Upstash Redis)
  const { success, reset } = await enterRatelimit.limit(user.id)
  if (!success) {
    return NextResponse.json(
      {
        error: 'Too many entry attempts. Please wait before trying again.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      { status: 429 }
    )
  }

  // Fetch contest (include title for notification messages)
  const { data: contest, error: contestError } = await admin
    .from('contests')
    .select('id, lister_id, status, entry_deadline, entry_limit, max_entries, title, deadline')
    .eq('id', params.id)
    .single()

  if (contestError || !contest) {
    return NextResponse.json({ error: 'Contest not found' }, { status: 404 })
  }

  // Check entry capacity
  const { count: entryCount, error: entryCountError } = await admin
    .from('contest_entries')
    .select('*', { count: 'exact', head: true })
    .eq('contest_id', params.id)

  if (entryCountError || entryCount === null) {
    console.error('Entry count failed:', entryCountError)
    return NextResponse.json({ error: 'Failed to check contest capacity' }, { status: 500 })
  }

  const effectiveLimit = contest.entry_limit ?? contest.max_entries
  // Check if already entered
  const { data: existing, error: existingError } = await supabase
    .from('contest_entries')
    .select('id')
    .eq('contest_id', params.id)
    .eq('contestant_id', user.id)
    .maybeSingle()

  if (existingError) {
    console.error('Entry lookup failed:', existingError)
    return NextResponse.json({ error: 'Failed to check contest entry' }, { status: 500 })
  }

  const decision = evaluateContestEntry({
    userId: user.id,
    listerId: contest.lister_id,
    status: contest.status,
    entryDeadline: contest.entry_deadline,
    entryCount,
    effectiveLimit,
    alreadyEntered: !!existing,
    now: new Date(),
  })

  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.error },
      { status: decision.status }
    )
  }

  // Repeat the critical checks under a contest-row lock so concurrent entry
  // requests cannot overfill the contest.
  let { data: entryId, error: insertError } = await admin.rpc(
    'enter_contest_authorized',
    {
      p_contest_id: params.id,
      p_contestant_id: user.id,
    }
  )

  const rpcMissing =
    insertError?.code === 'PGRST202' ||
    insertError?.message?.includes('schema cache')

  // Keep the local development flow usable before the coordinated migration
  // is approved. Production never falls back from the atomic function.
  if (
    process.env.NODE_ENV !== 'production' &&
    rpcMissing
  ) {
    const fallback = await admin
      .from('contest_entries')
      .insert({
        contest_id: params.id,
        contestant_id: user.id,
      })
      .select('id')
      .single()

    entryId = fallback.data?.id ?? null
    insertError = fallback.error
  }

  if (insertError || !entryId) {
    if (
      insertError?.code === '23505' ||
      insertError?.message?.includes('duplicate_entry')
    ) {
      return NextResponse.json(
        { error: 'You have already entered this contest' },
        { status: 409 }
      )
    }
    if (
      insertError?.message?.includes('entry_not_open') ||
      insertError?.message?.includes('entry_capacity_reached')
    ) {
      return NextResponse.json(
        { error: 'Entry period has closed for this contest' },
        { status: 400 }
      )
    }
    if (insertError?.message?.includes('creator_cannot_enter')) {
      return NextResponse.json(
        { error: 'You cannot enter your own contest' },
        { status: 403 }
      )
    }
    console.error('Entry insert failed:', insertError)
    return NextResponse.json({ error: 'Failed to enter contest' }, { status: 500 })
  }

  const { data: contestantProfile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single()

  if (contestantProfile?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    await enqueueEmail({
      idempotencyKey: `entry-confirmed/${params.id}/${user.id}`,
      eventType: 'entry_confirmed',
      contestId: params.id,
      userId: user.id,
      to: contestantProfile.email,
      payload: {
        participantName: contestantProfile.full_name ?? 'there',
        contestTitle: contest.title,
        entryClosesAt: contest.entry_deadline
          ? formatDateTime(contest.entry_deadline)
          : 'the announced entry cutoff',
        submissionDeadline: formatDateTime(contest.deadline),
        contestUrl: `${appUrl}/contest/${params.id}`,
      },
    })
  }

  const currentCount = entryCount + 1

  // Check if this entry just filled the contest → notify lister
  if (currentCount >= effectiveLimit) {
    try {
      await createNotificationEvent({
        userId: contest.lister_id,
        type: 'contest_full',
        title: 'Your contest is full!',
        message: `All ${effectiveLimit} spots are taken for "${contest.title}". The submission window is now open for participants.`,
        contestId: params.id,
        eventKey: `contest-full/${params.id}/${contest.lister_id}`,
      })
    } catch {
      console.error('[Entry] Contest-full notification failed')
    }

    const { data: allEntries } = await admin
      .from('contest_entries')
      .select('contestant_id, profiles(email, full_name)')
      .eq('contest_id', params.id)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    try {
      await createNotificationEvents((allEntries ?? []).map((entry) => ({
        userId: entry.contestant_id,
        type: 'entry_closed',
        title: 'Submission window open',
        message: `Entry for "${contest.title}" has closed. The full brief and materials are now available.`,
        contestId: params.id,
        eventKey: `submission-open/${params.id}/${entry.contestant_id}`,
      })))
    } catch {
      console.error('[Entry] Submission-open notifications failed')
    }

    for (const entry of allEntries ?? []) {
      const profile = normalizeEntryProfile(entry.profiles)
      if (!profile?.email) continue
      await enqueueEmail({
        idempotencyKey: `submission-open/${params.id}/${entry.contestant_id}`,
        eventType: 'submission_open',
        contestId: params.id,
        userId: entry.contestant_id,
        to: profile.email,
        payload: {
          participantName: profile.full_name ?? 'there',
          contestTitle: contest.title,
          totalSlots: effectiveLimit,
          entryCount: effectiveLimit,
          openedEarly: 'true',
          contestUrl: `${appUrl}/contest/${params.id}`,
          submissionDeadline: formatDateTime(contest.deadline),
        },
      })
    }
    await deliverPendingEmails(25)
  }

  await deliverPendingEmails(10)

  return NextResponse.json(
    {
      entry_id: entryId,
      message:
        'You are entered. Entry is final. Full brief and materials will be revealed when the entry period closes.',
    },
    { status: 201 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Contest entry is final and cannot be withdrawn' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
