import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contest, error } = await supabase
    .from('contests')
    .select(
      '*, profiles!lister_id(id, full_name, avatar_url), submissions(count)'
    )
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  const formatted = {
    ...contest,
    submission_count: contest.submissions?.[0]?.count ?? 0,
  }

  return NextResponse.json(formatted)
}
