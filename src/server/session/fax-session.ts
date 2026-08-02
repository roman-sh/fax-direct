import { DurableObject } from "cloudflare:workers"

import type { FaxSessionData } from "@/shared/session/fax-session"

const EMPTY_SESSION: FaxSessionData = {
  document: null,
  quote: null,
  recipient: null,
}

const SESSION_STORAGE_KEY = "session"

export class FaxSession extends DurableObject<CloudflareEnv> {
  async getSession(): Promise<FaxSessionData> {
    return (
      (await this.ctx.storage.get<FaxSessionData>(
        SESSION_STORAGE_KEY
      )) ?? EMPTY_SESSION
    )
  }
}
