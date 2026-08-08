# InterFAX Contract and Delivery Rules

Technical reference for Fax Direct's InterFAX boundary. It records provider
payloads, persisted fields, status mapping, and delivery invariants that are too
detailed for `README.md`. Product progress and future work belong in
`MILESTONES.md`.

Provider submission, chunked document upload, D1 persistence, polling, Durable
Object fax state, and Workflow orchestration are implemented. Sections marked
as planned describe the remaining browser UI and manual-recovery behavior.

## Sending

- Submit only after payment is confirmed.
- Use the session ID as the InterFAX `reference`.
- Store the returned InterFAX transaction ID as text.
- Submit PDFs up to 1 MiB directly. For larger PDFs, create an InterFAX
  document, upload sequential 1 MiB byte ranges through the Documents API,
  then submit the fax using that document's `Content-Location` reference.
- The provider client accepts a storage-agnostic ranged reader so the delivery
  Workflow can read each chunk directly from R2 without placing PDF bytes in
  Workflow parameters or step results.
- Submit `Fine` resolution in the first release. The provider boundary and D1
  schema also support the tested `Standard` value, so a customer choice can be
  added later without changing provider storage.
- Disable InterFAX automatic retries: each transaction gets one attempt.
- If submission throws before a transaction is persisted, mark the session fax
  as `failed` with `UNKNOWN_FAILURE`. Do not create a D1 row or start polling.
- The first release deliberately treats ambiguous submission failures the same
  way. Searching by the session reference before retrying is postponed.
- Planned manual retry behavior reads the retained PDF from R2 and submits a
  fresh InterFAX request, creating a new Workflow instance, InterFAX
  transaction, and D1 row. Do not use the InterFAX resend endpoint because the
  provider image is deleted after use.

## D1 transmission record

One row represents one InterFAX transaction:

```text
transaction_id   TEXT PRIMARY KEY
session_id       TEXT NOT NULL
provider_status  INTEGER NULL        -- null until the first provider poll
pages_submitted  INTEGER NOT NULL
pages_sent       INTEGER NOT NULL
attempts_made    INTEGER NOT NULL
attempts_total   INTEGER NOT NULL
resolution       TEXT NOT NULL         -- Fine | Standard
submitted_at     TEXT NOT NULL
updated_at       TEXT NOT NULL
completed_at     TEXT
```

Index `provider_status` for active-job polling and `session_id` for session
lookup. InterFAX submission returns only a transaction ID, so the initial value
is `NULL`. The polling coordinator selects active jobs with
`provider_status IS NULL OR provider_status < 0`; `0` is delivered and positive
values are final failures.

`provider_status` is the only failure code persisted in D1. It is the original
numeric InterFAX value and is the most useful value for diagnostics. Our
semantic error is derived while updating the matching session and is not
duplicated in D1.

## InterFAX polling response

`GET /outbound/faxes/{id}` and the batch search endpoint return this shape. The
types and values below come from our successful Standard-resolution test, not
only from the provider's example documentation:

```ts
type InterfaxFax = {
  id: number
  uri: string
  status: number
  userId: string
  submitTime: string
  completionTime: string
  destinationFax: string
  subject: string
  pagesSubmitted: number
  pagesSent: number
  attemptsToPerform: number
  attemptsMade: number
  pageSize: string
  pageResolution: string
  pageOrientation: string
  rendering: string
  pageHeader: string | null
  senderCSID: string
  remoteCSID: string
  duration: number
  priority: number
  units: number
  costPerUnit: number
  contact: string | null
  replyEmail: string
}
```

Observed processing response:

```json
{
  "id": 1727669354,
  "status": -3,
  "pagesSubmitted": 2,
  "pagesSent": 2,
  "attemptsToPerform": 1,
  "attemptsMade": 0,
  "completionTime": "0001-01-01T00:00:00",
  "duration": 103,
  "units": 0,
  "costPerUnit": 0.3
}
```

Ten seconds later, the final response had `status: 0`, `attemptsMade: 1`, a
real `completionTime`, `duration: 107`, and `units: 2`.

### Response mapping

