import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getChatChannelName } from '@/lib/utils'

export async function POST(request: Request) {
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient()

  // 2. Validate body
  let body: {
    contest_id?: unknown
    recipient_id?: unknown
    content?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { contest_id, recipient_id, content } = body

  if (
    typeof contest_id !== 'string' ||
    typeof recipient_id !== 'string' ||
    typeof content !== 'string'
  ) {
    return NextResponse.json(
      { error: 'contest_id, recipient_id, and content are required' },
      { status: 400 }
    )
  }

  const trimmed = content.trim()
  if (trimmed.length < 1 || trimmed.length > 1000) {
    return NextResponse.json(
      { error: 'Message must be between 1 and 1000 characters' },
      { status: 400 }
    )
  }

  // 3. Fetch contest
  const { data: contest, error: contestError } = await supabaseAdmin
    .from('contests')
    .select('id, lister_id, status')
    .eq('id', contest_id)
    .single()

  if (contestError || !contest) {
    return NextResponse.json({ error: 'Contest not found' }, { status: 404 })
  }

  if (contest.status === 'completed' || contest.status === 'cancelled') {
    return NextResponse.json(
      { error: 'This contest has ended. Chat is no longer available.' },
      { status: 403 }
    )
  }

  if (recipient_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot message yourself.' },
      { status: 400 }
    )
  }

  // 4. A valid contest conversation contains exactly the creator and one
  // entrant. Entrants cannot open private conversations with each other.
  const senderIsLister = contest.lister_id === user.id
  const recipientIsLister = contest.lister_id === recipient_id
  if (senderIsLister === recipientIsLister) {
    return NextResponse.json(
      { error: 'Contest chat is only available between the creator and an entrant.' },
      { status: 403 }
    )
  }

  const contestantId = senderIsLister ? recipient_id : user.id
  const { data: contestantEntry } = await supabaseAdmin
    .from('contest_entries')
    .select('id')
    .eq('contest_id', contest_id)
    .eq('contestant_id', contestantId)
    .maybeSingle()

  if (!contestantEntry) {
    return NextResponse.json(
      { error: 'A valid contest entry is required for chat.' },
      { status: 403 }
    )
  }

  // 6. Generate conversation_id
  const conversationId = getChatChannelName(contest_id, user.id, recipient_id)

  // 7. Insert message using admin client (bypasses RLS)
  const { data: message, error: insertError } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      recipient_id,
      contest_id,
      content: trimmed,
    })
    .select('*')
    .single()

  if (insertError) {
    console.error('[Chat] Insert error:', insertError)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }

  // 8. Return 201 with full message row
  return NextResponse.json(message, { status: 201 })
}
