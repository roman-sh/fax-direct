/**
 * Owns the durable payment-creation sequence.
 *
 * Step 1 establishes only the endpoint-to-Workflow boundary. The PayMe call
 * will move into this Workflow in the next reviewed implementation step.
 */
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers"

export type PaymentWorkflowParams = {
  sessionId: string
}

/** Receives one durable payment-creation run for a browser session. */
export class PaymentWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  PaymentWorkflowParams
> {
  async run(
    event: Readonly<WorkflowEvent<PaymentWorkflowParams>>,
    step: WorkflowStep
  ): Promise<void> {
    // Temporary smoke test for the endpoint-to-Workflow trigger path. The
    // PayMe sale-creation step will replace this webhook in step 2.
    await step.do("send-test-webhook", async () => {
      const response = await fetch(
        "https://webhook.site/8c5ba286-32f8-403e-87c7-c92e3bf4b95c",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      )

      return response.status
    })
  }
}
