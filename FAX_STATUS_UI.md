# Fax delivery status UI

This document specifies the client work that begins after payment. It does not
describe InterFAX polling or provider-code classification; those backend rules
remain in `API.md`.

## Goal

Keep the existing three-card flow. Before payment, card 3 remains the payment
summary. As soon as the authoritative session reports `payment.status ===
"paid"`, the content of that same card becomes the delivery-status view.

The browser already receives full session snapshots from
`/api/session/events`:

```ts
type FaxSessionEvent = {
  type: "session"
  session: FaxSessionData
}
```

`useFaxSession()` already replaces its local session with each snapshot. Do not
open a second WebSocket. The status UI should render from `session.payment` and
`session.fax` only.

## Locale and message formatting

Add `intl-messageformat` as the small client-side formatter. It is not a full
localization system; it formats typed message templates, interpolated values,
and ICU plural rules.

The Server Component passes the enforced locale to the interactive sheet:

```tsx
<FaxSheet locale="he-IL" ... />
```

The client must not infer the locale from WebSocket data. In the first release
only `he-IL` is rendered. English templates are defined now so the contract is
clear and the design can be reviewed in both languages.

Use two typed maps created once per locale:

```ts
progressStatusToMessageMap
semanticCodeToMessageMap
```

Each map value is an `IntlMessageFormat` instance. Complete sentences belong
inside the templates; application code must not assemble Hebrew fragments.

## Third-card layout

The status view should feel like the payment card continuing forward, not a new
page or modal.

```text
+-------------------------------------------------------------+
| 03  סטטוס השליחה                                            |
|     [state icon]  הפקס נשלח / מתחבר / נמסר                  |
|                                                             |
| מסמך ........ two_pages.pdf                                 |
| מספר פקס .... 077-4448706                                   |
| עמודים ...... 1 / 2            [==========------]           |
|                                                             |
| פעילות                                                      |
|   מכינים את המסמך לשליחה.                                   |
|   הפקס התקבל וממתין לשליחה.                                 |
| > נשלח עמוד אחד מתוך שניים.                                 |
|                                                             |
| [contextual action]                         קוד: XXXX-XXXX   |
+-------------------------------------------------------------+
```

Recommended hierarchy:

1. **Global state** — icon, short title, and color. Neutral/brand while active,
   green only for `delivered`, red only for `failed`, and amber for
   `service_delayed`.
2. **Compact summary** — original filename, recipient display value, and page
   progress. Keep phone number and filename visually LTR inside the RTL card.
3. **Page progress** — `pagesSent / pagesSubmitted` plus a progress bar. Reaching
   all pages does not mean delivered; `finalizing` still waits for provider
   confirmation.
4. **Activity feed** — a compact console-like history described below.
5. **Actions** — hidden while delivery is active; contextual after success or
   failure.

During `preparing`, `queued`, `sending`, `finalizing`, and `service_delayed`, do
not allow cards 1 or 2 to edit the paid fax. A failed state may expose “edit
number” or “edit document” actions once the corresponding retry endpoints are
implemented. Delivered exposes “send another fax” once new-session reset is
implemented.

## Console-like activity feed

The poller deliberately broadcasts a fresh snapshot every ten seconds, even if
the provider values did not change. The feed must therefore append only when
this fingerprint changes:

```ts
`${fax.status}:${fax.pagesSent}:${fax.pagesSubmitted}:${fax.error ?? ""}`
```

Behavior:

- Keep entries chronologically, oldest at the top and newest at the bottom.
- Use a fixed-height area that shows roughly four entries.
- Auto-scroll to the newest entry unless the user has manually scrolled up.
- Fade older entries toward the top instead of abruptly replacing the message.
- Keep a small bounded in-memory list, for example the latest eight entries.
- Do not persist the feed. After refresh, seed it with the current authoritative
  snapshot; historical transitions cannot be reconstructed reliably.
- Use `role="log"`, `aria-live="polite"`, and `aria-relevant="additions"` so new
  entries are announced without interrupting the user.
- A repeated snapshot may refresh connection health internally, but it must not
  create a duplicate visible line.

## Progress messages

