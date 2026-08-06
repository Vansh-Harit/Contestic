import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type PublicProfile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('get_public_profile', { p_profile_id: id })
    .single()

  if (error || !data) notFound()
  const profile = data as PublicProfile
  const name = profile.full_name?.trim() || 'Contestic member'

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-container-padding-mobile py-12 font-sans md:px-container-padding-desktop md:py-16">
      <section className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={`${name}'s profile picture`}
              className="h-24 w-24 rounded-full border border-outline-variant object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-100 text-3xl font-semibold text-indigo-700">
              {name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 pt-1 text-center sm:text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-secondary">Public profile</p>
            <h1 className="break-words font-heading text-3xl font-bold text-on-surface">
              {name}
            </h1>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-secondary">
              {profile.bio?.trim() || 'This member has not added a bio yet.'}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
