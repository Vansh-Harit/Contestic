import { NextResponse } from 'next/server'

// Keep the route non-disclosing in deployed environments. Sentry can be
// validated through its dashboard or controlled test environments instead.
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
