/**
 * Owns the single polling alarm for all active fax transmissions. Provider
 * requests and status interpretation belong to FaxPollingService; this Durable
 * Object only decides when another polling pass should run.
 */
import { DurableObject } from "cloudflare:workers"

import { createFaxPollingService } from "@/server/fax/fax-polling.service"
import { FaxTransmissionRepository } from "@/server/fax/fax-transmission.repository"

const POLLING_INTERVAL_MS = 10_000

/** Serializes scheduling so the application never owns competing poll loops. */
export class FaxPollingCoordinator extends DurableObject<CloudflareEnv> {
  private readonly polling = createFaxPollingService(this.env)
  private readonly transmissions = new FaxTransmissionRepository(
    this.env.APP_DATABASE
  )

  /**
   * Starts polling only when work exists and no alarm is already pending.
   * Preserving an existing alarm avoids pushing an imminent poll ten seconds
   * into the future whenever another fax is submitted.
   */
  async managePolling(): Promise<void> {
    if (await this.ctx.storage.getAlarm()) {
      return
    }

    const active = await this.transmissions.findProcessing()

    if (!active.length) {
      return
    }

    await this.ctx.storage.setAlarm(Date.now() + POLLING_INTERVAL_MS)
  }

  /** Runs one polling pass and continues the loop while active work remains. */
  async alarm(): Promise<void> {
    if (await this.polling.poll()) {
      await this.managePolling()
    }
  }
}
