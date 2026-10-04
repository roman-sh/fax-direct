import { DurableObject } from "cloudflare:workers"
import { and, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/durable-sqlite"
import { migrate } from "drizzle-orm/durable-sqlite/migrator"

import migrations from "../../../drizzle/fax-session/migrations"
import {
  faxSessionTable,
  type FaxSessionRow,
} from "@/server/session/fax-session.schema"
import type { FaxSessionEvent } from "@/shared/session/fax-session-event"
import {
  type FaxDocumentErrorCode,
  type FaxSessionDocument,
  type FaxSessionData,
  type FaxSessionDocumentFile,
  type FaxSessionFax,
  type FaxSessionPayment,
  type FaxSessionQuote,
  type FaxSessionRecipient,
} from "@/shared/session/fax-session.types"
import {
  DOCUMENT_STATUS,
  FAX_STATUS,
  PAYMENT_STATUS,
  type FaxPaymentStatus,
} from "@/shared/session/fax-session-status"
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
      deliveryAttempt: row.deliveryAttempt,
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

  /**
   * Columns that retire a finally failed delivery, or none when there is
   * nothing to retire. Editing the document or the recipient answers the
   * failure, so leaving the old result on screen would keep complaining about
   * something the customer has already corrected. The attempt counter is
   * deliberately untouched: it still numbers the next Workflow instance, and a
   * null fax beside a non-zero count is what tells the card to offer sending
   * again rather than paying again.
   */
  private clearFailedDelivery(): Partial<FaxSessionRow> {
    const row = this.db
      .select({ faxStatus: faxSessionTable.faxStatus })
      .from(faxSessionTable)
      .where(eq(faxSessionTable.id, SESSION_ROW_ID))
      .get()

    if (row?.faxStatus !== FAX_STATUS.FAILED) {
      return {}
    }

    return {
      faxStatus: null,
      faxPagesSent: 0,
      faxPagesSubmitted: 0,
      faxError: null,
    }
  }

  /**
   * Initializes the accepted document with `processing` status.
   *
   * On success, `updateSession()` returns the updated session and broadcasts it
   * to connected clients. Returns `null` without broadcasting when another
   * document is already processing.
   */
  async initializeDocument(
    document: FaxSessionDocumentFile
  ): Promise<FaxSessionData | null> {
    return this.updateSession(() => {
      const updated = this.db
        .update(faxSessionTable)
        .set({
          documentObjectKey: document.objectKey,
          documentOriginalName: document.originalName,
          documentPageCount: null,
          documentSizeBytes: document.sizeBytes,
          documentStatus: DOCUMENT_STATUS.processing,
          documentError: null,
          quoteAmount: null,
          quoteCurrency: null,
          ...this.clearFailedDelivery(),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(faxSessionTable.id, SESSION_ROW_ID),
            or(
              isNull(faxSessionTable.documentStatus),
              ne(
                faxSessionTable.documentStatus,
                DOCUMENT_STATUS.processing
              )
            )
          )
        )
        .returning({ id: faxSessionTable.id })
        .get()

      return updated !== undefined
    })
  }

  /**
   * Finalizes a processing document after successful inspection. The existing
   * R2 metadata remains unchanged; only the discovered page count and `ready`
   * status are added. The quote is restored when a recipient already exists
   * because pricing depends on both inputs.
   */
  async finalizeDocument(
    pageCount: number,
    quote: FaxSessionQuote
  ): Promise<FaxSessionData | null> {
    return this.updateSession(() => {
      const hasRecipient =
        this.db
          .select({ id: faxSessionTable.id })
          .from(faxSessionTable)
          .where(
            and(
              eq(faxSessionTable.id, SESSION_ROW_ID),
              isNotNull(faxSessionTable.recipientE164)
            )
          )
          .get() !== undefined

      const updated = this.db
        .update(faxSessionTable)
        .set({
          documentPageCount: pageCount,
          documentStatus: DOCUMENT_STATUS.ready,
          documentError: null,
          ...(hasRecipient
            ? { quoteAmount: quote.amount, quoteCurrency: quote.currency }
            : {}),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(faxSessionTable.id, SESSION_ROW_ID),
            eq(faxSessionTable.documentStatus, DOCUMENT_STATUS.processing)
          )
        )
        .returning({ id: faxSessionTable.id })
        .get()

      return updated !== undefined
    })
  }

  /**
   * Ends processing with a stable error code for the browser. The stored R2
   * metadata remains available so the failed document can still be identified.
   */
  async failDocument(
    error: FaxDocumentErrorCode
  ): Promise<FaxSessionData | null> {
    return this.updateSession(() => {
      const updated = this.db
        .update(faxSessionTable)
        .set({
          documentStatus: DOCUMENT_STATUS.failed,
          documentError: error,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(faxSessionTable.id, SESSION_ROW_ID),
            eq(
              faxSessionTable.documentStatus,
              DOCUMENT_STATUS.processing
            )
          )
        )
        .returning({ id: faxSessionTable.id })
        .get()

      return updated !== undefined
    })
  }

  /**
   * Stores the recipient and re-prices the session. The quote is written in the
   * same statement because the guard below already requires a document, so both
   * inputs are present whenever this succeeds. Returns null when no document
   * exists yet, which is the same rule `finalizeDocument` applies from its side.
   */
  async setRecipient(
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
          ...this.clearFailedDelivery(),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(faxSessionTable.id, SESSION_ROW_ID),
            eq(
              faxSessionTable.documentStatus,
              DOCUMENT_STATUS.ready
            )
          )
        )
        .returning({ id: faxSessionTable.id })
        .get()

      return updated !== undefined
    })
  }

  /** Updates and broadcasts the browser-facing payment status. */
  async setPaymentStatus(status: FaxPaymentStatus): Promise<void> {
    await this.updateSession(() => {
      this.db
        .update(faxSessionTable)
        .set({
          paymentStatus: status,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(faxSessionTable.id, SESSION_ROW_ID))
        .run()

      return true
    })
  }

  /**
   * Publishes a failed PayMe sale and removes its unusable hosted checkout.
   * Repeated failure callbacks are idempotent; a completed payment wins over
   * any delayed failure notification.
   */
  async failPayment(): Promise<void> {
    const current = await this.getSession()

    if (current.payment?.status === PAYMENT_STATUS.paid) return
    if (
      current.payment?.status === PAYMENT_STATUS.failed &&
      current.payment.checkoutUrl === null
    ) {
      return
    }

    const success = await this.updateSession(() => {
      const updated = this.db
        .update(faxSessionTable)
        .set({
          paymentStatus: PAYMENT_STATUS.failed,
          checkoutUrl: null,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(faxSessionTable.id, SESSION_ROW_ID),
            eq(faxSessionTable.paymentStatus, PAYMENT_STATUS.pending)
          )
        )
        .returning({ id: faxSessionTable.id })
        .get()

      return updated !== undefined
    })

    if (!success) {
      throw new Error("Session update to failed payment status failed.")
    }
  }

  /** Stores the checkout URL, marks payment pending, and broadcasts the session. */
  async setCheckout(checkoutUrl: string): Promise<void> {
    await this.updateSession(() => {
      this.db
        .update(faxSessionTable)
        .set({
          paymentStatus: PAYMENT_STATUS.pending,
          checkoutUrl,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(faxSessionTable.id, SESSION_ROW_ID))
        .run()

      return true
    })
  }

  /**
   * Confirms a pending payment. Already-paid callbacks are idempotent; any
   * other payment state rejects confirmation.
   */
  async confirmPayment(): Promise<void> {
    const current = await this.getSession()

    if (current.payment?.status === PAYMENT_STATUS.paid) return

    const success = await this.updateSession(() => {
      const updated = this.db
        .update(faxSessionTable)
        .set({
          paymentStatus: PAYMENT_STATUS.paid,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(faxSessionTable.id, SESSION_ROW_ID),
            eq(faxSessionTable.paymentStatus, PAYMENT_STATUS.pending)
          )
        )
        .returning({ id: faxSessionTable.id })
        .get()

      return updated !== undefined
    })

    if (!success) {
      throw new Error("Session update to paid status failed.")
    }
  }

  /**
   * Initializes the session state for one fax-delivery attempt.
   *
   * A paid session with a document and recipient may start its first delivery
   * or retry a failed one. Initialization increments the attempt number, resets
   * earlier progress and errors, changes the fax status to `preparing`, and
   * publishes the updated session to connected browsers.
   *
   * When the session is already `preparing`, the existing attempt is returned
   * unchanged. This lets the caller safely repeat deterministic Workflow
   * creation if an earlier creation request failed. Other active or completed
   * delivery states return null because no new Workflow should be created.
   */
  async initializeDeliveryAttempt(): Promise<{
    number: number
    session: FaxSessionData
  } | null> {
    const row = this.db
      .select()
      .from(faxSessionTable)
      .where(eq(faxSessionTable.id, SESSION_ROW_ID))
      .get()

    if (!row) {
      throw new Error("Fax session row is missing.")
    }

    const document = documentFromRow(row)

    // Delivery requires a completed payment and both provider inputs.
    if (
      row.paymentStatus !== PAYMENT_STATUS.paid ||
      document?.status !== DOCUMENT_STATUS.ready ||
      recipientFromRow(row) === null
    ) {
      return null
    }

    // Reuse the existing number so retrying Workflow creation remains safe.
    if (row.faxStatus === FAX_STATUS.PREPARING) {
      return {
        number: row.deliveryAttempt,
        session: await this.getSession(),
      }
    }

    // A running or completed delivery must not start another attempt.
    if (
      row.faxStatus !== null &&
      row.faxStatus !== FAX_STATUS.FAILED
    ) {
      return null
    }

    const attempt = row.deliveryAttempt + 1

    // Initialize browser-visible progress before its Workflow is created.
    const session = await this.updateSession(() => {
      this.db
        .update(faxSessionTable)
        .set({
          deliveryAttempt: attempt,
          faxStatus: FAX_STATUS.PREPARING,
          faxPagesSent: 0,
          // The current document decides the counters, so a document replaced
          // after a failure is reflected in the next attempt's progress.
          faxPagesSubmitted: document.pageCount,
          faxError: null,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(faxSessionTable.id, SESSION_ROW_ID))
        .run()

      return true
    })

    return {
      number: attempt,
      session,
    }
  }

  /**
   * Persists fax progress that has already been determined by the owning
   * orchestration component. The delivery Workflow supplies `queued` and the
   * submission failure; the InterFAX poller supplies the remaining
   * provider-driven states. This Durable Object stores the public state but
   * does not interpret provider codes itself.
   *
   * Every write names the delivery attempt it belongs to and lands only while
   * that attempt is still the current one. A slow provider result for a
   * superseded attempt — e.g. a poll that was in flight when the customer
   * started a retry — returns null instead of overwriting the newer attempt.
   *
   * `updateSession()` reads the resulting authoritative session and broadcasts
   * it through the existing WebSocket path.
   */
  async updateFax(
    fax: FaxSessionFax,
    attempt: number
  ): Promise<FaxSessionData | null> {
    const session = await this.updateSession(() => {
      const updated = this.db
        .update(faxSessionTable)
        .set({
          faxStatus: fax.status,
          faxPagesSent: fax.pagesSent,
          faxPagesSubmitted: fax.pagesSubmitted,
          faxError: fax.error,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(faxSessionTable.id, SESSION_ROW_ID),
            eq(faxSessionTable.deliveryAttempt, attempt)
          )
        )
        .returning({ id: faxSessionTable.id })
        .get()

      return updated !== undefined
    })

    if (!session) {
      console.warn("fax_stale_attempt_write_dropped", {
        sessionId: this.sessionName,
        attempt,
        faxStatus: fax.status,
      })
    }

    return session
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

/** Reconstructs the stored document and its lifecycle. */
function documentFromRow(row: FaxSessionRow): FaxSessionDocument | null {
  // A session without an R2 object key has not accepted a document yet.
  if (!row.documentObjectKey) return null

  // Every stored document must have the metadata shared by all three states.
  if (
    !row.documentOriginalName ||
    !row.documentSizeBytes ||
    !row.documentStatus
  ) {
    throw new Error("Stored document state is incomplete.")
  }

  const file: FaxSessionDocumentFile = {
    objectKey: row.documentObjectKey,
    originalName: row.documentOriginalName,
    sizeBytes: row.documentSizeBytes,
  }

  switch (row.documentStatus) {
    // Upload, PDF validation, or page counting has not finished yet.
    case DOCUMENT_STATUS.processing:
      return {
        ...file,
        status: DOCUMENT_STATUS.processing,
      }

    case DOCUMENT_STATUS.ready:
      // A ready document must include the page count found by inspection.
      if (!row.documentPageCount) {
        throw new Error("Ready document has no page count.")
      }

      return {
        ...file,
        status: DOCUMENT_STATUS.ready,
        pageCount: row.documentPageCount,
      }

    case DOCUMENT_STATUS.failed:
      // A failed document must include the stable browser-facing error code.
      if (!row.documentError) {
        throw new Error("Failed document has no error code.")
      }

      return {
        ...file,
        status: DOCUMENT_STATUS.failed,
        error: row.documentError,
      }
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

/** Converts the nullable SQL payment columns into the nested session shape. */
function paymentFromRow(row: FaxSessionRow): FaxSessionPayment | null {
  if (row.paymentStatus === null) {
    return null
  }

  return {
    status: row.paymentStatus,
    checkoutUrl: row.checkoutUrl,
  }
}
