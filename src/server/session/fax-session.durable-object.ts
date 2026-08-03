import { DurableObject } from "cloudflare:workers"

import {
  type FaxSessionDocument,
  type FaxSessionData,
  type FaxSessionQuote,
  type FaxSessionRecipient,
} from "@/shared/session/fax-session.types"

const LEGACY_SESSION_STORAGE_KEY = "session"

type FaxSessionRow = {
  document_object_key: string | null
  document_original_name: string | null
  document_page_count: number | null
  document_size_bytes: number | null
  quote_amount: string | null
  quote_currency: string | null
  recipient_display_value: string | null
  recipient_e164: string | null
}

/**
 * Each Durable Object represents one browser fax session and owns a separate
 * SQLite database. The database contains one flattened row so its state is
 * readable in Cloudflare Data Studio while the public API can stay nested.
 */
export class FaxSession extends DurableObject<CloudflareEnv> {
  constructor(ctx: DurableObjectState, env: CloudflareEnv) {
    super(ctx, env)

    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS fax_session (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          document_object_key TEXT,
          document_original_name TEXT,
          document_page_count INTEGER,
          document_size_bytes INTEGER,
          recipient_display_value TEXT,
          recipient_e164 TEXT,
          quote_amount TEXT,
          quote_currency TEXT CHECK (
            quote_currency IS NULL OR quote_currency = 'ILS'
          ),
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      ctx.storage.sql.exec(
        "INSERT OR IGNORE INTO fax_session (id) VALUES (1)"
      )

      // Test sessions created before SQL persistence are intentionally discarded.
      await ctx.storage.delete(LEGACY_SESSION_STORAGE_KEY)
    })
  }

  async getSession(): Promise<FaxSessionData> {
    const row = this.ctx.storage.sql
      .exec<FaxSessionRow>(`
        SELECT
          document_object_key,
          document_original_name,
          document_page_count,
          document_size_bytes,
          recipient_display_value,
          recipient_e164,
          quote_amount,
          quote_currency
        FROM fax_session
        WHERE id = 1
      `)
      .one()

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
    this.ctx.storage.sql.exec(
      `
        UPDATE fax_session
        SET
          document_object_key = ?,
          document_original_name = ?,
          document_page_count = ?,
          document_size_bytes = ?,
          quote_amount = NULL,
          quote_currency = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `,
      document.objectKey,
      document.originalName,
      document.pageCount,
      document.sizeBytes
    )

    return this.getSession()
  }

  /** Saves payment-ready recipient and quote data only after a document exists. */
  async setRecipientAndQuote(
    recipient: FaxSessionRecipient,
    quote: FaxSessionQuote
  ): Promise<boolean> {
    const result = this.ctx.storage.sql.exec(
      `
        UPDATE fax_session
        SET
          recipient_display_value = ?,
          recipient_e164 = ?,
          quote_amount = ?,
          quote_currency = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1 AND document_object_key IS NOT NULL
      `,
      recipient.displayValue,
      recipient.e164,
      quote.amount,
      quote.currency
    )

    return result.rowsWritten === 1
  }
}

function documentFromRow(row: FaxSessionRow): FaxSessionDocument | null {
  if (
    row.document_object_key === null ||
    row.document_original_name === null ||
    row.document_page_count === null ||
    row.document_size_bytes === null
  ) {
    return null
  }

  return {
    objectKey: row.document_object_key,
    originalName: row.document_original_name,
    pageCount: row.document_page_count,
    sizeBytes: row.document_size_bytes,
  }
}

function recipientFromRow(row: FaxSessionRow): FaxSessionRecipient | null {
  if (
    row.recipient_display_value === null ||
    row.recipient_e164 === null
  ) {
    return null
  }

  return {
    displayValue: row.recipient_display_value,
    e164: row.recipient_e164,
  }
}

function quoteFromRow(row: FaxSessionRow): FaxSessionQuote | null {
  if (row.quote_amount === null || row.quote_currency !== "ILS") {
    return null
  }

  return {
    amount: row.quote_amount,
    currency: row.quote_currency,
  }
}
