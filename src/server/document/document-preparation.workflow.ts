/**
 * Detects and prepares one uploaded document, then publishes its final state.
 *
 * The upload route has already claimed the session as `processing` and stored
 * the bytes in R2. This Workflow owns the slower preparation work so it can
 * survive the request that accepted the upload.
 */
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers"
import {
  fileTypeFromStream,
  type FileTypeResult,
} from "file-type"

import type { MarketConfig } from "@/server/config/market-config.schema"
import { getMarketConfig } from "@/server/config/market-config.service"
import { calculateFaxQuote } from "@/server/quote/quote.service"
import {
  inspectPdfFile,
  PdfInspectionError,
} from "@/shared/pdf/inspect-pdf"
import { DOCUMENT_STATUS } from "@/shared/session/fax-session-status"
import type {
  FaxDocumentErrorCode,
  FaxDocumentFormat,
  FaxSessionQuote,
} from "@/shared/session/fax-session.types"

export type DocumentPreparationWorkflowParams = {
  sessionId: string
}

type DocumentPreparationResult =
  | {
      status: typeof DOCUMENT_STATUS.ready
      pageCount: number
      sizeBytes: number
      format: FaxDocumentFormat
      quote: FaxSessionQuote
    }
  | {
      status: typeof DOCUMENT_STATUS.failed
      error: FaxDocumentErrorCode
    }

type StoredDocument = {
  bytes: ArrayBuffer
  originalName: string
  sizeBytes: number
}

type DocumentValidationResult =
  | {
      isValid: true
      pageCount: number
    }
  | {
      isValid: false
      error: FaxDocumentErrorCode
    }

type DetectedDocument = {
  objectKey: string
  originalName: string
  format: FileTypeResult | null
}

type PreprocessedDocumentFile = {
  objectKey: string
  originalName: string
}

type PreprocessedDocument =
  | (PreprocessedDocumentFile & {
      kind: "pdf"
      format: "pdf"
    })
  | (PreprocessedDocumentFile & {
      kind: "image"
      format: "jpg" | "png"
    })
  | {
      kind: "unsupported"
    }

/** Prepares the document currently claimed by one browser session. */
export class DocumentPreparationWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  DocumentPreparationWorkflowParams
> {
  async run(
    event: Readonly<WorkflowEvent<DocumentPreparationWorkflowParams>>,
    step: WorkflowStep
  ): Promise<void> {
    // The upload route starts one Workflow with the browser session ID. The
    // session contains the R2 object key and the document processing state.
    const { sessionId } = event.payload
    const sessionObject = this.env.FAX_SESSIONS.getByName(sessionId)

    let result: DocumentPreparationResult

    try {
      // Identify the stored file before deciding which preparation path owns
      // it. Only small metadata crosses the Workflow step boundary; the file
      // itself remains in R2.
      const detectedDocument = await step.do(
        "detect-document-type",
        async () => {
          const session = await sessionObject.getSession()
          const document = session.document

          // Only a document accepted by the upload route may be prepared.
          if (document?.status !== DOCUMENT_STATUS.processing) {
            throw new Error(
              `Fax session ${sessionId} has no processing document.`
            )
          }

          // The document metadata points to the original file stored in R2.
          const storedFile = await this.env.FAX_DOCUMENTS.get(
            document.objectKey
          )

          if (!storedFile) {
            throw new Error(
              `Fax session ${sessionId} has no document in R2.`
            )
          }

          return {
            objectKey: document.objectKey,
            originalName: document.originalName,
            format: (await fileTypeFromStream(storedFile.body)) ?? null,
          } satisfies DetectedDocument
        }
      )

      let preprocessedDocument: PreprocessedDocument

      // This switch owns the preprocessing phase. Native files pass through
      // unchanged; conversion formats will run their Workflow steps here
      // before they enter the common PDF or image processor.
      switch (detectedDocument.format?.ext) {
        case "pdf":
          preprocessedDocument = {
            kind: "pdf",
            objectKey: detectedDocument.objectKey,
            originalName: detectedDocument.originalName,
            format: "pdf",
          }
          break

        case "jpg":
        case "png":
          preprocessedDocument = {
            kind: "image",
            objectKey: detectedDocument.objectKey,
            originalName: detectedDocument.originalName,
            format: detectedDocument.format.ext,
          }
          break

        case "heic":
          // HEIC-to-JPEG conversion will become a durable step here.
          preprocessedDocument = {
            kind: "unsupported",
          }
          break

        case "docx":
        case "xlsx":
        case "pptx":
          // Office-to-PDF conversion and its completion event will run here.
          preprocessedDocument = {
            kind: "unsupported",
          }
          break

        default:
          preprocessedDocument = {
            kind: "unsupported",
          }
      }

      result = await step.do("prepare-document-for-fax", async () => {
        switch (preprocessedDocument.kind) {
          case "pdf": {
            const storedDocument = await loadStoredDocument(
              preprocessedDocument,
              this.env.FAX_DOCUMENTS
            )
            const config = await getMarketConfig(
              "IL",
              this.env.MARKET_CONFIG
            )
            const validation = await validatePdfAndCountPages(
              storedDocument,
              config
            )

            if (!validation.isValid) {
              return failedDocument(validation.error)
            }

            return {
              status: DOCUMENT_STATUS.ready,
              pageCount: validation.pageCount,
              sizeBytes: storedDocument.sizeBytes,
              format: preprocessedDocument.format,
              quote: calculateFaxQuote(config),
            }
          }

          case "image": {
            const storedDocument = await loadStoredDocument(
              preprocessedDocument,
              this.env.FAX_DOCUMENTS
            )
            const images = this.env.IMAGES

            if (!images) {
              throw new Error(
                "The Cloudflare Images binding is unavailable."
              )
            }

            const config = await getMarketConfig(
              "IL",
              this.env.MARKET_CONFIG
            )
            const validation = await validateImageAndCountPages(
              storedDocument,
              images,
              config
            )

            if (!validation.isValid) {
              return failedDocument(validation.error)
            }

            return {
              status: DOCUMENT_STATUS.ready,
              pageCount: validation.pageCount,
              sizeBytes: storedDocument.sizeBytes,
              format: preprocessedDocument.format,
              quote: calculateFaxQuote(config),
            }
          }

          case "unsupported":
            return failedDocument("INVALID_FILE_TYPE")
        }
      })
    } catch (error) {
      // Infrastructure and unexpected preparation failures cannot produce a
      // usable document, so publish a retryable processing failure.
      console.error("document_preparation_failed", {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      })

      await step.do("mark-processing-failed", async () => {
        await sessionObject.failDocument("PROCESSING_FAILED")
        return null
      })

      return
    }

    // Publish the preparation result through the session Durable Object. Its
    // WebSocket broadcast updates every browser viewing this fax session.
    switch (result.status) {
      case DOCUMENT_STATUS.ready:
        await step.do("finalize-document", async () => {
          await sessionObject.finalizeDocument(
            {
              pageCount: result.pageCount,
              sizeBytes: result.sizeBytes,
              format: result.format,
            },
            result.quote
          )
          return null
        })
        break

      case DOCUMENT_STATUS.failed:
        await step.do("publish-document-failure", async () => {
          await sessionObject.failDocument(result.error)
          return null
        })
        break
    }
  }
}

