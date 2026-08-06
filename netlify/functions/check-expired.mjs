function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

const checkExpired = async (_request, context) => {
  const deployContext = context?.deploy?.context ?? process.env.CONTEXT
  const scheduledJobsEnabled =
    process.env.NETLIFY_SCHEDULED_JOBS_ENABLED === 'true'

  if (deployContext !== 'production' || !scheduledJobsEnabled) {
    console.log('[Netlify cron] Lifecycle job skipped', {
      deployContext: deployContext ?? 'unknown',
      enabled: scheduledJobsEnabled,
    })
    return jsonResponse({ skipped: true })
  }

  const baseUrl =
    process.env.DEPLOY_PRIME_URL ||
    process.env.URL ||
    process.env.NEXT_PUBLIC_APP_URL
  const cronSecret = process.env.CRON_SECRET

  if (!baseUrl || !cronSecret) {
    console.error('[Netlify cron] Required runtime configuration is missing')
    return jsonResponse({ error: 'Scheduled job is not configured' }, 500)
  }

  try {
    const response = await fetch(
      new URL('/.netlify/functions/check-expired-background', baseUrl),
      {
        method: 'POST',
        headers: { authorization: `Bearer ${cronSecret}` },
        cache: 'no-store',
      }
    )

    if (response.status !== 202) {
      console.error('[Netlify cron] Background dispatch failed', {
        status: response.status,
      })
      return jsonResponse({ error: 'Lifecycle job was not dispatched' }, 502)
    }

    console.log('[Netlify cron] Lifecycle job dispatched')
    return jsonResponse({ dispatched: true })
  } catch {
    console.error('[Netlify cron] Background dispatch request failed')
    return jsonResponse({ error: 'Lifecycle job was not dispatched' }, 502)
  }
}

export default checkExpired
