import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import type { FaxDeliveryWorkflowParams } from "@/server/fax/fax-delivery.workflow"
import type { FaxSessionData } from "@/shared/session/fax-session.types"

/**
 * Starts one delivery attempt — the initial paid delivery and every manual
 * retry go through this same path. The Durable Object gate atomically claims
 * the attempt as `preparing` before any Workflow exists, so concurrent calls
 * cannot start two deliveries; the attempt number makes the instance id
 * deterministic, so re-running a claim (`preparing` re-entry after a failed
 * instance creation) is an idempotent no-op rather than a duplicate fax.
 * Returns null when the session may not start an attempt.
 */
export async function startFaxDeliveryAttempt(
  sessionId: string
): Promise<FaxSessionData | null> {
  const { env } = getCloudflareContext()
  const claim = await env.FAX_SESSIONS
    .getByName(sessionId)
    .beginDelivery()

  if (!claim) {
    return null
  }

  await env.FAX_DELIVERY_WORKFLOW.createBatch([
    {
      id: `${sessionId}-${claim.attempt}`,
      params: {
        sessionId,
        attempt: claim.attempt,
      } satisfies FaxDeliveryWorkflowParams,
    },
  ])

  return claim.session
}
