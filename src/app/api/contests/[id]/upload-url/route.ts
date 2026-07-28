import { createClient } from '@/lib/supabase/server'
import { getUploadUrl, getPublicUrl } from '@/lib/r2'

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contestId } = await params

  // 1. Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2. Parse body
  let body: { filename?: string; contentType?: string; fileSize?: number }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { filename, contentType, fileSize } = body

  if (!filename || !contentType) {
    return Response.json(
      { error: 'filename and contentType are required' },
      { status: 400 }
    )
  }

  // 3. Validate fileSize — must be a positive number (not just truthy)
  if (typeof fileSize !== 'number' || fileSize <= 0) {
    return Response.json(
      { error: 'Invalid file size provided' },
      { status: 400 }
    )
  }

  // 4. Validate content type
  if (!ALLOWED_TYPES.includes(contentType)) {
    return Response.json(
      { error: 'File type not supported. Use JPG, PNG, WebP, or PDF.' },
      { status: 400 }
    )
  }

  // 5. Validate file size against limit
  if (fileSize > MAX_FILE_SIZE) {
    return Response.json(
      { error: 'File exceeds 20MB. Please use a Google Drive link instead.' },
      { status: 400 }
    )
  }

  // 5. Verify user can submit to this contest
  const { data: contest } = await supabase
    .from('contests')
    .select('id, lister_id, status, deadline, entry_deadline')
    .eq('id', contestId)
    .single()

  if (!contest) {
    return Response.json({ error: 'Contest not found' }, { status: 404 })
  }

  if (contest.status !== 'active') {
    return Response.json(
      { error: 'Contest is not accepting submissions' },
      { status: 400 }
    )
  }

  if (new Date(contest.deadline) < new Date()) {
    return Response.json(
      { error: 'Contest deadline has passed' },
      { status: 400 }
    )
  }

  if (contest.lister_id === user.id) {
    return Response.json(
      { error: 'Cannot submit to own contest' },
      { status: 403 }
    )
  }

  // Entry verification
  if (contest.entry_deadline) {
    const { data: entry } = await supabase
      .from('contest_entries')
      .select('id')
      .eq('contest_id', contestId)
      .eq('contestant_id', user.id)
      .single()

    if (!entry) {
      return Response.json(
        { error: 'You must enter this contest before uploading files.' },
        { status: 403 }
      )
    }
  }

  // Duplicate submission check
  const { data: existingSub } = await supabase
    .from('submissions')
    .select('id')
    .eq('contest_id', contestId)
    .eq('contestant_id', user.id)
    .single()

  if (existingSub) {
    return Response.json(
      { error: 'You have already submitted to this contest' },
      { status: 409 }
    )
  }

  // 6. Generate unique key
  const timestamp = Date.now()
  const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  const key = `submissions/${contestId}/${user.id}/${timestamp}_${sanitizedName}`

  // 7. Get presigned upload URL
  // Pass fileSize to getUploadUrl — R2 will lock ContentLength into the
  // presigned URL, rejecting actual uploads that don't match this size
  const uploadUrl = await getUploadUrl(key, contentType, fileSize)

  // 8. Return
  return Response.json({
    uploadUrl,
    publicUrl: getPublicUrl(key),
    key,
  })
}
