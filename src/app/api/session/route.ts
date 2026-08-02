/**
 * Creates or restores the browser's fax-session identity.
 *
 * The HttpOnly cookie contains a human-friendly Crockford Base32 code. That
 * same code is the Durable Object name, so Cloudflare can route every request
 * from this browser to the same FaxSession instance without a database lookup.
 *
 * Calling getSession() reads the instance's current state. An empty session is
 * returned but not persisted yet; later workflow actions will write meaningful
 * document, recipient, and quote data. This is a POST because it may set the
 * cookie, and every response is marked no-store to prevent session caching.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { cookies } from "next/headers"

import type { FaxSessionData } from "@/shared/session/fax-session"
import {
  createFaxSessionCode,
  normalizeFaxSessionCode,
} from "@/shared/session/fax-session-code"

export const runtime = "nodejs"

const SESSION_COOKIE = "fax_direct_session"
const SESSION_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60

export async function POST(): Promise<Response> {
  const cookieStore = await cookies()
  const existingSessionCode = cookieStore.get(SESSION_COOKIE)?.value
  const sessionCode =
    (existingSessionCode && normalizeFaxSessionCode(existingSessionCode)) ??
    createFaxSessionCode()

  let session: FaxSessionData

  try {
    const namespace = getCloudflareContext().env.FAX_SESSIONS
    session = await namespace.getByName(sessionCode).getSession()
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

  if (existingSessionCode !== sessionCode) {
    cookieStore.set(SESSION_COOKIE, sessionCode, {
      httpOnly: true,
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: true,
    })
  }

  return Response.json(session, {
    headers: {
      "Cache-Control": "no-store",
    },
  })
}
