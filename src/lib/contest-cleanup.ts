import { createAdminClient } from '@/lib/supabase/admin'
import { deleteContestFolder } from '@/lib/r2'

export async function completeContestSubmissionCleanup(contestId: string) {
  const deletedCount = await deleteContestFolder(contestId)
  const admin = createAdminClient()
  const { error } = await admin
    .from('contests')
    .update({
      submission_cleanup_status: 'completed',
      submission_cleanup_completed_at: new Date().toISOString(),
    })
    .eq('id', contestId)
    .eq('status', 'completed')
    .eq('submission_cleanup_status', 'pending')

  if (error) throw error
  return deletedCount
}
