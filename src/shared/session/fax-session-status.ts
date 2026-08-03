export const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
} as const

export type FaxPaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]

/** Fax delivery states will be persisted when transmission is implemented. */
export const FAX_STATUS = {
  READY: "ready",
  SENDING: "sending",
  DELIVERED: "delivered",
  FAILED: "failed",
} as const

export type FaxDeliveryStatus =
  (typeof FAX_STATUS)[keyof typeof FAX_STATUS]
