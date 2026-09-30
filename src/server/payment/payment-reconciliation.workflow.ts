import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers"

import { scheduleFaxDelivery } from "@/server/fax/fax-delivery.service"
import { PAYMENT_STATUS_CHANGED_EVENT } from "@/server/payment/payment-reconciliation.constants"
import {
  PayMeService,
  type GetPayMeSaleStateResult,
} from "@/server/payment/payme.service"
import { PaymentRepository } from "@/server/payment/payment.repository"
import { PAYMENT_STATUS } from "@/shared/session/fax-session-status"

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

    let result: GetPayMeSaleStateResult

    // Keep waiting and checking until PayMe reports a final state.
    do {
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
      result = await step.do(
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
    } while (result.state === PAYMENT_STATUS.pending)

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

        // Initialize the session attempt and ensure its deterministic
        // fax-delivery Workflow exists.
        await step.do("start-fax-delivery", async () => {
          await scheduleFaxDelivery(this.env, sessionId)

          return null
        })

        break
      }

      case PAYMENT_STATUS.failed: {
        const sessionObject = this.env.FAX_SESSIONS.getByName(sessionId)

        // Apply failure only while this remains the session's current sale. A
        // delayed result from a sale replaced by a retry must not overwrite it.
        const isCurrentFailure = await step.do(
          "mark-payment-failed",
          async () =>
            new PaymentRepository(this.env.APP_DATABASE).markFailed(
              sessionId,
              payMeSaleId
            )
        )

        if (!isCurrentFailure) {
          break
        }

        // Publish the failed state and remove the unusable checkout URL so the
        // browser can offer another payment attempt.
        await step.do("publish-payment-failed", async () => {
          await sessionObject.failPayment()

          return null
        })

        break
      }
    }

    return result
  }
}
