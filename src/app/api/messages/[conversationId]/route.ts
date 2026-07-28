import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

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

  // 2. Verify user is a participant of this conversation
  if (!conversationId.includes(user.id)) {
    return NextResponse.json(
      { error: 'You are not a participant of this conversation' },
      { status: 403 }
    )
  }

  const supabaseAdmin = createAdminClient()

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
  const formatted = (messages ?? []).map((m: any) => ({
    id: m.id,
    sender_id: m.sender_id,
    recipient_id: m.recipient_id,
    content: m.content,
    created_at: m.created_at,
    read_at: m.read_at,
    sender_name: m.profiles?.full_name ?? 'Unknown',
    sender_avatar: m.profiles?.avatar_url ?? null,
  }))

  return NextResponse.json({ messages: formatted })
}
