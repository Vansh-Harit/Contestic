'use client'

import posthog from 'posthog-js'

type AnalyticsEvents = {
  '$pageview': {
    '$current_url': string
    path: string
  }
  contest_viewed: {
    contest_id: string
    category: string
    phase: string
    viewer_relationship: 'anonymous' | 'host' | 'entrant' | 'authenticated'
  }
  contest_entered: {
    contest_id: string
    category: string
  }
  submission_started: {
    contest_id: string
    category: string
  }
  submission_completed: {
    contest_id: string
    category: string
    attachment_count: number
    attachment_types: Array<'upload' | 'drive_link'>
    has_description: boolean
  }
  contest_checkout_opened: {
    contest_id: string
    category: string
    prize_amount_inr: number
  }
  contest_creation_step_completed: {
    step: 1 | 2 | 3
    category: string
  }
  contest_checkout_dismissed: {
    contest_id: string
  }
  contest_payment_verified: {
    contest_id: string
    category: string
    prize_amount_inr: number
  }
  winner_selected: {
    contest_id: string
    submission_count: number
  }
  profile_updated: {
    update_kind: 'details' | 'avatar_added' | 'avatar_removed'
    has_bio?: boolean
  }
}

export function isAnalyticsConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN)
}

export function captureAnalyticsEvent<EventName extends keyof AnalyticsEvents>(
  eventName: EventName,
  properties: AnalyticsEvents[EventName]
) {
  if (!isAnalyticsConfigured()) return

  try {
    posthog.capture(eventName, properties)
  } catch {
    // Analytics must never block or change an application flow.
  }
}

export function identifyAnalyticsUser(userId: string) {
  if (!isAnalyticsConfigured()) return

  try {
    if (posthog.get_distinct_id() !== userId) posthog.identify(userId)
  } catch {
    // Authentication remains independent from analytics availability.
  }
}

export function resetAnalyticsUser() {
  if (!isAnalyticsConfigured()) return

  try {
    if (posthog.get_property('$user_id')) posthog.reset()
  } catch {
    // Sign-out remains independent from analytics availability.
  }
}
