import { parseCookie } from "cookie"
import { unsealData } from "iron-session"

import {
  FAX_SESSION_COOKIE_NAME,
  FAX_SESSION_TTL_SECONDS,
  type FaxBrowserSession,
} from "@/shared/session/fax-browser-session"
import { normalizeFaxSessionId } from "@/shared/session/fax-session-id"

/**
 * Reads and verifies the signed browser session cookie attached to a raw Worker
 * request, then returns the normalized Durable Object session name.
 */
export async function getFaxSessionIdFromRequest(
  request: Request,
  password: string | undefined
): Promise<string | null> {
  if (!password) {
    return null
  }

  const cookies = parseCookie(request.headers.get("Cookie") ?? "")
  const seal = cookies[FAX_SESSION_COOKIE_NAME]

  if (!seal) {
    return null
  }

  const browserSession = await unsealData<FaxBrowserSession>(seal, {
    password,
    ttl: FAX_SESSION_TTL_SECONDS,
  })

  return browserSession.sessionId
    ? normalizeFaxSessionId(browserSession.sessionId)
    : null
}
