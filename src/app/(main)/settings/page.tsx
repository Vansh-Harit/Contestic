import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: claimsData,
    error: authError,
  } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (authError || !userId) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, email, bio')
    .eq('id', userId)
    .single()

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-container-padding-mobile py-10 font-sans md:px-container-padding-desktop md:py-12">
      <h1 className="font-heading text-3xl font-bold text-on-surface">
        Settings
      </h1>
      <p className="mb-8 mt-1 text-sm text-secondary">
        Manage your public profile and private account information.
      </p>
      <SettingsClient
        profile={{
          id: userId,
          fullName: profile?.full_name ?? '',
          avatarUrl: profile?.avatar_url ?? null,
          bio: profile?.bio ?? '',
          email: profile?.email ?? '',
        }}
      />
    </main>
  )
}
