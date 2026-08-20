export interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  contest_id: string | null
  read: boolean
  created_at: string
}

const CREATOR_REVIEW_TYPES = new Set([
  'new_submission',
  'deadline_passed',
  'judging_reminder_3',
])

const CREATOR_DASHBOARD_TYPES = new Set([
  'contest_live',
  'contest_full',
  'auto_refund',
])

const CONTESTANT_DASHBOARD_TYPES = new Set([
  'winner',
  'not_selected',
  'upi_reminder',
  'prize_sent',
])

export function notificationHref(notification: NotificationItem): string {
  if (
    notification.contest_id &&
    CREATOR_REVIEW_TYPES.has(notification.type)
  ) {
    return `/dashboard/lister/contest/${notification.contest_id}`
  }

  if (CREATOR_DASHBOARD_TYPES.has(notification.type)) {
    return '/dashboard/lister'
  }

  if (CONTESTANT_DASHBOARD_TYPES.has(notification.type)) {
    return '/dashboard/contestant'
  }

  if (notification.contest_id) {
    return `/contest/${notification.contest_id}`
  }

  return '/notifications'
}
