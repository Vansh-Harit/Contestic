import Link from 'next/link'

const steps = [
  {
    title: '1. Browse open contests',
    body: 'Explore contests by category, compare the prize, available entry slots, public description and important deadlines, then open a listing to review its public details.',
  },
  {
    title: '2. Enter before entries close',
    body: 'Choose a contest that fits your skills and enter during the entry period. Entry is final, and the complete brief remains locked until the entry period ends so every contestant receives it at the same stage.',
  },
  {
    title: '3. Create and submit your work',
    body: 'When the submission period opens, eligible contestants can view the full brief and materials. Submit your description, uploaded files or supported external links before the fixed submission deadline.',
  },
  {
    title: '4. Follow the result',
    body: 'The host reviews submissions during judging and selects a winner. Contestants can follow the outcome from Participated contests. If you win, add your UPI ID so Contestic can prepare the manual prize payout and record its transfer reference.',
  },
]

export default function ContestantsGuidePage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-container-padding-mobile py-12 font-sans md:px-container-padding-desktop md:py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">Back to Contestic</Link>
      <header className="mt-6 border-b border-outline-variant pb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">How Contestic Works</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-on-surface">For contestants</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-secondary">
          Find contests that match your skills, enter fairly, submit before the deadline and follow your result in one place.
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
      <Link href="/" className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">
        Browse contests
      </Link>
    </main>
  )
}
