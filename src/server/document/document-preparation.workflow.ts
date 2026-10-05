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
  FaxSessionQuote,
} from "@/shared/session/fax-session.types"

export type DocumentPreparationWorkflowParams = {
  sessionId: string
}

type DocumentPreparationResult =
  | {
      status: typeof DOCUMENT_STATUS.ready
      pageCount: number
      quote: FaxSessionQuote
    }
  | {
      status: typeof DOCUMENT_STATUS.failed
      error: FaxDocumentErrorCode
    }

type DocumentPreparationInput = {
  bytes: ArrayBuffer
  originalName: string
  config: MarketConfig
}

type DetectedDocument = {
  objectKey: string
  originalName: string
  format: FileTypeResult | null
}

type PreprocessedDocumentFile = {
  objectKey: string
  originalName: string
  contentType: string
}

type PreprocessedDocument =
  | (PreprocessedDocumentFile & {
      kind: "pdf"
    })
  | (PreprocessedDocumentFile & {
      kind: "image"
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
            contentType: detectedDocument.format.mime,
          }
          break

        case "jpg":
        case "png":
          preprocessedDocument = {
            kind: "image",
            objectKey: detectedDocument.objectKey,
            originalName: detectedDocument.originalName,
            contentType: detectedDocument.format.mime,
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

      result = await step.do("process-document", async () => {
        return processDocument(
          preprocessedDocument,
          this.env.FAX_DOCUMENTS,
          await getMarketConfig("IL", this.env.MARKET_CONFIG)
        )
      })
    } catch (error) {
      // Infrastructure and unexpected inspection failures cannot produce a
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

    // Publish the inspection result through the session Durable Object. Its
    // WebSocket broadcast updates every browser viewing this fax session.
    switch (result.status) {
      case DOCUMENT_STATUS.ready:
        await step.do("finalize-document", async () => {
          await sessionObject.finalizeDocument(
            result.pageCount,
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

/** Routes one preprocessed file to its final PDF or image processor. */
async function processDocument(
  document: PreprocessedDocument,
  bucket: R2Bucket,
  config: MarketConfig
): Promise<DocumentPreparationResult> {
  switch (document.kind) {
    case "pdf": {
      const storedFile = await bucket.get(document.objectKey)

      if (!storedFile) {
        throw new Error(
          `Document '${document.objectKey}' disappeared from R2 before processing.`
        )
      }

      return preparePdfDocument(
        {
          bytes: await storedFile.arrayBuffer(),
          originalName: document.originalName,
          config,
        },
        document.contentType
      )
    }

    case "image":
      return prepareImageDocument()

    case "unsupported":
      return unsupportedDocument()
  }
}

/** Runs the existing PDF validation path after the bytes identify as PDF. */
async function preparePdfDocument(
  input: DocumentPreparationInput,
  mimeType: string
): Promise<DocumentPreparationResult> {
  const file = new File([input.bytes], input.originalName, {
    type: mimeType,
  })

  try {
    const { pageCount } = await inspectPdfFile(file, input.config.fax)

    return {
      status: DOCUMENT_STATUS.ready,
      pageCount,
      quote: calculateFaxQuote(input.config),
    }
  } catch (error) {
    if (error instanceof PdfInspectionError) {
      return {
        status: DOCUMENT_STATUS.failed,
        error: error.code,
      }
    }

    throw error
  }
}

/** Placeholder for images that InterFAX can accept without conversion. */
function prepareImageDocument(): DocumentPreparationResult {
  return unsupportedDocument()
}

function unsupportedDocument(): DocumentPreparationResult {
  return {
    status: DOCUMENT_STATUS.failed,
    error: "INVALID_FILE_TYPE",
  }
}
