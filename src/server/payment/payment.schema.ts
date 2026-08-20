/**
 * Defines the global D1 record for a PayMe sale created for one fax session.
 * The session's Durable Object separately owns the live browser-facing state.
 */
import { sql } from "drizzle-orm"
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

import {
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
} from "@/shared/session/fax-session-status"

/** One successfully created PayMe sale for one Fax Direct session. */
export const paymentTable = sqliteTable(
  "payments",
  {
    /** Fax Direct session and PayMe transaction identifier. */
    sessionId: text("session_id").primaryKey(),
    /** Unique sale identifier assigned by PayMe. */
    payMeSaleId: text("payme_sale_id").notNull().unique(),
    /** Numeric sale code assigned by PayMe. */
    payMeSaleCode: integer("payme_sale_code").notNull(),
    /** Hosted PayMe page displayed to the customer. */
    checkoutUrl: text("checkout_url").notNull(),
    /** Charged amount in the currency's smallest unit. */
    amountMinorUnits: integer("amount_minor_units").notNull(),
    /** Currency used for the sale. */
    currency: text("currency").notNull(),
    /** PayMe payment method used for the sale. */
    paymentMethod: text("payment_method").notNull(),
    /**
     * Current payment lifecycle state. D1 rows begin at "pending"; "initiated" is
     * shared with the browser session but is never stored without a PayMe sale.
     */
    status: text("status", {
      enum: PAYMENT_STATUS_VALUES,
    })
      .notNull()
      .default(PAYMENT_STATUS.pending),
    /** Time at which Fax Direct stored the created sale. */
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    /** Time of the latest payment-state change. */
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("payments_positive_amount", sql`${table.amountMinorUnits} > 0`),
    check(
      "payments_status",
      sql`${table.status} IN (${sql.raw(
        PAYMENT_STATUS_VALUES.map((status) => `'${status}'`).join(", ")
      )})`
    ),
  ]
)

export type PaymentRow = typeof paymentTable.$inferSelect
export type NewPaymentRow = typeof paymentTable.$inferInsert
export type PaymentStatus = PaymentRow["status"]
