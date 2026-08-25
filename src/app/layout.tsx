import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import { Inter, Oswald } from 'next/font/google'
import { AnalyticsPageview } from '@/components/analytics-pageview'
import './globals.css'

const oswald = Oswald({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-oswald',
})

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://contestic.in'),
  title: {
    default: 'Contestic — Skill-Based Creative Contest Platform',
    template: '%s | Contestic',
  },
  description:
    'A skill-based creative contest platform for hosting briefs, receiving original submissions and awarding fixed prizes for design, writing, naming and video work.',
  keywords: ['creative contests', 'design contests', 'writing contests', 'skill-based contests', 'Contestic'],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: '/',
    siteName: 'Contestic',
    title: 'Contestic — Skill-Based Creative Contest Platform',
    description: 'Host a creative brief, review original submissions and award a fixed prize to the selected winner.',
  },
  twitter: {
    card: 'summary',
    title: 'Contestic — Skill-Based Creative Contest Platform',
    description: 'Host creative briefs, review original submissions and award fixed prizes.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className={`min-h-full flex flex-col bg-background text-foreground ${oswald.variable} ${inter.variable} font-sans`} suppressHydrationWarning>
        <AnalyticsPageview />
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
