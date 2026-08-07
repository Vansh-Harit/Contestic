import Navbar from '@/components/navbar'
import { AuthProvider } from '@/components/auth-provider'
import Link from 'next/link'
import { Mail } from 'lucide-react'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <Navbar />
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="mt-16 w-full border-t border-outline-variant bg-white py-8 font-sans">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-container-padding-mobile md:flex-row md:items-center md:justify-between md:px-container-padding-desktop">
          <div className="flex max-w-xl flex-col gap-2">
            <div className="font-heading text-xl font-bold text-on-surface">
              Contestic
            </div>
            <p className="text-sm text-secondary">
              A focused marketplace for hosting and entering creative contests.
            </p>
          </div>

          <div className="flex flex-col gap-4 text-sm text-secondary sm:flex-row sm:items-center sm:gap-6">
            <Link href="/terms" className="font-medium transition-colors hover:text-primary">
              Terms and conditions
            </Link>
            <Link href="/privacy" className="font-medium transition-colors hover:text-primary">
              Privacy policy
            </Link>
            <a
              href="mailto:contestic.support@gmail.com"
              className="inline-flex items-center gap-2 font-medium transition-colors hover:text-primary"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              contestic.support@gmail.com
            </a>
            <span>© {new Date().getFullYear()} Contestic</span>
          </div>
        </div>
      </footer>
    </AuthProvider>
  )
}
