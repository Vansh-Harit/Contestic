function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function paragraph(content: string): string {
  return `<p style="color:#374151;font-size:15px;line-height:1.6;">${content}</p>`
}

function greeting(name: string): string {
  return `<p style="color:#6b7280;font-size:15px;margin:0 0 20px 0;">Hi ${escapeHtml(name)},</p>`
}

export function base(content: string): string {
  return `<!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:#0f172a;padding:20px 32px;">
        <span style="color:#f59e0b;font-size:20px;font-weight:700;">Contestic</span>
      </div>
      <div style="padding:32px;">${content}</div>
      <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">
          You received this because you have an account on Contestic. Questions? Reply to this email.
        </p>
      </div>
    </div>
  </body>
  </html>`
}

export function btn(text: string, url: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:#f59e0b;color:#000000;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-top:20px;">${escapeHtml(text)}</a>`
}

function heading(text: string): string {
  return `<h2 style="color:#111827;font-size:22px;margin:0 0 8px 0;">${escapeHtml(text)}</h2>`
}

export function contestLiveEmail(
  listerName: string,
  contestTitle: string,
  contestUrl: string,
  entryWindowHours: string | number
): string {
  return base(`
    ${heading('Your contest is live')}
    ${greeting(listerName)}
    ${paragraph(`<strong>"${escapeHtml(contestTitle)}"</strong> is now live and open for entries.`)}
    ${paragraph(`The entry window is open for <strong>${escapeHtml(entryWindowHours)} hours</strong>. The full brief and materials remain private until entry closes.`)}
    ${btn('View Your Contest', contestUrl)}
  `)
}

export function entryConfirmedEmail(
  participantName: string,
  contestTitle: string,
  entryClosesAt: string,
  submissionDeadline: string,
  contestUrl: string
): string {
  return base(`
    ${heading('Your contest entry is confirmed')}
    ${greeting(participantName)}
    ${paragraph(`You are registered for <strong>"${escapeHtml(contestTitle)}"</strong>. Your entry is final and cannot be withdrawn.`)}
    ${paragraph(`The full brief remains private until entry closes at <strong>${escapeHtml(entryClosesAt)}</strong>. We will email you when the submission window opens.`)}
    ${paragraph(`<strong>Submission deadline:</strong> ${escapeHtml(submissionDeadline)}`)}
    ${btn('View Contest', contestUrl)}
  `)
}

export function entryClosedTimeEmail(
  participantName: string,
  contestTitle: string,
  entryCount: number,
  maxEntries: number,
  contestUrl: string,
  submissionDeadline: string
): string {
  return base(`
    ${heading('The submission window is open')}
    ${greeting(participantName)}
    ${paragraph(`The entry period for <strong>"${escapeHtml(contestTitle)}"</strong> has ended. <strong>${escapeHtml(entryCount)} of ${escapeHtml(maxEntries)}</strong> spots were filled.`)}
    ${paragraph('The full brief and contest materials are now available. You can begin preparing your submission.')}
    ${paragraph(`<strong>Submission deadline:</strong> ${escapeHtml(submissionDeadline)}`)}
    ${btn('View Brief and Start Working', contestUrl)}
  `)
}

export function entryClosedFullEmail(
  participantName: string,
  contestTitle: string,
  totalSlots: number,
  contestUrl: string,
  submissionDeadline: string
): string {
  return base(`
    ${heading('All entry slots are filled')}
    ${greeting(participantName)}
    ${paragraph(`<strong>"${escapeHtml(contestTitle)}"</strong> filled all <strong>${escapeHtml(totalSlots)} entry slots</strong>, so the entry period closed early.`)}
    ${paragraph('The full brief and contest materials are now available. The fixed submission deadline has not changed.')}
    ${paragraph(`<strong>Submission deadline:</strong> ${escapeHtml(submissionDeadline)}`)}
    ${btn('View Brief and Start Working', contestUrl)}
  `)
}

