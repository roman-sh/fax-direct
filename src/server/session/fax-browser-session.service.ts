import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"
import { getIronSession, type SessionOptions } from "iron-session"
import { cookies } from "next/headers"

import {
  FAX_SESSION_COOKIE_NAME,
  FAX_SESSION_TTL_SECONDS,
  type FaxBrowserSession,
} from "@/shared/session/fax-browser-session"
import {
  createFaxSessionId,
  normalizeFaxSessionId,
} from "@/shared/session/fax-session-id"

/**
 * Opens the authenticated, encrypted browser cookie that identifies one fax
 * session. Iron Session returns an empty object for missing, expired, or
 * tampered seals, allowing the caller to initialize a new session safely.
 */
export async function getOrCreateFaxBrowserSession(): Promise<{
  created: boolean
  sessionId: string
}> {
  const session = await openFaxBrowserSession()

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

/**
 * Points the cookie at a brand new session, whatever it held before.
 *
 * The previous session is not deleted, only forgotten: its Durable Object
 * keeps whatever it had and simply stops being addressable from this browser.
 * That is what makes this safe to call while a fax exists — nothing in flight
 * is interrupted — and also why callers must decide for themselves whether
 * abandoning the old session is acceptable, since this function cannot.
 */
export async function mintFaxBrowserSession(): Promise<string> {
  const session = await openFaxBrowserSession()

  session.sessionId = createFaxSessionId()
  delete session.sessionCode
  await session.save()

  return session.sessionId
}

async function openFaxBrowserSession() {
  const password = getCloudflareContext().env.SESSION_COOKIE_PASSWORD

  if (!password) {
    throw new Error("SESSION_COOKIE_PASSWORD is not configured.")
  }

  const options = {
    cookieName: FAX_SESSION_COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    },
    password,
    ttl: FAX_SESSION_TTL_SECONDS,
  } satisfies SessionOptions

  return getIronSession<FaxBrowserSession>(await cookies(), options)
}
