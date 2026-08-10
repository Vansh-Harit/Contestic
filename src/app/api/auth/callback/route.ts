import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const requestedNext = searchParams.get('next') ?? '/'
  const next =
    requestedNext.startsWith('/') &&
    !requestedNext.startsWith('//') &&
    !requestedNext.includes('\\')
      ? requestedNext
      : '/'
  let redirectOrigin = origin
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      const configuredUrl = new URL(process.env.NEXT_PUBLIC_APP_URL)
      if (configuredUrl.protocol === 'https:' || configuredUrl.protocol === 'http:') {
        redirectOrigin = configuredUrl.origin
      }
    } catch {
      // Fall back to the current request origin when local configuration is invalid.
    }
  }

  if (tokenHash && type === 'recovery') {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    })
    if (!error) {
      return NextResponse.redirect(`${redirectOrigin}${next}`)
    }
  } else if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${redirectOrigin}${next}`)
    }
  }

  return NextResponse.redirect(
    `${redirectOrigin}/login?error=auth_callback_error`
  )
}
