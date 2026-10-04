/**
 * Validates one uploaded PDF and publishes its final document state.
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
      // Run inspection as a durable step. Cloudflare records its result so a
      // resumed Workflow does not repeat a successfully completed inspection.
      result = await step.do("inspect-pdf", async () => {
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

        // Reconstruct the browser File expected by the existing PDF inspector.
        const file = new File(
          [await storedFile.arrayBuffer()],
          document.originalName,
          {
            type: storedFile.httpMetadata?.contentType ?? "",
          }
        )

        try {
          const { pageCount } = await inspectPdfFile(file, config.fax)

          return {
            status: DOCUMENT_STATUS.ready,
            pageCount,
            quote: calculateFaxQuote(config),
          }
        } catch (error) {
          // Expected document-validation failures become a final session state
          // that the frontend can present to the user.
          if (error instanceof PdfInspectionError) {
            return {
              status: DOCUMENT_STATUS.failed,
              error: error.code,
            }
          }

          throw error
        }
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