| InterFAX field | Application use |
| --- | --- |
| `id` | Convert to text and store as D1 `transaction_id` |
| `status` | Store as `provider_status`; negative is temporary, `0` is delivered, and positive is a final failure reason |
| `pagesSubmitted` / `pagesSent` | Store in D1 and copy to the session fax projection |
| `attemptsToPerform` / `attemptsMade` | Store in D1 for provider diagnostics; do not expose them in the session fax projection |
| `pageResolution` | Store as `resolution` |
| `submitTime` / `completionTime` | Normalize into D1 timestamps; treat `0001-01-01T00:00:00` as no completion time |
| `subject` | InterFAX returns our submitted `reference` here; use only as a correlation check |
| `duration`, `units`, `costPerUnit`, `remoteCSID` | Useful operational diagnostics; log them at completion but do not put them in the browser session |
| Remaining fields | Provider metadata or duplicated application data; do not persist initially |

The provider response is validated at the InterFAX service boundary before it
is mapped into D1 and Durable Object models.

## Failure classification

InterFAX uses one numeric `status` field for lifecycle and failure reason:

- Any negative value is temporary and remains `processing`.
- `0` is a permanent successful delivery.
- Any positive value is a permanent failure.

Our application converts a final provider failure into a stable semantic code:

```ts
type FaxFailureSemanticCode =
  | "BUSY"
  | "CALL_REJECTED"
  | "CANCELED"
  | "CONNECTION_FAILED"
  | "DELIVERY_UNCONFIRMED"
  | "DESTINATION_UNAVAILABLE"
  | "DOCUMENT_PROCESSING_FAILED"
  | "FAX_INCOMPATIBLE"
  | "INVALID_NUMBER"
  | "NO_ANSWER"
  | "PARTIAL_TRANSMISSION"
  | "ROUTE_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "TRANSMISSION_INTERRUPTED"
  | "UNKNOWN_FAILURE"
  | "VOICE_ANSWERED"
```

Classification accepts only the provider facts it needs:

```ts
type InterfaxFailureFacts = Pick<
  InterfaxFax,
  "status" | "pagesSent" | "pagesSubmitted"
>
```

### Classification precedence

Apply these rules in order:

1. A negative `status` is processing and has no semantic error.
2. `status === 0` is delivered and has no semantic error.
3. A positive status with `pagesSubmitted > 0` and
   `pagesSent >= pagesSubmitted` maps to `DELIVERY_UNCONFIRMED`.
4. A positive status with `pagesSent > 0` maps to
   `PARTIAL_TRANSMISSION`.
5. Otherwise map the positive numeric status using the table below.
6. Any undocumented positive status maps to `UNKNOWN_FAILURE` and is logged.

Page-based composite rules take precedence because retrying a fax after some
or all pages were transmitted can duplicate pages at the recipient.

### Provider status to semantic code

This table covers every positive status currently listed by InterFAX. Ambiguous
provider descriptions are intentionally mapped to a general semantic code
rather than presenting an unsupported precise diagnosis.

| Semantic code | InterFAX positive statuses |
| --- | --- |
| `BUSY` | `263`, `3931`, `3937`, `6017`, `8025` |
| `NO_ANSWER` | `3935`, `6018`, `8021` |
| `VOICE_ANSWERED` | `3936` |
| `INVALID_NUMBER` | `6027` |
| `DESTINATION_UNAVAILABLE` | `3912`, `3932`, `3933`, `3938`, `6001`, `6022`, `6028` |
| `CALL_REJECTED` | `488`, `6021`, `6029` |
| `ROUTE_UNAVAILABLE` | `6002` |
| `FAX_INCOMPATIBLE` | `3211`, `3220`, `3225`, `3231`, `3233`, `3264`, `3267`, `3269`, `6088`, `6095`, `6097`, `6099`, `6100` |
| `TRANSMISSION_INTERRUPTED` | `3223`, `3224`, `3230`, `3268`, `8010` |
| `CONNECTION_FAILED` | `2`, `12`, `101`, `102`, `104`, `130`, `132`, `204`, `483`, `501`, `603`, `3072`, `3080`, `3300`, `3510`, `3830`, `6003`, `6004`, `6016`, `6019`, `6031`, `6034`, `6038`, `6041`, `6042`, `6043`, `6044`, `6047`, `6050`, `6054`, `6057`, `6058`, `6063`, `6065`, `6069`, `6079`, `6102`, `6111`, `6127`, `7004`, `7012`, `7013`, `9951`, `9952`, `9987`, `9994`, `9998`, `9999` |
| `DOCUMENT_PROCESSING_FAILED` | `204000`, `204001` |
| `CANCELED` | `403` |
| `SERVICE_UNAVAILABLE` | `1`, `256`, `205000`, `205001`, `206001` |
| `UNKNOWN_FAILURE` | `7200` and any undocumented positive status |

