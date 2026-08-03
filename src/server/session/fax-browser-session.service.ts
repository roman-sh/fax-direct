import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"
import { getIronSession, type SessionOptions } from "iron-session"
import { cookies } from "next/headers"

import {
  createFaxSessionId,
  normalizeFaxSessionId,
} from "@/shared/session/fax-session-id"

const SESSION_COOKIE = "fax_direct_session"
const SESSION_TTL_SECONDS = 24 * 60 * 60

type FaxBrowserSession = {
  sessionId?: string
  /** Previous cookie payload key, retained only for seamless migration. */
  sessionCode?: string
}

/**
 * Opens the authenticated, encrypted browser cookie that identifies one fax
 * session. Iron Session returns an empty object for missing, expired, or
 * tampered seals, allowing the caller to initialize a new session safely.
 */
export async function getOrCreateFaxBrowserSession(): Promise<{
  created: boolean
  sessionId: string
}> {
  const password =
    getCloudflareContext().env.SESSION_COOKIE_PASSWORD

  if (!password) {
    throw new Error("SESSION_COOKIE_PASSWORD is not configured.")
  }

  const options = {
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    },
    password,
    ttl: SESSION_TTL_SECONDS,
  } satisfies SessionOptions

  const session = await getIronSession<FaxBrowserSession>(
    await cookies(),
    options
  )

  if (session.sessionId) {
    return {
      created: false,
      sessionId: session.sessionId,
    }
  }

  const legacySessionId = session.sessionCode
    ? normalizeFaxSessionId(session.sessionCode)
    : null

  if (legacySessionId) {
    session.sessionId = legacySessionId
    delete session.sessionCode
    await session.save()

    return {
      created: false,
      sessionId: legacySessionId,
    }
  }

  session.sessionId = createFaxSessionId()
  await session.save()

  return {
    created: true,
    sessionId: session.sessionId,
  }
}
