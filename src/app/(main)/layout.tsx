import Navbar from '@/components/navbar'
import { AuthProvider } from '@/components/auth-provider'
import Link from 'next/link'
import { Mail } from 'lucide-react'

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.54 5.34A16.72 16.72 0 0 0 15.44 4l-.5 1.02a15.4 15.4 0 0 0-5.87 0L8.56 4a16.95 16.95 0 0 0-4.1 1.35C1.86 9.2 1.15 12.95 1.5 16.64a16.5 16.5 0 0 0 5.02 2.54l1.2-1.65c-.66-.25-1.3-.56-1.9-.93.16-.12.31-.24.46-.36 3.68 1.7 7.67 1.7 11.3 0 .16.13.31.25.46.36-.6.37-1.24.68-1.9.93l1.2 1.65a16.47 16.47 0 0 0 5.03-2.54c.42-4.28-.72-7.99-2.83-11.3ZM8.86 14.37c-1.1 0-2.01-1.02-2.01-2.27s.89-2.27 2.01-2.27c1.13 0 2.03 1.03 2.01 2.27 0 1.25-.89 2.27-2.01 2.27Zm6.28 0c-1.1 0-2.01-1.02-2.01-2.27s.89-2.27 2.01-2.27c1.13 0 2.03 1.03 2.01 2.27 0 1.25-.88 2.27-2.01 2.27Z" />
    </svg>
  )
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <Navbar />
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="mt-16 w-full border-t border-outline-variant bg-white py-10 font-sans">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-container-padding-mobile sm:grid-cols-3 md:grid-cols-[1.2fr_1fr_1fr_1fr] md:px-container-padding-desktop">
          <div className="col-span-2 sm:col-span-3 md:col-span-1">
            <div className="font-heading text-2xl font-bold text-on-surface">Contestic</div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-on-surface">Company</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm text-secondary">
              <Link href="/terms" className="transition-colors hover:text-primary">Terms and conditions</Link>
              <Link href="/privacy" className="transition-colors hover:text-primary">Privacy policy</Link>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-on-surface">How Contestic Works</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm text-secondary">
              <Link href="/how-contestic-works/contestants" className="transition-colors hover:text-primary">For contestants</Link>
              <Link href="/how-contestic-works/hosts" className="transition-colors hover:text-primary">For hosts</Link>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-on-surface">Socials &amp; Support</h2>
            <div className="mt-3 flex items-center gap-3">
              <a
                href="https://mail.google.com/mail/?view=cm&fs=1&to=contestic.support%40gmail.com&su=Contestic%20support"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Email Contestic support"
                title="Email Contestic support"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant text-secondary transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-primary"
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href="https://discord.gg/HtVAjGkFC"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join the Contestic Discord server"
                title="Join the Contestic Discord server"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant text-secondary transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-primary"
              >
                <DiscordIcon className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-outline-variant px-container-padding-mobile pt-6 text-sm text-secondary md:px-container-padding-desktop">
          © {new Date().getFullYear()} Contestic
        </div>
      </footer>
    </AuthProvider>
  )
}
