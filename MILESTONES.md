# Fax Direct Milestones

This file tracks what is implemented, what is currently being built, and what
comes next.

## Current state

Implemented:

- Next.js application deployed to Cloudflare Workers through OpenNext
- shadcn/ui foundation and Hebrew RTL stacked-card fax flow
- Client-side PDF inspection for immediate feedback
- Authoritative backend PDF validation and page counting
- Israel market limits and pricing stored in Cloudflare Workers KV
- Client-side and backend Israeli recipient validation
- Signed HttpOnly browser identity with a human-readable recovery code
- Temporary PDF storage in a private R2 bucket with 24-hour expiration
- One SQLite-backed Durable Object per fax session
- Drizzle-owned SQL schema, typed queries, and embedded per-object migrations
- Server-owned ₪9.90 ILS quote after document and recipient validation
- Production verification of R2, Durable Object SQL, and session restoration API

Not yet implemented:

- Hydration of the browser interface from the restored backend session
- WebSocket session synchronization and live status updates
- Simulated payment and fax transmission
- Start-another-fax behavior
- Fax provider integration
- Payment provider integration

## Milestone 1: Prepare a persistent fax order

Status: **In progress**

### Product rules

- The initial market is Israel.
- The interface is Hebrew and right-to-left.
- Only PDF files are accepted.
- A fax can contain between 1 and 10 pages.
- The browser performs preliminary PDF inspection for responsive feedback.
- The backend always repeats PDF validation and page counting authoritatively.
- A PDF with more than 10 pages is rejected with a clear message.
- Every accepted Israeli fax currently costs a flat **₪9.90**.
- PDF editing, reordering, rotation, and page removal are postponed.

### Scope

- Allow the customer to select and inspect one PDF.
- Validate, count, and temporarily store the PDF on the backend.
- Accept and validate an Israeli recipient fax number.
- Calculate and persist the server-owned quote.
- Restore the most advanced valid step after a browser refresh.
- Keep the existing document in R2 without downloading it back into the browser.
- Allow a restored document or recipient to be replaced through the normal flow.

### Restoration rules

- Empty session: open the document card.
- Valid document only: open the recipient card.
- Valid document, recipient, and quote: open the payment card.
- The browser file input is never restored; stored document metadata represents
  the previously uploaded PDF.
- Inconsistent server state falls back to the earliest valid step.

### Acceptance criteria

- A valid PDF containing 1–10 pages is accepted by the backend and stored in R2.
- Corrupt, encrypted, empty, and over-10-page PDFs are rejected.
- Invalid or non-Israeli recipient numbers produce a clear error.
- The backend stores the display phone number and normalized E.164 value.
- The persisted quote is always ₪9.90 ILS for the current Israel market.
- Refreshing restores document, recipient, quote, and the most advanced valid card.
- The API continues to return nested session objects independent of SQL layout.
- `npm run build` and the OpenNext Cloudflare build succeed.

### Checklist

- [x] Initialize shadcn/ui with RTL support.
- [x] Build the stacked three-card Hebrew interface.
- [x] Add client-side PDF selection and preliminary inspection.
- [x] Add authoritative backend PDF parsing, validation, and page counting.
- [x] Add Israel market configuration in Workers KV.
- [x] Add client-side and backend Israeli recipient validation.
- [x] Create signed browser session identities.
- [x] Store accepted PDFs temporarily in R2.
- [x] Persist session state in a SQLite-backed Durable Object.
- [x] Manage the Durable Object schema and migrations with Drizzle.
- [x] Calculate and persist the server-owned quote.
- [x] Verify the backend flow in production and Data Studio.
- [ ] Hydrate the browser flow from `/api/session`.
- [ ] Restore the most advanced valid card after refresh.
- [ ] Verify restored and replaced values on desktop and mobile.

## Milestone 2: Live simulated fax lifecycle

- Connect the browser to its Durable Object over WebSocket.
- Send the current session snapshot when the socket connects.
- Broadcast authoritative session updates to the browser.
- Add awaiting-payment, paid, sending, delivered, and failed states.
- Simulate payment confirmation on the backend.
- Simulate fax transmission and delivery or failure.
- Turn the payment card into the live status card after payment.
- Allow the customer to start another fax with a fresh session.

## Milestone 3: Fax provider

- Integrate Phaxio.
- Submit the stored R2 document to the provider.
- Verify webhooks and handle duplicate events.
- Reconcile ambiguous submissions and allow safe retries.
- Remove provider document copies after completion.

## Milestone 4: Payments and launch readiness

- Select and integrate the payment provider.
- Present the final server-owned amount through the provider flow.
- Verify payment webhooks and handle duplicate events and refunds.
- Add abuse protection, monitoring, and operational alerts.
- Connect the production domain to the Worker.
- Complete legal, privacy, and operational launch checks.

## Decision log

| Date       | Decision |
| ---------- | -------- |
| 2026-07-29 | The initial market is Israel and the interface is Hebrew RTL. |
| 2026-07-29 | The initial price is a flat ₪9.90 for a fax of up to 10 pages. |
| 2026-07-29 | Use shadcn/ui base-nova components with RTL generation. |
| 2026-07-29 | Use Noto Sans Hebrew; Latin falls back to the system UI sans. |
| 2026-07-29 | The whole flow fits one screen; no dashboard or marketing page is required. |
| 2026-07-29 | Store Israel limits and pricing in the `market:IL` Workers KV entry. |
| 2026-07-29 | Use Workers Paid after representative PDF inspection exceeded the Free CPU limit. |
| 2026-07-29 | Use `unpdf` so permission-restricted PDFs work while opening-password PDFs are rejected. |
| 2026-08-03 | Perform preliminary PDF inspection in the browser and repeat it authoritatively on the backend. |
| 2026-08-03 | Use a signed Crockford Base32 code as the browser identity, Durable Object name, R2 key, and future recovery code. |
| 2026-08-03 | Keep accepted PDFs in private R2 storage and expire all objects after 24 hours. |
| 2026-08-03 | Store one flattened `fax_session` SQL row inside each session Durable Object. |
| 2026-08-03 | Use Drizzle as the single TypeScript source for the SQL schema, typed queries, and per-object migrations. |
| 2026-08-03 | Calculate the quote after both document and recipient are validated so future destination-based pricing remains possible. |