/** Loads the original bytes referenced by a preprocessed document from R2. */
async function loadStoredDocument(
  document: PreprocessedDocumentFile,
  bucket: R2Bucket
): Promise<StoredDocument> {
  const storedFile = await bucket.get(document.objectKey)

  if (!storedFile) {
    throw new Error(
      `Document '${document.objectKey}' disappeared from R2 during preparation.`
    )
  }

  const bytes = await storedFile.arrayBuffer()

  return {
    bytes,
    originalName: document.originalName,
    sizeBytes: bytes.byteLength,
  }
}

/** Validates a PDF and returns the page count needed for fax delivery. */
async function validatePdfAndCountPages(
  document: StoredDocument,
  config: MarketConfig
): Promise<DocumentValidationResult> {
  const file = new File([document.bytes], document.originalName, {
    type: "application/pdf",
  })

  try {
    const { pageCount } = await inspectPdfFile(file, config.fax)

    return {
      isValid: true,
      pageCount,
    }
  } catch (error) {
    if (error instanceof PdfInspectionError) {
      return {
        isValid: false,
        error: error.code,
      }
    }

    throw error
  }
}

/** Decodes a native image without changing its stored bytes. */
async function validateImageAndCountPages(
  document: StoredDocument,
  images: ImagesBinding,
  config: MarketConfig
): Promise<DocumentValidationResult> {
  if (document.sizeBytes > config.fax.maxFileBytes) {
    return {
      isValid: false,
      error: "FILE_TOO_LARGE",
    }
  }

  try {
    // Cloudflare must successfully decode the bytes as an image. `info()`
    // validates them without transforming or replacing the R2 object.
    await images.info(new Blob([document.bytes]).stream())

    return {
      isValid: true,
      pageCount: 1,
    }
  } catch (error) {
    if (isImagesError(error)) {
      return {
        isValid: false,
        error: "INVALID_IMAGE",
      }
    }

    throw error
  }
}

/** Creates the final session result for a document rejected during preparation. */
function failedDocument(
  error: FaxDocumentErrorCode
): DocumentPreparationResult {
  return {
    status: DOCUMENT_STATUS.failed,
    error,
  }
}

function isImagesError(error: unknown): error is ImagesError {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "number"
  )
}
