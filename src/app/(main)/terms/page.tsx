import Link from 'next/link'

const sections = [
  {
    title: '1. Using Contestic',
    body: 'By creating an account or using Contestic, you agree to these terms. You must provide accurate account and payment information, protect your sign-in credentials, and use the platform only for lawful creative contests.',
  },
  {
    title: '2. How contests work',
    body: 'A host defines the contest, prize, entry limit, deadlines, brief and AI policy. The contest becomes live only after payment is confirmed. Contestant entry is final. The full brief and participant materials remain locked during the entry period and become available during the submission period only to eligible entrants.',
  },
  {
    title: '3. Payments, fees and payouts',
    body: 'Before a contest goes live, the host pays the advertised winner prize plus a 5% Contestic platform fee. The fee covers platform operations, payment processing costs and contest administration; it is not a separate fee charged by Razorpay. For example, a ₹1,000 prize requires a ₹1,050 payment and the selected winner remains eligible for the ₹1,000 prize. Winner payouts are manual UPI transfers after a valid winner is selected and provides the required payout information. Contestic records the transfer reference or UTR as payment evidence.',
  },
  {
    title: '4. Cancellations and contest outcomes',
    body: 'A live contest cannot be cancelled by the host. If the submission period ends with zero submissions, including where users entered but nobody submitted, the host is eligible for a full refund of the prize and the 5% platform fee. If submissions exist but the host does not select a winner within three days of judging beginning, the host is not refunded: Contestic retains the platform fee and the prize is allocated manually among participants whose submissions are confirmed valid after review. Payment disputes, suspected abuse and exceptional failures may be held for manual review.',
  },
  {
    title: '5. Submissions and intellectual property',
    body: 'Users retain ownership of the work they submit. By submitting content, users grant Contestic the limited permission needed to store, display, transmit and process that content for operating the contest. Hosts must not use non-winning work without permission from its creator.',
  },
  {
    title: '6. Prohibited conduct',
    body: 'Do not submit unlawful, infringing, deceptive, abusive or malicious content; manipulate contest outcomes; misuse another person’s identity or payment information; attack the platform; or attempt to access private briefs, submissions, chats or payment records without authorization.',
  },
  {
    title: '7. Availability and enforcement',
    body: 'Contestic may restrict accounts, submissions or contests when necessary to investigate abuse, protect users, comply with law or preserve platform security. Service availability is not guaranteed, and maintenance or third-party service interruptions may occasionally affect access.',
  },
  {
    title: '8. Changes and contact',
    body: 'These terms may be updated as the product and its legal requirements evolve. Material changes will be reflected by a new effective date. Questions may be sent to contestic.support@gmail.com. The operator identity and governing jurisdiction will be published before Contestic moves from controlled testing to a general public launch.',
  },
]

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-container-padding-mobile py-12 font-sans md:px-container-padding-desktop md:py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">Back to Contestic</Link>
      <header className="mt-6 border-b border-outline-variant pb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Legal</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-on-surface">Terms and conditions</h1>
        <p className="mt-3 text-sm text-secondary">Effective 7 August 2026</p>
      </header>
      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-heading text-xl font-bold text-on-surface">{section.title}</h2>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  )
}