| State | Hebrew | English |
| --- | --- | --- |
| Payment `pending` | ממתינים לאישור התשלום. | Waiting for payment confirmation. |
| Payment `paid`, fax still `null` | התשלום התקבל. מתחילים את השליחה. | Payment received. Starting the fax delivery. |
| `preparing` | מכינים את המסמך לשליחה. | Preparing the document for delivery. |
| `queued` | הפקס התקבל וממתין לשליחה. | The fax is queued for delivery. |
| `sending`, zero pages sent | מתחברים למספר הפקס. | Connecting to the fax number. |
| `sending`, pages sent | נשלחו {pagesSent} מתוך {pagesSubmitted} עמודים. | Sent {pagesSent} of {pagesSubmitted} pages. |
| `finalizing` | כל עמודי המסמך שודרו. ממתינים לאישור המסירה. | All pages were transmitted. Waiting for final delivery confirmation. |
| `service_delayed` | השליחה מתעכבת עקב תקלה זמנית בשירות. נמשיך לבדוק. | Delivery is delayed by a temporary service issue. We will keep checking. |
| `delivered` | הפקס נמסר בהצלחה. | The fax was delivered successfully. |
| `failed` | Select the message using `fax.error`. | Select the message using `fax.error`. |

The `sending` formatter should use ICU plural branches rather than the generic
Hebrew sentence above, so singular and dual forms read naturally.

## Failure messages

`fax.error` is our semantic code, not the numeric InterFAX status. A failed fax
must display exactly one primary failure message. Provider codes and internal
diagnostics are never shown to the customer.

| Semantic code | Hebrew | English | Future action |
| --- | --- | --- | --- |
| `BUSY` | מספר הפקס תפוס כרגע. אפשר לנסות שוב מאוחר יותר. | The fax number is busy. Try again later. | Retry |
| `NO_ANSWER` | מספר הפקס לא ענה. בדקו את המספר או נסו שוב מאוחר יותר. | The fax number did not answer. Check the number or try again later. | Edit number, retry |
| `VOICE_ANSWERED` | השיחה נענתה, אך לא זוהה מכשיר פקס. בדקו את המספר לפני ניסיון נוסף. | The call was answered, but no fax machine was detected. Check the number before retrying. | Edit number |
| `INVALID_NUMBER` | מספר הפקס אינו תקין. בדקו את המספר ונסו שוב. | The fax number is invalid. Check it and try again. | Edit number |
| `DESTINATION_UNAVAILABLE` | לא ניתן לחייג למספר הפקס. בדקו שהמספר פעיל ותקין. | The fax number cannot be reached. Check that it is active and correct. | Edit number |
| `CALL_REJECTED` | היעד דחה את השיחה. בדקו את המספר או נסו שוב מאוחר יותר. | The destination rejected the call. Check the number or try again later. | Edit number, retry |
| `ROUTE_UNAVAILABLE` | לא ניתן כרגע לנתב את השליחה למספר הזה. בדקו את המספר או נסו שוב מאוחר יותר. | Delivery cannot currently be routed to this number. Check it or try again later. | Edit number, retry later |
| `FAX_INCOMPATIBLE` | נוצר קשר עם מכשיר הפקס, אך התקשורת איתו נכשלה. אפשר לנסות שוב. | A fax machine answered, but fax communication failed. You can try again. | Retry |
| `TRANSMISSION_INTERRUPTED` | החיבור נותק לפני שהשליחה הושלמה. אפשר לנסות שוב. | The connection ended before delivery was complete. You can try again. | Retry |
| `CONNECTION_FAILED` | לא הצלחנו ליצור קשר עם מספר הפקס. בדקו את המספר או נסו שוב מאוחר יותר. | We could not connect to the fax number. Check it or try again later. | Edit number, retry |
| `DOCUMENT_PROCESSING_FAILED` | לא הצלחנו להכין את המסמך לשליחה. נסו להעלות קובץ PDF אחר. | We could not prepare the document. Try uploading a different PDF. | Edit document |
| `CANCELED` | שליחת הפקס בוטלה. | Fax delivery was canceled. | Retry |
| `SERVICE_UNAVAILABLE` | לא הצלחנו לשלוח את הפקס עקב תקלה זמנית בשירות. נסו שוב מאוחר יותר. | A temporary service problem prevented delivery. Try again later. | Retry later |
| `UNKNOWN_FAILURE` | שליחת הפקס נכשלה מסיבה לא ידועה. בדקו את המספר או נסו שוב מאוחר יותר. | Fax delivery failed for an unknown reason. Check the number or try again later. | Edit number, retry later |
| `DELIVERY_UNCONFIRMED` | כל עמודי המסמך שודרו, אך לא התקבל אישור מסירה סופי. מומלץ לבדוק מול הנמען לפני ניסיון נוסף. | All pages were transmitted, but final delivery was not confirmed. Check with the recipient before retrying. | Check with recipient |
| `PARTIAL_TRANSMISSION` | השליחה נכשלה לאחר שחלק מהעמודים שודרו. ייתכן שחלק מהמסמך התקבל. | Delivery failed after some pages were transmitted. The recipient may have received part of the document. | Check before retrying |

