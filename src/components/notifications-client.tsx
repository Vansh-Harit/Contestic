'use client'

import { useCallback, useEffect, useState } from 'react'
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

async function fetchNotificationPage(cursor?: string): Promise<NotificationResponse> {
  const search = new URLSearchParams({ limit: '20' })
  if (cursor) search.set('cursor', cursor)
  const response = await fetch(`/api/notifications?${search}`, {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('notification_fetch_failed')
  return response.json() as Promise<NotificationResponse>
}

export default function NotificationsClient() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (cursor?: string) => {
    if (cursor) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setFailed(false)

    try {
      const payload = await fetchNotificationPage(cursor)
      setItems((previous) => cursor
        ? [...previous, ...payload.items.filter((item) => (
          !previous.some((existing) => existing.id === item.id)
        ))]
        : payload.items)
      setUnreadCount(payload.unreadCount)
      setNextCursor(payload.nextCursor)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchNotificationPage()
      .then((payload) => {
        if (cancelled) return
        setItems(payload.items)
        setUnreadCount(payload.unreadCount)
        setNextCursor(payload.nextCursor)
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
    <main className="mx-auto w-full max-w-4xl px-container-padding-mobile py-10 md:px-container-padding-desktop md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-on-surface md:text-4xl">Notifications</h1>
          <p className="mt-2 text-sm text-secondary">
            Important contest, result and payout updates.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 text-sm font-semibold text-primary transition-colors hover:bg-indigo-50"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </button>
        )}
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm">
        {failed && items.length > 0 && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700" role="status">
            Notifications could not be refreshed. Showing the last loaded items.
          </div>
        )}
        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-secondary">
            <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading notifications" />
          </div>
        ) : failed && items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold text-on-surface">Notifications could not be loaded.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 text-sm font-semibold text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Bell className="mx-auto h-9 w-9 text-outline" aria-hidden="true" />
            <h2 className="mt-4 font-heading text-xl font-semibold text-on-surface">No notifications yet</h2>
            <p className="mt-2 text-sm text-secondary">Important updates will appear here as your contests progress.</p>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <Link
                key={item.id}
                href={notificationHref(item)}
                onClick={() => markRead(item.id)}
                className={`flex gap-4 border-b border-outline-variant px-5 py-5 transition-colors last:border-b-0 hover:bg-surface-container-low md:px-6 ${
                  item.read ? 'bg-white' : 'bg-indigo-50/60'
                }`}
              >
                <span
                  className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${
                    item.read ? 'bg-outline-variant' : 'bg-primary'
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="font-semibold text-on-surface">{item.title}</h2>
                    <time className="text-xs text-secondary" dateTime={item.created_at}>
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </time>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-secondary">{item.message}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {nextCursor && (
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void load(nextCursor)}
            className="min-h-11 rounded-xl border border-outline-variant bg-white px-5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </main>
  )
}
