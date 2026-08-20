import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export interface NotificationEventInput {
  userId: string
  type: string
  title: string
  message: string
  eventKey: string
  contestId?: string | null
}

export async function createNotificationEvent(
  input: NotificationEventInput
): Promise<boolean> {
  const admin = createAdminClient()
  const { error } = await admin.from('notifications').insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    contest_id: input.contestId ?? null,
    event_key: input.eventKey,
  })

  if (!error) return true
  if (error.code === '23505') return false
  throw error
}

export async function createNotificationEvents(
  inputs: NotificationEventInput[]
): Promise<number> {
  let created = 0

  for (const input of inputs) {
    if (await createNotificationEvent(input)) created++
  }

  return created
}

export async function getExistingNotificationEventKeysForContests(
  contestIds: string[]
): Promise<Set<string>> {
  const uniqueContestIds = [...new Set(contestIds)]
  if (uniqueContestIds.length === 0) return new Set()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('notifications')
    .select('event_key')
    .in('contest_id', uniqueContestIds)
    .not('event_key', 'is', null)

  if (error) throw error
  return new Set(
    (data ?? [])
      .map((row) => row.event_key)
      .filter((key): key is string => typeof key === 'string')
  )
}
