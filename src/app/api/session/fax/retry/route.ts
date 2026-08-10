/**
 * Manually retries a failed fax for the signed browser session.
 *
 * The delivery gate on the Durable Object authorizes the retry (paid session,
 * final failure, document and recipient present) and atomically claims the
 * next attempt, so a double click or second tab cannot start two deliveries.
 */
import { startFaxDeliveryAttempt } from "@/server/fax/fax-delivery.service"
import { getOrCreateFaxBrowserSession } from "@/server/session/fax-browser-session.service"

export const runtime = "nodejs"

export async function POST(): Promise<Response> {
  try {
    const { sessionId } = await getOrCreateFaxBrowserSession()
    const session = await startFaxDeliveryAttempt(sessionId)

    if (!session) {
      return errorResponse(
        "RETRY_NOT_AVAILABLE",
        "אין פקס שממתין לשליחה חוזרת.",
        409
      )
    }

    return Response.json(session, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Could not retry fax delivery:", error)
    return errorResponse(
      "RETRY_FAILED",
      "לא הצלחנו להתחיל שליחה חוזרת. נסו שוב.",
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
