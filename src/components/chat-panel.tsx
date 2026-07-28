'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Loader2, Wifi, WifiOff } from 'lucide-react'
import { getChatChannelName } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_avatar: string | null
  content: string
  created_at: string
  read_at: string | null
}

interface ChatPanelProps {
  contestId: string
  contestStatus: string
  recipientId: string
  recipientName: string
  currentUserId: string
  currentUserName: string
  onClose: () => void
}

export default function ChatPanel({
  contestId,
  contestStatus,
  recipientId,
  recipientName,
  currentUserId,
  currentUserName,
  onClose,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isChatDisabled = contestStatus === 'completed' || contestStatus === 'cancelled'
  const conversationId = getChatChannelName(contestId, currentUserId, recipientId)

  useEffect(() => {
    // 1. Load message history from DB
    const loadMessages = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/messages/${conversationId}`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages ?? [])
        }
      } catch (err) {
        console.error('[Chat] Failed to load messages:', err)
      }
      setIsLoading(false)
    }

    loadMessages()

    // 2. Subscribe to Supabase Realtime for new messages
    const supabase = createClient()
    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const incoming = payload.new as any
          const msg: ChatMessage = {
            id: incoming.id,
            sender_id: incoming.sender_id,
            sender_name: incoming.sender_id === currentUserId ? currentUserName : recipientName,
            sender_avatar: null,
            content: incoming.content,
            created_at: incoming.created_at,
            read_at: incoming.read_at,
          }
          setMessages(prev =>
            prev.some(m => m.id === msg.id)
              ? prev
              : [...prev.filter(m => !m.id.startsWith('temp_')), msg]
          )
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, currentUserName, recipientName])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isChatDisabled || isSending) return
    const content = input.trim()

    // Optimistic update
    const optimistic: ChatMessage = {
      id: `temp_${Date.now()}`,
      sender_id: currentUserId,
      sender_name: currentUserName,
      sender_avatar: null,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
    }
    setMessages(prev => [...prev, optimistic])
    setInput('')
    setIsSending(true)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contest_id: contestId,
          recipient_id: recipientId,
          content,
        }),
      })

      if (!res.ok) {
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
        const err = await res.json()
        toast.error(err.error || 'Message failed to send')
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      toast.error('Message failed to send')
    }

    setIsSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      bottom: 0,
      width: 360,
      height: 480,
      background: '#FFFFFF',
      borderLeft: '1px solid #E5E7EB',
      borderTop: '1px solid #E5E7EB',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      borderTopLeftRadius: 12,
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #E5E7EB',
        background: '#F9FAFB',
        borderTopLeftRadius: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
              {recipientName}
            </span>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isConnected ? '#22C55E' : '#9CA3AF',
              display: 'inline-block',
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            {isConnected ? (
              <Wifi style={{ width: 10, height: 10, color: '#22C55E' }} />
            ) : (
              <WifiOff style={{ width: 10, height: 10, color: '#9CA3AF' }} />
            )}
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>
              {isConnected ? 'Live' : 'Connecting...'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: '#6B7280',
          }}
        >
          <X style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Chat disabled banner */}
      {isChatDisabled && (
        <div style={{
          padding: '8px 16px',
          background: '#FEF2F2',
          borderBottom: '1px solid #FECACA',
          fontSize: 12,
          color: '#991B1B',
          textAlign: 'center',
        }}>
          Contest ended — chat is no longer available
        </div>
      )}

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 40,
                borderRadius: 12,
                background: '#F3F4F6',
                width: i % 2 === 0 ? '60%' : '75%',
                alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </>
        ) : messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9CA3AF',
            fontSize: 13,
          }}>
            No messages yet. Say hello! 👋
          </div>
        ) : (
          messages.map(msg => {
            const isOwn = msg.sender_id === currentUserId
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOwn ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  alignSelf: isOwn ? 'flex-end' : 'flex-start',
                }}
              >
                {!isOwn && (
                  <span style={{
                    fontSize: 10,
                    color: '#9CA3AF',
                    marginBottom: 2,
                    fontWeight: 500,
                  }}>
                    {msg.sender_name}
                  </span>
                )}
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: isOwn ? '#FEF3C7' : '#F3F4F6',
                  color: '#111827',
                  fontSize: 13,
                  lineHeight: 1.4,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 2,
                }}>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                    {formatTime(msg.created_at)}
                  </span>
                  {isOwn && msg.read_at && (
                    <span style={{ fontSize: 10, color: '#22C55E' }}>
                      ✓ Seen
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        borderTop: '1px solid #E5E7EB',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        background: '#FFFFFF',
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 1000))}
          onKeyDown={handleKeyDown}
          placeholder={isChatDisabled ? 'Chat disabled' : 'Type a message...'}
          disabled={isChatDisabled}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.4,
            maxHeight: 80,
            overflowY: 'auto',
            opacity: isChatDisabled ? 0.5 : 1,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isSending || isChatDisabled}
          style={{
            background: !input.trim() || isSending || isChatDisabled ? '#E5E7EB' : '#F59E0B',
            border: 'none',
            borderRadius: 8,
            padding: '8px 10px',
            cursor: !input.trim() || isSending || isChatDisabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isSending ? (
            <Loader2 style={{ width: 16, height: 16, color: '#6B7280', animation: 'spin 1s linear infinite' }} />
          ) : (
            <Send style={{ width: 16, height: 16, color: !input.trim() || isChatDisabled ? '#9CA3AF' : '#000' }} />
          )}
        </button>
      </div>

      {/* Character count */}
      {input.length > 800 && (
        <div style={{
          textAlign: 'right',
          paddingRight: 12,
          paddingBottom: 4,
          fontSize: 10,
          color: input.length > 950 ? '#DC2626' : '#9CA3AF',
        }}>
          {input.length}/1000
        </div>
      )}
    </div>
  )
}
