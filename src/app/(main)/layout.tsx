import Navbar from '@/components/navbar'
import Link from 'next/link'
import { Share2, Mail, Globe } from 'lucide-react'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navbar />
      <div className="flex-1 flex flex-col">{children}</div>
      <footer className="bg-surface-container-low border-t border-outline-variant w-full py-12 mt-section-gap font-sans">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter px-container-padding-mobile md:px-container-padding-desktop max-w-7xl mx-auto">
          <div className="flex flex-col gap-4">
            <div className="text-headline-sm font-heading font-bold text-on-surface">
              Contestic
            </div>
            <p className="text-body-sm text-secondary">
              A premium marketplace for high-stakes creative drafting and design contests.
            </p>
            <div className="text-body-sm text-secondary mt-4">
              © {new Date().getFullYear()} Contestic. All rights reserved.
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="text-label-caps uppercase tracking-wider text-on-surface font-bold">
              Platform
            </div>
            <nav className="flex flex-col gap-2">
              <Link href="/" className="text-secondary hover:text-primary text-body-sm transition-colors">
                Browse
              </Link>
              <Link href="#" className="text-secondary hover:text-primary text-body-sm transition-colors">
                How it Works
              </Link>
              <Link href="#" className="text-secondary hover:text-primary text-body-sm transition-colors">
                Help Center
              </Link>
            </nav>
          </div>
          <div className="flex flex-col gap-4">
            <div className="text-label-caps uppercase tracking-wider text-on-surface font-bold">
              Company
            </div>
            <nav className="flex flex-col gap-2">
              <Link href="#" className="text-secondary hover:text-primary text-body-sm transition-colors">
                About Us
              </Link>
              <Link href="#" className="text-secondary hover:text-primary text-body-sm transition-colors">
                Privacy Policy
              </Link>
              <Link href="#" className="text-secondary hover:text-primary text-body-sm transition-colors">
                Terms of Service
              </Link>
            </nav>
          </div>
          <div className="flex flex-col gap-4">
            <div className="text-label-caps uppercase tracking-wider text-on-surface font-bold">
              Connect
            </div>
            <div className="flex gap-4">
              <a
                href="#"
                className="w-10 h-10 flex items-center justify-center bg-surface-container rounded-lg text-secondary hover:text-primary transition-colors"
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" />
              </a>
              <a
                href="mailto:support@contestic.com"
                className="w-10 h-10 flex items-center justify-center bg-surface-container rounded-lg text-secondary hover:text-primary transition-colors"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="w-10 h-10 flex items-center justify-center bg-surface-container rounded-lg text-secondary hover:text-primary transition-colors"
                aria-label="Website"
              >
                <Globe className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
