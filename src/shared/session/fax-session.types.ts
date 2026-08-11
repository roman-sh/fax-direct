import type {
  FaxPaymentStatus,
  FaxProgressStatus,
} from "@/shared/session/fax-session-status"

export type FaxSessionDocument = {
  objectKey: string
  originalName: string
  pageCount: number
  sizeBytes: number
}

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
