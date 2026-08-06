import { createHmac, timingSafeEqual } from 'crypto'

function safeHexEqual(expectedHex: string, providedHex: string): boolean {
  if (!/^[a-f0-9]+$/i.test(providedHex)) return false

  const expected = Buffer.from(expectedHex, 'hex')
  const provided = Buffer.from(providedHex, 'hex')
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeHexEqual(expected, signature)
}

export function verifyRazorpayCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return safeHexEqual(expected, signature)
}
