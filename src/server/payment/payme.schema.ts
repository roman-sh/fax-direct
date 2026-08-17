/**
 * Defines the PayMe responses accepted at the provider boundary. Runtime
 * validation keeps malformed sale and error payloads out of application state.
 */
import { z } from "zod"

/** A successful hosted-sale response returned by PayMe. */
export const payMeGenerateSaleSuccessSchema = z.object({
  status_code: z.literal(0),
  sale_url: z.string().url(),
  payme_sale_id: z.string().min(1),
  payme_sale_code: z.number().int().nonnegative(),
  price: z.number().int().positive(),
  transaction_id: z.string().min(1),
  currency: z.literal("ILS"),
  sale_payment_method: z.literal("bit"),
})

/** A rejected PayMe request still normally arrives with HTTP status 200. */
export const payMeErrorSchema = z.object({
  /** Provider-level failure marker, independent of the HTTP status. */
  status_code: z.literal(1),
  /** Stable PayMe code used for programmatic error classification. */
  status_error_code: z.union([z.number(), z.string()]),
  /** Main human-readable provider diagnostic, when supplied. */
  status_error_details: z.string().optional(),
  /** Extra context such as the offending value or current sale status. */
  status_additional_info: z.union([z.string(), z.number()]).optional(),
})

export const payMeGenerateSaleResponseSchema = z.discriminatedUnion(
  "status_code",
  [payMeGenerateSaleSuccessSchema, payMeErrorSchema]
)

/** Provider diagnostics returned when PayMe rejects a request. */
export type PayMeError = z.infer<typeof payMeErrorSchema>
