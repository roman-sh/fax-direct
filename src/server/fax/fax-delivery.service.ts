import type { FaxDeliveryWorkflowParams } from "@/server/fax/fax-delivery.workflow"
import type { FaxSessionData } from "@/shared/session/fax-session.types"

/**
 * Starts one delivery attempt — the initial paid delivery and every manual
 * retry go through this same path. The Durable Object atomically initializes
 * the attempt as `preparing` before any Workflow exists, so concurrent calls
 * cannot start two deliveries. Its number makes the instance id deterministic,
 * so retrying Workflow creation is an idempotent no-op rather than a duplicate
 * fax.
 * Returns null when the session may not start an attempt.
 */
export async function scheduleFaxDelivery(
  env: CloudflareEnv,
  sessionId: string
): Promise<FaxSessionData | null> {
  const attempt = await env.FAX_SESSIONS
    .getByName(sessionId)
    .initializeDeliveryAttempt()

  if (!attempt) {
    return null
  }

  await env.FAX_DELIVERY_WORKFLOW.createBatch([
    {
      id: `${sessionId}-${attempt.number}`,
      params: {
        sessionId,
        attempt: attempt.number,
      } satisfies FaxDeliveryWorkflowParams,
    },
  ])

  return attempt.session
}
