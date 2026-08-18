import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import { startFaxDeliveryAttempt } from "@/server/fax/fax-delivery.service"
import { PaymentRepository } from "@/server/payment/payment.repository"
import { PAYMENT_STATUS } from "@/server/payment/payment.schema"
import type { PaymentWorkflowParams } from "@/server/payment/payment.workflow"
import type { FaxSessionData } from "@/shared/session/fax-session.types"

/** Creates or restarts the session's durable payment-creation Workflow. */
export async function startFaxPayment(
  sessionId: string
): Promise<void> {
  const { env } = getCloudflareContext()
  const payment = await new PaymentRepository(
    env.APP_DATABASE
  ).findBySessionId(sessionId)

  switch (payment?.status) {
    // The frontend normally hides the Pay button for an existing checkout or
    // completed payment. Repeated requests are also safe on the server.
    case PAYMENT_STATUS.PENDING:
    case PAYMENT_STATUS.PAID:
      return

    // A failed payment already has a Workflow instance under this session ID.
    // Restarting it from the beginning creates the customer's new attempt.
    case PAYMENT_STATUS.FAILED: {
      const workflow = await env.PAYMENT_WORKFLOW.get(sessionId)
      await workflow.restart()
      return
    }

    // No D1 payment exists yet. createBatch makes repeated requests with this
    // deterministic instance id idempotent by skipping an existing Workflow.
    case undefined:
      await env.PAYMENT_WORKFLOW.createBatch([
        {
          id: sessionId,
          params: {
            sessionId,
          } satisfies PaymentWorkflowParams,
        },
      ])
      return

    default:
      throw new Error("Unsupported payment status.")
  }
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
