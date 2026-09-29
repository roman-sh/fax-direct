import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers"

import {
  PayMeService,
  type GetPayMeSaleStateResult,
} from "@/server/payment/payme.service"
import { confirmFaxPayment } from "@/server/payment/payment.service"
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
      case PAYMENT_STATUS.paid:
        await confirmFaxPayment(sessionId, payMeSaleId)
        break
    }

    return result
  }
}
