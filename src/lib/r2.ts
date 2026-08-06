import { S3Client, PutObjectCommand, GetObjectCommand,
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

export async function getDownloadUrl(key: string, filename: string) {
  const safeFilename =
    filename.replace(/["\\\r\n]/g, '_').trim() || 'submission'
  const command = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${safeFilename}"`,
  })
  return getSignedUrl(r2Client, command, { expiresIn: 60 })
}

export async function deleteContestFolder(contestId: string) {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME
  const prefix = `submissions/${contestId}/`
  let continuationToken: string | undefined
  let deletedCount = 0

  do {
    const listed = await r2Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }))
    const objects = (listed.Contents ?? [])
      .flatMap((object) => object.Key ? [{ Key: object.Key }] : [])

    if (objects.length > 0) {
      const result = await r2Client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects, Quiet: true },
      }))
      if (result.Errors?.length) {
        throw new Error(
          `R2 rejected ${result.Errors.length} submission object deletion(s)`
        )
      }
      deletedCount += objects.length
    }

    continuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined
  } while (continuationToken)

  return deletedCount
}
