import Link from 'next/link'
import { legalDetails } from '@/lib/legal-details'

export default function GrievancePage() {
  const officer = legalDetails.grievanceOfficer

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-container-padding-mobile py-12 font-sans md:px-container-padding-desktop md:py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">Back to Contestic</Link>
      <header className="mt-6 border-b border-outline-variant pb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Support</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-on-surface">Grievance redressal</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">For complaints concerning a payment, payout, refund, contest administration, privacy or platform access.</p>
      </header>

      <section className="mt-8 rounded-2xl border border-outline-variant bg-white p-6 shadow-sm">
        <h2 className="font-heading text-xl font-bold text-on-surface">Grievance Officer</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-secondary">Name</dt><dd className="mt-1 font-semibold text-on-surface">{officer.name}</dd></div>
          <div><dt className="text-secondary">Title</dt><dd className="mt-1 font-semibold text-on-surface">{officer.title}</dd></div>
          <div><dt className="text-secondary">Email</dt><dd className="mt-1"><a href={`mailto:${officer.email}`} className="font-semibold text-primary hover:underline">{officer.email}</a></dd></div>
          <div><dt className="text-secondary">Phone</dt><dd className="mt-1"><a href={`tel:${officer.phone.replace(/\s/g, '')}`} className="font-semibold text-primary hover:underline">{officer.phone}</a></dd></div>
        </dl>
      </section>

      <section className="mt-5 rounded-2xl border border-outline-variant bg-surface-container-low p-6">
        <h2 className="font-heading text-xl font-bold text-on-surface">How to raise a grievance</h2>
        <p className="mt-3 text-sm leading-7 text-on-surface-variant">Email the Grievance Officer with your account email, contest title or link, relevant payment or payout reference if applicable, and a short description of the issue. Contestic will acknowledge a grievance {legalDetails.grievanceAcknowledgementTimeline} and aims to resolve it {legalDetails.grievanceResolutionTimeline}.</p>
      </section>
    </main>
  )
}
