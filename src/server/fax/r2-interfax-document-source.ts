/**
 * Adapts one session document in R2 to InterFAX's storage-agnostic document
 * source. The read is pinned to the initially observed R2 ETag so a changed
 * object cannot be submitted under stale session metadata.
 */
import type { InterfaxDocumentSource } from "@/server/fax/interfax.service"
import type { FaxSessionReadyDocument } from "@/shared/session/fax-session.types"

export type R2InterfaxDocumentSourceErrorCode =
  | "DOCUMENT_CHANGED"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_SIZE_MISMATCH"
  | "DOCUMENT_READ_INCOMPLETE"

/** Identifies session-document storage failures before provider submission. */
export class R2InterfaxDocumentSourceError extends Error {
  constructor(
    readonly code: R2InterfaxDocumentSourceErrorCode,
    message: string
  ) {
    super(message)
    this.name = "R2InterfaxDocumentSourceError"
  }
}

/**
 * Loads and verifies the R2 object before exposing it to InterFAX. Performing
 * this check first avoids starting a fax submission for a missing or stale
 * application object.
 */
export async function createR2InterfaxDocumentSource(
  bucket: R2Bucket,
  document: FaxSessionReadyDocument
): Promise<InterfaxDocumentSource> {
  const object = await bucket.head(document.objectKey)

  if (!object) {
    throw new R2InterfaxDocumentSourceError(
      "DOCUMENT_NOT_FOUND",
      `The fax document '${document.objectKey}' does not exist in R2.`
    )
  }

  if (object.size !== document.sizeBytes) {
    throw new R2InterfaxDocumentSourceError(
      "DOCUMENT_SIZE_MISMATCH",
      `The fax document '${document.objectKey}' has ${object.size} bytes in R2; the session expects ${document.sizeBytes}.`
    )
  }

  return {
    sizeBytes: object.size,
    format: document.format,
    read: () =>
      readR2Document(bucket, document.objectKey, object.etag, object.size),
  }
}

/** Reads the complete document while requiring the original R2 object version. */
async function readR2Document(
  bucket: R2Bucket,
  objectKey: string,
  etag: string,
  objectSize: number
): Promise<ArrayBuffer> {
  const object = await bucket.get(objectKey, {
    onlyIf: {
      etagMatches: etag,
    },
  })

  if (!object) {
    throw new R2InterfaxDocumentSourceError(
      "DOCUMENT_NOT_FOUND",
      `The fax document '${objectKey}' disappeared from R2 while being read.`
    )
  }

  if (!("body" in object)) {
    throw new R2InterfaxDocumentSourceError(
      "DOCUMENT_CHANGED",
      `The fax document '${objectKey}' changed in R2 while being read.`
    )
  }

  const bytes = await object.arrayBuffer()

  if (bytes.byteLength !== objectSize) {
    throw new R2InterfaxDocumentSourceError(
      "DOCUMENT_READ_INCOMPLETE",
      `R2 returned ${bytes.byteLength} bytes for '${objectKey}' instead of ${objectSize}.`
    )
  }

  return bytes
}
