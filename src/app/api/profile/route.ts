import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_NAME_CHARACTERS = 80
const MAX_BIO_CHARACTERS = 200

function characterCount(value: string) {
  return Array.from(value).length
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { full_name?: unknown; bio?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.full_name !== 'string' || typeof body.bio !== 'string') {
    return NextResponse.json(
      { error: 'Name and bio must be text' },
      { status: 400 }
    )
  }

  const fullName = body.full_name.trim()
  const bio = body.bio.trim()

  if (
    characterCount(fullName) < 1 ||
    characterCount(fullName) > MAX_NAME_CHARACTERS
  ) {
    return NextResponse.json(
      { error: `Name must be between 1 and ${MAX_NAME_CHARACTERS} characters` },
      { status: 400 }
    )
  }

  if (characterCount(bio) > MAX_BIO_CHARACTERS) {
    return NextResponse.json(
      { error: `Bio must be ${MAX_BIO_CHARACTERS} characters or fewer` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .update({ full_name: fullName, bio: bio || null })
    .eq('id', user.id)
    .select('id, full_name, avatar_url, bio')
    .single()

  if (error || !profile) {
    console.error('[Profile] Update failed:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }

  return NextResponse.json({ profile })
}
