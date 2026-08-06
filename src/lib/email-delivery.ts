import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend'
import {
  renderQueuedEmail,
  type QueuedEmailPayload,
} from '@/lib/email-templates'

export interface EmailDeliveryInput {
  idempotencyKey: string
  eventType: string
  to: string
  payload: QueuedEmailPayload
  contestId?: string | null
  userId?: string | null
}

interface ClaimedDelivery {
  id: string
  idempotency_key: string
  recipient_email: string
  event_type: string
  payload: QueuedEmailPayload
  attempts: number
  max_attempts: number
}

export interface EmailDeliverySummary {
  claimed: number
  sent: number
  failed: number
  claimFailed: boolean
}

function retryAt(attempts: number): string {
  const minutes = Math.min(5 * 2 ** Math.max(attempts - 1, 0), 360)
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown email delivery error'
  return message.replace(/[\r\n]+/g, ' ').slice(0, 500)
}

export async function enqueueEmail(input: EmailDeliveryInput): Promise<boolean> {
  if (!input.to.trim()) {
    console.error('[Email] Delivery was not queued because the recipient is missing')
    return false
  }

  const admin = createAdminClient()
  const { error } = await admin.from('email_deliveries').upsert(
    {
      idempotency_key: input.idempotencyKey,
      event_type: input.eventType,
      contest_id: input.contestId ?? null,
      user_id: input.userId ?? null,
      recipient_email: input.to.trim(),
      payload: input.payload,
    },
    {
      onConflict: 'idempotency_key',
      ignoreDuplicates: true,
    }
  )

  if (error) {
    Sentry.captureException(error, {
      tags: { operation: 'email_enqueue', eventType: input.eventType },
    })
    console.error('[Email] Could not queue delivery:', input.eventType)
    return false
  }

  return true
}

export async function deliverPendingEmails(
  limit = 25
): Promise<EmailDeliverySummary> {
  const admin = createAdminClient()
  const summary: EmailDeliverySummary = {
    claimed: 0,
    sent: 0,
    failed: 0,
    claimFailed: false,
  }
  const { data, error } = await admin.rpc('claim_due_email_deliveries', {
    p_limit: Math.min(Math.max(limit, 1), 100),
  })

  if (error) {
    Sentry.captureException(error, {
      tags: { operation: 'email_claim' },
    })
    console.error('[Email] Could not claim queued deliveries')
    summary.claimFailed = true
    return summary
  }

  const deliveries = (data ?? []) as ClaimedDelivery[]
  summary.claimed = deliveries.length

  for (const delivery of deliveries) {
    try {
      const rendered = renderQueuedEmail(delivery.event_type, delivery.payload)
      const providerMessageId = await sendEmail(
        delivery.recipient_email,
        rendered.subject,
        rendered.html,
        delivery.idempotency_key
      )

      const { error: sentError } = await admin
        .from('email_deliveries')
        .update({
          status: 'sent',
          provider_message_id: providerMessageId,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          locked_at: null,
          next_attempt_at: null,
          last_error: null,
        })
        .eq('id', delivery.id)
        .eq('status', 'processing')

      if (sentError) throw sentError
      summary.sent++
    } catch (deliveryError) {
      const message = safeErrorMessage(deliveryError)
      const exhausted = delivery.attempts >= delivery.max_attempts

      await admin
        .from('email_deliveries')
        .update({
          status: 'failed',
          locked_at: null,
          next_attempt_at: exhausted ? null : retryAt(delivery.attempts),
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', delivery.id)
        .eq('status', 'processing')

      Sentry.captureException(deliveryError, {
        tags: { operation: 'email_send' },
        extra: { deliveryId: delivery.id, attempts: delivery.attempts },
      })
      console.error('[Email] Queued delivery failed:', delivery.id)
      summary.failed++
    }
  }

  const retentionCutoff = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString()
  const { error: cleanupError } = await admin
    .from('email_deliveries')
    .delete()
    .eq('status', 'sent')
    .lt('sent_at', retentionCutoff)

  if (cleanupError) {
    Sentry.captureException(cleanupError, {
      tags: { operation: 'email_delivery_cleanup' },
    })
  }

  return summary
}

export async function enqueueAndAttemptEmail(
  input: EmailDeliveryInput
): Promise<boolean> {
  const queued = await enqueueEmail(input)
  if (!queued) return false

  const result = await deliverPendingEmails(10)
  return !result.claimFailed && result.failed === 0
}
