export const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
} as const

export type FaxPaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]

/**
 * Browser-facing fax progress. These states describe our business flow rather
 * than exposing InterFAX's numeric lifecycle codes to the client.
 */
export const FAX_STATUS = {
  // The paid delivery Workflow is reading the PDF and submitting it to InterFAX.
  PREPARING: "preparing",
  // InterFAX accepted the submission, but the first provider poll has not run yet.
  QUEUED: "queued",
  // InterFAX is processing the fax and has not yet sent every submitted page.
  SENDING: "sending",
  // Every page was sent, but InterFAX has not confirmed final delivery yet.
  FINALIZING: "finalizing",
  // InterFAX reported a known temporary service hold rather than a final failure.
  SERVICE_DELAYED: "service_delayed",
  // Only InterFAX status 0 confirms delivery; page counts alone never do.
  DELIVERED: "delivered",
  // InterFAX reported a positive, final failure status.
  FAILED: "failed",
} as const

/** Runtime list used by persistence validation and other status boundaries. */
export const FAX_PROGRESS_STATUSES = [
  FAX_STATUS.PREPARING,
  FAX_STATUS.QUEUED,
  FAX_STATUS.SENDING,
  FAX_STATUS.FINALIZING,
  FAX_STATUS.SERVICE_DELAYED,
  FAX_STATUS.DELIVERED,
  FAX_STATUS.FAILED,
] as const

export type FaxProgressStatus =
  (typeof FAX_PROGRESS_STATUSES)[number]
