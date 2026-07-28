import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { razorpay } from '@/lib/razorpay'
import { NextResponse } from 'next/server'
import { rupeesToPaise, calcPlatformFee, calcTotal } from '@/lib/utils'
import { MIN_PRIZE_INR, MAX_PRIZE_INR, MIN_ENTRIES, MAX_ENTRIES } from '@/lib/constants'
import { createContestRatelimit } from '@/lib/ratelimit'

export async function GET() {
  const supabase = await createClient()

  const { data: contests, error } = await supabase
    .from('contests_with_counts')
    .select('*')
    .in('status', ['active', 'judging'])
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(contests)
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limiting (Upstash Redis — 3 contest creations per minute)
  const { success, reset } = await createContestRatelimit.limit(user.id)
  if (!success) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      { status: 429 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Validate required fields
  const { title, description, public_summary, category, prize_amount_inr, max_entries, deadline, ai_policy, entry_window_hours, materials } = body

  if (!title || !description || !public_summary || !category || !prize_amount_inr || !max_entries || !deadline || !ai_policy) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  if (typeof title !== 'string' || title.length < 10 || title.length > 100) {
    return NextResponse.json({ error: 'Title must be between 10 and 100 characters' }, { status: 400 })
  }

  if (typeof public_summary !== 'string' || public_summary.length < 20 || public_summary.length > 200) {
    return NextResponse.json({ error: 'Contest teaser must be between 20 and 200 characters' }, { status: 400 })
  }

  if (typeof description !== 'string' || description.length < 50) {
    return NextResponse.json({ error: 'Description must be at least 50 characters' }, { status: 400 })
  }

  if (!['Naming', 'Content Writing', 'Design', 'Video Editing', 'Others'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  if (!['none', 'partial', 'allowed'].includes(ai_policy)) {
    return NextResponse.json({ error: 'Invalid AI policy' }, { status: 400 })
  }

  const prizeInr = Number(prize_amount_inr)
  if (isNaN(prizeInr) || prizeInr < MIN_PRIZE_INR || prizeInr > MAX_PRIZE_INR) {
    return NextResponse.json(
      { error: `Prize must be between ${MIN_PRIZE_INR} and ${MAX_PRIZE_INR} INR` },
      { status: 400 }
    )
  }

  const entries = Number(max_entries)
  if (isNaN(entries) || entries < MIN_ENTRIES || entries > MAX_ENTRIES) {
    return NextResponse.json(
      { error: `Max entries must be between ${MIN_ENTRIES} and ${MAX_ENTRIES}` },
      { status: 400 }
    )
  }

  if (new Date(deadline).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Deadline must be a future date' }, { status: 400 })
  }

  const hours = entry_window_hours ? Number(entry_window_hours) : 24
  if (hours !== 24 && hours !== 48) {
    return NextResponse.json({ error: 'Entry window must be 24 or 48 hours' }, { status: 400 })
  }

  // Deadline must be far enough in the future to fit the entry window + buffer
  const minDeadlineMs = Date.now() + (hours + 2) * 60 * 60 * 1000
  if (new Date(deadline).getTime() < minDeadlineMs) {
    return NextResponse.json(
      { error: `Submission deadline must be at least ${hours + 2} hours from now to allow for the ${hours}-hour entry window.` },
      { status: 400 }
    )
  }

  // Validate materials
  if (materials && Array.isArray(materials)) {
    if (materials.length > 10) {
      return NextResponse.json({ error: 'Maximum of 10 materials allowed' }, { status: 400 })
    }
    for (const m of materials) {
      if (!m.type || !['link', 'text'].includes(m.type)) {
        return NextResponse.json({ error: 'Invalid material type' }, { status: 400 })
      }
      if (!m.label || typeof m.label !== 'string' || !m.label.trim()) {
        return NextResponse.json({ error: 'Material label is required' }, { status: 400 })
      }
      if (!m.content || typeof m.content !== 'string' || !m.content.trim()) {
        return NextResponse.json({ error: 'Material content is required' }, { status: 400 })
      }
      if (m.type === 'link') {
        if (!m.content.startsWith('http://') && !m.content.startsWith('https://')) {
          return NextResponse.json({ error: 'Material link URL must start with http:// or https://' }, { status: 400 })
        }
      }
    }
  }

  // Compute ALL amounts server-side. Never trust client-supplied amounts.
  const prizePaise = rupeesToPaise(prizeInr)
  const platformFee = calcPlatformFee(prizePaise)
  const total = calcTotal(prizePaise)

  // Create Razorpay order FIRST. If this fails, no DB record is created.
  let order: any
  try {
    order = await razorpay.orders.create({
      amount: total,
      currency: 'INR',
      receipt: `contest_${Date.now()}`,
      notes: {
        lister_id: user.id,
        prize_paise: String(prizePaise),
      },
    })
  } catch (err: any) {
    console.error('Razorpay order creation failed:', err)
    return NextResponse.json(
      { error: 'Payment gateway error. Please try again.' },
      { status: 502 }
    )
  }

  // Insert contest with status 'draft'
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .insert({
      lister_id: user.id,
      title,
      description,
      public_summary,
      entry_window_hours: hours,
      category,
      prize_amount: prizePaise,
      platform_fee: platformFee,
      total_charged: total,
      max_entries: entries,
      deadline: new Date(deadline).toISOString(),
      ai_policy,
      status: 'draft',
      razorpay_order_id: order.id,
    })
    .select()
    .single()

  if (contestError) {
    // CRITICAL: Razorpay order exists but DB insert failed.
    // Log the orphaned order for manual cleanup.
    console.error(
      `ORPHANED RAZORPAY ORDER: ${order.id} | lister: ${user.id} | amount: ${total}`,
      contestError
    )
    return NextResponse.json(
      { error: 'Failed to create contest. Our team has been notified.' },
      { status: 500 }
    )
  }

  // Insert materials if present
  if (body.materials && Array.isArray(body.materials) && body.materials.length > 0) {
    const { error: materialsError } = await supabase.from('contest_materials').insert(
      body.materials.map((m: any, i: number) => ({
        contest_id: contest.id,
        type: m.type,
        label: m.label,
        content: m.content,
        display_order: i
      }))
    )
    if (materialsError) {
      console.error('Failed to insert contest materials:', materialsError)
    }
  }

  // Insert payment record using admin client (bypasses RLS on payments table)
  const supabaseAdmin = createAdminClient()
  const { error: paymentError } = await supabaseAdmin.from('payments').insert({
    contest_id: contest.id,
    razorpay_order_id: order.id,
    amount: total,
    platform_fee: platformFee,
    prize_amount: prizePaise,
    payment_status: 'pending',
    payout_status: 'pending'
  })

  if (paymentError) {
    console.error(
      `ORPHANED PAYMENT RECORD: order=${order.id} contest=${contest.id}`,
      paymentError
    )
    // Contest exists but payment record failed. Non-fatal for the user flow
    // since webhook will reconcile, but log it.
  } else {
    console.log('[Contest] Payment row created for:', contest.id)
  }

  return NextResponse.json({
    contest_id: contest.id,
    order_id: order.id,
    amount: total,
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  })
}
