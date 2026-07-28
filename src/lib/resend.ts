import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.NODE_ENV === 'production'
  ? `Contestic <noreply@${process.env.EMAIL_DOMAIN}>`
  : 'Contestic <onboarding@resend.dev>'

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const recipient = process.env.NODE_ENV === 'production'
    ? to
    : (process.env.TEST_EMAIL ?? to)

  try {
    await resend.emails.send({ from: FROM, to: recipient, subject, html })
    console.log('[Email] Sent to:', recipient, '|', subject)
  } catch (e) {
    console.error('[Email] Failed:', recipient, subject, e)
  }
}
