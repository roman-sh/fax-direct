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
import { fileTypeFromBuffer } from "file-type"

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
      // Run detection and preparation as one durable step. Cloudflare records
      // its result so a resumed Workflow does not repeat successful work.
      result = await step.do("prepare-document", async () => {
        // Load the document metadata and the market limits used to validate it.
        const [session, config] = await Promise.all([
          sessionObject.getSession(),
          getMarketConfig("IL", this.env.MARKET_CONFIG),
        ])
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

        return prepareDocument({
          bytes: await storedFile.arrayBuffer(),
          originalName: document.originalName,
          config,
        })
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

/** Detects the stored bytes and sends each supported family to its processor. */
async function prepareDocument(
  input: DocumentPreparationInput
): Promise<DocumentPreparationResult> {
  const detectedType = await fileTypeFromBuffer(input.bytes)

  switch (detectedType?.ext) {
    case "pdf":
      return preparePdfDocument(input, detectedType.mime)

    case "jpg":
    case "png":
    case "tif":
      return prepareImageDocument()

    case "heic":
      return prepareConvertedDocument()

    default:
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

/** Placeholder for formats that will first be converted to PDF. */
function prepareConvertedDocument(): DocumentPreparationResult {
  return unsupportedDocument()
}

function unsupportedDocument(): DocumentPreparationResult {
  return {
    status: DOCUMENT_STATUS.failed,
    error: "INVALID_FILE_TYPE",
  }
}
