import { sql } from "drizzle-orm"
import {
  check,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

import { PAYMENT_STATUS } from "@/shared/session/fax-session-status"

/**
 * One Durable Object owns one database, so this table always contains exactly
 * one fax-session row. Drizzle infers query types and generates migrations from
 * this definition, keeping the SQLite and TypeScript shapes in sync.
 */
export const faxSessionTable = sqliteTable(
  "fax_session",
  {
    id: integer("id").primaryKey(),
    documentObjectKey: text("document_object_key"),
    documentOriginalName: text("document_original_name"),
    documentPageCount: integer("document_page_count"),
    documentSizeBytes: integer("document_size_bytes"),
    recipientDisplayValue: text("recipient_display_value"),
    recipientE164: text("recipient_e164"),
    quoteAmount: text("quote_amount"),
    quoteCurrency: text("quote_currency", {
      enum: ["ILS"],
    }),
    paymentStatus: text("payment_status", {
      enum: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID],
    }),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("fax_session_singleton", sql`${table.id} = 1`),
    check(
      "fax_session_quote_currency",
      sql`${table.quoteCurrency} IS NULL OR ${table.quoteCurrency} = 'ILS'`
    ),
    check(
      "fax_session_payment_status",
      sql`${table.paymentStatus} IS NULL OR ${table.paymentStatus} IN ('pending', 'paid')`
    ),
  ]
)

export type FaxSessionRow = typeof faxSessionTable.$inferSelect
