'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { captureAnalyticsEvent } from '@/lib/analytics'

export function AnalyticsPageview() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return

    captureAnalyticsEvent('$pageview', {
      '$current_url': `${window.location.origin}${pathname}`,
      path: pathname,
    })
  }, [pathname])

  return null
}
