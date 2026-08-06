'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { ALLOWED_AVATAR_TYPES, MAX_AVATAR_SIZE_BYTES } from '@/lib/constants'

interface SettingsClientProps {
  profile: {
    id: string
    fullName: string
    avatarUrl: string | null
    bio: string
    email: string
  }
}

export default function SettingsClient({ profile }: SettingsClientProps) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [fullName, setFullName] = useState(profile.fullName)
  const [bio, setBio] = useState(profile.bio)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const displayUrl = previewUrl || avatarUrl
  const initials = fullName ? fullName.charAt(0).toUpperCase() : profile.email.charAt(0).toUpperCase()

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error('Only JPG and PNG files are allowed')
      return
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error(`File is too large. Maximum size is 300KB (yours: ${Math.round(file.size / 1024)}KB)`)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    uploadAvatar(file)
  }

  async function uploadAvatar(file: File) {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Upload failed')
        setPreviewUrl(null)
        return
      }

      setAvatarUrl(data.avatar_url)
      setPreviewUrl(null)
      toast.success('Profile picture updated')
      router.refresh()
    } catch (error) {
      console.error('[Avatar Upload]', error)
      toast.error('Network error — please try again')
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    setIsRemoving(true)
    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to remove avatar')
        return
      }

      setAvatarUrl(null)
      setPreviewUrl(null)
      toast.success('Profile picture removed')
      router.refresh()
    } catch (error) {
      console.error('[Avatar Remove]', error)
      toast.error('Network error — please try again')
    } finally {
      setIsRemoving(false)
    }
  }

  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault()
    const trimmedName = fullName.trim()
    if (!trimmedName || Array.from(trimmedName).length > 80) {
      toast.error('Name must be between 1 and 80 characters')
      return
    }
    if (Array.from(bio).length > 200) {
      toast.error('Bio must be 200 characters or fewer')
      return
    }

    setIsSavingProfile(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: trimmedName, bio }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update profile')
        return
      }

      setFullName(data.profile.full_name)
      setBio(data.profile.bio ?? '')
      toast.success('Profile updated')
      router.refresh()
    } catch (error) {
      console.error('[Profile Update]', error)
      toast.error('Network error — please try again')
    } finally {
      setIsSavingProfile(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm md:p-8">
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold text-on-surface">Public profile</h2>
            <p className="mt-1 text-sm text-secondary">Your name, photo and bio are visible to other people.</p>
          </div>
          <Link href={`/profile/${profile.id}`} className="shrink-0 text-sm font-semibold text-primary hover:underline">
            View profile
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-[180px_1fr]">
          <div>
            <div className="group relative mx-auto h-28 w-28 md:mx-0">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-indigo-50">
                {displayUrl ? (
                  <img src={displayUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-semibold text-indigo-700">{initials}</span>
                )}
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45">
                    <Loader2 className="h-7 w-7 animate-spin text-white" aria-label="Uploading profile picture" />
                  </div>
                )}
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-colors group-hover:bg-black/35 group-hover:opacity-100 focus-visible:bg-black/35 focus-visible:opacity-100"
                  aria-label="Change profile picture"
                >
                  <Camera className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="rounded-lg bg-primary-container px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                {isUploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
              </button>
              {avatarUrl && !isUploading && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isRemoving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {isRemoving ? 'Removing…' : 'Remove'}
                </button>
              )}
            </div>
            <p className="mt-3 text-center text-xs text-secondary md:text-left">JPG or PNG, maximum 300KB.</p>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileSelect} className="hidden" />
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div>
              <label htmlFor="full-name" className="mb-1.5 block text-sm font-medium text-on-surface">Display name</label>
              <input
                id="full-name"
                value={fullName}
                onChange={(event) => {
                  if (Array.from(event.target.value).length <= 80) setFullName(event.target.value)
                }}
                required
                className="min-h-11 w-full rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface focus:border-indigo-400"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="bio" className="text-sm font-medium text-on-surface">Bio</label>
                <span className="text-xs text-secondary">{Array.from(bio).length}/200</span>
              </div>
              <textarea
                id="bio"
                value={bio}
                onChange={(event) => {
                  if (Array.from(event.target.value).length <= 200) setBio(event.target.value)
                }}
                rows={5}
                placeholder="Tell people a little about yourself and your creative work."
                className="w-full resize-y rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm leading-6 text-on-surface focus:border-indigo-400"
              />
            </div>
            <button
              type="submit"
              disabled={isSavingProfile}
              className="min-h-11 rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              {isSavingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm md:p-8">
        <h2 className="font-heading text-xl font-bold text-on-surface">Account information</h2>
        <p className="mt-1 text-sm text-secondary">Your email is private and used for account access and notifications.</p>
        <div className="mt-5 rounded-lg border border-outline-variant bg-gray-50 px-4 py-3">
          <p className="text-xs font-medium text-secondary">Email address</p>
          <p className="mt-1 break-all text-sm font-medium text-on-surface">{profile.email}</p>
        </div>
      </section>
    </div>
  )
}
