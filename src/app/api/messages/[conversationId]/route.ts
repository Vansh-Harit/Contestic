import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getChatChannelName } from '@/lib/utils'

interface MessageWithSender {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  created_at: string
  read_at: string | null
  profiles:
    | {
        full_name: string | null
        avatar_url: string | null
      }
    | {
        full_name: string | null
        avatar_url: string | null
      }[]
    | null
}

const UUID_PATTERN =
  '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'
const CONVERSATION_PATTERN = new RegExp(
  `^contest-${UUID_PATTERN}-${UUID_PATTERN}-${UUID_PATTERN}$`,
  'i'
)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient()

  // 2. Fetch one row first and authorize against canonical participants.
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('messages')
    .select('sender_id, recipient_id, contest_id')
    .eq('conversation_id', conversationId)
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    return NextResponse.json(
      { error: 'Failed to authorize conversation' },
      { status: 500 }
    )
  }

  if (
    membership &&
    membership.sender_id !== user.id &&
    membership.recipient_id !== user.id
  ) {
    return NextResponse.json(
      { error: 'You are not a participant of this conversation' },
      { status: 403 }
    )
  }

  let contestId = membership?.contest_id ?? null

  // A valid conversation has no message row until the first message is sent.
  // Authorize that empty state from the canonical channel name and the same
  // contest/entry membership rules used by POST /api/messages.
  if (!membership) {
    const match = CONVERSATION_PATTERN.exec(conversationId)
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid conversation' },
        { status: 400 }
      )
    }

    const [, parsedContestId, participantA, participantB] = match
    if (
      getChatChannelName(parsedContestId, participantA, participantB) !==
        conversationId ||
      (participantA !== user.id && participantB !== user.id)
    ) {
      return NextResponse.json(
        { error: 'You are not a participant of this conversation' },
        { status: 403 }
      )
    }

    const { data: contest } = await supabaseAdmin
      .from('contests')
      .select('lister_id, status')
      .eq('id', parsedContestId)
      .single()

    if (
      !contest ||
      contest.status === 'completed' ||
      contest.status === 'cancelled'
    ) {
      return NextResponse.json(
        { error: 'This contest has ended. Chat is no longer available.' },
        { status: 403 }
      )
    }

    const participantAIsLister = participantA === contest.lister_id
    const participantBIsLister = participantB === contest.lister_id
    if (participantAIsLister === participantBIsLister) {
      return NextResponse.json(
        { error: 'Contest chat is only available between the creator and an entrant.' },
        { status: 403 }
      )
    }

    const entrantId = participantAIsLister ? participantB : participantA
    const { data: entry } = await supabaseAdmin
      .from('contest_entries')
      .select('id')
      .eq('contest_id', parsedContestId)
      .eq('contestant_id', entrantId)
      .maybeSingle()

    if (!entry) {
      return NextResponse.json(
        { error: 'You are not a participant of this contest conversation' },
        { status: 403 }
      )
    }

    contestId = parsedContestId
  }

  if (membership) {
    if (!contestId) {
      return NextResponse.json(
        { error: 'This conversation is not attached to a contest.' },
        { status: 403 }
      )
    }

    const { data: contest } = await supabaseAdmin
      .from('contests')
      .select('lister_id, status')
      .eq('id', contestId)
      .single()

    if (
      !contest ||
      contest.status === 'completed' ||
      contest.status === 'cancelled'
    ) {
      return NextResponse.json(
        { error: 'This contest has ended. Chat is no longer available.' },
        { status: 403 }
      )
    }

    if (
      getChatChannelName(
        contestId,
        membership.sender_id,
        membership.recipient_id
      ) !== conversationId
    ) {
      return NextResponse.json(
        { error: 'Invalid conversation' },
        { status: 403 }
      )
    }

    const senderIsLister = membership.sender_id === contest.lister_id
    const recipientIsLister = membership.recipient_id === contest.lister_id
    if (senderIsLister === recipientIsLister) {
      return NextResponse.json(
        { error: 'Contest chat is only available between the creator and an entrant.' },
        { status: 403 }
      )
    }

    const entrantId = senderIsLister
      ? membership.recipient_id
      : membership.sender_id
    const { data: entry } = await supabaseAdmin
      .from('contest_entries')
      .select('id')
      .eq('contest_id', contestId)
      .eq('contestant_id', entrantId)
      .maybeSingle()

    if (!entry) {
      return NextResponse.json(
        { error: 'A valid contest entry is required for chat.' },
        { status: 403 }
      )
    }
  }

  // 3. Fetch messages with sender info
  const { data: messages, error } = await supabaseAdmin
    .from('messages')
    .select(`
      id, sender_id, recipient_id, content, 
      created_at, read_at,
      profiles!messages_sender_id_fkey(full_name, avatar_url)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    console.error('[Chat] Fetch messages error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }

  // 4. Mark all unread messages as read where recipient = current user
  await supabaseAdmin
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('recipient_id', user.id)
    .is('read_at', null)

  // Transform messages to flatten sender info
  const formatted = ((messages ?? []) as MessageWithSender[]).map((m) => {
    const sender = Array.isArray(m.profiles)
      ? m.profiles[0]
      : m.profiles

    return {
      id: m.id,
      sender_id: m.sender_id,
      recipient_id: m.recipient_id,
      content: m.content,
      created_at: m.created_at,
      read_at: m.read_at,
      sender_name: sender?.full_name ?? 'Unknown',
      sender_avatar: sender?.avatar_url ?? null,
    }
  })

  return NextResponse.json({ messages: formatted })
}