export function entryClosedListerEmail(
  listerName: string,
  contestTitle: string,
  entryCount: number,
  reviewUrl: string
): string {
  return base(`
    ${heading('Entry period closed')}
    ${greeting(listerName)}
    ${paragraph(`Entry for <strong>"${escapeHtml(contestTitle)}"</strong> has closed with <strong>${escapeHtml(entryCount)} participant(s)</strong>. Entered contestants can now see the full brief and submit until the fixed deadline.`)}
    ${btn('View Contest', reviewUrl)}
  `)
}

export function newSubmissionEmail(
  listerName: string,
  contestTitle: string,
  submissionCount: number,
  maxSubmissions: number,
  reviewUrl: string
): string {
  return base(`
    ${heading('New submission received')}
    ${greeting(listerName)}
    ${paragraph(`A new submission has been received for <strong>"${escapeHtml(contestTitle)}"</strong>.`)}
    ${paragraph(`Total submissions: <strong>${escapeHtml(submissionCount)}</strong> of ${escapeHtml(maxSubmissions)}.`)}
    ${btn('Review Submissions', reviewUrl)}
  `)
}

export function judgingOpenEmail(
  listerName: string,
  contestTitle: string,
  submissionCount: number,
  reviewUrl: string
): string {
  return base(`
    ${heading('Submissions are ready for review')}
    ${greeting(listerName)}
    ${paragraph(`The fixed submission deadline for <strong>"${escapeHtml(contestTitle)}"</strong> has passed. You have <strong>${escapeHtml(submissionCount)} submission(s)</strong> to review.`)}
    ${paragraph('Please review the work and select one winner within three days.')}
    ${btn('Review Submissions', reviewUrl)}
  `)
}

export function winnerEmail(
  winnerName: string,
  contestTitle: string,
  prizeFormatted: string,
  dashboardUrl: string
): string {
  return base(`
    ${heading('Congratulations - you won!')}
    ${greeting(winnerName)}
    ${paragraph(`You have been selected as the winner of <strong>"${escapeHtml(contestTitle)}"</strong>.`)}
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
      <p style="color:#92400e;font-size:13px;margin:0 0 4px 0;">Your prize</p>
      <p style="color:#f59e0b;font-size:36px;font-weight:700;margin:0;font-family:monospace;">${escapeHtml(prizeFormatted)}</p>
    </div>
    ${paragraph('Add your UPI ID in the dashboard if it is not already present. Contestic will notify you when the manual transfer is completed.')}
    ${btn('Go to Dashboard', dashboardUrl)}
  `)
}

export function notSelectedEmail(
  participantName: string,
  contestTitle: string,
  browseUrl: string
): string {
  return base(`
    ${heading(`Results are in for "${contestTitle}"`)}
    ${greeting(participantName)}
    ${paragraph(`A winner has been selected for <strong>"${escapeHtml(contestTitle)}"</strong>. You were not selected as the winner this time.`)}
    ${paragraph('Thank you for participating and sharing your work. More contests are available when you are ready to try again.')}
    ${btn('Browse More Contests', browseUrl)}
  `)
}

export function prizeSentEmail(
  winnerName: string,
  contestTitle: string,
  prizeFormatted: string,
  maskedUpi: string,
  transferReference: string
): string {
  return base(`
    ${heading('Your prize payment has been completed')}
    ${greeting(winnerName)}
    ${paragraph(`Your prize of <strong>${escapeHtml(prizeFormatted)}</strong> for <strong>"${escapeHtml(contestTitle)}"</strong> has been transferred.`)}
    ${paragraph(`Sent to UPI: <strong>${escapeHtml(maskedUpi)}</strong>`)}
    ${paragraph(`Payment reference (UTR/transaction ID): <strong>${escapeHtml(transferReference)}</strong>`)}
    ${paragraph('The payment may take a few minutes to appear. Reply to this email if it has not arrived within 24 hours.')}
  `)
}

