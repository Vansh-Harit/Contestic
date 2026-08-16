import Link from 'next/link'

const steps = [
  {
    title: '1. Build your contest',
    body: 'Describe the outcome you need, choose a category, publish a concise public description, and keep the complete working brief and materials separate for eligible contestants.',
  },
  {
    title: '2. Set the contest rules',
    body: 'Choose the prize, entry capacity, entry window, fixed submission deadline and AI policy. Review every detail before continuing to payment.',
  },
  {
    title: '3. Pay and go live',
    body: 'A contest becomes live only after Razorpay confirms payment of the advertised prize plus the Contestic platform fee. Once live, the contest cannot be cancelled by the host.',
  },
  {
    title: '4. Review and select a winner',
    body: 'During judging, open Hosted contests to review entrant submissions, files, links and permitted conversations. Download anything you need before confirming the winner because winner selection is final and starts the protected submission-cleanup process.',
  },
]

export default function HostsGuidePage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-container-padding-mobile py-12 font-sans md:px-container-padding-desktop md:py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">Back to Contestic</Link>
      <header className="mt-6 border-b border-outline-variant pb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">How Contestic Works</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-on-surface">For hosts</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-secondary">
          Turn a creative requirement into a structured contest, receive submissions and select the work that fits best.
        </p>
      </header>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {steps.map((step) => (
          <section key={step.title} className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm">
            <h2 className="font-heading text-xl font-bold text-on-surface">{step.title}</h2>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">{step.body}</p>
          </section>
        ))}
      </div>
      <Link href="/post" className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">
        Host a contest
      </Link>
    </main>
  )
}
