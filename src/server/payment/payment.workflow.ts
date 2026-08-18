/**
 * Owns the durable payment-creation sequence.
 *
 * The endpoint establishes one instance per browser session. Durable steps
 * load the server-owned checkout inputs, create the hosted PayMe sale, and
 * persist its provider details before they are published to the browser.
 */
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers"
import currency from "currency.js"

import { getMarketConfig } from "@/server/config/market-config.service"
import {
  PayMeService,
  type GeneratePayMeSaleInput,
  type GeneratePayMeSaleResult,
} from "@/server/payment/payme.service"
import { PaymentRepository } from "@/server/payment/payment.repository"

export type PaymentWorkflowParams = {
  sessionId: string
}

/** Receives one durable payment-creation run for a browser session. */
export class PaymentWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  PaymentWorkflowParams
> {
  async run(
    event: Readonly<WorkflowEvent<PaymentWorkflowParams>>,
    step: WorkflowStep
  ): Promise<GeneratePayMeSaleResult> {
    const { sessionId } = event.payload

    const saleInput = await step.do("load-payment-input", async () => {
      const [session, config] = await Promise.all([
        this.env.FAX_SESSIONS.getByName(sessionId).getSession(),
        getMarketConfig("IL", this.env.MARKET_CONFIG),
      ])

      // The summary card is available only after the server-owned quote has
      // been stored. PayMe accepts its amount as integer minor units.
      const quote = session.quote!

      return {
        amountMinorUnits: currency(quote.amount).intValue,
        callbackUrl: this.env.PAYME_CALLBACK_URL,
        language: config.payment.language,
        productName: config.payment.productName,
        transactionId: sessionId,
      } satisfies GeneratePayMeSaleInput
    })

    // PayMe sale creation is an external side effect. A timeout or lost
    // response is ambiguous, so the Workflow must not retry it automatically.
    const sale = await step.do(
      "create-payme-sale",
      {
        timeout: "30 seconds",
        retries: {
          limit: 0,
          delay: 0,
        },
      },
      async () =>
        new PayMeService(
          this.env.PAYME_SELLER_ID,
          this.env.PAYME_BASE_URL
        ).generateSale(saleInput)
    )

    // D1 persistence is safe to replay: the session primary key makes a repeat
    // insert a no-op while this Workflow continues with its cached PayMe sale.
    await step.do("save-payment-to-d1", async () => {
      await new PaymentRepository(this.env.APP_DATABASE).create({
        sessionId,
        payMeSaleId: sale.payMeSaleId,
        payMeSaleCode: sale.payMeSaleCode,
        checkoutUrl: sale.checkoutUrl,
        amountMinorUnits: sale.price,
        currency: sale.currency,
        paymentMethod: sale.paymentMethod,
      })

      return null
    })

    // The validated sale remains inspectable as Workflow output; it does not
    // reach the HTTP endpoint or browser until the next integration step.
    return sale
  }
}