export function autoRefundEmail(
  listerName: string,
  contestTitle: string,
  refundAmount: string,
  retainedFee: string | null,
  reason: 'no_entries' | 'no_submissions'
): string {
  const outcome = reason === 'no_entries'
    ? 'received no entries before the entry period closed'
    : 'received entries, but no submissions before the submission deadline'
  const refundDetails = retainedFee
    ? `${paragraph(`A refund of the advertised prize amount, <strong>${escapeHtml(refundAmount)}</strong>, has been initiated. It may take 5-7 business days to appear.`)}
       ${paragraph(`The Contestic platform fee of <strong>${escapeHtml(retainedFee)}</strong> is non-refundable and has been retained in accordance with the contest terms.`)}`
    : paragraph(`A refund of <strong>${escapeHtml(refundAmount)}</strong> has been initiated. It may take 5-7 business days to appear.`)

  return base(`
    ${heading('Contest closed - prize refund initiated')}
    ${greeting(listerName)}
    ${paragraph(`Your contest <strong>"${escapeHtml(contestTitle)}"</strong> ${outcome}.`)}
    ${refundDetails}
  `)
}

export function adminPayoutRequiredEmail(
  contestTitle: string,
  winnerName: string,
  winnerEmail: string,
  prizeFormatted: string,
  contestId: string,
  payoutUrl: string
): string {
  return base(`
    ${heading('Manual winner payout required')}
    ${paragraph(`<strong>Contest:</strong> ${escapeHtml(contestTitle)}`)}
    ${paragraph(`<strong>Winner:</strong> ${escapeHtml(winnerName)}`)}
    ${paragraph(`<strong>Winner email:</strong> ${escapeHtml(winnerEmail)}`)}
    ${paragraph(`<strong>Prize:</strong> ${escapeHtml(prizeFormatted)}`)}
    ${paragraph(`<strong>Contest ID:</strong> ${escapeHtml(contestId)}`)}
    ${btn('Open Payout Dashboard', payoutUrl)}
  `)
}

export function adminJudgingOverdueEmail(
  contestTitle: string,
  contestId: string,
  submissionCount: number,
  payoutUrl: string
): string {
  return base(`
    ${heading('Manual contest review required')}
    ${paragraph(`<strong>"${escapeHtml(contestTitle)}"</strong> has remained in judging for three days without a selected winner.`)}
    ${paragraph(`Submission count: <strong>${escapeHtml(submissionCount)}</strong><br>Contest ID: <strong>${escapeHtml(contestId)}</strong>`)}
    ${paragraph('Review the contest manually before deciding participant compensation.')}
    ${btn('Open Admin Payouts', payoutUrl)}
  `)
}

export type QueuedEmailPayload = Record<string, string | number>

function payloadString(payload: QueuedEmailPayload, key: string): string {
  const value = payload[key]
  if (typeof value !== 'string') {
    throw new Error(`Invalid email payload field: ${key}`)
  }
  return value
}

function payloadOptionalString(
  payload: QueuedEmailPayload,
  key: string
): string | null {
  const value = payload[key]
  return typeof value === 'string' ? value : null
}

