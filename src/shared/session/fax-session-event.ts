import type { FaxSessionData } from "@/shared/session/fax-session.types"

export type FaxSessionEvent = {
  type: "session"
  session: FaxSessionData
}
