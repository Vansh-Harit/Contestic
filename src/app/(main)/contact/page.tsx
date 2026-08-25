import Link from 'next/link'
import { legalDetails } from '@/lib/legal-details'

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-container-padding-mobile py-12 font-sans md:px-container-padding-desktop md:py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">Back to Contestic</Link>
      <header className="mt-6 border-b border-outline-variant pb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Company</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-on-surface">Contact and operator details</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">
          Contestic is a skill-based creative contest platform operated by {legalDetails.operatorName}.
        </p>
      </header>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <section className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm">
          <h2 className="font-heading text-xl font-bold text-on-surface">Business details</h2>
          <address className="mt-3 not-italic text-sm leading-7 text-on-surface-variant">
            {legalDetails.brandName}, operated by {legalDetails.operatorName}<br />
            {legalDetails.addressLine1}<br />
            {legalDetails.city}, {legalDetails.state} {legalDetails.postalCode}<br />
            {legalDetails.country}
          </address>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm">
          <h2 className="font-heading text-xl font-bold text-on-surface">Support</h2>
          <div className="mt-3 space-y-2 text-sm leading-7 text-on-surface-variant">
            <p><a href={`mailto:${legalDetails.supportEmail}`} className="text-primary hover:underline">{legalDetails.supportEmail}</a></p>
            <p><a href={`tel:${legalDetails.supportPhone.replace(/\s/g, '')}`} className="text-primary hover:underline">{legalDetails.supportPhone}</a></p>
            <p>{legalDetails.supportHours}</p>
            <p><a href={legalDetails.discordUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Community support on Discord</a></p>
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-outline-variant bg-surface-container-low p-6">
        <h2 className="font-heading text-xl font-bold text-on-surface">What Contestic provides</h2>
        <p className="mt-3 text-sm leading-7 text-on-surface-variant">
          Contestic provides the digital platform and contest administration tools that let hosts publish skill-based creative briefs, receive entries and review submissions. Contestants do not pay an entry fee. Contests are judged on creative work and are not lotteries, betting, random draws or games of chance.
        </p>
      </section>
    </main>
  )
}
