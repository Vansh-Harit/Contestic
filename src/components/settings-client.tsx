'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { MAX_AVATAR_SIZE_BYTES, ALLOWED_AVATAR_TYPES } from '@/lib/constants'

interface SettingsClientProps {
  profile: {
    fullName: string
    avatarUrl: string | null
    email: string
  }
}

export default function SettingsClient({ profile }: SettingsClientProps) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const displayUrl = previewUrl || avatarUrl
  const initials = profile.fullName
    ? profile.fullName.charAt(0).toUpperCase()
    : profile.email.charAt(0).toUpperCase()

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side validation
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error('Only JPG and PNG files are allowed')
      return
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error(`File is too large. Maximum size is 300KB (yours: ${Math.round(file.size / 1024)}KB)`)
      return
    }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    // Upload
    uploadAvatar(file)
  }

  async function uploadAvatar(file: File) {
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Upload failed')
        setPreviewUrl(null)
        return
      }

      setAvatarUrl(data.avatar_url)
      setPreviewUrl(null)
      toast.success('Profile picture updated!')
      router.refresh()
    } catch (err) {
      console.error('[Avatar Upload]', err)
      toast.error('Network error — please try again')
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    setIsRemoving(true)

    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to remove avatar')
        return
      }

      setAvatarUrl(null)
      setPreviewUrl(null)
      toast.success('Profile picture removed')
      router.refresh()
    } catch (err) {
      console.error('[Avatar Remove]', err)
      toast.error('Network error — please try again')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* Profile Picture Section */}
      <section className="border border-outline-variant rounded-xl p-6 bg-surface-container-lowest">
        <h2 className="text-title-md font-bold text-on-surface mb-1">
          Profile Picture
        </h2>
        <p className="text-body-sm text-secondary mb-6">
          JPG or PNG, max 300KB
        </p>

        <div className="flex items-center gap-6">
          {/* Avatar with overlay */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-outline-variant bg-surface-container flex items-center justify-center">
              {displayUrl ? (
                <img
                  src={displayUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-on-surface-variant">
                  {initials}
                </span>
              )}

              {/* Upload spinner overlay */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
            </div>

            {/* Hover overlay */}
            {!isUploading && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
              >
                <Camera className="h-6 w-6 text-white drop-shadow-md" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 rounded-lg text-body-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? 'Uploading...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
            </button>

            {avatarUrl && !isUploading && (
              <button
                onClick={handleRemoveAvatar}
                disabled={isRemoving}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-body-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isRemoving ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </section>

      {/* Account Info Section (read-only display) */}
      <section className="border border-outline-variant rounded-xl p-6 bg-surface-container-lowest">
        <h2 className="text-title-md font-bold text-on-surface mb-4">
          Account Info
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-body-sm font-medium text-secondary block mb-1">
              Name
            </label>
            <p className="text-body-md text-on-surface font-medium">
              {profile.fullName || '—'}
            </p>
          </div>

          <div>
            <label className="text-body-sm font-medium text-secondary block mb-1">
              Email
            </label>
            <p className="text-body-md text-on-surface font-medium">
              {profile.email}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
