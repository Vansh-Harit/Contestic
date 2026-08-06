'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setMessage(null)
    setHasError(false)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    })

    if (error) {
      setHasError(true)
      setMessage('We could not send a recovery email right now. Please wait and try again.')
    } else {
      setMessage(
        'If an account exists for that email, a password-reset link is on its way.'
      )
    }

    setIsLoading(false)
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
            Reset your password
          </h1>
          <p className="text-body-sm text-secondary">
            Enter your account email and we will send you a secure reset link.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="recovery-email" className="text-sm font-medium text-on-surface">
              Email address
            </Label>
            <Input
              id="recovery-email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={isLoading}
              className="min-h-11 rounded-lg border-outline-variant bg-white"
            />
          </div>

          {message && (
            <p
              role={hasError ? 'alert' : 'status'}
              className={`rounded-lg border px-4 py-3 text-sm ${
                hasError
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-800'
              }`}
            >
              {message}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="min-h-12 w-full rounded-lg bg-primary-container py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            {isLoading ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

        <div className="mt-6 border-t border-outline-variant pt-6 text-center">
          <Link
            href="/login"
            className="text-body-sm font-semibold text-secondary transition-colors hover:text-primary"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
