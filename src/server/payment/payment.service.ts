import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import type { FaxDeliveryWorkflowParams } from "@/server/fax/fax-delivery.workflow"
import type { FaxSessionData } from "@/shared/session/fax-session.types"

const POSTHOOK_SCHEDULE_URL = "https://api.posthook.io/v1/hooks"
const PAYMENT_WEBHOOK_PATH = "/api/webhooks/payment"
const PAYMENT_CONFIRMATION_DELAY = "5s"
const INITIAL_DELIVERY_WORKFLOW_PREFIX = "initial-"

export type PaymentServiceErrorCode =
  | "NOT_READY"
  | "SCHEDULING_FAILED"

export class PaymentServiceError extends Error {
  constructor(readonly code: PaymentServiceErrorCode) {
    super(code)
    this.name = "PaymentServiceError"
  }
}

/** Marks the current session pending and schedules its confirmation callback. */
export async function startFaxPayment(
  sessionId: string
): Promise<FaxSessionData> {
  const { env } = getCloudflareContext()
  const session = env.FAX_SESSIONS.getByName(sessionId)
  const result = await session.startPayment()

  if (!result) {
    throw new PaymentServiceError("NOT_READY")
  }

  if (!result.started) {
    return result.session
  }

  try {
    await schedulePaymentConfirmation(sessionId, env.POSTHOOK_API_KEY)
  } catch (error) {
    await session.cancelPendingPayment()
    console.error("Could not schedule payment confirmation:", error)
    throw new PaymentServiceError("SCHEDULING_FAILED")
  }

  return result.session
}

/**
 * Applies a delayed payment callback and durably ensures its delivery Workflow
 * exists. Repeated callbacks reuse the same deterministic Workflow ID.
 */
export async function confirmFaxPayment(
  sessionId: string
): Promise<FaxSessionData | null> {
  const { env } = getCloudflareContext()
  const session = await env.FAX_SESSIONS
    .getByName(sessionId)
    .confirmPayment()

  if (!session) {
    return null
  }

  // createBatch is idempotent: a duplicate webhook skips an existing instance
  // instead of failing or starting a second delivery for the paid session.
  await env.FAX_DELIVERY_WORKFLOW.createBatch([
    {
      id: `${INITIAL_DELIVERY_WORKFLOW_PREFIX}${sessionId}`,
      params: {
        sessionId,
      } satisfies FaxDeliveryWorkflowParams,
    },
  ])

  return session
}

async function schedulePaymentConfirmation(
  sessionId: string,
  apiKey: string
): Promise<void> {
  if (!apiKey) {
    throw new Error("POSTHOOK_API_KEY is not configured.")
  }

  const response = await fetch(POSTHOOK_SCHEDULE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      path: PAYMENT_WEBHOOK_PATH,
      postIn: PAYMENT_CONFIRMATION_DELAY,
      data: {
        sessionId,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Posthook scheduling failed with ${response.status}.`)
  }
}
