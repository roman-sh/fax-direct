# Fax Direct Milestones

This file is the implementation roadmap. Architecture and operating
instructions belong in `README.md`; detailed InterFAX contracts and mappings
belong in `API.md`.

## Current position

Milestone 1 is complete. Milestone 2 is implemented on the server and needs an
end-to-end deployed verification. The next user-visible work is delivery status
and manual retry behavior.

## Milestone 1: Persistent fax order — complete

- [x] Build the Hebrew RTL stacked-card interface.
- [x] Add preliminary browser PDF inspection.
- [x] Repeat PDF validation and page counting on the backend.
- [x] Store configurable Israel limits and pricing in Workers KV.
- [x] Validate Israeli recipient numbers in browser and backend.
- [x] Create signed Crockford Base32 browser session identities.
- [x] Store accepted PDFs temporarily in private R2.
- [x] Persist nested session state in a SQLite-backed Durable Object.
- [x] Manage Durable Object and D1 schemas with Drizzle migrations.
- [x] Calculate and persist the server-owned ₪9.90 quote.
- [x] Restore the most advanced valid card after refresh.
- [x] Synchronize authoritative session updates over PartySocket/WebSocket.

## Milestone 2: Provider delivery — in progress

Implemented:

- [x] Evaluate InterFAX with successful real two-page Fine and Standard faxes.
- [x] Submit small PDFs directly and larger PDFs through sequential 1 MiB
      InterFAX document chunks.
- [x] Read document ranges directly from private R2.
- [x] Persist one D1 row per InterFAX transaction.
- [x] Poll active transactions in batches every 10 seconds.
- [x] Map provider status and page counts into browser-facing fax state.
- [x] Broadcast changed fax state through the existing session Durable Object.
- [x] Add one durable Cloudflare Workflow per paid fax.
- [x] Disable automatic InterFAX submission retries.
- [x] Mark a submission error as a final generic failure.

Remaining:

- [ ] Deploy the Workflow binding and verify the complete paid-to-delivered
      path against the evaluation account.
- [ ] Verify one real provider failure through D1, polling, Durable Object, and
      WebSocket state.
- [ ] Confirm production InterFAX retention settings with the provider.

## Milestone 3: Delivery status and recovery

- [ ] Turn the payment card into a live preparing, queued, sending, finalizing,
      delivered, or failed status card.
- [ ] Format Hebrew progress and semantic failure messages on the client.
- [ ] Show page progress separately from final delivery confirmation.
- [ ] Offer controls appropriate to the failure: edit number, edit document,
      or manually retry.
- [ ] Start every manual retry as a new Workflow and InterFAX transaction while
      retaining the same paid session.
- [ ] Add a “send another fax” action that creates a fresh browser session.
- [ ] Later, reconcile ambiguous submission failures through InterFAX reference
      search before allowing another real submission.

## Milestone 4: Real payments

- [ ] Register the business and select the Israeli payment gateway.
- [ ] Replace Posthook simulation with hosted payment creation.
- [ ] Verify signed payment webhooks and handle duplicates idempotently.
- [ ] Pass the server-owned amount and session reference to the gateway.
- [ ] Define refund behavior for final fax failures.
- [ ] Verify Bit, card, Apple Pay, and Google Pay availability and required
      customer fields.

## Milestone 5: Launch readiness

- [ ] Add abuse protection and upload rate controls.
- [ ] Add production monitoring and operational alerts.
- [ ] Connect `fax.direct` to the Worker.
- [ ] Complete privacy, terms, receipts, and support procedures.
- [ ] Test the full flow on desktop and mobile.
- [ ] Validate search indexing for the Hebrew landing page.
- [ ] Decide whether demand justifies another localized market.

## Decision log

| Date | Decision |
| --- | --- |
| 2026-07-29 | Launch first in Israel with a Hebrew RTL interface, a 10-page limit, and flat ₪9.90 pricing. |
| 2026-07-29 | Keep operational market limits and pricing in the `market:IL` Workers KV entry. |
| 2026-07-29 | Use Workers Paid after representative PDF inspection exceeded the Free CPU allowance. |
| 2026-07-29 | Use `unpdf` so permission-restricted PDFs work while opening-password PDFs are rejected. |
| 2026-08-03 | Use a signed Crockford Base32 code as cookie identity, Durable Object name, R2 key, and recovery code. |
| 2026-08-03 | Keep PDFs private in R2 and expire all objects after 24 hours. |
| 2026-08-03 | Use Drizzle for per-session Durable Object SQLite and global D1 schemas. |
| 2026-08-05 | Use InterFAX for the provider integration and delete provider fax images after completion. |
| 2026-08-05 | Poll InterFAX in D1-backed batches every 10 seconds instead of depending on provider webhooks. |
| 2026-08-05 | Give each InterFAX transaction one attempt; expose a manual retry instead of waiting through automatic retries. |
| 2026-08-07 | Run paid delivery in Cloudflare Workflows while keeping browser-facing state in the session Durable Object. |
| 2026-08-07 | Treat submission errors as failed initially; postpone reference-based reconciliation of ambiguous timeouts. |
