import type {
  FaxPaymentStatus,
  FaxProgressStatus,
} from "@/shared/session/fax-session-status"

/** File metadata recorded when a session accepts an upload for processing. */
export type FaxSessionDocumentFile = {
  objectKey: string
  originalName: string
  sizeBytes: number
}

/** A successfully inspected document that is safe to use for fax delivery. */
export type FaxSessionReadyDocument = FaxSessionDocumentFile & {
  status: "ready"
  pageCount: number
}

export const DOCUMENT_ERROR_CODES = [
  "ENCRYPTED_PDF",
  "EMPTY_PDF",
  "FILE_TOO_LARGE",
  "INVALID_FILE_TYPE",
  "INVALID_PDF",
  "TOO_MANY_PAGES",
  "PROCESSING_FAILED",
] as const

export type FaxDocumentErrorCode =
  (typeof DOCUMENT_ERROR_CODES)[number]

/**
 * One accepted document throughout its lifecycle.
 *
 * Every variant contains the R2 key, original filename, and byte size from
 * `FaxSessionDocumentFile`. Its `status` determines what additional data is
 * available:
 *
 * In these examples, `file` is a `FaxSessionDocumentFile` value containing
 * the metadata shared by every state:
 *
 * - `{ status: "processing", ...file }` — inspection has not finished.
 * - `{ status: "ready", ...file, pageCount: 2 }` — ready for fax delivery.
 * - `{ status: "failed", ...file, error: "INVALID_PDF" }` — inspection failed.
 *
 * TypeScript narrows the union after checking the status. For example,
 * `document.pageCount` is available inside
 * `if (document.status === "ready")`.
 */
export type FaxSessionDocument =
  | (FaxSessionDocumentFile & {
      status: "processing"
    })
  | (FaxSessionDocumentFile & {
      status: "ready"
      pageCount: number
    })
  | (FaxSessionDocumentFile & {
      status: "failed"
      error: FaxDocumentErrorCode
    })

export type FaxSessionRecipient = {
  displayValue: string
  e164: string
}

export type FaxSessionQuote = {
  amount: string
  currency: "ILS"
}

export type FaxSessionPayment = {
  status: FaxPaymentStatus
  checkoutUrl: string | null
}

/**
 * Stable application error categories derived from final InterFAX failures.
 * The client maps these language-neutral codes to localized user messages.
 */
export const FAX_FAILURE_SEMANTIC_CODES = [
  "BUSY",
  "CALL_REJECTED",
  "CANCELED",
  "CONNECTION_FAILED",
  "DELIVERY_UNCONFIRMED",
  "DESTINATION_UNAVAILABLE",
  "DOCUMENT_PROCESSING_FAILED",
  "FAX_INCOMPATIBLE",
  "INVALID_NUMBER",
  "NO_ANSWER",
  "PARTIAL_TRANSMISSION",
  "ROUTE_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "TRANSMISSION_INTERRUPTED",
  "UNKNOWN_FAILURE",
  "VOICE_ANSWERED",
] as const

export type FaxFailureSemanticCode =
  (typeof FAX_FAILURE_SEMANTIC_CODES)[number]

/**
 * Public fax-delivery state stored with the session and sent to the browser.
 * Page progress remains separate from the lifecycle status because all pages
 * can be transmitted while final delivery confirmation is still pending.
 * `error` is populated only for a final `failed` state.
 */
export type FaxSessionFax = {
  status: FaxProgressStatus
  pagesSent: number
  pagesSubmitted: number
  error: FaxFailureSemanticCode | null
}

export type FaxSessionData = {
  document: FaxSessionDocument | null
  fax: FaxSessionFax | null
  payment: FaxSessionPayment | null
  quote: FaxSessionQuote | null
  recipient: FaxSessionRecipient | null
  /**
   * How many deliveries this session has started. Zero until the first one is
   * claimed, and incremented in the same write that sets `preparing`, so a
   * null `fax` alongside a non-zero count can only mean an attempt was cleared
   * by editing the document or the recipient after a failure — the one state
   * that asks the customer to send again rather than to pay.
   */
  deliveryAttempt: number
}

export const EMPTY_FAX_SESSION_DATA: FaxSessionData = {
  document: null,
  fax: null,
  payment: null,
  quote: null,
  recipient: null,
  deliveryAttempt: 0,
}
