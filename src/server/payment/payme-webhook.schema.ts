/** Validates and normalizes PayMe webhook notifications before handling. */
import { z } from "zod"

export const payMeWebhookSchema = z
  .object({
    notify_type: z.string(),
    payme_status: z.string().optional(),
    transaction_id: z.string().optional(),
  })
  .transform((webhook, context) => {
    switch (webhook.notify_type) {
      case "sale-complete":
        if (webhook.payme_status !== "success") {
          context.addIssue({
            code: "custom",
            path: ["payme_status"],
            message: "Expected a successful payment status.",
          })
          return z.NEVER
        }

        if (!webhook.transaction_id) {
          context.addIssue({
            code: "custom",
            path: ["transaction_id"],
            message: "Expected a session ID.",
          })
          return z.NEVER
        }

        return {
          type: "sale-complete" as const,
          sessionId: webhook.transaction_id,
        }

      case "sale-failure":
        return { type: "sale-failure" as const }

      default:
        return {
          type: "other" as const,
          notifyType: webhook.notify_type,
        }
    }
  })
