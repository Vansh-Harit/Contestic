import type { SubmissionAttachment } from '@/lib/types'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_ATTACHMENTS = 10

export type { SubmissionAttachment } from '@/lib/types'

function safeFilename(value: unknown): string {
  if (typeof value !== 'string') return 'Attachment'
  return value.trim().slice(0, 255) || 'Attachment'
}

export function submissionDownloadPath(
  contestId: string,
  key: string
): string {
  const params = new URLSearchParams({ contest_id: contestId, key })
  return `/api/download?${params.toString()}`
}

export function normalizeSubmissionAttachments(
  contestId: string,
  contestantId: string,
  value: unknown
): SubmissionAttachment[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid file data')
  }
  if (value.length > MAX_ATTACHMENTS) {
    throw new Error('Maximum 10 attachments per submission')
  }

  let totalBytes = 0
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid attachment')
    }

    const attachment = raw as Record<string, unknown>
    if (attachment.type === 'upload') {
      const key =
        typeof attachment.key === 'string' ? attachment.key : ''
      const expectedPrefix = `submissions/${contestId}/${contestantId}/`
      if (!key.startsWith(expectedPrefix) || key.includes('..')) {
        throw new Error('Invalid upload key')
      }

      const sizeBytes = Number(attachment.size_bytes)
      if (
        !Number.isFinite(sizeBytes) ||
        sizeBytes <= 0 ||
        sizeBytes > MAX_FILE_BYTES
      ) {
        throw new Error('Invalid upload size')
      }

      totalBytes += sizeBytes
      if (totalBytes > MAX_FILE_BYTES) {
        throw new Error('Total file size exceeds 20MB limit')
      }

      return {
        type: 'upload',
        key,
        url: submissionDownloadPath(contestId, key),
        filename: safeFilename(attachment.filename),
        size_bytes: sizeBytes,
      }
    }

    if (attachment.type === 'drive_link') {
      if (typeof attachment.url !== 'string') {
        throw new Error('Invalid Drive link')
      }

      let url: URL
      try {
        url = new URL(attachment.url)
      } catch {
        throw new Error('Invalid Drive link')
      }

      if (url.protocol !== 'https:') {
        throw new Error('Drive links must use HTTPS')
      }

      return {
        type: 'drive_link',
        url: url.toString(),
        filename: safeFilename(attachment.filename),
        size_bytes: 0,
      }
    }

    throw new Error('Invalid attachment type')
  })
}

export function attachmentObjectKey(
  attachment: unknown,
  publicBaseUrl?: string
): string | null {
  if (!attachment || typeof attachment !== 'object') return null
  const value = attachment as Record<string, unknown>

  if (typeof value.key === 'string') return value.key
  if (
    typeof value.url !== 'string' ||
    !publicBaseUrl
  ) {
    return null
  }

  try {
    const attachmentUrl = new URL(value.url)
    const baseUrl = new URL(publicBaseUrl)
    if (attachmentUrl.origin !== baseUrl.origin) return null

    const basePath = baseUrl.pathname.replace(/\/$/, '')
    if (!attachmentUrl.pathname.startsWith(`${basePath}/`)) return null
    return decodeURIComponent(
      attachmentUrl.pathname.slice(basePath.length + 1)
    )
  } catch {
    return null
  }
}

export function authorizeStoredAttachments(
  contestId: string,
  attachments: unknown
): SubmissionAttachment[] {
  if (!Array.isArray(attachments)) return []

  return attachments.map((attachment) => {
    if (!attachment || typeof attachment !== 'object') {
      return attachment as SubmissionAttachment
    }

    const value = attachment as SubmissionAttachment
    if (value.type !== 'upload') return value

    const key = attachmentObjectKey(
      value,
      process.env.CLOUDFLARE_R2_PUBLIC_URL
    )
    if (!key) return { ...value, url: undefined }

    return {
      ...value,
      key,
      url: submissionDownloadPath(contestId, key),
    }
  })
}
