import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers"

import type { FaxDeliveryWorkflowParams } from "@/server/fax/fax-delivery.workflow"
import {
  PayMeService,
  type GetPayMeSaleStateResult,
} from "@/server/payment/payme.service"
import { PaymentRepository } from "@/server/payment/payment.repository"
import { PAYMENT_STATUS } from "@/shared/session/fax-session-status"

// Webhook and browser-return handlers send this event only as a wake-up signal.
// The Workflow never trusts the signal as proof of a payment outcome.
const PAYMENT_STATUS_CHANGED_EVENT = "payment-status-changed"

export type PaymentReconciliationWorkflowParams = {
  payMeSaleId: string
  sessionId: string
}

/** Owns the reconciliation lifecycle for one PayMe sale. */
export class PaymentReconciliationWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  PaymentReconciliationWorkflowParams
> {
  async run(
    event: Readonly<WorkflowEvent<PaymentReconciliationWorkflowParams>>,
    step: WorkflowStep
  ): Promise<GetPayMeSaleStateResult> {
    const { payMeSaleId, sessionId } = event.payload

    try {
      // Pause until either PayMe's webhook or the customer's return request
      // tells this sale's Workflow instance that its status may have changed.
      await step.waitForEvent("wait-for-payment-signal", {
        type: PAYMENT_STATUS_CHANGED_EVENT,
        timeout: "1 minute",
      })
    } catch {
      // If neither signal arrives, the one-minute timeout still performs the
      // same provider check so a missing webhook cannot leave payment stuck.
    }

    // Signals and timeouts are triggers only. PayMe's API remains the
    // authoritative source for the sale's paid, failed, or pending state.
    const result = await step.do(
      "get-payme-sale-state",
      {
        retries: {
          limit: 0,
          delay: 0,
        },
      },
      async () => // return
        new PayMeService(
          this.env.PAYME_SELLER_ID,
          this.env.PAYME_BASE_URL
        ).getSaleState(payMeSaleId, sessionId)
    )

    switch (result.state) {
      case PAYMENT_STATUS.paid: {
        const sessionObject = this.env.FAX_SESSIONS.getByName(sessionId)

        // Persist the provider-confirmed result first. If a later step fails,
        // this completed checkpoint is not repeated when the Workflow resumes.
        await step.do("mark-payment-paid", async () => {
          await new PaymentRepository(
            this.env.APP_DATABASE
          ).markPaid(sessionId)

          return null
        })

        // Publish the paid state through the session Durable Object so the
        // connected browser can leave the checkout and show delivery progress.
        await step.do("publish-payment-paid", async () => {
          await sessionObject.confirmPayment()

          return null
        })

        // Initialize the first delivery attempt before creating its Workflow.
        // A null result means delivery is already running or the session is no
        // longer eligible, so there is nothing else to start.
        await step.do("start-fax-delivery", async () => {
          const attempt =
            await sessionObject.initializeDeliveryAttempt()

          if (!attempt) {
            return null
          }

          // The attempt number makes the Workflow ID deterministic,
          // preventing a replay from creating a duplicate fax delivery.
          await this.env.FAX_DELIVERY_WORKFLOW.createBatch([
            {
              id: `${sessionId}-${attempt.number}`,
              params: {
                sessionId,
                attempt: attempt.number,
              } satisfies FaxDeliveryWorkflowParams,
            },
          ])

          return null
        })

        break
      }
    }

    return result
  }
}
