/**
 * Provides the application's typed write boundary for PayMe sale records in
 * D1. The payment Workflow creates the row; later webhook handling will update
 * its lifecycle status through this repository.
 */
import { drizzle } from "drizzle-orm/d1"

import {
  paymentTable,
  type NewPaymentRow,
} from "@/server/payment/payment.schema"

type PaymentDatabase = ReturnType<typeof createPaymentDatabase>

/** Provider sale details stored after PayMe creates the hosted checkout. */
export type CreatePayment = Omit<
  NewPaymentRow,
  "status" | "createdAt" | "updatedAt"
>

/** Creates a typed Drizzle client over the Worker's global D1 binding. */
function createPaymentDatabase(database: D1Database) {
  return drizzle(database, {
    logger: false,
    schema: {
      paymentTable,
    },
  })
}

/** Groups the supported D1 operations for global payment state. */
export class PaymentRepository {
  private readonly db: PaymentDatabase

  constructor(database: D1Database) {
    this.db = createPaymentDatabase(database)
  }

  /** Stores one successfully created PayMe sale with pending status. */
  async create(payment: CreatePayment): Promise<void> {
    // A Workflow step may run again when D1 committed the insert but
    // Cloudflare did not persist the step checkpoint. The session primary key
    // turns that replay into a no-op instead of a duplicate-row error.
    await this.db
      .insert(paymentTable)
      .values(payment)
      .onConflictDoNothing({ target: paymentTable.sessionId })
      .run()
  }
}
