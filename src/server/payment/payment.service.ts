import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"
import currency from "currency.js"

import { getMarketConfig } from "@/server/config/market-config.service"
import { startFaxDeliveryAttempt } from "@/server/fax/fax-delivery.service"
import { PayMeService } from "@/server/payment/payme.service"
import type { FaxSessionData } from "@/shared/session/fax-session.types"

let payMeService: PayMeService | undefined

export type PaymentServiceErrorCode =
  | "NOT_READY"
  | "SALE_CREATION_FAILED"

export class PaymentServiceError extends Error {
  constructor(readonly code: PaymentServiceErrorCode) {
    super(code)
    this.name = "PaymentServiceError"
  }
}

/** Marks the current session pending and creates its hosted PayMe sale. */
export async function startFaxPayment(
  sessionId: string
): Promise<FaxSessionData> {
  const { env } = getCloudflareContext()
  const session = env.FAX_SESSIONS.getByName(sessionId)

  // The per-session Durable Object owns the atomic transition to `pending`.
  // This keeps two simultaneous Pay requests from both starting a new sale.
  const paymentStart = await session.startPayment()

  // A null response means the session is missing its document, recipient, or
  // server-owned quote, so payment cannot start yet.
  if (!paymentStart) {
    throw new PaymentServiceError("NOT_READY")
  }

  // An existing pending or paid payment makes the request idempotent. Return
  // the current session without creating a second PayMe sale.
  if (!paymentStart.started) {
    return paymentStart.session
  }

  // Only the request that changed the Durable Object to `pending` reaches
  // PayMe and creates the external sale.
  try {
    const config = await getMarketConfig("IL")
    // startPayment succeeds only when the server-owned quote exists.
    const quote = paymentStart.session.quote!
    // PayMe accepts an integer in minor units rather than a decimal price.
    const amountMinorUnits = currency(quote.amount).intValue

    await getPayMeService(env).generateSale({
      amountMinorUnits,
      callbackUrl: env.PAYME_CALLBACK_URL,
      language: config.payment.language,
      productName: config.payment.productName,
      transactionId: sessionId,
    })
  } catch (error) {
    await session.cancelPendingPayment()
    console.error("Could not create PayMe sale:", error)
    throw new PaymentServiceError("SALE_CREATION_FAILED")
  }

  return paymentStart.session
}

/**
 * Applies a payment confirmation callback and durably ensures its delivery
 * Workflow exists. Repeated callbacks are safe: the delivery gate re-issues
 * the same attempt while `preparing` (idempotent instance creation) and
 * declines once the delivery is in flight.
 */
export async function confirmFaxPayment(
  sessionId: string
): Promise<FaxSessionData | null> {
  const { env } = getCloudflareContext()
  const session = await env.FAX_SESSIONS
    .getByName(sessionId)
    .confirmPayment()

  if (!session) {
    return null
  }

  return (await startFaxDeliveryAttempt(sessionId)) ?? session
}

/** Reuses the stateless PayMe client within the current Worker isolate. */
function getPayMeService(env: CloudflareEnv): PayMeService {
  payMeService ??= new PayMeService(
    env.PAYME_SELLER_ID,
    env.PAYME_BASE_URL
  )

  return payMeService
}