function payloadNumber(payload: QueuedEmailPayload, key: string): number {
  const value = payload[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid email payload field: ${key}`)
  }
  return value
}

export function renderQueuedEmail(
  eventType: string,
  payload: QueuedEmailPayload
): { subject: string; html: string } {
  const contestTitle = payloadString(payload, 'contestTitle')

  switch (eventType) {
    case 'contest_live':
      return {
        subject: `Your contest is live - ${contestTitle}`,
        html: contestLiveEmail(
          payloadString(payload, 'listerName'),
          contestTitle,
          payloadString(payload, 'contestUrl'),
          payloadString(payload, 'entryWindowHours')
        ),
      }
    case 'entry_confirmed':
      return {
        subject: `Entry confirmed - ${contestTitle}`,
        html: entryConfirmedEmail(
          payloadString(payload, 'participantName'),
          contestTitle,
          payloadString(payload, 'entryClosesAt'),
          payloadString(payload, 'submissionDeadline'),
          payloadString(payload, 'contestUrl')
        ),
      }
    case 'submission_open': {
      const participantName = payloadString(payload, 'participantName')
      const contestUrl = payloadString(payload, 'contestUrl')
      const submissionDeadline = payloadString(payload, 'submissionDeadline')
      const totalSlots = payloadNumber(payload, 'totalSlots')
      const entryCount = payloadNumber(payload, 'entryCount')
      const openedEarly = payloadString(payload, 'openedEarly') === 'true'
      return {
        subject: `Submission window open - ${contestTitle}`,
        html: openedEarly
          ? entryClosedFullEmail(
              participantName,
              contestTitle,
              totalSlots,
              contestUrl,
              submissionDeadline
            )
          : entryClosedTimeEmail(
              participantName,
              contestTitle,
              entryCount,
              totalSlots,
              contestUrl,
              submissionDeadline
            ),
      }
    }
    case 'entry_closed_lister':
      return {
        subject: payloadString(payload, 'openedEarly') === 'true'
          ? `All entry slots filled - ${contestTitle}`
          : `Entry period ended - ${contestTitle}`,
        html: entryClosedListerEmail(
          payloadString(payload, 'listerName'),
          contestTitle,
          payloadNumber(payload, 'entryCount'),
          payloadString(payload, 'reviewUrl')
        ),
      }
    case 'new_submission':
      return {
        subject: `New submission on "${contestTitle}"`,
        html: newSubmissionEmail(
          payloadString(payload, 'listerName'),
          contestTitle,
          payloadNumber(payload, 'submissionCount'),
          payloadNumber(payload, 'maxSubmissions'),
          payloadString(payload, 'reviewUrl')
        ),
      }
    case 'empty_contest_refund': {
      const reason = payloadString(payload, 'reason')
      if (reason !== 'no_entries' && reason !== 'no_submissions') {
        throw new Error('Invalid email payload field: reason')
      }
      return {
        subject: `Contest closed - refund initiated for ${contestTitle}`,
        html: autoRefundEmail(
          payloadString(payload, 'listerName'),
          contestTitle,
          payloadString(payload, 'refundAmount'),
          payloadOptionalString(payload, 'retainedFee'),
          reason
        ),
      }
    }
    case 'judging_open':
      return {
        subject: `Review submissions - ${contestTitle}`,
        html: judgingOpenEmail(
          payloadString(payload, 'listerName'),
          contestTitle,
          payloadNumber(payload, 'submissionCount'),
          payloadString(payload, 'reviewUrl')
        ),
      }
    case 'admin_judging_overdue':
      return {
        subject: `Manual review required - ${contestTitle}`,
        html: adminJudgingOverdueEmail(
          contestTitle,
          payloadString(payload, 'contestId'),
          payloadNumber(payload, 'submissionCount'),
          payloadString(payload, 'payoutUrl')
        ),
      }
    case 'winner_selected':
      return {
        subject: `You won ${payloadString(payload, 'prizeFormatted')}!`,
        html: winnerEmail(
          payloadString(payload, 'winnerName'),
          contestTitle,
          payloadString(payload, 'prizeFormatted'),
          payloadString(payload, 'dashboardUrl')
        ),
      }
    case 'winner_not_selected':
      return {
        subject: `Results are in for: ${contestTitle}`,
        html: notSelectedEmail(
          payloadString(payload, 'participantName'),
          contestTitle,
          payloadString(payload, 'browseUrl')
        ),
      }
    case 'admin_payout_required':
      return {
        subject: `Manual payout needed - ${contestTitle}`,
        html: adminPayoutRequiredEmail(
          contestTitle,
          payloadString(payload, 'winnerName'),
          payloadString(payload, 'winnerEmail'),
          payloadString(payload, 'prizeFormatted'),
          payloadString(payload, 'contestId'),
          payloadString(payload, 'payoutUrl')
        ),
      }
    case 'payout_transferred':
      return {
        subject: `Your prize has been sent - ${payloadString(payload, 'prizeFormatted')}`,
        html: prizeSentEmail(
          payloadString(payload, 'winnerName'),
          contestTitle,
          payloadString(payload, 'prizeFormatted'),
          payloadString(payload, 'maskedUpi'),
          payloadString(payload, 'transferReference')
        ),
      }
    default:
      throw new Error(`Unsupported email event type: ${eventType}`)
  }
}
