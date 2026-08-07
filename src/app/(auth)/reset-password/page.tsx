import { redirect } from 'next/navigation'
import ResetPasswordForm from '@/components/reset-password-form'
import { createClient } from '@/lib/supabase/server'

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: claimsData,
  } = await supabase.auth.getClaims()

  if (!claimsData?.claims?.sub) {
    redirect('/login?error=invalid_recovery_link')
  }

  return <ResetPasswordForm />
}
