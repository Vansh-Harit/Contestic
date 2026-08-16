import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
})

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2026-05-30',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false,
    capture_performance: false,
    capture_heatmaps: false,
    disable_session_recording: true,
    person_profiles: 'identified_only',
    respect_dnt: true,
    before_send: (event) => {
      if (!event) return null

      const properties = { ...event.properties }
      const urlProperties = [
        '$current_url',
        '$referrer',
        '$initial_referrer',
        '$session_entry_url',
      ]

      for (const key of urlProperties) {
        const value = properties[key]
        if (typeof value !== 'string') continue

        try {
          const parsed = new URL(value, window.location.origin)
          properties[key] = `${parsed.origin}${parsed.pathname}`
        } catch {
          delete properties[key]
        }
      }

      for (const key of [
        'email',
        'name',
        'full_name',
        'description',
        'content',
        'message',
        'filename',
        'file_urls',
        'upi_id',
        'utr',
        'razorpay_order_id',
        'razorpay_payment_id',
      ]) {
        delete properties[key]
      }

      properties.$geoip_disable = true

      return { ...event, properties }
    },
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
