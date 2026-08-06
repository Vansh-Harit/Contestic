import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { MAX_AVATAR_SIZE_BYTES, ALLOWED_AVATAR_TYPES } from '@/lib/constants'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('avatar') as File | null
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate file type
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPG and PNG files are allowed' },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File size must be under 300KB' },
      { status: 400 }
    )
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const filePath = `${user.id}/avatar.${ext}`

  // Delete any existing avatar files for this user first
  const { data: existingFiles } = await supabase.storage
    .from('avatars')
    .list(user.id)

  if (existingFiles && existingFiles.length > 0) {
    const filesToRemove = existingFiles.map(f => `${user.id}/${f.name}`)
    await supabase.storage.from('avatars').remove(filesToRemove)
  }

  // Upload the new avatar
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('[Avatar] Upload error:', uploadError)
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    )
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  const avatarUrl = urlData.publicUrl

  // Update the profile
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  if (updateError) {
    console.error('[Avatar] Profile update error:', updateError)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }

  return NextResponse.json({ avatar_url: avatarUrl })
}

export async function DELETE() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // List and remove all avatar files for this user
  const { data: existingFiles } = await supabase.storage
    .from('avatars')
    .list(user.id)

  if (existingFiles && existingFiles.length > 0) {
    const filesToRemove = existingFiles.map(f => `${user.id}/${f.name}`)
    const { error: removeError } = await supabase.storage
      .from('avatars')
      .remove(filesToRemove)

    if (removeError) {
      console.error('[Avatar] Remove error:', removeError)
      return NextResponse.json(
        { error: 'Failed to remove avatar' },
        { status: 500 }
      )
    }
  }

  // Clear avatar_url in profile
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id)

  if (updateError) {
    console.error('[Avatar] Profile clear error:', updateError)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
