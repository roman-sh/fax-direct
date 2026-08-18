# PayMe API Reference

Provider-level reference for the PayMe endpoints and observed behavior.
Application orchestration belongs in `README.md`; this file contains no
credential values.

Most behavior below was observed with a demo sandbox merchant. Request and
response shapes are suitable integration evidence, but production-only product
behavior must be confirmed with PayMe before the application depends on it.

## Environments

| Environment | Base URL |
| --- | --- |
| Sandbox | `https://sandbox.payme.io/api` |
| Production | `https://live.payme.io/api` |

Requests and responses are JSON unless an endpoint says otherwise.

PayMe commonly returns HTTP 200 for both accepted and rejected API requests.
The JSON `status_code` is authoritative:

- `0` — success
- `1` — rejected request

A rejected response contains:

| Field | Meaning |
| --- | --- |
| `status_error_code` | Provider error code |
| `status_error_details` | Main human-readable diagnostic; may be absent |
| `status_additional_info` | Optional context such as the offending value or current sale status |

## Credentials

PayMe uses two different identifiers:

- `seller_payme_id` — merchant credential used to create and query sales and
  capture authorizations.
- `payme_client_key` — partner credential required by `refund-sale`.

Neither value may be committed or sent to the browser.

## Create a sale

`POST /generate-sale`

### Request

| Field | Meaning |
| --- | --- |
| `seller_payme_id` | Merchant credential |
| `sale_price` | Integer amount in the currency's smallest unit; for ILS, agorot |
| `currency` | ISO currency such as `ILS` |
| `product_name` | Description displayed by PayMe |
| `transaction_id` | Merchant correlation identifier, maximum 50 characters |
| `sale_type` | `sale` for an immediate J4 sale or `authorize` for J5 |
| `sale_payment_method` | Requested method such as `bit`; `multi` offers enabled methods |
| `layout` | Hosted checkout layout such as `dynamic` |
| `sale_callback_url` | Server-to-server notification URL; may not be localhost |
| `language` | Hosted checkout language code such as `he` |

The observed minimum sale amount is 500 minor units. PayMe should be treated as
the authority for account- and currency-specific limits.

### Successful response

| Field | Meaning |
| --- | --- |
| `status_code` | `0` |
| `sale_url` | Hosted checkout URL |
| `payme_sale_id` | Provider sale identifier |
| `payme_sale_code` | Numeric provider sale code |
| `price` | Amount in minor units |
| `transaction_id` | Merchant correlation identifier echoed by PayMe |
| `currency` | Currency echoed by PayMe |
| `sale_payment_method` | Payment method echoed by PayMe |

## Bit layouts

Observed behavior for `sale_payment_method: "bit"`:

| `layout` | Desktop | Mobile |
| --- | --- | --- |
| `dynamic` | Bare QR code | Bit application deep link |
| `qr-sms` | Phone field, SMS action, and QR code | Same |
| `dynamic-loose` | Same observed result as `dynamic` | Same observed result as `dynamic` |
| `micro` | Appears to fall back to `dynamic` | Appears to fall back to `dynamic` |
| omitted | Same observed result as `dynamic` | Same observed result as `dynamic` |

`micro` appears in an older 2020 Bit integration document and should not be
treated as a current distinct layout without confirmation from PayMe.

## Notification channels

PayMe exposes three separate channels:

| Channel | Direction | Format |
| --- | --- | --- |
| `generate-sale` response | PayMe to the requesting server | JSON |
| `sale_callback_url` | PayMe server to merchant server | POST `application/x-www-form-urlencoded` |
| `sale_return_url` | Customer browser redirect | GET parameters |

The callback body includes sale-result fields and `payme_signature`. PayMe's
current public documentation does not fully specify signature verification.
The algorithm and canonical field ordering must be confirmed with PayMe support
before the callback is accepted as payment evidence.

The browser return URL is a separate redirect mechanism and is not equivalent
to the server callback.

## Query sales

`POST /get-sales`

This endpoint uses `seller_payme_id` and supports filtering by
`transaction_id`. When filtering by the provider sale identifier, the parameter
name is `sale_payme_id`, not `payme_sale_id`.

Unknown filter names may be silently ignored, producing an unfiltered success
response. Callers must use the documented parameter names.

Observed behavior:

- A newly created, unpaid sale in `initial` state may be absent from results.
- Results are ordered oldest first.
- Results are capped at 500 rows per page.
- Pagination uses `page_size` and `page`.

## Capture an authorization

`POST /capture-sale`

Uses `seller_payme_id` and `payme_sale_id`. It applies to an authorized J5 sale,
not a regular completed J4 sale.

Observed responses:

- Capturing an authorized sandbox sale changed it to `completed`.
- Capturing an unpaid or already completed sale returned error `305`.
- `status_additional_info` contained the sale's current status.

Whether Bit authorization and capture are supported on a production merchant
account remains unconfirmed.

## Refund or void

`POST /refund-sale`

The documented refund request uses:

- `payme_client_key`
- `seller_payme_id`
- `payme_sale_id`
- optional `sale_refund_amount` for a partial refund

Omitting `sale_refund_amount` requests a full refund. The observed minimum
partial amount is 500 minor units.

The sandbox rejected an attempted Bit authorization void with provider error
`4` and `void action is not supported`. Production Bit refund and void behavior
must be confirmed with PayMe.

## Sale types

| `sale_type` | Meaning | Typical resulting state |
| --- | --- | --- |
| `sale` | J4 immediate sale | `completed` after approval |
| `authorize` | J5 authorization hold | `authorized` after approval |

The sandbox accepted and captured a Bit authorization, while older PayMe Bit
documentation describes only ordinary one-time sales. Treat production Bit J5
support as unconfirmed.

## Sale statuses

| Status | Meaning |
| --- | --- |
| `initial` | Created; no completed payment attempt |
| `authorized` | Funds authorized but not captured |
| `completed` | Paid |
| `failed` | Failed, refused, or expired |
| `refunded` / `partial-refund` | Fully or partly refunded |
| `chargeback` / `partial-chargeback` | Full or partial chargeback |
| `voided` / `partial-void` | Authorization fully or partly voided |
| `canceled` | Canceled |

Observed unpaid Bit sales expired after roughly nine minutes. Expiry and refusal
both appeared as `failed` at the provider level.

## Observed error codes

| Code | Meaning observed in sandbox |
| --- | --- |
| `4` | Requested action not implemented or supported |
| `305` | Current sale status does not allow the requested action |
| `720` | Requested payment method is not activated for the merchant |
| `20000` | Transaction approved |
| `23003` | Request or unpaid sale expired |

## Payment-method availability

Enabled payment methods are configured on the merchant account. Requesting a
method that is not enabled returned error `720`; `status_additional_info`
identified the method.

PayMe's Hosted Fields SDK is card-specific. It does not provide a shared custom
form for Bit, PayPal, Apple Pay, or Google Pay.

## Questions for PayMe support

- How is `payme_signature` calculated and verified, including field ordering
  and character encoding?
- Does production Bit support J5 authorization and capture?
- Are Bit authorization voids supported in production?
- How is a `payme_client_key` obtained for refunds?
- Can hosted-page personal-detail fields be disabled at the merchant-account
  level?
- Does PayMe's Apple Pay integration support cross-device QR payment?
