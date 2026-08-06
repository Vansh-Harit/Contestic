'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    const supabase = createClient()

    if (isSignUp) {
      const trimmedName = fullName.trim()
      if (!trimmedName || Array.from(trimmedName).length > 80) {
        toast.error('Name must be between 1 and 80 characters')
        setIsLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      })
      if (error) {
        toast.error(error.message)
        setIsLoading(false)
        return
      }
      toast.success('Account created successfully! You can now log in.')
      setIsSignUp(false)
      setIsLoading(false)
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        toast.error(error.message)
        setIsLoading(false)
        return
      }
      toast.success('Welcome back!')
      setIsLoading(false)
      onClose()
      window.location.reload() // Force reload to update navbar state if we aren't using context
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-2xl border border-outline-variant bg-white p-6 font-sans sm:max-w-[430px] sm:p-8">
        <DialogHeader className="space-y-2">
          <DialogTitle className="font-heading text-2xl font-bold text-on-surface">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </DialogTitle>
          <DialogDescription className="text-body-sm text-secondary">
            {isSignUp
              ? 'Join Contestic to host contests or submit your drafts.'
              : 'Sign in to access your creative workspace.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
        {/* Google Sign-In */}
        <button
          type="button"
          onClick={async () => {
            const supabase = createClient()
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo: `${window.location.origin}/api/auth/callback`,
              },
            })
            if (error) toast.error(error.message)
          }}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-outline-variant bg-white px-4 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-gray-50"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.08 24.08 0 0 0 0 21.56l7.98-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-outline-variant" />
          <span className="text-body-sm text-secondary font-medium">or</span>
          <div className="flex-1 h-px bg-outline-variant" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium text-on-surface">
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={80}
                required
                className="min-h-11 rounded-lg border-outline-variant bg-white"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-on-surface">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="min-h-11 rounded-lg border-outline-variant bg-white"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password" className="text-sm font-medium text-on-surface">
                Password
              </Label>
              {!isSignUp && (
                <Link
                  href="/forgot-password"
                  onClick={onClose}
                  className="text-sm font-semibold text-primary transition-colors hover:text-indigo-700"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="min-h-11 rounded-lg border-outline-variant bg-white"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="min-h-12 w-full rounded-lg bg-primary-container py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            {isLoading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </Button>
        </form>
        </div>

        <div className="mt-6 pt-6 border-t border-outline-variant text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-body-sm text-secondary hover:text-primary transition-colors font-medium"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
