import { S3Client, PutObjectCommand, DeleteObjectCommand,
  ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

export async function getUploadUrl(
  key: string, 
  contentType: string,
  contentLength: number
) {
  if (contentLength > MAX_FILE_SIZE_BYTES) {
    throw new Error('File exceeds 20MB limit')
  }

  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  })
  return getSignedUrl(r2Client, command, { expiresIn: 300 })
}

export function getPublicUrl(key: string): string {
  return `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`
}

export async function deleteContestFolder(contestId: string) {
  const listCommand = new ListObjectsV2Command({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Prefix: `submissions/${contestId}/`,
  })
  const listed = await r2Client.send(listCommand)
  if (!listed.Contents || listed.Contents.length === 0) return

  const deleteCommand = new DeleteObjectsCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Delete: {
      Objects: listed.Contents.map(obj => ({ Key: obj.Key! })),
    },
  })
  await r2Client.send(deleteCommand)
  console.log('[R2] Deleted', listed.Contents.length,
    'files for contest:', contestId)
}
