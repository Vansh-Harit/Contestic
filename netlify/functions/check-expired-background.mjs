const checkExpiredBackground = async (request, context) => {
  const deployContext = context?.deploy?.context ?? process.env.CONTEXT
  const scheduledJobsEnabled =
    process.env.NETLIFY_SCHEDULED_JOBS_ENABLED === 'true'
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (
    deployContext !== 'production' ||
    !scheduledJobsEnabled ||
    !cronSecret ||
    authHeader !== `Bearer ${cronSecret}`
  ) {
    console.error('[Netlify cron background] Dispatch rejected')
    return
  }

  const baseUrl =
    process.env.DEPLOY_PRIME_URL ||
    process.env.URL ||
    process.env.NEXT_PUBLIC_APP_URL

  if (!baseUrl) {
    console.error('[Netlify cron background] Site URL is unavailable')
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55_000)

  try {
    const response = await fetch(
      new URL('/api/cron/check-expired', baseUrl),
      {
        method: 'GET',
        headers: { authorization: `Bearer ${cronSecret}` },
        cache: 'no-store',
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      console.error('[Netlify cron background] Lifecycle endpoint failed', {
        status: response.status,
      })
      return
    }

    console.log('[Netlify cron background] Lifecycle job completed')
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    console.error(
      timedOut
        ? '[Netlify cron background] Lifecycle endpoint timed out'
        : '[Netlify cron background] Lifecycle endpoint request failed'
    )
  } finally {
    clearTimeout(timeout)
  }
}

export default checkExpiredBackground
