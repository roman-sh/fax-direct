/** Creates temporary R2 access for one document conversion job. */
import { AwsClient } from "aws4fetch"

const URL_LIFETIME_SECONDS = 60 * 60

export type R2DocumentUrlConfig = {
  accountId: string
  bucketName: string
  accessKeyId: string
  secretAccessKey: string
}

export type R2DocumentUrls = {
  readUrl: string
  writeUrl: string
}

/**
 * Signs one GET for CloudConvert's input and one PUT for its PDF output.
 * Both URLs address the session's existing R2 key. CloudConvert receives
 * temporary access to that object, not our secret key or a public bucket URL.
 */
export async function createR2DocumentUrls(
  objectKey: string,
  config: R2DocumentUrlConfig
): Promise<R2DocumentUrls> {
  const signer = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: "auto",
    service: "s3",
  })
  const objectUrl = new URL(
    `https://${config.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(config.bucketName)}/${encodeURIComponent(objectKey)}`
  )
  objectUrl.searchParams.set("X-Amz-Expires", String(URL_LIFETIME_SECONDS))

  const [readRequest, writeRequest] = await Promise.all([
    signer.sign(new Request(objectUrl), { aws: { signQuery: true } }),
    signer.sign(new Request(objectUrl, { method: "PUT" }), {
      aws: { signQuery: true },
    }),
  ])

  return {
    readUrl: readRequest.url,
    writeUrl: writeRequest.url,
  }
}
