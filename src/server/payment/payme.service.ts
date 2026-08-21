/**
 * Implements Fax Direct's PayMe boundary for creating one hosted Bit sale.
 * Application orchestration, persistence, and browser state remain elsewhere.
 */
import {
  payMeGenerateSaleResponseSchema,
  type PayMeError,
} from "@/server/payment/payme.schema"

/** Application values required to create one PayMe sale. */
export type GeneratePayMeSaleInput = {
  /** Amount in the currency's smallest unit; for ILS, this is agorot. */
  amountMinorUnits: number
  callbackUrl: string
  /** Language code configured for the market's PayMe checkout. */
  language: string
  /** Product description shown on the PayMe-hosted checkout. */
  productName: string
  /** Where PayMe returns the customer's browser after a successful payment. */
  returnUrl: string
  transactionId: string
}

/** Provider identifiers and checkout details returned for a created sale. */
export type GeneratePayMeSaleResult = {
  /** Hosted PayMe page displayed to the customer. */
  checkoutUrl: string
  /** Currency echoed by PayMe. */
  currency: "ILS"
  /** Payment method echoed by PayMe. */
  paymentMethod: "bit"
  /** Numeric sale code assigned by PayMe. */
  payMeSaleCode: number
  /** Unique sale identifier assigned by PayMe. */
  payMeSaleId: string
  /** Sale amount echoed by PayMe, in agorot. */
  price: number
  /** Fax Direct session identifier echoed by PayMe. */
  transactionId: string
}

/**
 * Identifies errors raised by the PayMe boundary. The standard `message`
 * remains readable in logs, while native `Error.cause` preserves the validated
 * provider response for later semantic-code mapping.
 */
export class PayMeServiceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "PayMeServiceError"
  }
}

/** Groups the PayMe operations used by the payment flow. */
export class PayMeService {
  constructor(
    private readonly sellerId: string,
    private readonly baseUrl: string
  ) {
    if (!sellerId || !baseUrl) {
      throw new PayMeServiceError("PayMe is not configured.")
    }
  }

  /**
   * Creates a regular J4 Bit sale and returns the hosted checkout details.
   * PayMe reports ordinary API rejections in JSON with HTTP status 200, so the
   * response body's `status_code` is authoritative rather than `response.ok`.
   */
  async generateSale({
    amountMinorUnits,
    callbackUrl,
    language,
    productName,
    returnUrl,
    transactionId,
  }: GeneratePayMeSaleInput): Promise<GeneratePayMeSaleResult> {
    const response = await fetch(`${this.baseUrl}/generate-sale`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        seller_payme_id: this.sellerId,
        sale_price: amountMinorUnits,
        currency: "ILS",
        product_name: productName,
        transaction_id: transactionId,
        sale_type: "sale",
        // Bit is intentionally server-owned for the first integration. Add
        // future methods explicitly instead of forwarding arbitrary client input.
        sale_payment_method: "bit",
        layout: "dynamic", // Desktop QR and mobile Bit deep link.
        sale_callback_url: callbackUrl,
        // Returns the customer to our own delivery status instead of leaving
        // them on PayMe's confirmation page. It is a browser redirect only:
        // payment is still confirmed by the server callback above, which
        // arrives whether or not the customer's browser ever comes back.
        sale_return_url: returnUrl,
        language, // Market language used on PayMe-hosted screens.
      })
    })

    const rawBody: unknown = await response.json()
    const result = payMeGenerateSaleResponseSchema.safeParse(rawBody)

    // A body outside both documented shapes cannot safely enter our models.
    if (!result.success) {
      throw new PayMeServiceError(
        "PayMe returned an invalid generate-sale response.",
        { cause: result.error }
      )
    }

    // Validated and typed PayMe response.
    const payme = result.data

    // PayMe uses status_code 1 for a rejected request, usually over HTTP 200.
    if (payme.status_code === 1) {
      // Keep the human-readable fields in Error.message and the complete,
      // validated PayMe error object in the standard Error.cause property.
      throw new PayMeServiceError(createPayMeErrorMessage(payme), {
        cause: result.data,
      })
    }

    return {
      checkoutUrl: payme.sale_url,
      currency: payme.currency,
      paymentMethod: payme.sale_payment_method,
      payMeSaleCode: payme.payme_sale_code,
      payMeSaleId: payme.payme_sale_id,
      price: payme.price,
      transactionId: payme.transaction_id,
    }
  }
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/** Builds the server-log message from the details PayMe supplied. */
function createPayMeErrorMessage(error: PayMeError): string {
  // A rejected PayMe response returns its main error description in
  // status_error_details and may provide extra context, such as the rejected
  // value, in status_additional_info.
  const message = [
    error.status_error_details,
    error.status_additional_info,
  ]
    .filter(
      (value): value is string | number =>
        typeof value === "string" || typeof value === "number"
    )
    .join(" — ")

  return message || "No error message was provided by PayMe."
}
