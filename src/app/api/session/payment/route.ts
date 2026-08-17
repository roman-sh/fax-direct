/**
 * Starts payment for the signed browser session.
 *
 * The endpoint only starts the durable payment Workflow. Provider work
 * continues asynchronously after this request is accepted.
 */
import { startFaxPayment } from "@/server/payment/payment.service"
import { getOrCreateFaxBrowserSession } from "@/server/session/fax-browser-session.service"

export const runtime = "nodejs"

export async function POST(): Promise<Response> {
  try {
    const { sessionId } = await getOrCreateFaxBrowserSession()
    await startFaxPayment(sessionId)

    return new Response(null, {
      status: 202,
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
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
