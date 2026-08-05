# Fax API Design

Concise reference for the first InterFAX integration. This describes planned
behavior; the provider integration and D1 table are not implemented yet.

## Sending

- Submit only after payment is confirmed.
- Use the session ID as the InterFAX `reference`.
- Store the returned InterFAX transaction ID as text.
- Let the customer choose `Fine` or `Standard` resolution per fax.
- Default to `Fine`; explain that it is sharper but may take longer.
- Proposed retry policy: 3 total attempts, 3 minutes apart. Automatic attempts
  remain part of the same InterFAX transaction.
- Explicit resend behavior is unverified and postponed.

## D1 transmission record

One row represents one InterFAX transaction:

```text
transaction_id   TEXT PRIMARY KEY
session_id       TEXT NOT NULL
status           TEXT NOT NULL        -- processing | delivered | failed
provider_status  INTEGER NOT NULL
pages_submitted  INTEGER NOT NULL
pages_sent       INTEGER NOT NULL
attempts_made    INTEGER NOT NULL
attempts_total   INTEGER NOT NULL
resolution       TEXT NOT NULL         -- Fine | Standard
submitted_at     TEXT NOT NULL
updated_at       TEXT NOT NULL
completed_at     TEXT
```

Index `status` for active-job polling and `session_id` for session lookup.

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
| `status` | Store as `provider_status`; map negative to processing, `0` to delivered, and positive to failed |
| `pagesSubmitted` / `pagesSent` | Store in D1 and copy to the session fax projection |
| `attemptsToPerform` / `attemptsMade` | Store in D1 and copy to the session fax projection |
| `pageResolution` | Store as `resolution` |
| `submitTime` / `completionTime` | Normalize into D1 timestamps; treat `0001-01-01T00:00:00` as no completion time |
| `subject` | InterFAX returns our submitted `reference` here; use only as a correlation check |
| `duration`, `units`, `costPerUnit`, `remoteCSID` | Useful operational diagnostics; log them at completion but do not put them in the browser session |
| Remaining fields | Provider metadata or duplicated application data; do not persist initially |

The provider response is validated at the InterFAX service boundary before it
is mapped into our D1 and Durable Object models.

## Durable Object fax field

The session Durable Object stores only the browser-facing fax state:

```ts
fax: {
  status: "processing" | "delivered" | "failed"
  pagesSent: number
  pagesSubmitted: number
  attemptsMade: number
  attemptsTotal: number
} | null
```

The InterFAX transaction ID remains in D1 and is not exposed to the browser.

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
- Update D1 only when provider data changes.
- Forward changes to the matching session Durable Object, which broadcasts its
  authoritative snapshot to the browser over WebSocket.
- InterFAX webhooks are not required initially.

## User-visible state

Page progress and final delivery status are separate:

| Stored state | Display |
| --- | --- |
| Processing, `0 / N` pages | Connecting |
| Processing, `X / N` pages | `X of N pages sent` |
| Processing, `N / N` pages | Finalizing delivery confirmation |
| Delivered | Delivered |
| Failed | Delivery failed or could not be confirmed |

`pages_sent === pages_submitted` never means delivered by itself. Only the
final InterFAX success status confirms delivery.
