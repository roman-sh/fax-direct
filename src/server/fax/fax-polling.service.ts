/**
 * Polls every active InterFAX transaction as one batch, then synchronizes its
 * public session projection and provider facts. Timing belongs to the separate
 * polling coordinator; this service performs one complete polling pass only.
 */
import {
  isUndocumentedFailureStatus,
  mapInterfaxFaxToSessionFax,
  mapInterfaxFaxToTransmissionUpdate,
} from "@/server/fax/fax-polling.mapper"
import { FaxTransmissionRepository } from "@/server/fax/fax-transmission.repository"
import type { FaxTransmissionRow } from "@/server/fax/fax-transmission.schema"
import {
  createInterfaxService,
  type InterfaxService,
} from "@/server/fax/interfax.service"
import type { InterfaxFax } from "@/server/fax/interfax.schema"

type FaxPollingEnvironment = Pick<
  CloudflareEnv,
  | "APP_DATABASE"
  | "FAX_SESSIONS"
  | "INTERFAX_USERNAME"
  | "INTERFAX_PASSWORD"
>

/** Creates one polling service from the Worker's application bindings. */
export function createFaxPollingService(
  env: FaxPollingEnvironment
): FaxPollingService {
  return new FaxPollingService(
    new FaxTransmissionRepository(env.APP_DATABASE),
    createInterfaxService(env),
    env.FAX_SESSIONS
  )
}

/** Runs one provider polling pass; it does not own alarm scheduling. */
export class FaxPollingService {
  constructor(
    private readonly transmissions: FaxTransmissionRepository,        // D1 rows
    private readonly interfax: InterfaxService,                       // The InterFAX API client
    private readonly sessions: FaxPollingEnvironment["FAX_SESSIONS"]  // durable object's data
  ) {}

  /**
   * Reads every active D1 row, requests their statuses in one InterFAX call,
   * and synchronizes every result. The return value tells the coordinator
   * whether another polling alarm is needed.
   * Transmission: row in D1; Transaction: fax object from interfax api;
   */
  async poll(): Promise<boolean> {
    // collect rows in active(processing) state from D1 to poll
    const active = await this.transmissions.findProcessing()

    if (!active.length) {
      return false  // stops polling
    }

    // fetches transactions(faxes) from interfax api
    const providerFaxes = await this.interfax.getFaxes(
      active.map(({ transactionId }) => transactionId)  // array of transactionIds
    )

    // creates a map of transactionIds to transaction objects for O(1) lookup
    const providerFaxById = new Map(
      providerFaxes.map((fax) => [String(fax.id), fax])
    )

    for (const transmission of active) {
      const providerFax = providerFaxById.get(transmission.transactionId)

      if (!providerFax) {
        console.error({
          event: "interfax_transaction_omitted",
          transactionId: transmission.transactionId,
        })
        continue
      }

      try {
        await this.synchronizeTransmission(transmission, providerFax)
      } catch (error) {
        // One fax must not prevent unrelated transactions in the same provider
        // batch from advancing. Its unchanged D1 row remains active and will be
        // retried during the next polling pass.
        console.error({
          event: "fax_transmission_sync_failed",
          transactionId: transmission.transactionId,
          error: readErrorMessage(error),
        })
      }
    }

    return !!(await this.transmissions.findProcessing()).length
  }

  /**
   * Applies one provider result. The session is deliberately written first:
   * if a final D1 row were written first and the session RPC then failed, that
   * row would leave the active query and the browser could stay stale forever.
   */
  private async synchronizeTransmission(
    transmission: FaxTransmissionRow,
    providerFax: InterfaxFax
  ): Promise<void> {
    const transmissionUpdate = mapInterfaxFaxToTransmissionUpdate(providerFax)

    if (isUndocumentedFailureStatus(providerFax.status)) {
      console.warn({
        event: "interfax_undocumented_final_status",
        transactionId: transmission.transactionId,
        providerStatus: providerFax.status,
      })
    }

    const nextSessionFax = mapInterfaxFaxToSessionFax(providerFax)

    // Every poll refreshes the browser-facing state and broadcasts a snapshot.
    // Besides keeping the flow straightforward, this periodically reconciles
    // the session if a previous WebSocket update was not observed by a client.
    await this.sessions
      .getByName(transmission.sessionId)
      .updateFax(nextSessionFax)

    await this.transmissions.update(
      transmission.transactionId,
      transmissionUpdate
    )

    if (providerFax.status >= 0) {
      logFinalProviderDiagnostics(transmission.transactionId, providerFax)
    }
  }
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/** Logs useful final diagnostics without persisting provider-only metadata. */
function logFinalProviderDiagnostics(
  transactionId: string,
  providerFax: InterfaxFax
): void {
  console.info({
    event: "interfax_transaction_completed",
    transactionId,
    providerStatus: providerFax.status,
    duration: providerFax.duration,
    units: providerFax.units,
    remoteCSID: providerFax.remoteCSID,
  })
}

/** Produces a stable structured-log value for an arbitrary thrown value. */
function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
