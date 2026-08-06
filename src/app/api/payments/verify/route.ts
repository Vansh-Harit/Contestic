import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyRazorpayCheckoutSignature } from '@/lib/razorpay-signature'

interface VerificationBody {
  razorpay_order_id?: unknown
  razorpay_payment_id?: unknown
  razorpay_signature?: unknown
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: VerificationBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const orderId = body.razorpay_order_id
  const paymentId = body.razorpay_payment_id
  const signature = body.razorpay_signature
  if (
    typeof orderId !== 'string' ||
    typeof paymentId !== 'string' ||
    typeof signature !== 'string' ||
    orderId.length > 100 ||
    paymentId.length > 100 ||
    signature.length !== 64
  ) {
    return NextResponse.json({ error: 'Invalid payment response' }, { status: 400 })
  }

  const { data: contest } = await supabase
    .from('contests')
    .select('id, razorpay_order_id')
    .eq('lister_id', user.id)
    .eq('razorpay_order_id', orderId)
    .single()

  if (!contest?.razorpay_order_id) {
    return NextResponse.json({ error: 'Payment order not found' }, { status: 404 })
  }

  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Payment verification unavailable' }, { status: 500 })
  }

  if (
    !verifyRazorpayCheckoutSignature(
      contest.razorpay_order_id,
      paymentId,
      signature,
      secret
    )
  ) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  return NextResponse.json({ verified: true })
}
