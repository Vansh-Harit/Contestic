interface RazorpayRefund {
  id: string
  payment_id: string
  amount: number
  status: string
}

export async function createIdempotentFullRefund(input: {
  paymentId: string
  amount: number
  idempotencyKey: string
  reason: string
}): Promise<RazorpayRefund> {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new Error('Razorpay refund credentials are not configured')
  }

  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authorization}`,
        'Content-Type': 'application/json',
        'X-Refund-Idempotency': input.idempotencyKey,
      },
      body: JSON.stringify({
        amount: input.amount,
        notes: { reason: input.reason },
      }),
    }
  )

  const body = (await response.json()) as Partial<RazorpayRefund> & {
    error?: { description?: string }
  }
  if (
    !response.ok ||
    typeof body.id !== 'string' ||
    body.payment_id !== input.paymentId ||
    body.amount !== input.amount
  ) {
    throw new Error(body.error?.description || 'Razorpay refund request failed')
  }

  return body as RazorpayRefund
}
