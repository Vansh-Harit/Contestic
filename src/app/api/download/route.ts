import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDownloadUrl } from '@/lib/r2'
import {
  canAccessSubmissionFile,
  getAuthorizationStage,
} from '@/lib/authorization'
import { attachmentObjectKey } from '@/lib/submission-files'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const contestId = searchParams.get('contest_id')
  const key = searchParams.get('key')

  if (!contestId || !key) {
    return NextResponse.json(
      { error: 'contest_id and key are required' },
      { status: 400 }
    )
  }

  if (
    !key.startsWith(`submissions/${contestId}/`) ||
    key.includes('..')
  ) {
    return NextResponse.json({ error: 'Invalid file key' }, { status: 400 })
  }

  const keyParts = key.split('/')
  const contestantId = keyParts[2]
  const storedFilename = keyParts.slice(3).join('/')
  const downloadFilename = storedFilename.replace(/^\d+_/, '')

  if (!contestantId || !storedFilename) {
    return NextResponse.json({ error: 'Invalid file key' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: contest, error: contestError } = await admin
    .from('contests')
    .select('lister_id, status, deadline, entry_deadline, entry_limit, max_entries')
    .eq('id', contestId)
    .single()

  if (contestError || !contest) {
    return NextResponse.json({ error: 'Contest not found' }, { status: 404 })
  }

  if (contest.status === 'completed' || contest.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Submission access has ended for this contest' },
      { status: 403 }
    )
  }

  const [{ count: entryCount }, { data: submission, error: submissionError }] =
    await Promise.all([
      admin
        .from('contest_entries')
        .select('*', { count: 'exact', head: true })
        .eq('contest_id', contestId),
      admin
        .from('submissions')
        .select('contestant_id, file_urls')
        .eq('contest_id', contestId)
        .eq('contestant_id', contestantId)
        .maybeSingle(),
    ])

  if (submissionError) {
    return NextResponse.json(
      { error: 'Failed to authorize file' },
      { status: 500 }
    )
  }

  const ownsStoredAttachment =
    submission &&
    Array.isArray(submission.file_urls) &&
    submission.file_urls.some(
      (attachment) =>
        attachmentObjectKey(
          attachment,
          process.env.CLOUDFLARE_R2_PUBLIC_URL
        ) === key
    )

  if (!submission || !ownsStoredAttachment) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const stage = getAuthorizationStage({
    status: contest.status,
    entryDeadline: contest.entry_deadline,
    deadline: contest.deadline,
    entryCount: entryCount ?? 0,
    entryLimit: contest.entry_limit ?? contest.max_entries,
  })

  const allowed = canAccessSubmissionFile({
    isCreator: contest.lister_id === user.id,
    ownsSubmission: submission.contestant_id === user.id,
    stage,
  })

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const signedUrl = await getDownloadUrl(key, downloadFilename)
    return NextResponse.redirect(signedUrl)
  } catch (error) {
    console.error('Signed download failed:', error)
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    )
  }
}
