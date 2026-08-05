/**
 * Defines the global D1 representation of submitted faxes. This schema is
 * intentionally separate from FaxSession's per-object SQLite schema: D1 lets
 * the polling coordinator find and update transmissions across all sessions.
 */
import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const FAX_TRANSMISSION_STATUS = {
  PROCESSING: "processing",
  DELIVERED: "delivered",
  FAILED: "failed",
} as const

export const FAX_RESOLUTION = {
  FINE: "Fine",
  STANDARD: "Standard",
} as const

/** One global D1 record for one InterFAX transaction. */
export const faxTransmissionTable = sqliteTable(
  "fax_transmissions",
  {
    transactionId: text("transaction_id").primaryKey(),
    sessionId: text("session_id").notNull(),
    status: text("status", {
      enum: [
        FAX_TRANSMISSION_STATUS.PROCESSING,
        FAX_TRANSMISSION_STATUS.DELIVERED,
        FAX_TRANSMISSION_STATUS.FAILED,
      ],
    })
      .notNull()
      .default(FAX_TRANSMISSION_STATUS.PROCESSING),
    providerStatus: integer("provider_status").notNull(),
    pagesSubmitted: integer("pages_submitted").notNull(),
    pagesSent: integer("pages_sent").notNull(),
    attemptsMade: integer("attempts_made").notNull(),
    attemptsTotal: integer("attempts_total").notNull(),
    resolution: text("resolution", {
      enum: [FAX_RESOLUTION.FINE, FAX_RESOLUTION.STANDARD],
    }).notNull(),
    submittedAt: text("submitted_at").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("fax_transmissions_status_idx").on(table.status),
    index("fax_transmissions_session_id_idx").on(table.sessionId),
    check(
      "fax_transmissions_status",
      sql`${table.status} IN ('processing', 'delivered', 'failed')`
    ),
    check(
      "fax_transmissions_resolution",
      sql`${table.resolution} IN ('Fine', 'Standard')`
    ),
    check(
      "fax_transmissions_page_counts",
      sql`${table.pagesSubmitted} >= 0 AND ${table.pagesSent} >= 0`
    ),
    check(
      "fax_transmissions_attempt_counts",
      sql`${table.attemptsMade} >= 0 AND ${table.attemptsTotal} >= 0`
    ),
  ]
)

export type FaxTransmissionRow = typeof faxTransmissionTable.$inferSelect
export type NewFaxTransmissionRow = typeof faxTransmissionTable.$inferInsert
export type FaxTransmissionStatus = FaxTransmissionRow["status"]
export type FaxResolution = FaxTransmissionRow["resolution"]
