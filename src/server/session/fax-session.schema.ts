/**
 * Typed model for each FaxSession Durable Object's private SQLite database.
 * Keep this definition aligned with `fax-session.sql`, which creates the table
 * when a new session object starts. This is not the application's global D1.
 */
import { sql } from "drizzle-orm"
import {
  check,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

import {
  DOCUMENT_STATUS_VALUES,
  FAX_PROGRESS_STATUSES,
  PAYMENT_STATUS_VALUES,
} from "@/shared/session/fax-session-status"
import {
  DOCUMENT_ERROR_CODES,
  DOCUMENT_FORMATS,
  FAX_FAILURE_SEMANTIC_CODES,
} from "@/shared/session/fax-session.types"

/** The private database contains exactly one row for its owning fax session. */
export const faxSessionTable = sqliteTable(
  "fax_session",
  {
    id: integer("id").primaryKey(),
    documentObjectKey: text("document_object_key"),
    documentOriginalName: text("document_original_name"),
    documentPageCount: integer("document_page_count"),
    documentSizeBytes: integer("document_size_bytes"),
    documentFormat: text("document_format", {
      enum: DOCUMENT_FORMATS,
    }),
    documentStatus: text("document_status", {
      enum: DOCUMENT_STATUS_VALUES,
    }),
    documentError: text("document_error", {
      enum: DOCUMENT_ERROR_CODES,
    }),
    recipientDisplayValue: text("recipient_display_value"),
    recipientE164: text("recipient_e164"),
    quoteAmount: text("quote_amount"),
    quoteCurrency: text("quote_currency", {
      enum: ["ILS"],
    }),
    paymentStatus: text("payment_status", {
      enum: PAYMENT_STATUS_VALUES,
    }),
    checkoutUrl: text("checkout_url"),
    // This is our browser-facing lifecycle, not InterFAX's numeric status.
    faxStatus: text("fax_status", {
      enum: FAX_PROGRESS_STATUSES,
    }),
    // Page counts stay independent from status: N/N pages can still be finalizing.
    faxPagesSent: integer("fax_pages_sent"),
    faxPagesSubmitted: integer("fax_pages_submitted"),
    // Persist a stable application code; localized messages belong to the client.
    faxError: text("fax_error", {
      enum: FAX_FAILURE_SEMANTIC_CODES,
    }),
    // Counts started deliveries (initial = 1) and numbers their Workflow ids.
    deliveryAttempt: integer("delivery_attempt")
      .notNull()
      .default(0),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("fax_session_singleton", sql`${table.id} = 1`),
    check(
      "fax_session_document_format",
      sql`${table.documentFormat} IS NULL OR ${table.documentFormat} IN (${sql.raw(
        DOCUMENT_FORMATS.map((format) => `'${format}'`).join(", ")
      )})`
    ),
    check(
      "fax_session_document_status",
      sql`${table.documentStatus} IS NULL OR ${table.documentStatus} IN (${sql.raw(
        DOCUMENT_STATUS_VALUES.map((status) => `'${status}'`).join(", ")
      )})`
    ),
    check(
      "fax_session_document_error",
      sql`${table.documentError} IS NULL OR ${table.documentError} IN (${sql.raw(
        DOCUMENT_ERROR_CODES.map((code) => `'${code}'`).join(", ")
      )})`
    ),
    check(
      "fax_session_document_status_consistency",
      sql`(${table.documentStatus} = 'failed' AND ${table.documentError} IS NOT NULL) OR (${table.documentStatus} IS NULL OR ${table.documentStatus} != 'failed') AND ${table.documentError} IS NULL`
    ),
    check(
      "fax_session_quote_currency",
      sql`${table.quoteCurrency} IS NULL OR ${table.quoteCurrency} = 'ILS'`
    ),
    check(
      "fax_session_payment_status",
      sql`${table.paymentStatus} IS NULL OR ${table.paymentStatus} IN (${sql.raw(
        PAYMENT_STATUS_VALUES.map((status) => `'${status}'`).join(", ")
      )})`
    ),
    check(
      "fax_session_fax_status",
      sql`${table.faxStatus} IS NULL OR ${table.faxStatus} IN ('preparing', 'queued', 'sending', 'finalizing', 'service_delayed', 'delivered', 'failed')`
    ),
    check(
      "fax_session_fax_pages_sent",
      sql`${table.faxPagesSent} IS NULL OR ${table.faxPagesSent} >= 0`
    ),
    check(
      "fax_session_fax_pages_submitted",
      sql`${table.faxPagesSubmitted} IS NULL OR ${table.faxPagesSubmitted} >= 0`
    ),
    check(
      "fax_session_fax_page_progress",
      sql`${table.faxPagesSent} IS NULL OR ${table.faxPagesSubmitted} IS NULL OR ${table.faxPagesSent} <= ${table.faxPagesSubmitted}`
    ),
    check(
      "fax_session_delivery_attempt",
      sql`${table.deliveryAttempt} >= 0`
    ),
    check(
      "fax_session_fax_error",
      sql`${table.faxError} IS NULL OR ${table.faxError} IN ('BUSY', 'CALL_REJECTED', 'CANCELED', 'CONNECTION_FAILED', 'DELIVERY_UNCONFIRMED', 'DESTINATION_UNAVAILABLE', 'DOCUMENT_PROCESSING_FAILED', 'FAX_INCOMPATIBLE', 'INVALID_NUMBER', 'NO_ANSWER', 'PARTIAL_TRANSMISSION', 'ROUTE_UNAVAILABLE', 'SERVICE_UNAVAILABLE', 'TRANSMISSION_INTERRUPTED', 'UNKNOWN_FAILURE', 'VOICE_ANSWERED')`
    ),
  ]
)

export type FaxSessionRow = typeof faxSessionTable.$inferSelect
