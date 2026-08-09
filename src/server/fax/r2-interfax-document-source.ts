/**
 * Adapts one session document in R2 to InterFAX's storage-agnostic ranged
 * document source. Every range is pinned to the initially observed R2 ETag so
 * one fax cannot accidentally combine chunks from different object versions.
 */
import type { InterfaxDocumentSource } from "@/server/fax/interfax-document.service"
import type { FaxSessionDocument } from "@/shared/session/fax-session.types"

export type R2InterfaxDocumentSourceErrorCode =
  | "DOCUMENT_CHANGED"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_SIZE_MISMATCH"
  | "INVALID_DOCUMENT_RANGE"
  | "RANGE_UNAVAILABLE"

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
 * this check first avoids creating a temporary provider document for a missing
 * or stale application object.
 */
export async function createR2InterfaxDocumentSource(
  bucket: R2Bucket,
  document: FaxSessionDocument
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
    name: document.originalName,
    sizeBytes: object.size,
    readRange: (offset, length) =>
      readR2Range(bucket, document.objectKey, object.etag, object.size, {
        offset,
        length,
      }),
  }
}

type RequiredRange = {
  offset: number
  length: number
}

/** Reads one exact range while requiring the original R2 object version. */
async function readR2Range(
  bucket: R2Bucket,
  objectKey: string,
  etag: string,
  objectSize: number,
  range: RequiredRange
): Promise<ArrayBuffer> {
  validateRange(range, objectSize)

  const object = await bucket.get(objectKey, {
    onlyIf: {
      etagMatches: etag,
    },
    range,
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

  if (bytes.byteLength !== range.length) {
    throw new R2InterfaxDocumentSourceError(
      "RANGE_UNAVAILABLE",
      `R2 returned ${bytes.byteLength} bytes for '${objectKey}' instead of ${range.length}.`
    )
  }

  return bytes
}

/** Rejects impossible ranges before sending a request to R2. */
function validateRange(range: RequiredRange, objectSize: number): void {
  const rangeEnd = range.offset + range.length
  const valid =
    Number.isSafeInteger(range.offset) &&
    Number.isSafeInteger(range.length) &&
    range.offset >= 0 &&
    range.length > 0 &&
    rangeEnd <= objectSize

  if (!valid) {
    throw new R2InterfaxDocumentSourceError(
      "INVALID_DOCUMENT_RANGE",
      `The requested document range ${range.offset}-${rangeEnd - 1} exceeds the ${objectSize}-byte R2 object.`
    )
  }
}
