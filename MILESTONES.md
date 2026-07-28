# Fax Direct Milestones

This file tracks what is implemented, what is currently being built, and what comes next.

## Current state

Implemented:

- Next.js application scaffold
- OpenNext adapter for Cloudflare Workers
- Local Next.js development and Cloudflare preview commands
- Cloudflare Worker, assets, image, and self-reference bindings
- shadcn/ui foundation with RTL-compatible components
- Product architecture and lifecycle documented in `README.md`

Not yet implemented:

- Interactive fax flow
- PDF upload and page counting
- Recipient validation
- Pricing logic
- R2 document storage
- Payment integration
- Fax provider integration
- Workflow, Durable Object, and live status updates

## Milestone 1: Local fax flow

Status: **In progress**

### Product rules

- The initial market is Israel.
- The interface is Hebrew and right-to-left.
- Only PDF files are accepted.
- A fax can contain between 1 and 10 pages.
- PDF page counting is performed only on the backend.
- A PDF with more than 10 pages is rejected with a clear message.
- Every accepted fax costs a flat **₪9.90**.
- PDF editing, reordering, rotation, and page removal are postponed.

### Scope

- Replace the starter page with the Fax Direct interface.
- Allow the customer to select and upload one PDF.
- Add a backend route that parses the uploaded PDF.
- Count the PDF's pages on the backend and return the verified count.
- Reject corrupt, encrypted, empty, or over-10-page PDFs on the backend.
- Accept and validate an Israeli recipient fax number.
- Display the verified page count and fixed ₪9.90 price.
- Simulate payment and fax transmission locally.
- Display submitting, transmitting, delivered, and failed states.
- Allow the customer to start a new fax.
- Support mobile and desktop layouts.

### Acceptance criteria

- The complete simulated flow works on one page.
- The interface is Hebrew and uses RTL layout.
- A valid PDF containing 1–10 pages is accepted by the backend.
- The browser does not determine the authoritative page count.
- Corrupt, encrypted, empty, and over-10-page PDFs are rejected by the backend.
- The displayed price is always ₪9.90.
- Invalid recipient numbers produce a clear error.
- Refreshing or starting over returns to a safe initial state.
- `npm run build` succeeds.
- The OpenNext Cloudflare build succeeds.

### Checklist

- [x] Initialize shadcn/ui with RTL support.
- [x] Add Card, Field, Input, Button, Alert, Spinner, and Badge.
- [ ] Define fax-flow states and events.
- [ ] Add Israel market configuration.
- [x] Build the Hebrew RTL page shell.
- [ ] Add PDF selection and upload.
- [ ] Add the backend PDF inspection route.
- [ ] Add backend PDF parsing and validation.
- [ ] Add backend-only PDF page counting.
- [ ] Display the verified page count.
- [ ] Add Israeli recipient validation.
- [x] Add fixed-price display.
- [ ] Add simulated payment.
- [ ] Add simulated transmission states.
- [ ] Add restart behavior.
- [ ] Verify responsive layout.
- [ ] Verify Next.js and OpenNext builds.

## Later milestones

### Milestone 2: Cloudflare session and storage

- Create server-owned fax sessions.
- Store PDFs temporarily in R2.
- Associate stored PDFs with their verified page count and price.

### Milestone 3: Durable execution

- Add one Workflow per fax attempt.
- Add one Durable Object per fax attempt.
- Stream live status updates to the browser.
- Use fake payment and fax providers end to end.

### Milestone 4: Fax provider

- Integrate Phaxio.
- Verify webhooks and handle duplicate events.
- Reconcile ambiguous submissions.
- Delete provider document copies after completion.

### Milestone 5: Payments and launch readiness

- Integrate the selected payment provider.
- Verify payment webhooks and handle refunds.
- Add production secrets, resource bindings, retention rules, and monitoring.
- Complete legal, privacy, and operational launch checks.

## Decision log

| Date       | Decision                                                     |
| ---------- | ------------------------------------------------------------ |
| 2026-07-29 | Milestone 1 supports PDF page counting without PDF editing.  |
| 2026-07-29 | The initial price is a flat ₪9.90 for a fax of up to 10 pages. |
| 2026-07-29 | PDF validation and page counting run only on the backend.     |
| 2026-07-29 | Use shadcn/ui base-nova components with RTL generation.       |
