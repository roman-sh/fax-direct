/**
 * Receives the asynchronous payment confirmation scheduled through Posthook.
 * Posthook wraps the supplied payload inside `data`, which contains sessionId.
 */
import { confirmFaxPayment } from "@/server/payment/payment.service"
import { normalizeFaxSessionId } from "@/shared/session/fax-session-id"

export const runtime = "nodejs"

type PosthookDelivery = {
  data?: {
    sessionId?: unknown
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: PosthookDelivery

  try {
    body = (await request.json()) as PosthookDelivery
  } catch {
    return errorResponse("INVALID_REQUEST", "Invalid JSON body.", 400)
  }

  const sessionId =
    typeof body.data?.sessionId === "string"
      ? normalizeFaxSessionId(body.data.sessionId)
      : null

  if (!sessionId) {
    return errorResponse("INVALID_SESSION_ID", "Invalid sessionId.", 400)
  }

  try {
    await confirmFaxPayment(sessionId)
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("Could not confirm fax payment:", error)
    return errorResponse(
      "PAYMENT_CONFIRMATION_FAILED",
      "Could not confirm payment.",
      503
    )
  }
}

function errorResponse(
  code: string,
  message: string,
  status: number
): Response {
  return Response.json({ code, message }, { status })
}
