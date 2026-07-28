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

  // 2. Validate body
  const body = await request.json()
  const { contest_id, recipient_id, content } = body

  if (!contest_id || !recipient_id || !content) {
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
  const { data: contest, error: contestError } = await supabase
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

  // 4. Verify sender is a valid participant
  const senderIsLister = contest.lister_id === user.id
  if (!senderIsLister) {
    const { data: senderEntry } = await supabase
      .from('contest_entries')
      .select('id')
      .eq('contest_id', contest_id)
      .eq('contestant_id', user.id)
      .single()

    if (!senderEntry) {
      return NextResponse.json(
        { error: 'You must enter this contest before messaging the lister.' },
        { status: 403 }
      )
    }
  }

  // 5. Verify recipient is also a valid participant
  const recipientIsLister = contest.lister_id === recipient_id
  if (!recipientIsLister) {
    const { data: recipientEntry } = await supabase
      .from('contest_entries')
      .select('id')
      .eq('contest_id', contest_id)
      .eq('contestant_id', recipient_id)
      .single()

    if (!recipientEntry) {
      return NextResponse.json(
        { error: 'Invalid recipient.' },
        { status: 403 }
      )
    }
  }

  // 6. Generate conversation_id
  const conversationId = getChatChannelName(contest_id, user.id, recipient_id)

  // 7. Insert message using admin client (bypasses RLS)
  const supabaseAdmin = createAdminClient()
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
