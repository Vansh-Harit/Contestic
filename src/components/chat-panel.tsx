'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, Wifi, WifiOff, X } from 'lucide-react'
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

type RealtimeChatMessage = Pick<ChatMessage, 'id' | 'sender_id' | 'content' | 'created_at' | 'read_at'>

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
    const loadMessages = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/messages/${conversationId}`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages ?? [])
        }
      } catch (error) {
        console.error('[Chat] Failed to load messages:', error)
      }
      setIsLoading(false)
    }

    loadMessages()

    const supabase = createClient()
    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as RealtimeChatMessage
          const message: ChatMessage = {
            id: incoming.id,
            sender_id: incoming.sender_id,
            sender_name: incoming.sender_id === currentUserId ? currentUserName : recipientName,
            sender_avatar: null,
            content: incoming.content,
            created_at: incoming.created_at,
            read_at: incoming.read_at,
          }
          setMessages((previous) =>
            previous.some((existing) => existing.id === message.id)
              ? previous
              : [...previous.filter((existing) => !existing.id.startsWith('temp_')), message],
          )
        },
      )
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'))

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, currentUserName, recipientName])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isChatDisabled || isSending) return
    const content = input.trim()
    const optimistic: ChatMessage = {
      id: `temp_${Date.now()}`,
      sender_id: currentUserId,
      sender_name: currentUserName,
      sender_avatar: null,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
    }

    setMessages((previous) => [...previous, optimistic])
    setInput('')
    setIsSending(true)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contest_id: contestId, recipient_id: recipientId, content }),
      })
      if (!res.ok) {
        setMessages((previous) => previous.filter((message) => message.id !== optimistic.id))
        const error = await res.json()
        toast.error(error.error || 'Message failed to send')
      }
    } catch {
      setMessages((previous) => previous.filter((message) => message.id !== optimistic.id))
      toast.error('Message failed to send')
    }

    setIsSending(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const formatTime = (date: string) => new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <section className="fixed inset-x-3 bottom-3 z-[100] flex h-[min(520px,calc(100vh-24px))] flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-xl sm:inset-x-auto sm:right-4 sm:w-[380px]">
      <header className="flex items-center justify-between border-b border-outline-variant bg-gray-50 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-heading text-lg font-semibold text-on-surface">{recipientName}</h2>
            <span className={`h-2 w-2 shrink-0 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-400'}`} aria-hidden="true" />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-secondary">
            {isConnected ? <Wifi className="h-3 w-3 text-emerald-600" aria-hidden="true" /> : <WifiOff className="h-3 w-3" aria-hidden="true" />}
            <span>{isConnected ? 'Live' : 'Connecting…'}</span>
          </div>
        </div>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-white hover:text-on-surface" aria-label="Close chat">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {isChatDisabled && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-center text-xs font-medium text-red-700">
          This contest has ended. Chat is no longer available.
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {isLoading ? (
          [1, 2, 3].map((item) => (
            <div key={item} className={`h-10 animate-pulse rounded-xl bg-gray-100 ${item % 2 === 0 ? 'ml-auto w-3/5' : 'w-3/4'}`} />
          ))
        ) : messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-secondary">No messages yet.</div>
        ) : (
          messages.map((message) => {
            const isOwn = message.sender_id === currentUserId
            return (
              <div key={message.id} className={`flex max-w-[82%] flex-col ${isOwn ? 'ml-auto items-end' : 'items-start'}`}>
                {!isOwn && <span className="mb-1 text-[11px] font-medium text-secondary">{message.sender_name}</span>}
                <div className={`break-words rounded-xl px-3 py-2 text-sm leading-5 text-on-surface ${isOwn ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                  {message.content}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                  <span>{formatTime(message.created_at)}</span>
                  {isOwn && message.read_at && <span className="text-emerald-700">Seen</span>}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-outline-variant bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, 1000))}
            onKeyDown={handleKeyDown}
            placeholder={isChatDisabled ? 'Chat disabled' : 'Type a message…'}
            disabled={isChatDisabled}
            rows={1}
            className="max-h-24 min-h-10 flex-1 resize-none overflow-y-auto rounded-lg border border-outline-variant px-3 py-2 text-sm leading-5 focus:border-indigo-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending || isChatDisabled}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-white transition-colors hover:bg-indigo-700"
            aria-label="Send message"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {input.length > 800 && (
          <p className={`mt-1 text-right text-[10px] ${input.length > 950 ? 'text-red-600' : 'text-secondary'}`}>{input.length}/1000</p>
        )}
      </div>
    </section>
  )
}
