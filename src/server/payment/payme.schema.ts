/**
 * Defines the PayMe responses accepted at the provider boundary. Runtime
 * validation keeps malformed sale and error payloads out of application state.
 */
import { z } from "zod"

/*
 * Complete PayMe sandbox generate-sale response captured on 2026-09-29
 * (HTTP 200). Every returned field and value is preserved. Fields marked with
 * "<-- validated" are checked by payMeGenerateSaleSuccessSchema.
 * {
 *   "status_code": 0, <-- validated
 *   "sale_url": "https://sandbox.payme.io/sale/generate/SALE1790-713021LJ-ZOOBFVUO-WPJKJHDD", <-- validated
 *   "payme_sale_id": "SALE1790-713021LJ-ZOOBFVUO-WPJKJHDD", <-- validated
 *   "payme_sale_code": 18090968, <-- validated
 *   "price": 2500, <-- validated
 *   "transaction_id": "REF0-0000-0001", <-- validated
 *   "currency": "ILS", <-- validated
 *   "sale_payment_method": "bit", <-- validated
 *   "session": "6dZr1aN4"
 * }
 */

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

/** The subset of one queried sale needed for payment reconciliation. */
export const payMeQueriedSaleSchema = z.object({
  transaction_id: z.string().min(1),
  sale_payme_id: z.string().min(1),
  sale_status: z.string().min(1),
})

/** A successful response from PayMe's get-sales endpoint. */
export const payMeGetSalesSuccessSchema = z.object({
  status_code: z.literal(0),
  items: z.array(payMeQueriedSaleSchema),
})

export const payMeGetSalesResponseSchema = z.discriminatedUnion(
  "status_code",
  [payMeGetSalesSuccessSchema, payMeErrorSchema]
)

/** Provider diagnostics returned when PayMe rejects a request. */
export type PayMeError = z.infer<typeof payMeErrorSchema>

/*
 * Complete PayMe sandbox responses captured on 2026-09-29.
 * Every returned field and value is preserved except buyer_social_id, which
 * contains the buyer's Israeli ID and is intentionally redacted.
 * Fields marked with "<-- validated" are checked by the schemas above.
 *
 * Completed sale lookup (HTTP 200):
 * {
 *   "items_count": 1,
 *   "items": [ <-- validated
 *     {
 *       "seller_payme_id": "MPL15952-55747UXL-TVTRUDAK-VFESKZOM",
 *       "seller_id": null,
 *       "sale_payme_code": 18042351,
 *       "transaction_id": "PB6R-2S8Z-7NTT", <-- validated
 *       "sale_type": 1,
 *       "sale_created": "2026-09-29 01:46:25",
 *       "sale_status": "completed", <-- validated
 *       "transaction_risk_score": 0,
 *       "sale_currency": "ILS",
 *       "sale_price": 2500,
 *       "sale_price_after_fees": "2500",
 *       "sale_description": "שליחת פקס",
 *       "sale_installments": 1,
 *       "transaction_first_payment": "2500",
 *       "transaction_periodical_payment": "0",
 *       "sale_vat": "0.18",
 *       "sale_paid_date": "2026-09-29 01:50:24",
 *       "sale_auth_number": "ARzb5xfow",
 *       "sale_release_date": null,
 *       "sale_error_code": null,
 *       "sale_error_text": null,
 *       "sale_payment_method": "bit",
 *       "sale_payme_id": "SALE1790-63558524-NDTLWMYB-UISCX56P", <-- validated
 *       "sale_url": "https://sandbox.payme.io/sale/generate/SALE1790-63558524-NDTLWMYB-UISCX56P",
 *       "sale_is_3ds": false,
 *       "sale_fees": {
 *         "sale_processing_fee": "2.95",
 *         "sale_processing_fee_total": 74,
 *         "sale_processing_charge": "0.100000000000000000",
 *         "sale_discount_fee": "0.00",
 *         "sale_discount_fee_total": 0,
 *         "sale_rapid_settlement_fee": "0.00",
 *         "sale_rapid_settlement_fee_total": 0,
 *         "sale_annual_interest_rate": null,
 *         "sale_market_fee": "0.00",
 *         "sale_market_fee_fixed": 0,
 *         "sale_market_fee_total": 0
 *       },
 *       "sale_buyer_details": {
 *         "buyer_card_mask": "531084******1234",
 *         "buyer_card_expiry": "1234",
 *         "buyer_card_brand": "Mastercard",
 *         "buyer_card_is_foreign": true,
 *         "buyer_name": "",
 *         "buyer_email": "",
 *         "buyer_phone": "",
 *         "buyer_social_id": "[redacted]"
 *       },
 *       "sale_invoices": {}
 *     }
 *   ],
 *   "status_code": 0, <-- validated
 *   "session": "sWz6fapb"
 * }
 *
 * Exact lookup with no matching sale (HTTP 200):
 * {
 *   "items_count": 0,
 *   "items": [], <-- validated
 *   "status_code": 0, <-- validated
 *   "session": "DRhhmyC3"
 * }
 *
 * Rejected seller identifier (HTTP 200 or 500):
 * {
 *   "status_code": 1, <-- validated
 *   "status_error_code": 251, <-- validated
 *   "status_error_details": "מוכר לא נמצא", <-- validated when present
 *   "status_additional_info": "seller_payme_id" <-- validated when present
 * }
 */
