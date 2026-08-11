'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    if (password.length < 8) {
      setErrorMessage('Choose a password with at least 8 characters.')
      return
    }

    if (password !== confirmation) {
      setErrorMessage('The passwords do not match.')
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setErrorMessage(
        error.code === 'same_password'
          ? 'Your new password must be different from your current password.'
          : 'Your password could not be updated. Request a new reset link and try again.'
      )
      setIsLoading(false)
      return
    }

    toast.success('Password updated successfully.')
    router.replace('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F8F7FF] px-container-padding-mobile py-12 font-sans">
      <div className="w-full max-w-[440px] rounded-2xl border border-outline-variant bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-8 text-center">
          <Link
            href="/"
            className="mb-5 block font-heading text-2xl font-bold tracking-tight text-primary"
          >
            Contestic
          </Link>
          <h1 className="mb-2 font-heading text-3xl font-bold text-on-surface">
            Choose a new password
          </h1>
          <p className="text-body-sm text-secondary">
            Use at least 8 characters and keep this password unique to Contestic.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm font-medium text-on-surface">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              disabled={isLoading}
              className="min-h-11 rounded-lg border-outline-variant bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm font-medium text-on-surface">
              Confirm new password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              required
              disabled={isLoading}
              className="min-h-11 rounded-lg border-outline-variant bg-white"
            />
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {errorMessage}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="min-h-12 w-full rounded-lg bg-primary-container py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            {isLoading ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      </div>
    </main>
  )
}
