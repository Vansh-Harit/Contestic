'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  notificationHref,
  type NotificationItem,
} from '@/lib/notification-types'

type NotificationResponse = {
  items: NotificationItem[]
  unreadCount: number
  nextCursor: string | null
}

async function fetchRecentNotifications(): Promise<NotificationResponse> {
  const response = await fetch('/api/notifications?limit=6', {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('notification_fetch_failed')
  return response.json() as Promise<NotificationResponse>
}

export default function NotificationMenu() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setFailed(false)

    try {
      const payload = await fetchRecentNotifications()
      setItems(payload.items)
      setUnreadCount(payload.unreadCount)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchRecentNotifications()
      .then((payload) => {
        if (cancelled) return
        setItems(payload.items)
        setUnreadCount(payload.unreadCount)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const markRead = (id: string) => {
    const current = items.find((item) => item.id === id)
    if (!current || current.read) return

    setItems((previous) => previous.map((item) => (
      item.id === id ? { ...item, read: true } : item
    )))
    setUnreadCount((previous) => Math.max(0, previous - 1))
    void fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
      keepalive: true,
    }).catch(() => undefined)
  }

  const markAllRead = async () => {
    if (unreadCount === 0) return
    const previousItems = items
    const previousCount = unreadCount
    setItems((current) => current.map((item) => ({ ...item, read: true })))
    setUnreadCount(0)

    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      if (response.ok) return
      throw new Error('notification_update_failed')
    } catch {
      setItems(previousItems)
      setUnreadCount(previousCount)
      setFailed(true)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const nextOpen = !isOpen
          setIsOpen(nextOpen)
          if (nextOpen) void refresh()
        }}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
            <div>
              <p className="font-heading text-lg font-semibold text-on-surface">Notifications</p>
              <p className="text-xs text-secondary">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primary transition-colors hover:bg-indigo-50"
              >
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {failed && items.length > 0 && (
              <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700" role="status">
                Notifications could not be refreshed. Showing the last loaded items.
              </div>
            )}
            {loading && items.length === 0 ? (
              <div className="flex min-h-36 items-center justify-center text-secondary">
                <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading notifications" />
              </div>
            ) : failed && items.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-secondary">Notifications could not be loaded.</p>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="mt-3 text-sm font-semibold text-primary hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Bell className="mx-auto h-7 w-7 text-outline" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-on-surface">No notifications yet</p>
                <p className="mt-1 text-xs text-secondary">Important contest updates will appear here.</p>
              </div>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={notificationHref(item)}
                  onClick={() => {
                    markRead(item.id)
                    setIsOpen(false)
                  }}
                  className={`block border-b border-outline-variant px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-container-low ${
                    item.read ? 'bg-white' : 'bg-indigo-50/60'
                  }`}
                >
                  <div className="flex gap-3">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        item.read ? 'bg-transparent' : 'bg-primary'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-secondary">{item.message}</p>
                      <p className="mt-1.5 text-[11px] text-secondary">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            className="block border-t border-outline-variant px-4 py-3 text-center text-sm font-semibold text-primary transition-colors hover:bg-indigo-50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
