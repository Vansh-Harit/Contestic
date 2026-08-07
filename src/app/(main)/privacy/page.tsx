import Link from 'next/link'

const sections = [
  {
    title: 'Information we collect',
    body: 'We process account information such as your email address, display name, profile photo and bio; contest entries, briefs, submissions, files, links and chat messages; payout details such as a UPI ID and transfer reference; and technical records needed for security, reliability and rate limiting.',
  },
  {
    title: 'Payment information',
    body: 'Payments are processed through Razorpay. Contestic stores the identifiers, amounts and statuses needed to verify and reconcile payments, refunds and payouts. Contestic does not collect or store your full card details.',
  },
  {
    title: 'How information is used',
    body: 'Information is used to authenticate users, operate contests, enforce entry and submission rules, deliver private briefs, enable creator-participant chat, process payments and payouts, send service emails, prevent abuse, investigate failures and improve platform reliability.',
  },
  {
    title: 'Public and private information',
    body: 'Your display name, profile photo and bio may be viewed by other users. Private account, payment and payout information is not part of the public profile. Full briefs, participant materials, submissions and chats are restricted according to the user’s role and the contest stage.',
  },
  {
    title: 'Service providers',
    body: 'Contestic uses service providers to operate the product, including Supabase for authentication and database services, Razorpay for payments, Cloudflare R2 for uploaded submission files, Resend for transactional email, and infrastructure, monitoring and security providers used by the application.',
  },
  {
    title: 'Retention and deletion',
    body: 'Uploaded submission files are scheduled for contest-scoped deletion only after a winner is successfully selected, with failed cleanup retried by the service. External submission links may remain in the database but are no longer displayed after completion. Contest chat access closes after completion and chat records are scheduled for deletion after 90 days. Payment, refund, payout, security and audit records may be retained for reconciliation, fraud prevention, dispute handling and legal obligations.',
  },
  {
    title: 'Your choices',
    body: 'You can update your public name, profile photo and bio from Settings. You may contact contestic.support@gmail.com to ask about your personal information, correction or deletion options. Some records may need to be retained for payment reconciliation, fraud prevention, dispute handling or legal obligations.',
  },
  {
    title: 'Security and changes',
    body: 'Contestic uses access controls and service-side authorization intended to protect private information, but no online service can guarantee absolute security. This policy may change as the product or applicable requirements evolve. Privacy questions may be sent to contestic.support@gmail.com. The operator identity and governing jurisdiction will be published before Contestic moves from controlled testing to a general public launch.',
  },
]

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-container-padding-mobile py-12 font-sans md:px-container-padding-desktop md:py-16">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">Back to Contestic</Link>
      <header className="mt-6 border-b border-outline-variant pb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Legal</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-on-surface">Privacy policy</h1>
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
