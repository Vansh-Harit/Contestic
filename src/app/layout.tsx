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
  title: 'Contestic — Creative Contest Marketplace',
  description:
    'Host and participate in creative contests for scripts, naming, copywriting, and design. Win real prizes.',
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
