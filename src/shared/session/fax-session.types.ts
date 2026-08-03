import type { FaxPaymentStatus } from "@/shared/session/fax-session-status"

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

export type FaxSessionData = {
  document: FaxSessionDocument | null
  payment: FaxSessionPayment | null
  quote: FaxSessionQuote | null
  recipient: FaxSessionRecipient | null
}

export const EMPTY_FAX_SESSION_DATA: FaxSessionData = {
  document: null,
  payment: null,
  quote: null,
  recipient: null,
}
