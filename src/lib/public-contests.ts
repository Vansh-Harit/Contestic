import 'server-only'

import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { VisibleContest } from '@/lib/types'

function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    }
  )
}

export const getCachedVisibleContests = unstable_cache(
  async (): Promise<VisibleContest[]> => {
    const { data, error } = await createPublicClient()
      .rpc('get_visible_contests')
      .in('status', ['active', 'judging'])
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Public contest fetch failed: ${error.message}`)
    return (data ?? []) as VisibleContest[]
  },
  ['public-visible-contests'],
  { revalidate: 60, tags: ['contests'] }
)

export const getCachedVisibleContest = unstable_cache(
  async (contestId: string): Promise<VisibleContest | null> => {
    const { data, error } = await createPublicClient()
      .rpc('get_visible_contests', { p_contest_id: contestId })
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Public contest fetch failed: ${error.message}`)
    }

    return data as VisibleContest
  },
  ['public-visible-contest'],
  { revalidate: 60, tags: ['contests'] }
)
