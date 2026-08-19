/**
 * Abandons the current fax session and points the browser at a fresh one.
 *
 * The cookie is the only thing that changes. The previous Durable Object keeps
 * its state and simply stops being reachable, so a fax already on its way is
 * never interrupted — but it also becomes unreachable, which is what the guard
 * below is for. A paid session that has not been delivered still has either a
 * delivery running or a retry the customer has paid for and not used, and
 * walking away from it would forfeit that with no way back.
 *
 * Everything else may be abandoned freely: an empty session, a half-filled one,
 * or a delivered fax whose confirmation the customer has already seen.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare"

import {
  getOrCreateFaxBrowserSession,
  mintFaxBrowserSession,
} from "@/server/session/fax-browser-session.service"
import {
  FAX_STATUS,
  PAYMENT_STATUS,
} from "@/shared/session/fax-session-status"
import {
  EMPTY_FAX_SESSION_DATA,
  type FaxSessionData,
} from "@/shared/session/fax-session.types"

export const runtime = "nodejs"

export async function POST(): Promise<Response> {
  try {
    const browserSession = await getOrCreateFaxBrowserSession()

    // A cookie minted by this very request is already the fresh session being
    // asked for. Reading its state would activate a Durable Object to learn
    // that it is empty, and replacing it would mint a second id for nothing.
    if (browserSession.created) {
      return newSessionResponse()
    }

    const current = await getCloudflareContext()
      .env.FAX_SESSIONS.getByName(browserSession.sessionId)
      .getSession()

    if (!canAbandon(current)) {
      return errorResponse(
        "FAX_IN_PROGRESS",
        "השליחה הנוכחית עדיין פעילה. המתינו לסיומה לפני שליחת פקס חדש.",
        409
      )
    }

    await mintFaxBrowserSession()

    return newSessionResponse()
  } catch (error) {
    console.error("Could not start a new fax session:", error)

    return errorResponse(
      "NEW_SESSION_FAILED",
      "לא הצלחנו להתחיל שליחה חדשה. נסו שוב.",
      503
    )
  }
}

function newSessionResponse(): Response {
  return Response.json(EMPTY_FAX_SESSION_DATA, {
    headers: {
      "Cache-Control": "no-store",
    },
  })
}

/** Paid work the customer has not received yet is the one thing worth keeping. */
function canAbandon(session: FaxSessionData): boolean {
  if (session.payment?.status !== PAYMENT_STATUS.paid) {
    return true
  }

  return session.fax?.status === FAX_STATUS.DELIVERED
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
