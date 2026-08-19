/**
 * Runs the durable, paid-fax delivery sequence. Every instance — the initial
 * paid delivery and each manual retry — is created through the delivery gate
 * (`beginDelivery` + fax-delivery.service.ts), which claims the session as
 * `preparing` and numbers the instance id before this Workflow starts.
 */
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
  // Every session write and the D1 record carry the attempt, so results from
  // a superseded attempt can never overwrite the state of a newer retry.
  attempt: number
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
    const { sessionId, attempt } = event.payload
    const sessionObject = this.env.FAX_SESSIONS.getByName(sessionId)

    const faxParams = await step.do("load-fax-params", async () => {
      const session = await sessionObject.getSession()

      if (session.payment?.status !== PAYMENT_STATUS.paid) {
        throw new Error(`Fax session ${sessionId} has not been paid.`)
      }

      // PDF and phone validation happened before they entered FaxSession. The
      // Workflow checks only that the values required for delivery are present.
      // The delivery gate already claimed the session as `preparing`.
      if (!session.document || !session.recipient) {
        throw new Error(`Fax session ${sessionId} is missing delivery data.`)
      }

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
      console.error("interfax_submission_failed", {
        sessionId,
        error: readErrorMessage(error),
      })

      // The first version deliberately treats every submission error as final.
      // It neither retries nor attempts provider reconciliation, avoiding a
      // second real fax when an accepted response was lost in transit.
      await step.do("mark-submission-failed", async () => {
        await sessionObject.updateFax(
          createFailedFax(faxParams.document.pageCount),
          attempt
        )

        return null
      })

      return
    }

    // Establish the initial browser state before D1 makes this fax visible to
    // the global poller. Otherwise an existing alarm could publish a newer
    // provider state and this Workflow could incorrectly overwrite it later.
    await step.do("mark-queued", async () => {
      await sessionObject.updateFax(
        createQueuedFax(faxParams.document.pageCount),
        attempt
      )

      return null
    })

    await step.do("store-transmission", async () => {
      await new FaxTransmissionRepository(this.env.APP_DATABASE).create({
        transactionId: providerSubmission.transactionId,
        sessionId,
        deliveryAttempt: attempt,
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
  }
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/** Creates the accepted-by-provider state that precedes the first poll. */
function createQueuedFax(pagesSubmitted: number): FaxSessionFax {
  return {
    status: FAX_STATUS.QUEUED,
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
