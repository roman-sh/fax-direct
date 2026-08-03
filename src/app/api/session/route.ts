/**
 * Creates or restores the browser's fax-session identity.
 *
 * An authenticated, encrypted Iron Session cookie contains a human-friendly
 * Crockford Base32 code. That code is the Durable Object name, so Cloudflare
 * can route every request from this browser to the same FaxSession instance
 * without a database lookup.
 *
 * A new, expired, or tampered cookie receives a fresh code and an empty response
 * without activating a Durable Object. Existing cookies call getSession() to
 * restore state. This is a POST because it may set the cookie, and every
 * response is marked no-store to prevent session caching.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare"

import { getFaxBrowserSession } from "@/server/session/fax-browser-session"
import {
  EMPTY_FAX_SESSION_DATA,
  type FaxSessionData,
} from "@/shared/session/fax-session"
import { createFaxSessionCode } from "@/shared/session/fax-session-code"

export const runtime = "nodejs"

export async function POST(): Promise<Response> {
  try {
    const browserSession = await getFaxBrowserSession()

    if (!browserSession.sessionCode) {
      browserSession.sessionCode = createFaxSessionCode()
      await browserSession.save()

      return sessionResponse(EMPTY_FAX_SESSION_DATA)
    }

    const namespace = getCloudflareContext().env.FAX_SESSIONS
    const session = await namespace
      .getByName(browserSession.sessionCode)
      .getSession()

    return sessionResponse(session)
  } catch (error) {
    console.error("Could not initialize fax session:", error)

    return Response.json(
      {
        code: "SESSION_UNAVAILABLE",
        message: "לא הצלחנו להתחיל את השליחה. נסו שוב.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  }
}

function sessionResponse(session: FaxSessionData): Response {
  return Response.json(session, {
    headers: {
      "Cache-Control": "no-store",
    },
  })
}