`PARTIAL_TRANSMISSION` must interpolate `pagesSent` and `pagesSubmitted`. Hebrew
needs explicit `=1`, `=2`, and `other` ICU branches. English can use normal ICU
singular/plural branches. The complete templates already drafted in `API.md`
are the source for implementation.

If `status === "failed"` but `error === null`, render `UNKNOWN_FAILURE`
defensively and report the invalid snapshot to the console/observability layer.

## State and transition rules

- Show `PaymentStep` while payment is absent or `pending`.
- Show the new delivery-status component when payment is `paid` or `fax` is not
  `null`. Checking `fax` as well makes restoration resilient to an unexpected
  payment-field mismatch.
- The current snapshot is authoritative. The activity feed is presentation
  history only and must never drive business state.
- Never infer delivery from page counts. Only `status === "delivered"` is final
  success.
- `failed` and `delivered` are terminal for the current attempt.
- Keep the WebSocket connected throughout active and terminal display so a
  late authoritative correction can still replace the snapshot.

## Suggested component split

```text
FaxSheet
└── third FlowCard
    ├── PaymentStep                 (before payment confirmation)
    └── FaxDeliveryStatusStep       (after payment confirmation)
        ├── FaxDeliverySummary
        ├── FaxPageProgress
        ├── FaxActivityLog
        └── FaxDeliveryActions
```

Suggested client helpers:

- `createFaxMessageFormatters(locale)` — creates and caches both typed maps.
- `formatFaxSnapshotMessage(fax, formatters)` — returns one localized line for
  one snapshot.
- `useFaxActivityLog(fax)` — fingerprints snapshots and maintains the bounded
  visible history.

Keep these helpers independent of React where possible. React components should
choose layout; formatter helpers should choose language.

## Implementation order

1. Add `intl-messageformat` and pass `locale="he-IL"` from `page.tsx` to
   `FaxSheet`.
2. Add typed Hebrew and English progress/failure templates and formatter
   helpers.
3. Add the deduplicated in-memory activity-log hook.
4. Build `FaxDeliveryStatusStep` using the existing card styles.
5. Switch card 3 from payment to delivery status on authoritative payment/fax
   state.
6. Wire delivered/failed actions only after retry and new-session endpoints are
   defined; until then, show status without nonfunctional buttons.
7. Verify restoration, WebSocket reconnection, repeated identical polls, page
   progression, final delivery, every semantic failure, RTL layout, and mobile
   layout.

## Acceptance criteria

- Payment confirmation changes card 3 in place without navigation.
- WebSocket snapshots update the global status, progress bar, and activity feed.
- Identical ten-second polling snapshots do not create duplicate feed entries.
- `0/2`, `1/2`, and `2/2 finalizing` remain visibly distinct from delivered.
- A failed state shows one localized semantic message, never an InterFAX code.
- Hebrew renders correctly in RTL while filenames, phone numbers, and counters
  remain readable.
- Refresh restores the latest authoritative state and starts a fresh local
  activity feed.
- The design remains usable in the existing card height and on mobile.
