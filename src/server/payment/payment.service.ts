import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import { startFaxDeliveryAttempt } from "@/server/fax/fax-delivery.service"
import type { PaymentWorkflowParams } from "@/server/payment/payment.workflow"
import type { FaxSessionData } from "@/shared/session/fax-session.types"

/** Starts the session's one durable payment-creation Workflow. */
export async function startFaxPayment(
  sessionId: string
): Promise<void> {
  const { env } = getCloudflareContext()

  // createBatch makes repeated requests with this deterministic instance id
  // idempotent: an existing session Workflow is skipped rather than duplicated.
  await env.PAYMENT_WORKFLOW.createBatch([
    {
      id: sessionId,
      params: {
        sessionId,
      } satisfies PaymentWorkflowParams,
    },
  ])
}

/**
 * Applies a payment confirmation callback and durably ensures its delivery
 * Workflow exists. Repeated callbacks are safe: the delivery gate re-issues
 * the same attempt while `preparing` (idempotent instance creation) and
 * declines once the delivery is in flight.
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

  return (await startFaxDeliveryAttempt(sessionId)) ?? session
}
