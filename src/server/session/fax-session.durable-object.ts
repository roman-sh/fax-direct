import { DurableObject } from "cloudflare:workers"
import { and, eq, isNotNull, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/durable-sqlite"
import { migrate } from "drizzle-orm/durable-sqlite/migrator"

import migrations from "../../../drizzle/fax-session/migrations"
import {
  faxSessionTable,
  type FaxSessionRow,
} from "@/server/session/fax-session.schema"
import type { FaxSessionEvent } from "@/shared/session/fax-session-event"
import {
  type FaxSessionDocument,
  type FaxSessionData,
  type FaxSessionFax,
  type FaxSessionPayment,
  type FaxSessionQuote,
  type FaxSessionRecipient,
} from "@/shared/session/fax-session.types"
import { PAYMENT_STATUS } from "@/shared/session/fax-session-status"
import { isWebSocketUpgradeRequest } from "@/shared/websocket/is-websocket-upgrade-request"

const LEGACY_SESSION_STORAGE_KEY = "session"
const SESSION_ROW_ID = 1

/** Creates a typed Drizzle client over this Durable Object's private SQLite. */
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

  /**
   * Prepares the per-session database before Cloudflare delivers any request or
   * RPC call: apply migrations, ensure its single row exists, and discard the
   * obsolete pre-SQL test value.
   */
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

  /**
   * Identifies this object in logs. Sessions reach it through getByName, so the
   * name is the browser session ID and joins these entries to the poller's.
   */
  private get sessionName(): string {
    return this.ctx.id.name ?? this.ctx.id.toString()
  }

  /** Reconstructs the nested API session from its single flattened SQL row. */
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
      fax: faxFromRow(row),
      payment: paymentFromRow(row),
      quote: quoteFromRow(row),
      recipient: recipientFromRow(row),
    }
  }

  /** Accepts an authenticated browser connection routed by the custom Worker. */
  async fetch(request: Request): Promise<Response> {
    if (!isWebSocketUpgradeRequest(request)) {
      return new Response("Expected WebSocket", { status: 426 })
    }

    // A WebSocket connection has two endpoints. Cloudflare creates both ends
    // together: one will be returned to the browser, while the other remains
    // attached to this Durable Object so it can send future session updates.
    const pair = new WebSocketPair()
    const [browserSocket, durableObjectSocket] = Object.values(pair)

    // Accepting the server-side endpoint registers it with Cloudflare's
    // hibernation API. The connection can stay open while this object sleeps.
    this.ctx.acceptWebSocket(durableObjectSocket)

    // Give a newly connected browser the current authoritative state instead
    // of making it wait for the next database change.
    this.sendSession(durableObjectSocket, await this.getSession())

    // Status 101 completes the HTTP-to-WebSocket upgrade. Cloudflare transfers
    // this endpoint to the browser; the Durable Object keeps its paired end.
    return new Response(null, {
      status: 101,
      webSocket: browserSocket,
    })
  }

  /**
   * Records why an accepted browser WebSocket stopped receiving updates. Code
   * 1006 means the connection dropped without a close frame, which the browser
   * recovers from silently, so these entries are the only trace it happened.
   */
  webSocketClose(
    _webSocket: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ): void {
    console.info("fax_socket_closed", {
      sessionId: this.sessionName,
      code,
      reason,
      wasClean,
      remainingSockets: this.ctx.getWebSockets().length,
    })
  }

  /** Records errors raised by an accepted browser WebSocket. */
  webSocketError(_webSocket: WebSocket, error: unknown): void {
    console.error("fax_socket_error", {
      sessionId: this.sessionName,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  /** Stores the verified R2 document and invalidates any previous quote. */
  async setDocument(
    document: FaxSessionDocument
  ): Promise<FaxSessionData> {
    return this.updateSession(() => {
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

      return true
    })
  }

  /**
   * Saves payment-ready recipient and quote data only after a document exists.
   * Returns null when the session is not ready for this transition.
   */
  async setRecipientAndQuote(
    recipient: FaxSessionRecipient,
    quote: FaxSessionQuote
  ): Promise<FaxSessionData | null> {
    return this.updateSession(() => {
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
    })
  }

  /**
   * Starts payment only when document, recipient, and quote are complete.
   * Returns `started: false` for an existing payment and null when not ready.
   */
  async startPayment(): Promise<{
    session: FaxSessionData
    started: boolean
  } | null> {
    const current = await this.getSession()

    if (current.payment) {
      return {
        session: current,
        started: false,
      }
    }

    const session = await this.updateSession(() => {
      const updated = this.db
        .update(faxSessionTable)
        .set({
          paymentStatus: PAYMENT_STATUS.PENDING,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(faxSessionTable.id, SESSION_ROW_ID),
            isNotNull(faxSessionTable.documentObjectKey),
            isNotNull(faxSessionTable.recipientE164),
            isNotNull(faxSessionTable.quoteAmount),
            isNotNull(faxSessionTable.quoteCurrency)
          )
        )
        .returning({ id: faxSessionTable.id })
        .get()

      return updated !== undefined
    })

    if (!session) {
      return null
    }

    return {
      session,
      started: true,
    }
  }

  /**
   * Rolls back a pending payment when its external callback cannot be
   * scheduled, leaving an already non-pending session unchanged.
   */
  async cancelPendingPayment(): Promise<FaxSessionData> {
    const session = await this.updateSession(() => {
      const updated = this.db
        .update(faxSessionTable)
        .set({
          paymentStatus: null,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(faxSessionTable.id, SESSION_ROW_ID),
            eq(faxSessionTable.paymentStatus, PAYMENT_STATUS.PENDING)
          )
        )
        .returning({ id: faxSessionTable.id })
        .get()

      return updated !== undefined
    })

    return session ?? this.getSession()
  }

  /**
   * Confirms a pending payment. Already-paid callbacks are idempotent, while a
   * callback for a session that is not pending returns null.
   */
  async confirmPayment(): Promise<FaxSessionData | null> {
    const current = await this.getSession()

    if (current.payment?.status === PAYMENT_STATUS.PAID) {
      return current
    }

    return this.updateSession(() => {
      const updated = this.db
        .update(faxSessionTable)
        .set({
          paymentStatus: PAYMENT_STATUS.PAID,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(faxSessionTable.id, SESSION_ROW_ID),
            eq(faxSessionTable.paymentStatus, PAYMENT_STATUS.PENDING)
          )
        )
        .returning({ id: faxSessionTable.id })
        .get()

      return updated !== undefined
    })
  }

  /**
   * Persists fax progress that has already been determined by the owning
   * orchestration component. The delivery Workflow supplies `preparing` and
   * `queued`; the future InterFAX poller supplies the remaining provider-driven
   * states. This Durable Object stores the public state but does not interpret
   * provider codes itself.
   *
   * `updateSession()` reads the resulting authoritative session and broadcasts
   * it through the existing WebSocket path.
   */
  async updateFax(fax: FaxSessionFax): Promise<FaxSessionData> {
    return this.updateSession(() => {
      this.db
        .update(faxSessionTable)
        .set({
          faxStatus: fax.status,
          faxPagesSent: fax.pagesSent,
          faxPagesSubmitted: fax.pagesSubmitted,
          faxError: fax.error,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(faxSessionTable.id, SESSION_ROW_ID))
        .run()

      return true
    })
  }

  /**
   * Runs a synchronous database change, then reads and broadcasts exactly one
   * authoritative snapshot. A false result means no row changed and suppresses
   * both the read and the WebSocket notification.
   */
  private async updateSession(
    change: () => true
  ): Promise<FaxSessionData>
  private async updateSession(
    change: () => boolean
  ): Promise<FaxSessionData | null>
  private async updateSession(
    change: () => boolean
  ): Promise<FaxSessionData | null> {
    if (!change()) {
      return null
    }

    const session = await this.getSession()
    this.broadcastSession(session)

    return session
  }

  /** Sends the same session snapshot to every browser viewing this object. */
  private broadcastSession(session: FaxSessionData): void {
    const webSockets = this.ctx.getWebSockets()

    // Only the anomaly is recorded. Logging every broadcast would add one entry
    // per active fax every ten seconds while saying nothing; an update computed
    // for a session nobody is watching is the case worth seeing.
    if (webSockets.length === 0) {
      console.warn("fax_socket_broadcast_without_listener", {
        sessionId: this.sessionName,
        faxStatus: session.fax?.status ?? null,
      })
    }

    for (const webSocket of webSockets) {
      this.sendSession(webSocket, session)
    }
  }

  /** Serializes one session event to an open browser WebSocket. */
  private sendSession(
    webSocket: WebSocket,
    session: FaxSessionData
  ): void {
    if (webSocket.readyState !== WebSocket.OPEN) {
      return
    }

    const event: FaxSessionEvent = {
      type: "session",
      session,
    }

    webSocket.send(JSON.stringify(event))
  }
}

// SQL row mappers

/** Builds a complete document value, or null when any document column is absent. */
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

/**
 * Reconstructs the public fax-delivery section from its flattened SQL columns.
 * No status means delivery has not started, while a stored status requires both
 * page counters so the browser can distinguish progress from final delivery.
 */
function faxFromRow(row: FaxSessionRow): FaxSessionFax | null {
  if (
    row.faxStatus === null ||
    row.faxPagesSent === null ||
    row.faxPagesSubmitted === null
  ) {
    return null
  }

  return {
    status: row.faxStatus,
    pagesSent: row.faxPagesSent,
    pagesSubmitted: row.faxPagesSubmitted,
    error: row.faxError,
  }
}

/** Builds a complete recipient value, or null when either column is absent. */
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

/** Builds a complete quote value, or null when amount or currency is absent. */
function quoteFromRow(row: FaxSessionRow): FaxSessionQuote | null {
  if (row.quoteAmount === null || row.quoteCurrency === null) {
    return null
  }

  return {
    amount: row.quoteAmount,
    currency: row.quoteCurrency,
  }
}

/** Converts the nullable SQL payment status into the nested session shape. */
function paymentFromRow(row: FaxSessionRow): FaxSessionPayment | null {
  if (row.paymentStatus === null) {
    return null
  }

  return {
    status: row.paymentStatus,
  }
}
