/**
 * Runs the durable, paid-fax delivery sequence. The payment webhook creates
 * one initial instance per session; future manual retries can create new
 * instances of this same Workflow after a final failure.
 */
import "server-only"

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers"

import { FAX_RESOLUTION } from "@/server/fax/fax-transmission.schema"
import { FaxTransmissionRepository } from "@/server/fax/fax-transmission.repository"
import { createInterfaxService } from "@/server/fax/interfax.service"
import { createR2InterfaxDocumentSource } from "@/server/fax/r2-interfax-document-source"
import { FAX_STATUS, PAYMENT_STATUS } from "@/shared/session/fax-session-status"
import type {
  FaxSessionDocument,
  FaxSessionFax,
} from "@/shared/session/fax-session.types"

const FAX_POLLING_COORDINATOR_NAME = "global"
const INTERFAX_ATTEMPTS_TOTAL = 1

export type FaxDeliveryWorkflowParams = {
  sessionId: string
}

type FaxParams = {
  document: FaxSessionDocument
  recipientE164: string
  resolution: typeof FAX_RESOLUTION.FINE
}

type ProviderSubmission = {
  transactionId: string
  submittedAt: string
}

/** Delivers one session fax and hands its continuing progress to the poller. */
export class FaxDeliveryWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  FaxDeliveryWorkflowParams
> {
  async run(
    event: Readonly<WorkflowEvent<FaxDeliveryWorkflowParams>>,
    step: WorkflowStep
  ): Promise<void> {
    const { sessionId } = event.payload
    const sessionObject = this.env.FAX_SESSIONS.getByName(sessionId)

    const faxParams = await step.do("load-fax-params", async () => {
      const session = await sessionObject.getSession()

      if (session.payment?.status !== PAYMENT_STATUS.PAID) {
        throw new Error(`Fax session ${sessionId} has not been paid.`)
      }

      // PDF and phone validation happened before they entered FaxSession. The
      // Workflow checks only that the values required for delivery are present.
      if (!session.document || !session.recipient) {
        throw new Error(`Fax session ${sessionId} is missing delivery data.`)
      }

      if (session.fax && session.fax.status !== FAX_STATUS.FAILED) {
        throw new Error(`Fax session ${sessionId} is already being delivered.`)
      }

      const preparingFax = createInitialFax(
        FAX_STATUS.PREPARING,
        session.document.pageCount
      )
      await sessionObject.updateFax(preparingFax)

      return {
        document: session.document,
        recipientE164: session.recipient.e164,
        resolution: FAX_RESOLUTION.FINE,
      } satisfies FaxParams
    })

    let providerSubmission: ProviderSubmission

    try {
      providerSubmission = await step.do(
        "submit-to-interfax",
        {
          // Retrying an ambiguous network failure could deliver the same paid
          // fax twice, so only the customer may initiate another submission.
          retries: {
            limit: 0,
            delay: 0,
          },
        },
        async () => {
          const document = await createR2InterfaxDocumentSource(
            this.env.FAX_DOCUMENTS,
            faxParams.document
          )
          const result = await createInterfaxService(this.env).sendFax({
            document,
            faxNumber: faxParams.recipientE164,
            reference: sessionId,
            resolution: faxParams.resolution,
          })

          return {
            transactionId: result.transactionId,
            submittedAt: new Date().toISOString(),
          } satisfies ProviderSubmission
        }
      )
    } catch (error) {
      console.error({
        event: "interfax_submission_failed",
        sessionId,
        error: readErrorMessage(error),
      })

      // The first version deliberately treats every submission error as final.
      // It neither retries nor attempts provider reconciliation, avoiding a
      // second real fax when an accepted response was lost in transit.
      await step.do("mark-submission-failed", async () => {
        await sessionObject.updateFax(
          createFailedFax(faxParams.document.pageCount)
        )

        return null
      })

      return
    }

    await step.do("store-transmission", async () => {
      await new FaxTransmissionRepository(this.env.APP_DATABASE).create({
        transactionId: providerSubmission.transactionId,
        sessionId,
        pagesSubmitted: faxParams.document.pageCount,
        pagesSent: 0,
        attemptsMade: 0,
        attemptsTotal: INTERFAX_ATTEMPTS_TOTAL,
        resolution: faxParams.resolution,
        submittedAt: providerSubmission.submittedAt,
      })

      return null
    })

    await step.do("start-polling", async () => {
      await this.env.FAX_POLLING_COORDINATOR
        .getByName(FAX_POLLING_COORDINATOR_NAME)
        .managePolling()

      return null
    })

    await step.do("mark-queued", async () => {
      await sessionObject.updateFax(
        createInitialFax(FAX_STATUS.QUEUED, faxParams.document.pageCount)
      )

      return null
    })
  }
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/** Creates the two pre-provider session states with identical page counters. */
function createInitialFax(
  status: typeof FAX_STATUS.PREPARING | typeof FAX_STATUS.QUEUED,
  pagesSubmitted: number
): FaxSessionFax {
  return {
    status,
    pagesSent: 0,
    pagesSubmitted,
    error: null,
  }
}

/** Creates the first-version fallback for any provider submission error. */
function createFailedFax(pagesSubmitted: number): FaxSessionFax {
  return {
    status: FAX_STATUS.FAILED,
    pagesSent: 0,
    pagesSubmitted,
    error: "UNKNOWN_FAILURE",
  }
}

/** Produces a stable structured-log value for an arbitrary thrown value. */
function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
