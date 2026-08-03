/**
 * Validates and saves the recipient for the current fax session.
 *
 * A successful request also calculates and stores the server-owned quote. The
 * updated session is returned immediately and also broadcast to any connected
 * browser, so the payment card renders only server-validated data.
 */
import { MarketConfigError } from "@/server/config/market-config.service"
import {
  RecipientServiceError,
  type RecipientServiceErrorCode,
  saveFaxRecipient,
} from "@/server/recipient/recipient.service"
import { getOrCreateFaxBrowserSession } from "@/server/session/fax-browser-session.service"

export const runtime = "nodejs"

export async function POST(request: Request): Promise<Response> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      "INVALID_REQUEST",
      "לא הצלחנו לקרוא את מספר הפקס.",
      400
    )
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("recipient" in body) ||
    typeof body.recipient !== "string"
  ) {
    return errorResponse(
      "INVALID_REQUEST",
      "יש להזין מספר פקס.",
      400
    )
  }

  try {
    const { sessionId } = await getOrCreateFaxBrowserSession()

    const session = await saveFaxRecipient({
      input: body.recipient,
      sessionId,
    })

    return Response.json(session, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof RecipientServiceError) {
      return recipientErrorResponse(error.code)
    }

    if (error instanceof MarketConfigError) {
      return errorResponse(
        "CONFIG_UNAVAILABLE",
        "השירות אינו זמין כרגע. נסו שוב מאוחר יותר.",
        503
      )
    }

    console.error("Could not save fax recipient:", error)
    return errorResponse(
      "SESSION_UNAVAILABLE",
      "לא הצלחנו לשמור את מספר הפקס. נסו שוב.",
      503
    )
  }
}

function recipientErrorResponse(
  code: RecipientServiceErrorCode
): Response {
  switch (code) {
    case "EMPTY":
      return errorResponse(code, "יש להזין מספר פקס.", 400)
    case "INVALID_NUMBER":
      return errorResponse(
        code,
        "מספר הפקס אינו תקין. בדקו את המספר ונסו שוב.",
        422
      )
    case "UNSUPPORTED_COUNTRY":
      return errorResponse(
        code,
        "בשלב זה ניתן לשלוח פקס רק למספר ישראלי.",
        422
      )
    case "DOCUMENT_REQUIRED":
      return errorResponse(
        code,
        "יש להעלות מסמך תקין לפני שמירת מספר הפקס.",
        409
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
