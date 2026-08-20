import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { NotificationItem } from '@/lib/notification-types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type NotificationCursor = {
  createdAt: string
  id: string
}

function encodeCursor(item: NotificationItem): string {
  return Buffer.from(
    JSON.stringify({ createdAt: item.created_at, id: item.id })
  ).toString('base64url')
}

function decodeCursor(value: string | null): NotificationCursor | null {
  if (!value || value.length > 300) return null

  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as Partial<NotificationCursor>
    if (
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !UUID_PATTERN.test(parsed.id)
    ) {
      return null
    }

    const timestamp = new Date(parsed.createdAt)
    if (Number.isNaN(timestamp.getTime())) return null

    return { createdAt: timestamp.toISOString(), id: parsed.id }
  } catch {
    return null
  }
}

function privateJson(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers)
  headers.set('Cache-Control', 'private, no-store')
  return Response.json(body, { ...init, headers })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return privateJson({ error: 'Authentication required' }, { status: 401 })
  }

  const url = new URL(request.url)
  const requestedLimit = Number(url.searchParams.get('limit') ?? 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 25)
    : 10
  const rawCursor = url.searchParams.get('cursor')
  const cursor = decodeCursor(rawCursor)

  if (rawCursor && !cursor) {
    return privateJson({ error: 'Invalid notification cursor' }, { status: 400 })
  }

  let itemsQuery = supabase
    .from('notifications')
    .select('id, type, title, message, contest_id, read, created_at')
    .eq('user_id', user.id)
    .not('event_key', 'is', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    itemsQuery = itemsQuery.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    )
  }

  const [itemsResult, unreadResult] = await Promise.all([
    itemsQuery,
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .not('event_key', 'is', null),
  ])

  if (itemsResult.error || unreadResult.error) {
    console.error('[Notifications] Could not load notification feed')
    return privateJson({ error: 'Could not load notifications' }, { status: 500 })
  }

  const rows = (itemsResult.data ?? []) as NotificationItem[]
  const hasMore = rows.length > limit
  const items = rows.slice(0, limit)
  const lastItem = items[items.length - 1]

  return privateJson({
    items,
    unreadCount: unreadResult.count ?? 0,
    nextCursor: hasMore && lastItem ? encodeCursor(lastItem) : null,
  })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return privateJson({ error: 'Authentication required' }, { status: 401 })
  }

  let body: { all?: unknown; ids?: unknown }
  try {
    body = (await request.json()) as { all?: unknown; ids?: unknown }
  } catch {
    return privateJson({ error: 'Invalid request body' }, { status: 400 })
  }

  const markAll = body.all === true
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((id): id is string => (
      typeof id === 'string' && UUID_PATTERN.test(id)
    )))]
    : []

  if (!markAll && (ids.length === 0 || ids.length > 50)) {
    return privateJson({ error: 'Select between 1 and 50 notifications' }, { status: 400 })
  }

  const admin = createAdminClient()
  let updateQuery = admin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)
    .not('event_key', 'is', null)

  if (!markAll) updateQuery = updateQuery.in('id', ids)

  const { error } = await updateQuery
  if (error) {
    console.error('[Notifications] Could not mark notifications as read')
    return privateJson({ error: 'Could not update notifications' }, { status: 500 })
  }

  return privateJson({ success: true })
}
