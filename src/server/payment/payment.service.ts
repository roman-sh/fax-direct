import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import { PAYMENT_STATUS_CHANGED_EVENT } from "@/server/payment/payment-reconciliation.constants"
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
 * Wakes the current PayMe sale's reconciliation Workflow. Webhook and browser
 * return data are hints only; the Workflow queries PayMe for the actual state.
 */
export async function signalPaymentReconciliation(
  sessionId: string
): Promise<void> {
  const { env } = getCloudflareContext()
  const payment = await new PaymentRepository(
    env.APP_DATABASE
  ).findBySessionId(sessionId)

  if (!payment) {
    throw new Error(`Payment session ${sessionId} was not found.`)
  }

  // A repeated callback needs no work after reconciliation has finished.
  if (payment.status !== PAYMENT_STATUS.pending) {
    return
  }

  const workflow = await env.PAYMENT_RECONCILIATION_WORKFLOW.get(
    payment.payMeSaleId
  )

  await workflow.sendEvent({
    type: PAYMENT_STATUS_CHANGED_EVENT,
    payload: null,
  })
}
