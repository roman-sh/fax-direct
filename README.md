# Fax Direct

Fax Direct is a focused Hebrew service for sending a one-time fax without
creating an account or buying a subscription. The first market is Israel: one
PDF, one Israeli recipient, up to 10 pages, for a flat **₪9.90**.

The landing page and application are the same page. The customer selects a
document, enters the fax number, pays once, and follows delivery through the
same three-card interface.

See [MILESTONES.md](./MILESTONES.md) for completed work and the remaining
product roadmap. See [API.md](./API.md) for the detailed InterFAX data contract
and status-mapping rules.

## Current flow

1. The browser creates or restores a signed, human-readable session cookie.
2. The browser inspects the PDF for immediate feedback.
3. The document endpoint repeats validation and page counting authoritatively,
   stores the PDF in private R2, and saves its metadata in the session.
4. The recipient endpoint validates and normalizes the Israeli fax number,
   then stores the server-owned quote.
5. Posthook currently simulates a payment provider callback.
6. A confirmed payment starts one Cloudflare Workflow identified by the
   session ID.
7. The Workflow loads the PDF from R2, submits it to InterFAX, records the
   transaction in D1, and starts the global polling loop.
8. Every 10 seconds, the polling coordinator batches active InterFAX
   transactions, updates D1, and projects user-facing progress into the
   matching session Durable Object.
9. The Durable Object broadcasts its authoritative session snapshot over the
   browser's PartySocket connection.

InterFAX submission itself is attempted once. If it fails, the Workflow marks
the session fax as failed and stops; it does not automatically risk sending a
second real fax. Manual retry UX is the next product layer.

## Architecture

| Component | Responsibility |
| --- | --- |
| Next.js | Server-rendered page, interactive React client, and HTTP route handlers |
| OpenNext for Cloudflare | Packages Next.js as the deployed Worker |
| Custom Worker entry point | Routes WebSocket upgrades and exports Durable Objects and Workflows |
| Workers KV | Editable Israel market limits and pricing without redeployment |
| R2 | Private, temporary PDF storage with a 24-hour lifecycle rule |
| `FaxSession` Durable Object | Per-session SQLite state and live WebSocket snapshots |
| `FaxDeliveryWorkflow` | Durable paid-fax orchestration through InterFAX submission |
| D1 | Globally queryable InterFAX transaction records |
| `FaxPollingCoordinator` Durable Object | Owns the single ten-second polling alarm |
| InterFAX | Fax submission and delivery status provider |
| Posthook | Temporary payment-callback simulator; not the production gateway |

The storage responsibilities are deliberately separate:

- The session Durable Object contains only browser-facing facts.
- D1 contains provider transaction IDs and numeric InterFAX state so one
  coordinator can find all active transmissions.
- R2 contains the PDF bytes; neither Workflow parameters nor Durable Object
  SQLite contain the document itself.
- The Workflow executes the durable sequence but does not become the browser's
  source of truth.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/app` | Next.js pages and API routes |
| `src/components/fax-flow` | Three-card browser flow and client hooks |
| `src/server/session` | Signed browser sessions and `FaxSession` Durable Object |
| `src/server/pdf` | Authoritative PDF inspection |
| `src/server/recipient` | Backend recipient validation |
| `src/server/quote` | Server-owned price calculation |
| `src/server/payment` | Current simulated payment orchestration |
| `src/server/fax` | InterFAX client, Workflow, D1 repository, polling, and mappings |
| `src/shared` | Types and validation shared safely with browser code |
| `config` | Validated market configuration source |
| `drizzle/d1` | Global D1 migrations |
| `scripts` | Market publishing and direct InterFAX diagnostic scripts |
| `worker.ts` | Public Cloudflare Worker entry point |

Server-only code lives under `src/server`. Code under `src/shared` must remain
safe to bundle into the browser.

## Development

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Run the normal Next.js development server |
| `npm run build` | Build the Next.js application |
| `npm run preview` | Build and preview through OpenNext/Cloudflare |
| `npm run deploy` | Build and deploy the Worker to Cloudflare |
| `npm run cf-typegen` | Regenerate TypeScript types for Cloudflare bindings |
| `npm run config:seed` | Validate and seed local `market:IL` KV data |
| `npm run config:publish` | Validate and publish remote `market:IL` KV data |
| `npm run db:d1:generate` | Generate a D1 migration from the Drizzle schema |
| `npm run db:d1:migrate:local` | Apply D1 migrations locally |
| `npm run db:d1:migrate:remote` | Apply D1 migrations in Cloudflare |
| `npm run interfax:test` | Send a diagnostic fax using `.dev.vars` credentials |

`npm run dev` is useful for interface work, but the current internal Durable
Object and Workflow bindings require a deployed Worker for a complete
end-to-end test. The OpenNext build still verifies that the Worker bundle can
be produced locally.

## Configuration

Operational market settings live in `config/market.il.json`. Publishing writes
the validated object to the `market:IL` KV key, allowing the page limit, upload
limit, and price to change without redeploying the application.

Local secrets are read from the ignored `.dev.vars` file. Production secrets
are stored through Wrangler. Current secret bindings include:

- `SESSION_COOKIE_PASSWORD`
- `POSTHOOK_API_KEY`
- `INTERFAX_USERNAME`
- `INTERFAX_PASSWORD`

Cloudflare resource bindings are declared in `wrangler.jsonc`: KV, private R2,
D1, both Durable Object classes, and the delivery Workflow.

### InterFAX transport

Production requests use `https://interfax.fax.direct`, which must remain routed
through the Cloudflare Tunnel to nginx on `http://localhost:8080`. nginx removes
`X-Forwarded-For` and proxies the request to `https://rest.interfax.net` with the
provider host and TLS SNI preserved. This proxy is required because InterFAX
returns 401 before evaluating Basic auth when `X-Forwarded-For` contains an IPv6
address, as it does for direct requests from Cloudflare Workers.

The `npm run interfax:test` diagnostic intentionally calls InterFAX directly
from the developer machine, so it can distinguish provider or authentication
problems from the Cloudflare transport path.

## Reliability and privacy

- Signed cookies prevent clients from inventing valid session identities.
- Backend validation is authoritative even when the browser already validated.
- PDFs stay private in R2 and expire after 24 hours.
- InterFAX is configured to delete its fax image after completion.
- Workflow steps checkpoint their results, so later failures resume after the
  last completed step.
- The external fax-submission step has automatic retries disabled because it is
  not idempotent.
- D1 insertion is replay-safe if Cloudflare repeats the persistence step.
- Payment callbacks use a deterministic Workflow instance ID, preventing a
  duplicate callback from starting a second initial delivery.
- WebSocket loss does not stop paid backend work; reconnecting restores the
  latest Durable Object snapshot.

The first release intentionally treats an InterFAX submission error as failed.
Searching InterFAX by the session reference to reconcile an ambiguous timeout
is a later reliability refinement.
