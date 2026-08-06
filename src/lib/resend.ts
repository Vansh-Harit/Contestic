import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  idempotencyKey: string
): Promise<string | null> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Resend API key is not configured')
  }

  const isProduction = process.env.NODE_ENV === 'production'
  const emailDomain = process.env.EMAIL_DOMAIN?.trim()
  const testRecipient = process.env.TEST_EMAIL?.trim()

  if (isProduction && !emailDomain) {
    throw new Error('Production email domain is not configured')
  }
  if (!isProduction && !testRecipient) {
    throw new Error('TEST_EMAIL is required outside production')
  }

  const from = isProduction
    ? `Contestic <noreply@${emailDomain}>`
    : 'Contestic <onboarding@resend.dev>'
  const recipient = isProduction ? to : testRecipient!

  const { data, error } = await resend.emails.send(
    {
      from,
      to: recipient,
      subject,
      html,
    },
    { idempotencyKey }
  )

  if (error) {
    throw new Error(error.message || 'Resend rejected the email')
  }

  console.log('[Email] Delivery accepted:', data?.id ?? 'provider-id-unavailable')
  return data?.id ?? null
}
