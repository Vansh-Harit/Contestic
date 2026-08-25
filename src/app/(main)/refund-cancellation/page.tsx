import Link from 'next/link'
import { legalDetails } from '@/lib/legal-details'

const sections = [
  {
    title: 'Live contests cannot be cancelled',
    body: 'A host may review the contest before payment. Once payment is confirmed and a contest is live, the host cannot voluntarily cancel it.',
  },
  {
    title: 'When a prize-only refund applies',
    body: 'If the entry period closes with no entrants, the contest closes and the host is eligible for a refund of the advertised prize amount. If contestants entered but nobody submits before the submission deadline, the same prize-only refund applies after that deadline.',
  },
  {
    title: 'Platform fee',
    body: 'The 5% Contestic platform fee is non-refundable in either eligible refund scenario. It covers platform operations, payment processing costs and contest administration.',
  },
  {
    title: 'Refund timing',
    body: `Eligible refunds are initiated ${legalDetails.refundInitiationTimeline}. After initiation, the refund ${legalDetails.refundProcessingTimeline}.`,
  },
  {
    title: 'Other contest outcomes',
    body: 'If valid submissions exist but the host does not select a winner within three days of judging beginning, the host is not refunded. The prize is allocated manually among participants whose submissions are confirmed valid after review. Suspected abuse, payment disputes and exceptional payment failures may require manual review.',
  },
]

export default function RefundCancellationPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-container-padding-mobile py-12 font-sans md:px-container-padding-desktop md:py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">Back to Contestic</Link>
      <header className="mt-6 border-b border-outline-variant pb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Company policy</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-on-surface">Refund and cancellation policy</h1>
        <p className="mt-3 text-sm text-secondary">Effective 25 August 2026</p>
      </header>
      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-heading text-xl font-bold text-on-surface">{section.title}</h2>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">{section.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm leading-7 text-on-surface-variant">
        Need help with a refund or contest outcome? Contact <a href={`mailto:${legalDetails.supportEmail}`} className="text-primary hover:underline">{legalDetails.supportEmail}</a>.
      </p>
    </main>
  )
}
