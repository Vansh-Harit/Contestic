'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isAuthResolved, setIsAuthResolved] = useState(false)
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string; role: string } | null>(null)

  const isActive = (path: string) => pathname === path

  const fetchProfile = async (userId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, role')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setIsAuthResolved(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setIsAuthResolved(true)
    })

    return () => subscription.unsubscribe()
  }, [])



  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  useEffect(() => {
    if (!isDropdownOpen) return

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.profile-dropdown-container')) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [isDropdownOpen])

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-outline-variant bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-container-padding-mobile md:px-container-padding-desktop">
        <div className="flex items-center">
          <Link
            href="/"
            className="text-headline-md font-heading font-bold text-primary tracking-tight"
          >
            Contestic
          </Link>
        </div>

        {/* Desktop Buttons */}
        <div className="hidden md:flex items-center gap-6 font-sans">
          {user ? (
            <>
              <button
                onClick={() => router.push('/post')}
                className="mr-1 flex min-h-11 items-center rounded-full bg-primary-container px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                Host a contest
              </button>

              <div className="relative profile-dropdown-container">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center rounded-full"
                  aria-label="Open account menu"
                >
                  <Avatar className="h-9 w-9 border border-outline-variant hover:border-[#6366F1] transition-colors">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary-container text-on-primary-container font-bold">
                      {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-outline-variant bg-surface-container-lowest py-2 shadow-xl z-50 font-sans animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-outline-variant/50 mb-1">
                      <p className="text-body-sm font-bold text-on-surface truncate">
                        {profile?.full_name || 'My Account'}
                      </p>
                      <p className="text-[11px] text-secondary truncate">
                        {user.email}
                      </p>
                    </div>
                    <Link
                      href="/"
                      onClick={() => setIsDropdownOpen(false)}
                      className={`flex items-center px-4 py-2 text-body-sm font-medium transition-colors hover:bg-surface-container-low ${isActive('/') ? 'text-primary font-bold' : 'text-secondary hover:text-primary'
                        }`}
                    >
                      Browse
                    </Link>
                    <Link
                      href="/dashboard/lister"
                      onClick={() => setIsDropdownOpen(false)}
                      className={`flex items-center px-4 py-2 text-body-sm font-medium transition-colors hover:bg-surface-container-low ${pathname.startsWith('/dashboard/lister') ? 'text-primary font-bold' : 'text-secondary hover:text-primary'
                        }`}
                    >
                      Hosted contests
                    </Link>
                    <Link
                      href="/dashboard/contestant"
                      onClick={() => setIsDropdownOpen(false)}
                      className={`flex items-center px-4 py-2 text-body-sm font-medium transition-colors hover:bg-surface-container-low ${pathname.startsWith('/dashboard/contestant') ? 'text-primary font-bold' : 'text-secondary hover:text-primary'
                        }`}
                    >
                      My contests
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setIsDropdownOpen(false)}
                      className={`flex items-center px-4 py-2 text-body-sm font-medium transition-colors hover:bg-surface-container-low ${pathname === '/settings' ? 'text-primary font-bold' : 'text-secondary hover:text-primary'
                        }`}
                    >
                      Settings
                    </Link>
                    {profile?.role === 'admin' && (
                      <Link
                        href="/admin/payouts"
                        onClick={() => setIsDropdownOpen(false)}
                        className={`flex items-center px-4 py-2 text-body-sm font-medium transition-colors hover:bg-surface-container-low ${pathname.startsWith('/admin') ? 'text-primary font-bold' : 'text-secondary hover:text-primary'
                          }`}
                      >
                        Admin Payouts
                      </Link>
                    )}
                    <hr className="border-outline-variant/50 my-1" />
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false)
                        handleSignOut()
                      }}
                      className="flex w-full items-center px-4 py-2 text-left text-body-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : isAuthResolved ? (
            <>
              <button
                onClick={() => router.push('/login')}
                className="text-secondary font-body-md font-medium hover:text-primary transition-colors duration-200 cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => router.push('/login?next=/post')}
                className="flex min-h-11 items-center rounded-full bg-primary-container px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                Host a contest
              </button>
            </>
          ) : (
            <div className="h-11 w-48 animate-pulse rounded-full bg-gray-100" aria-hidden="true" />
          )}
        </div>

        {/* Mobile Menu Icon */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-on-surface hover:text-primary transition-colors p-2"
            aria-label="Toggle Menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="md:hidden border-t border-outline-variant bg-surface-container-lowest py-4 px-container-padding-mobile flex flex-col gap-4 shadow-lg animate-in slide-in-from-top duration-200">
          {user ? (
            <>
              <div className="flex items-center gap-3 py-2 px-1">
                <Avatar className="h-8 w-8 border border-outline-variant">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary-container text-on-primary-container font-bold text-xs">
                    {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-body-md font-bold text-on-surface">{profile?.full_name || user.email}</span>
              </div>
              <hr className="border-outline-variant" />
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className={`text-body-md font-medium py-2 ${isActive('/') ? 'text-primary font-bold' : 'text-secondary'}`}
              >
                Browse
              </Link>
              <Link
                href="/dashboard/lister"
                onClick={() => setIsOpen(false)}
                className={`text-body-md font-medium py-2 ${pathname.startsWith('/dashboard/lister') ? 'text-primary font-bold' : 'text-secondary'}`}
              >
                Hosted contests
              </Link>
              <Link
                href="/dashboard/contestant"
                onClick={() => setIsOpen(false)}
                className={`text-body-md font-medium py-2 ${pathname.startsWith('/dashboard/contestant') ? 'text-primary font-bold' : 'text-secondary'}`}
              >
                My contests
              </Link>
              {profile?.role === 'admin' && (
                <Link
                  href="/admin/payouts"
                  onClick={() => setIsOpen(false)}
                  className={`text-body-md font-medium py-2 ${pathname.startsWith('/admin') ? 'text-primary font-bold' : 'text-secondary'
                    }`}
                >
                  Admin Payouts
                </Link>
              )}
              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                className={`text-body-md font-medium py-2 ${pathname === '/settings' ? 'text-primary font-bold' : 'text-secondary'}`}
              >
                Settings
              </Link>
              <button
                onClick={() => {
                  setIsOpen(false)
                  handleSignOut()
                }}
                className="text-left text-secondary font-medium py-2 hover:text-primary"
              >
                Sign Out
              </button>
            </>
          ) : isAuthResolved ? (
            <>
              <button
                onClick={() => {
                  setIsOpen(false)
                  router.push('/login')
                }}
                className="text-left text-secondary font-medium py-2 hover:text-primary"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  router.push('/login?next=/post')
                }}
                className="w-full bg-primary-container text-on-primary-container py-3 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Post a Contest
              </button>
            </>
          ) : (
            <div className="h-11 w-full animate-pulse rounded-lg bg-gray-100" aria-hidden="true" />
          )}
        </div>
      )}
    </nav>
  )
}
