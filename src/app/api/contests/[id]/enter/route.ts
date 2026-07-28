import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { enterRatelimit } from '@/lib/ratelimit'

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
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('id, lister_id, status, entry_deadline, entry_limit, max_entries, title')
    .eq('id', params.id)
    .single()

  if (contestError || !contest) {
    return NextResponse.json({ error: 'Contest not found' }, { status: 404 })
  }

  if (contest.status !== 'active') {
    return NextResponse.json({ error: 'Contest is not active' }, { status: 400 })
  }

  // Block lister from entering own contest
  if (contest.lister_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot enter your own contest' },
      { status: 403 }
    )
  }

  // Check entry deadline
  const now = new Date()
  const entryDeadlinePassed = contest.entry_deadline
    ? now > new Date(contest.entry_deadline)
    : false

  // Check entry capacity
  const { count: entryCount } = await supabase
    .from('contest_entries')
    .select('*', { count: 'exact', head: true })
    .eq('contest_id', params.id)

  const effectiveLimit = contest.entry_limit ?? contest.max_entries
  const entryFull = (entryCount ?? 0) >= effectiveLimit

  if (entryDeadlinePassed || entryFull) {
    return NextResponse.json(
      { error: 'Entry period has closed for this contest' },
      { status: 400 }
    )
  }

  // Check if already entered
  const { data: existing } = await supabase
    .from('contest_entries')
    .select('id')
    .eq('contest_id', params.id)
    .eq('contestant_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'You have already entered this contest' },
      { status: 409 }
    )
  }

  // Insert entry
  const { data: entry, error: insertError } = await supabase
    .from('contest_entries')
    .insert({
      contest_id: params.id,
      contestant_id: user.id,
    })
    .select('id')
    .single()

  if (insertError || !entry) {
    console.error('Entry insert failed:', insertError)
    return NextResponse.json({ error: 'Failed to enter contest' }, { status: 500 })
  }

  const admin = createAdminClient()
  const currentCount = (entryCount ?? 0) + 1

  // Check if this entry just filled the contest → notify lister
  if (currentCount >= effectiveLimit) {
    await admin.from('notifications').insert({
      user_id: contest.lister_id,
      type: 'contest_full',
      title: 'Your contest is full!',
      message: `All ${effectiveLimit} spots taken for "${contest.title}". Submission window is now open for participants.`,
      contest_id: params.id,
    })
  } else {
    // Debounced new_entry notification (60-min window)
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentNotif } = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', contest.lister_id)
      .eq('type', 'new_entry')
      .eq('contest_id', params.id)
      .gt('created_at', sixtyMinutesAgo)
      .limit(1)
      .single()

    if (!recentNotif) {
      await admin.from('notifications').insert({
        user_id: contest.lister_id,
        type: 'new_entry',
        title: 'New participant!',
        message: `Someone entered "${contest.title}"`,
        contest_id: params.id,
      })
    }
  }

  return NextResponse.json(
    {
      entry_id: entry.id,
      message:
        'You are entered! Full brief and materials will be revealed when the entry period closes.',
    },
    { status: 201 }
  )
}

export async function DELETE(
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

  // Fetch contest
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('id, status, entry_deadline, entry_limit, max_entries')
    .eq('id', params.id)
    .single()

  if (contestError || !contest) {
    return NextResponse.json({ error: 'Contest not found' }, { status: 404 })
  }

  if (contest.status !== 'active') {
    return NextResponse.json(
      { error: 'Cannot withdraw from a non-active contest' },
      { status: 400 }
    )
  }

  // Compute phase — only allow withdrawal during entry_open
  const now = new Date()
  const entryDeadlinePassed = contest.entry_deadline
    ? now > new Date(contest.entry_deadline)
    : false

  const { count: entryCount } = await supabase
    .from('contest_entries')
    .select('*', { count: 'exact', head: true })
    .eq('contest_id', params.id)

  const effectiveLimit = contest.entry_limit ?? contest.max_entries
  const entryFull = (entryCount ?? 0) >= effectiveLimit

  if (entryDeadlinePassed || entryFull) {
    return NextResponse.json(
      { error: 'Cannot withdraw after submission period begins' },
      { status: 400 }
    )
  }

  // Check no submission exists from this user
  const { data: existingSub } = await supabase
    .from('submissions')
    .select('id')
    .eq('contest_id', params.id)
    .eq('contestant_id', user.id)
    .single()

  if (existingSub) {
    return NextResponse.json(
      { error: 'Cannot withdraw after submitting work' },
      { status: 400 }
    )
  }

  // Delete the entry
  const { error: deleteError } = await supabase
    .from('contest_entries')
    .delete()
    .eq('contest_id', params.id)
    .eq('contestant_id', user.id)

  if (deleteError) {
    console.error('Entry withdrawal failed:', deleteError)
    return NextResponse.json({ error: 'Failed to withdraw' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Successfully withdrawn from contest' })
}
