import { DurableObject } from "cloudflare:workers"

import {
  EMPTY_FAX_SESSION_DATA,
  type FaxSessionData,
} from "@/shared/session/fax-session"

const SESSION_STORAGE_KEY = "session"

export class FaxSession extends DurableObject<CloudflareEnv> {
  async getSession(): Promise<FaxSessionData> {
    return (
      (await this.ctx.storage.get<FaxSessionData>(
        SESSION_STORAGE_KEY
      )) ?? EMPTY_FAX_SESSION_DATA
    )
  }
}
