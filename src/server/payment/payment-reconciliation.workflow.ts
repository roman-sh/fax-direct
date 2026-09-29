import {
  WorkflowEntrypoint,
  type WorkflowEvent,
} from "cloudflare:workers"

export type PaymentReconciliationWorkflowParams = {
  payMeSaleId: string
  sessionId: string
}

/** Owns the reconciliation lifecycle for one PayMe sale. */
export class PaymentReconciliationWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  PaymentReconciliationWorkflowParams
> {
  async run(
    _event: Readonly<WorkflowEvent<PaymentReconciliationWorkflowParams>>
  ): Promise<void> {
    // Reconciliation behavior is added in the next implementation step.
  }
}
