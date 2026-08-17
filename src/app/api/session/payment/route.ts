/**
 * Starts payment for the signed browser session.
 *
 * The Durable Object verifies that the document, recipient, and quote exist,
 * records a pending payment, and PayMe creates the hosted checkout.
 */
import {
  PaymentServiceError,
  startFaxPayment,
} from "@/server/payment/payment.service"
import { getOrCreateFaxBrowserSession } from "@/server/session/fax-browser-session.service"

export const runtime = "nodejs"

export async function POST(): Promise<Response> {
  try {
    const { sessionId } = await getOrCreateFaxBrowserSession()
    const session = await startFaxPayment(sessionId)

    return Response.json(session, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      if (error.code === "NOT_READY") {
        return errorResponse(
          error.code,
          "יש להשלים את המסמך ומספר הפקס לפני התשלום.",
          409
        )
      }

      return errorResponse(
        error.code,
        "לא הצלחנו לפתוח את התשלום. נסו שוב.",
        503
      )
    }

    console.error("Could not start fax payment:", error)
    return errorResponse(
      "PAYMENT_UNAVAILABLE",
      "לא הצלחנו לפתוח את התשלום. נסו שוב.",
      503
    )
  }
}

function errorResponse(
  code: string,
  message: string,
  status: number
): Response {
  return Response.json(
    { code, message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
