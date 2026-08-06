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
    return this.db
      .insert(faxTransmissionTable)
      .values(transmission)
      .returning()
      .get()
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
