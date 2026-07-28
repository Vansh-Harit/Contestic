// ─── INTERNAL HELPERS (not exported) ───

function base(content: string): string {
  return `<!DOCTYPE html>
  <html>
  <head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#f5f5f5;
    font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:#0f172a;padding:20px 32px;">
        <span style="color:#f59e0b;font-size:20px;font-weight:700;">
          Contestic
        </span>
      </div>
      <div style="padding:32px;">
        ${content}
      </div>
      <div style="padding:16px 32px;background:#f8fafc;
        border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">
          You received this because you have an account on Contestic.
          Questions? Reply to this email.
        </p>
      </div>
    </div>
  </body>
  </html>`
}

function btn(text: string, url: string): string {
  return `<a href="${url}" 
    style="display:inline-block;background:#f59e0b;
    color:#000000;font-weight:700;font-size:15px;
    padding:12px 28px;border-radius:8px;
    text-decoration:none;margin-top:20px;">${text}</a>`
}

// Re-export base and btn for inline use in API routes
export { base, btn }

// ─── EXPORTED TEMPLATES ───

export function contestLiveEmail(
  listerName: string,
  contestTitle: string,
  contestUrl: string,
  entryWindowHours: string | number
): string {
  return base(`
    <h2 style="color:#111827;font-size:22px;margin:0 0 8px 0;">
      Your contest is live 🚀
    </h2>
    <p style="color:#6b7280;font-size:15px;margin:0 0 20px 0;">
      Hi ${listerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      <strong>"${contestTitle}"</strong> is now live and open 
      for registrations. The entry window is open for 
      <strong>${entryWindowHours} hours</strong>. 
      Participants will only see the full brief and materials 
      after the entry period closes.
    </p>
    ${btn('View Your Contest', contestUrl)}
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
    <h2 style="color:#111827;font-size:22px;margin:0 0 8px 0;">
      The brief is now revealed 📋
    </h2>
    <p style="color:#6b7280;font-size:15px;margin:0 0 20px 0;">
      Hi ${participantName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      The entry period for <strong>"${contestTitle}"</strong> has ended. 
      <strong>${entryCount} out of ${maxEntries}</strong> spots were filled.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      The full brief and all contest materials are now available. 
      You can start working on your submission.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      <strong>Submission deadline:</strong> ${submissionDeadline}
    </p>
    ${btn('View Brief & Start Working', contestUrl)}
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
    <h2 style="color:#111827;font-size:22px;margin:0 0 8px 0;">
      All spots filled — brief is now live ⚡
    </h2>
    <p style="color:#6b7280;font-size:15px;margin:0 0 20px 0;">
      Hi ${participantName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      Great news — <strong>"${contestTitle}"</strong> is completely full. 
      All <strong>${totalSlots} spots</strong> have been taken and the 
      entry period has closed early.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      The full brief and contest materials are now available. 
      You're competing against ${totalSlots - 1} other participants.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      <strong>Submission deadline:</strong> ${submissionDeadline}
    </p>
    ${btn('View Brief & Start Working', contestUrl)}
  `)
}

export function winnerEmail(
  winnerName: string,
  contestTitle: string,
  prizeFormatted: string,
  dashboardUrl: string
): string {
  return base(`
    <h2 style="color:#111827;font-size:22px;margin:0 0 8px 0;">
      You won! 🏆
    </h2>
    <p style="color:#6b7280;font-size:15px;margin:0 0 20px 0;">
      Hi ${winnerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      Congratulations — you have been selected as the winner of 
      <strong>"${contestTitle}"</strong>.
    </p>
    <div style="background:#fef3c7;border:1px solid #fde68a;
      border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
      <p style="color:#92400e;font-size:13px;margin:0 0 4px 0;">
        Your prize
      </p>
      <p style="color:#f59e0b;font-size:36px;font-weight:700;
        margin:0;font-family:monospace;">
        ${prizeFormatted}
      </p>
    </div>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      Your prize will be transferred within 
      <strong>24-48 working hours</strong>. 
      To receive it faster, make sure your UPI ID is added 
      in your dashboard.
    </p>
    ${btn('Go to Dashboard', dashboardUrl)}
  `)
}

export function notSelectedEmail(
  participantName: string,
  contestTitle: string,
  browseUrl: string
): string {
  return base(`
    <h2 style="color:#111827;font-size:22px;margin:0 0 8px 0;">
      Results are in for "${contestTitle}"
    </h2>
    <p style="color:#6b7280;font-size:15px;margin:0 0 20px 0;">
      Hi ${participantName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      A winner has been selected for 
      <strong>"${contestTitle}"</strong>. 
      Unfortunately you were not selected this time.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      Thank you for participating. There are more contests 
      open right now — keep going.
    </p>
    ${btn('Browse More Contests', browseUrl)}
  `)
}

export function prizeSentEmail(
  winnerName: string,
  contestTitle: string,
  prizeFormatted: string,
  maskedUpi: string
): string {
  return base(`
    <h2 style="color:#111827;font-size:22px;margin:0 0 8px 0;">
      Your prize has been sent 💸
    </h2>
    <p style="color:#6b7280;font-size:15px;margin:0 0 20px 0;">
      Hi ${winnerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      Your prize of <strong>${prizeFormatted}</strong> for 
      <strong>"${contestTitle}"</strong> has been transferred.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      Sent to UPI: <strong>${maskedUpi}</strong>
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      It may take a few minutes to appear in your UPI app. 
      If you have not received it within 24 hours please 
      reply to this email.
    </p>
  `)
}

export function autoRefundEmail(
  listerName: string,
  contestTitle: string,
  refundAmount: string
): string {
  return base(`
    <h2 style="color:#111827;font-size:22px;margin:0 0 8px 0;">
      Contest cancelled — refund initiated
    </h2>
    <p style="color:#6b7280;font-size:15px;margin:0 0 20px 0;">
      Hi ${listerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      Your contest <strong>"${contestTitle}"</strong> received 
      no participants before the deadline and has been 
      automatically cancelled.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      A full refund of <strong>${refundAmount}</strong> has been 
      initiated. This may take 5-7 business days to appear 
      depending on your payment method.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      You are welcome to post a new contest anytime.
    </p>
  `)
}
