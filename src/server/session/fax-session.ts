import { DurableObject } from "cloudflare:workers"

import {
  EMPTY_FAX_SESSION_DATA,
  type FaxSessionDocument,
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

  /** Stores the verified R2 document and invalidates any previous quote. */
  async setDocument(
    document: FaxSessionDocument
  ): Promise<FaxSessionData> {
    const current = await this.getSession()
    const updated: FaxSessionData = {
      ...current,
      document,
      quote: null,
    }

    await this.ctx.storage.put(SESSION_STORAGE_KEY, updated)

    return updated
  }
}
