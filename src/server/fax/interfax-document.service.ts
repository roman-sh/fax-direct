/**
 * Owns InterFAX's document lifecycle. Small PDFs remain inline; larger PDFs
 * are initialized, uploaded sequentially in 1 MiB ranges, and represented by
 * the provider URL that fax submission references.
 */
import {
  createRejectedRequestError,
  InterfaxServiceError,
} from "@/server/fax/interfax.error"

const INTERFAX_BASE_URL = "https://rest.interfax.net"
const INTERFAX_DOCUMENT_CHUNK_BYTES = 1024 * 1024

/** A PDF source that can later be backed efficiently by ranged R2 reads. */
export type InterfaxDocumentSource = {
  name: string
  sizeBytes: number
  readRange(offset: number, length: number): Promise<ArrayBuffer>
}

/** The two document forms accepted by the final fax submission request. */
export type PreparedInterfaxDocument =
  | {
      kind: "inline"
      body: ArrayBuffer
    }
  | {
      kind: "uploaded"
      url: string
    }

type UploadedDocument = {
  id: string
  url: string
}

/** Prepares one PDF for submission through the InterFAX fax endpoint. */
export class InterfaxDocumentService {
  constructor(private readonly authorization: string) {}

  /** Uses the SDK's 1 MiB threshold to select direct or chunked delivery. */
  async prepare(
    document: InterfaxDocumentSource
  ): Promise<PreparedInterfaxDocument> {
    validateDocumentSource(document)

    if (document.sizeBytes <= INTERFAX_DOCUMENT_CHUNK_BYTES) {
      return {
        kind: "inline",
        body: await readDocumentRange(document, 0, document.sizeBytes),
      }
    }

    return {
      kind: "uploaded",
      url: await this.upload(document),
    }
  }

  /** Creates a provider document and uploads every inclusive byte range. */
  private async upload(document: InterfaxDocumentSource): Promise<string> {
    const uploadedDocument = await this.create(document)

    try {
      for (
        let offset = 0;
        offset < document.sizeBytes;
        offset += INTERFAX_DOCUMENT_CHUNK_BYTES
      ) {
        const length = Math.min(
          INTERFAX_DOCUMENT_CHUNK_BYTES,
          document.sizeBytes - offset
        )
        const chunk = await readDocumentRange(document, offset, length)

        await this.uploadChunk(uploadedDocument.id, offset, chunk)
      }
    } catch (error) {
      await this.cancel(uploadedDocument.id)
      throw error
    }

    return uploadedDocument.url
  }

  /** Starts one resumable document upload and reads its ID from Location. */
  private async create(
    document: InterfaxDocumentSource
  ): Promise<UploadedDocument> {
    const url = new URL("/outbound/documents", INTERFAX_BASE_URL)
    url.searchParams.set("name", document.name)
    url.searchParams.set("size", String(document.sizeBytes))

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: this.authorization,
      },
    })

    if (response.status !== 201) {
      throw await createRejectedRequestError(
        "Document upload initialization failed",
        response
      )
    }

    const location = response.headers.get("Location")

    if (!location) {
      throw new InterfaxServiceError(
        "INVALID_PROVIDER_RESPONSE",
        "InterFAX initialized a document without returning its Location header.",
        response.status
      )
    }

    return readUploadedDocument(location)
  }

  /** Uploads one inclusive byte range to an initialized InterFAX document. */
  private async uploadChunk(
    documentId: string,
    offset: number,
    chunk: ArrayBuffer
  ): Promise<void> {
    const end = offset + chunk.byteLength - 1
    const response = await fetch(
      new URL(
        `/outbound/documents/${encodeURIComponent(documentId)}`,
        INTERFAX_BASE_URL
      ),
      {
        method: "POST",
        headers: {
          Authorization: this.authorization,
          Range: `bytes=${offset}-${end}`,
        },
        body: chunk,
      }
    )

    if (!response.ok) {
      throw await createRejectedRequestError(
        `Document chunk ${offset}-${end} failed`,
        response
      )
    }

    await response.body?.cancel()
  }

  /** Best-effort cleanup for a partially uploaded provider document. */
  private async cancel(documentId: string): Promise<void> {
    try {
      const response = await fetch(
        new URL(
          `/outbound/documents/${encodeURIComponent(documentId)}`,
          INTERFAX_BASE_URL
        ),
        {
          method: "DELETE",
          headers: {
            Authorization: this.authorization,
          },
        }
      )

      await response.body?.cancel()
    } catch (error) {
      console.error("interfax_document_cleanup_failed", {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/** Rejects malformed sources before any provider resource is created. */
function validateDocumentSource(document: InterfaxDocumentSource): void {
  if (!document.name.trim() || !Number.isSafeInteger(document.sizeBytes)) {
    throw new InterfaxServiceError(
      "INVALID_DOCUMENT_SOURCE",
      "The PDF name or size is invalid."
    )
  }

  if (document.sizeBytes <= 0) {
    throw new InterfaxServiceError(
      "INVALID_DOCUMENT_SOURCE",
      "The PDF is empty."
    )
  }
}

/** Reads and verifies the exact range required for one provider request. */
async function readDocumentRange(
  document: InterfaxDocumentSource,
  offset: number,
  length: number
): Promise<ArrayBuffer> {
  const bytes = await document.readRange(offset, length)

  if (bytes.byteLength !== length) {
    throw new InterfaxServiceError(
      "INVALID_DOCUMENT_SOURCE",
      `Expected ${length} document bytes at offset ${offset}, received ${bytes.byteLength}.`
    )
  }

  return bytes
}

/** Normalizes the created provider document's ID and absolute URL. */
function readUploadedDocument(location: string): UploadedDocument {
  let url: URL

  try {
    url = new URL(location, INTERFAX_BASE_URL)
  } catch (error) {
    throw new InterfaxServiceError(
      "INVALID_PROVIDER_RESPONSE",
      "InterFAX returned an invalid document Location header.",
      null,
      null,
      { cause: error }
    )
  }

  const id = url.pathname.split("/").filter(Boolean).at(-1)

  if (!id || !/^\d+$/.test(id)) {
    throw new InterfaxServiceError(
      "INVALID_PROVIDER_RESPONSE",
      "InterFAX returned a document Location without an ID."
    )
  }

  return {
    id,
    url: url.toString(),
  }
}
