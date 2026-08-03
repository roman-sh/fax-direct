import { DurableObject } from "cloudflare:workers"
import { and, eq, isNotNull, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/durable-sqlite"
import { migrate } from "drizzle-orm/durable-sqlite/migrator"

import migrations from "../../../drizzle/migrations"
import {
  faxSessionTable,
  type FaxSessionRow,
} from "@/server/session/fax-session.schema"
import {
  type FaxSessionDocument,
  type FaxSessionData,
  type FaxSessionQuote,
  type FaxSessionRecipient,
} from "@/shared/session/fax-session.types"

const LEGACY_SESSION_STORAGE_KEY = "session"
const SESSION_ROW_ID = 1

function createFaxSessionDatabase(storage: DurableObjectStorage) {
  return drizzle(storage, {
    logger: false,
    schema: {
      faxSessionTable,
    },
  })
}

type FaxSessionDatabase = ReturnType<typeof createFaxSessionDatabase>

/**
 * Each Durable Object represents one browser fax session and owns a separate
 * SQLite database. Drizzle runs the embedded schema migrations in each object
 * and keeps database queries typed from the shared table definition.
 */
export class FaxSession extends DurableObject<CloudflareEnv> {
  private readonly db: FaxSessionDatabase

  constructor(ctx: DurableObjectState, env: CloudflareEnv) {
    super(ctx, env)
    this.db = createFaxSessionDatabase(ctx.storage)

    ctx.blockConcurrencyWhile(async () => {
      await migrate(this.db, migrations)

      this.db
        .insert(faxSessionTable)
        .values({ id: SESSION_ROW_ID })
        .onConflictDoNothing()
        .run()

      // Test sessions created before SQL persistence are intentionally discarded.
      await ctx.storage.delete(LEGACY_SESSION_STORAGE_KEY)
    })
  }

  async getSession(): Promise<FaxSessionData> {
    const row = this.db
      .select()
      .from(faxSessionTable)
      .where(eq(faxSessionTable.id, SESSION_ROW_ID))
      .get()

    if (!row) {
      throw new Error("Fax session row is missing.")
    }

    return {
      document: documentFromRow(row),
      quote: quoteFromRow(row),
      recipient: recipientFromRow(row),
    }
  }

  /** Stores the verified R2 document and invalidates any previous quote. */
  async setDocument(
    document: FaxSessionDocument
  ): Promise<FaxSessionData> {
    this.db
      .update(faxSessionTable)
      .set({
        documentObjectKey: document.objectKey,
        documentOriginalName: document.originalName,
        documentPageCount: document.pageCount,
        documentSizeBytes: document.sizeBytes,
        quoteAmount: null,
        quoteCurrency: null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(faxSessionTable.id, SESSION_ROW_ID))
      .run()

    return this.getSession()
  }

  /** Saves payment-ready recipient and quote data only after a document exists. */
  async setRecipientAndQuote(
    recipient: FaxSessionRecipient,
    quote: FaxSessionQuote
  ): Promise<boolean> {
    const updated = this.db
      .update(faxSessionTable)
      .set({
        quoteAmount: quote.amount,
        quoteCurrency: quote.currency,
        recipientDisplayValue: recipient.displayValue,
        recipientE164: recipient.e164,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(faxSessionTable.id, SESSION_ROW_ID),
          isNotNull(faxSessionTable.documentObjectKey)
        )
      )
      .returning({ id: faxSessionTable.id })
      .get()

    return updated !== undefined
  }
}

function documentFromRow(row: FaxSessionRow): FaxSessionDocument | null {
  if (
    row.documentObjectKey === null ||
    row.documentOriginalName === null ||
    row.documentPageCount === null ||
    row.documentSizeBytes === null
  ) {
    return null
  }

  return {
    objectKey: row.documentObjectKey,
    originalName: row.documentOriginalName,
    pageCount: row.documentPageCount,
    sizeBytes: row.documentSizeBytes,
  }
}

function recipientFromRow(row: FaxSessionRow): FaxSessionRecipient | null {
  if (
    row.recipientDisplayValue === null ||
    row.recipientE164 === null
  ) {
    return null
  }

  return {
    displayValue: row.recipientDisplayValue,
    e164: row.recipientE164,
  }
}

function quoteFromRow(row: FaxSessionRow): FaxSessionQuote | null {
  if (row.quoteAmount === null || row.quoteCurrency === null) {
    return null
  }

  return {
    amount: row.quoteAmount,
    currency: row.quoteCurrency,
  }
}
