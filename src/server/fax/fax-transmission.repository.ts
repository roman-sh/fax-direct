/**
 * Provides the application's typed read/write boundary for fax transmission
 * records in D1. Submission creates rows here; the polling coordinator later
 * finds active rows and applies normalized InterFAX progress updates.
 */
import { eq, isNull, lt, or, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

import {
  faxTransmissionTable,
  type FaxResolution,
  type FaxTransmissionRow,
} from "@/server/fax/fax-transmission.schema"

type FaxTransmissionDatabase = ReturnType<typeof createFaxTransmissionDatabase>

export type CreateFaxTransmission = {
  transactionId: string
  sessionId: string
  deliveryAttempt: number
  pagesSubmitted: number
  pagesSent: number
  attemptsMade: number
  attemptsTotal: number
  resolution: FaxResolution
  submittedAt: string
}

export type UpdateFaxTransmission = {
  providerStatus: number
  pagesSubmitted: number
  pagesSent: number
  attemptsMade: number
  attemptsTotal: number
  completedAt: string | null
}

/** Creates a typed Drizzle client over the Worker's global D1 binding. */
function createFaxTransmissionDatabase(database: D1Database) {
  return drizzle(database, {
    logger: false,
    schema: {
      faxTransmissionTable,
    },
  })
}

/** Groups the supported D1 operations for global transmission state. */
export class FaxTransmissionRepository {
  private readonly db: FaxTransmissionDatabase

  constructor(database: D1Database) {
    this.db = createFaxTransmissionDatabase(database)
  }

  /** Stores the initial provider state immediately after fax submission. */
  async create(transmission: CreateFaxTransmission): Promise<FaxTransmissionRow> {
    const created = await this.db
      .insert(faxTransmissionTable)
      .values(transmission)
      .onConflictDoNothing()
      .returning()
      .get()

    if (created) {
      return created
    }

    const existing = await this.db
      .select()
      .from(faxTransmissionTable)
      .where(eq(faxTransmissionTable.transactionId, transmission.transactionId))
      .get()

    if (
      !existing ||
      existing.sessionId !== transmission.sessionId ||
      existing.deliveryAttempt !== transmission.deliveryAttempt ||
      existing.resolution !== transmission.resolution ||
      existing.submittedAt !== transmission.submittedAt
    ) {
      throw new Error(
        `Fax transaction ${transmission.transactionId} conflicts with an existing D1 record.`
      )
    }

    // A Workflow step can be replayed after its D1 write committed but before
    // Cloudflare persisted the step result. Returning the same row makes that
    // replay safe without overwriting newer polling fields.
    return existing
  }

  /** Returns every transaction that still needs provider polling. */
  async findProcessing(): Promise<FaxTransmissionRow[]> {
    return this.db
      .select()
      .from(faxTransmissionTable)
      .where(
        or(
          isNull(faxTransmissionTable.providerStatus),
          lt(faxTransmissionTable.providerStatus, 0)
        )
      )
      .all()
  }

  /** Applies one normalized provider update to an existing transaction. */
  async update(
    transactionId: string,
    transmission: UpdateFaxTransmission
  ): Promise<FaxTransmissionRow | null> {
    const updated = await this.db
      .update(faxTransmissionTable)
      .set({
        ...transmission,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(faxTransmissionTable.transactionId, transactionId))
      .returning()
      .get()

    return updated ?? null
  }
}