## Planned client-side fax messages and enforced locale

Use `intl-messageformat` in the interactive client for fax progress and failure
messages. It provides ICU message-template interpolation and plural selection
without introducing a full translation-management system. This package and
the delivery-status UI have not been added yet.

The client does not infer its locale from each WebSocket event. The page's
Server Component selects the enforced locale during the initial HTTP render and
passes it to the Client Component as a serialized prop. The first version is
fixed to Hebrew:

```tsx
<FaxSheet locale="he-IL" />
```

Later, the Server Component may derive this prop from the request hostname or
locale path. The same locale prop remains available after hydration and is used
to format every subsequent WebSocket update. The WebSocket therefore remains
language-neutral and carries neither a locale nor translated messages.

One client module owns a typed map of semantic codes to reusable message
formatters created for the enforced locale:

```ts
const locale = props.locale

const semanticCodeToMessageMap: Record<
  FaxFailureSemanticCode,
  IntlMessageFormat
> = {
  BUSY: new IntlMessageFormat(
    "מספר הפקס תפוס כרגע. אפשר לנסות שוב מאוחר יותר.",
    locale
  ),
  // ...one formatter for every semantic code
}
```

The same module owns a `progressStatusToMessageMap` for non-failure progress
messages. The client selects a formatter using either `fax.status` or
`fax.error`, then calls `.format()` with the structured facts received in the
session snapshot. Complete sentences remain inside the message templates;
application code does not assemble Hebrew grammatical fragments. Formatter
instances are created once for the locale prop and reused between WebSocket
updates.

Initial progress messages:

| Progress status | Hebrew message |
| --- | --- |
| `preparing` | מכינים את המסמך לשליחה. |
| `queued` | הפקס התקבל וממתין לשליחה. |
| `sending` with no sent pages | מתחברים למספר הפקס. |
| `sending` with sent pages | Parameterized message such as "נשלח עמוד אחד מתוך שניים." |
| `finalizing` | כל עמודי המסמך נשלחו. ממתינים לאישור המסירה. |
| `service_delayed` | השליחה מתעכבת עקב תקלה זמנית בשירות. |
| `delivered` | הפקס נשלח בהצלחה. |
| `failed` | Use the formatter selected by `fax.error`. |

Initial Hebrew messages and recommended controls:

| Semantic code | Hebrew message | Suggested controls |
| --- | --- | --- |
| `BUSY` | מספר הפקס תפוס כרגע. אפשר לנסות שוב מאוחר יותר. | Retry |
| `NO_ANSWER` | מספר הפקס לא ענה. בדקו את המספר או נסו שוב מאוחר יותר. | Edit number, retry |
| `VOICE_ANSWERED` | השיחה נענתה, אך לא זוהה מכשיר פקס. בדקו את המספר לפני ניסיון נוסף. | Edit number |
| `INVALID_NUMBER` | מספר הפקס אינו תקין. בדקו את המספר ונסו שוב. | Edit number |
| `DESTINATION_UNAVAILABLE` | לא ניתן לחייג למספר הפקס. בדקו שהמספר פעיל ותקין. | Edit number |
| `CALL_REJECTED` | היעד דחה את השיחה. בדקו את המספר או נסו שוב מאוחר יותר. | Edit number, retry |
| `ROUTE_UNAVAILABLE` | לא ניתן כרגע לנתב את השליחה למספר הזה. בדקו את המספר או נסו שוב מאוחר יותר. | Edit number, retry later |
| `FAX_INCOMPATIBLE` | נוצר קשר עם מכשיר הפקס, אך התקשורת איתו נכשלה. אפשר לנסות שוב. | Retry |
| `TRANSMISSION_INTERRUPTED` | החיבור נותק לפני שהשליחה הושלמה. אפשר לנסות שוב. | Retry |
| `CONNECTION_FAILED` | לא הצלחנו ליצור קשר עם מספר הפקס. בדקו את המספר או נסו שוב מאוחר יותר. | Edit number, retry |
| `DOCUMENT_PROCESSING_FAILED` | לא הצלחנו להכין את המסמך לשליחה. נסו להעלות קובץ PDF אחר. | Edit document |
| `CANCELED` | שליחת הפקס בוטלה. | Retry |
| `SERVICE_UNAVAILABLE` | לא הצלחנו לשלוח את הפקס עקב תקלה זמנית בשירות. נסו שוב מאוחר יותר. | Retry later |
| `UNKNOWN_FAILURE` | שליחת הפקס נכשלה מסיבה לא ידועה. בדקו את המספר או נסו שוב מאוחר יותר. | Edit number, retry later |
| `DELIVERY_UNCONFIRMED` | כל עמודי המסמך שודרו, אך לא התקבל אישור מסירה סופי. מומלץ לבדוק מול הנמען לפני ניסיון נוסף. | Check with recipient |
| `PARTIAL_TRANSMISSION` | Parameterized plural message shown below. | Check with recipient before retry |

