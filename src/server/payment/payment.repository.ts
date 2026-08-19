/**
 * Provides the application's typed D1 boundary for PayMe sale records. The
 * payment endpoint reads the current lifecycle state, the Workflow creates the
 * row, and later webhook handling will update it through this repository.
 */
import { eq, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

import {
  PAYMENT_STATUS,
  paymentTable,
  type NewPaymentRow,
  type PaymentRow,
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

  /** Finds the payment currently associated with a browser session. */
  async findBySessionId(sessionId: string): Promise<PaymentRow | undefined> {
    return this.db
      .select()
      .from(paymentTable)
      .where(eq(paymentTable.sessionId, sessionId))
      .get()
  }

  /** Stores one successfully created PayMe sale with pending status. */
  async create(payment: CreatePayment): Promise<void> {
    // Another Pay attempt replaces a failed sale. Pending and paid rows remain
    // unchanged, so a repeated Workflow step cannot replace an active payment.
    await this.db
      .insert(paymentTable)
      .values(payment)
      .onConflictDoUpdate({
        target: paymentTable.sessionId,
        set: {
          ...payment,
          status: PAYMENT_STATUS.PENDING,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
        setWhere: eq(paymentTable.status, PAYMENT_STATUS.FAILED),
      })
      .run()
  }
}
