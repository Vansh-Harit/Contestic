import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, email')
    .eq('id', user.id)
    .single()

  return (
    <main className="max-w-2xl mx-auto w-full px-container-padding-mobile md:px-container-padding-desktop py-12 flex-1 font-sans">
      <h1 className="text-headline-lg font-heading font-bold text-on-surface mb-2">
        Settings
      </h1>
      <p className="text-body-md text-secondary mb-10">
        Manage your profile and account preferences
      </p>
      <SettingsClient
        profile={{
          fullName: profile?.full_name ?? '',
          avatarUrl: profile?.avatar_url ?? null,
          email: user.email ?? '',
        }}
      />
    </main>
  )
}