The `PARTIAL_TRANSMISSION` formatter uses one ICU message with explicit Hebrew
singular, dual, and general variants:

```ts
new IntlMessageFormat(
  `{pagesSent, plural,
    =1 {השליחה נכשלה לאחר שנשלח עמוד אחד מתוך {pagesSubmitted}. ייתכן שחלק מהמסמך התקבל.}
    =2 {השליחה נכשלה לאחר שנשלחו שני עמודים מתוך {pagesSubmitted}. ייתכן שחלק מהמסמך התקבל.}
    other {השליחה נכשלה לאחר שנשלחו # מתוך {pagesSubmitted} עמודים. ייתכן שחלק מהמסמך התקבל.}
  }`,
  locale
)
```

Format it with `{pagesSent, pagesSubmitted}`. ICU selects the matching branch;
`#` inserts the locale-formatted `pagesSent` value. These ICU templates can be
moved into a broader localization system later without redesigning the
semantic-code boundary.

## Durable Object fax field

The session Durable Object persists only the browser-facing fax facts and our
semantic error:

```ts
type FaxProgressStatus =
  | "preparing"
  | "queued"
  | "sending"
  | "finalizing"
  | "service_delayed"
  | "delivered"
  | "failed"

fax: {
  status: FaxProgressStatus
  pagesSent: number
  pagesSubmitted: number
  error: FaxFailureSemanticCode | null
} | null
```

The InterFAX transaction ID and numeric `provider_status` remain in D1 and are
not exposed to the browser. HTTP and WebSocket session snapshots contain only
the structured fax facts and semantic error code shown above. Translated text
is neither persisted nor returned by the backend; the client formats the one
user-visible message with the locale prop supplied by the Server Component.
Existing hardcoded Hebrew interface copy is unchanged; migrating the complete
UI into locale catalogs is a separate, postponed refactor.

## Polling and live updates

- `FaxPollingCoordinator` is a separate Durable Object class in
  `src/server/fax/fax-polling-coordinator.durable-object.ts`.
- One globally named coordinator instance runs the poller. `FaxSession` remains
  one instance per browser session and does not poll InterFAX.
- `managePolling()` schedules an alarm only when D1 contains active jobs and no
  alarm exists. It stops scheduling when no active jobs remain.
- `alarm()` calls `poll()`; `poll()` performs the batch request and persists
  changed results.
- Polling runs every 10 seconds.
- Read active transaction IDs from D1 and query InterFAX in batches through
  `/outbound/search?ids=...`.
- On every poll, write the provider result to D1 and write the derived public
  state to the matching session Durable Object. The Durable Object broadcasts
  the refreshed authoritative snapshot even when its values are unchanged.
- Map application and provider state into `FaxProgressStatus`:
  - The delivery Workflow sets `preparing` before submission.
  - A successful InterFAX submission sets `queued` while `provider_status` is
    still `NULL`.
  - A negative provider status normally sets `sending`.
  - A negative provider status with all submitted pages sent sets `finalizing`.
  - A known temporary provider hold, such as `-22`, sets `service_delayed`.
  - Provider status `0` sets `delivered`.
  - A positive provider status sets `failed` and is classified into
    `fax.error`.
- Forward changes to the matching session Durable Object, which broadcasts its
  authoritative snapshot to the browser over WebSocket.
- InterFAX webhooks are not required initially.

## Planned user-visible state

Page progress and final delivery status are separate:

| Stored state | Display |
| --- | --- |
| `preparing` | Preparing the document |
| `queued` | Accepted and waiting to send |
| `sending`, `0 / N` pages | Connecting |
| `sending`, `X / N` pages | `X of N pages sent` |
| `finalizing`, `N / N` pages | Finalizing delivery confirmation |
| `service_delayed` | Temporary service delay |
| `delivered` | Delivered |
| `failed` | Display the message derived from `fax.error` and the appropriate manual controls |

`pages_sent === pages_submitted` never means delivered by itself. Only the
final InterFAX success status confirms delivery.
