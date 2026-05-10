import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const s3 = new S3Client({
  region: process.env.S3_REGION!,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
})

export const S3_BUCKET = process.env.S3_BUCKET!

// Returns a pre-signed PUT URL valid for 5 minutes.
// The caller uploads the file directly to S3, then saves the returned publicUrl.
export async function getPhotoUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket:      S3_BUCKET,
    Key:         key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })

  // Build a stable public URL (works for R2 public buckets / S3 public access)
  const baseEndpoint = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT
  const publicUrl    = `${baseEndpoint}/${S3_BUCKET}/${key}`

  return { uploadUrl, publicUrl }
}
