export const FAX_SESSION_COOKIE_NAME = "fax_direct_session"
export const FAX_SESSION_TTL_SECONDS = 24 * 60 * 60

export type FaxBrowserSession = {
  sessionId?: string
  /** Previous cookie payload key, retained only for seamless migration. */
  sessionCode?: string
}
