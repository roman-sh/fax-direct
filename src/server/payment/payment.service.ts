import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import { startFaxDeliveryAttempt } from "@/server/fax/fax-delivery.service"
import { PaymentRepository } from "@/server/payment/payment.repository"
import type { PaymentWorkflowParams } from "@/server/payment/payment.workflow"
import { PAYMENT_STATUS } from "@/shared/session/fax-session-status"

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
    case PAYMENT_STATUS.pending:
    case PAYMENT_STATUS.paid:
      return

    // A failed payment already has a Workflow instance under this session ID.
    // Restarting it from the beginning creates the customer's new attempt.
    case PAYMENT_STATUS.failed: {
      const workflow = await env.PAYMENT_WORKFLOW.get(sessionId)
      await workflow.restart()
      return
    }

    // Without a D1 sale, the Workflow distinguishes a first Pay request from
    // an active or failed creation: create, leave running, or restart.
    case undefined: {
      let workflow: WorkflowInstance

      try {
        // Cloudflare throws instead of returning null when instance doesn't exist.
        workflow = await env.PAYMENT_WORKFLOW.get(sessionId)
      } catch {
        // createBatch guarantees a concurrent create with this ID is safely skipped.
        await env.PAYMENT_WORKFLOW.createBatch([
          {
            id: sessionId,
            params: {
              sessionId,
            } satisfies PaymentWorkflowParams,
          },
        ])
        return
      }

      const { status } = await workflow.status()

      // Restart only failed workflow
      if (status === "errored") {
        await workflow.restart()
      }

      // Ignore the request for all other states
      return
    }

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
): Promise<void> {
  const { env } = getCloudflareContext()

  // Persist the completed payment in the global D1 record.
  await new PaymentRepository(env.APP_DATABASE).markPaid(sessionId)

  // Publish the paid state to the browser through the session Durable Object.
  await env.FAX_SESSIONS
    .getByName(sessionId)
    .confirmPayment()

  // Start the durable fax-delivery sequence after payment is confirmed.
  await startFaxDeliveryAttempt(sessionId)
}
