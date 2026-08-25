import Link from 'next/link'
import { legalDetails } from '@/lib/legal-details'

export default function ServiceDeliveryPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-container-padding-mobile py-12 font-sans md:px-container-padding-desktop md:py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">Back to Contestic</Link>
      <header className="mt-6 border-b border-outline-variant pb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Company policy</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-on-surface">Service delivery and shipping</h1>
        <p className="mt-3 text-sm text-secondary">Effective 25 August 2026</p>
      </header>
      <div className="mt-8 space-y-8 text-sm leading-7 text-on-surface-variant">
        <section>
          <h2 className="font-heading text-xl font-bold text-on-surface">Digital platform service</h2>
          <p className="mt-2">Contestic provides a digital service. No physical goods are sold or shipped. A host&apos;s contest becomes available on the platform after payment is confirmed.</p>
        </section>
        <section>
          <h2 className="font-heading text-xl font-bold text-on-surface">Contest access and delivery</h2>
          <p className="mt-2">During the entry period, users can view the public contest details and eligible contestants may enter. The full brief and materials unlock only for eligible entrants when the submission period begins. A host can review submissions during judging after submissions close.</p>
        </section>
        <section>
          <h2 className="font-heading text-xl font-bold text-on-surface">Prize payout</h2>
          <p className="mt-2">After a winner is selected and provides a valid UPI ID, Contestic initiates the advertised prize payout {legalDetails.payoutTimeline}. The winner receives a transaction reference after the transfer is recorded.</p>
        </section>
        <section>
          <h2 className="font-heading text-xl font-bold text-on-surface">Support</h2>
          <p className="mt-2">For a service-delivery question, contact <a href={`mailto:${legalDetails.supportEmail}`} className="text-primary hover:underline">{legalDetails.supportEmail}</a>.</p>
        </section>
      </div>
    </main>
  )
}
