# Fax Direct

Fax Direct is a focused Hebrew service for sending a one-time fax without
creating an account or buying a subscription. The first market is Israel: one
PDF, one Israeli recipient, up to 10 pages, for a flat **₪10**.

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
5. The payment endpoint starts one PayMe creation Workflow identified by the
   session ID.
6. The Workflow loads the server-owned quote and market settings, creates the
   PayMe sale, validates its response, and persists the hosted checkout in D1.
7. Publishing the checkout to the browser and replacing the legacy callback
   handler with signed PayMe confirmation are being implemented next.
8. A confirmed payment starts one Cloudflare Workflow identified by the
   session ID.
9. The Workflow loads the PDF from R2, submits it to InterFAX, records the
   transaction in D1, and starts the global polling loop.
10. Every 10 seconds, the polling coordinator batches active InterFAX
   transactions, updates D1, and projects user-facing progress into the
   matching session Durable Object.
11. The Durable Object broadcasts its authoritative session snapshot over the
   browser's PartySocket connection.

InterFAX submission itself is attempted once. If it fails, the Workflow marks
the session fax as failed and stops; it does not automatically risk sending a
second real fax. Manual retry UX is the next product layer.

### PayMe payment flow

The PayMe integration is being implemented sequentially with this final flow:

1. The customer presses Pay, and the browser sends `POST /api/session/payment`.
2. The endpoint restores the signed browser session and calls
   `startFaxPayment()` with its session ID.
3. `startFaxPayment()` reads the session's D1 payment state. No row creates the
   deterministic Payment Workflow, `failed` restarts it, and `pending` or
   `paid` makes the request a safe no-op.
4. The Workflow loads the session's server-owned quote and localized market
   configuration.
5. A durable step calls `PayMeService.generateSale()`. A retry may leave an
   unused provider sale when a response is lost, but no checkout is exposed
   until one sale has been adopted in D1.
6. D1 inserts the sale when no payment exists, replaces a `failed` payment, or
   retains the existing row when it is already `pending` or `paid`. The
   retained row is the application's authoritative payment.
7. The Workflow publishes that row's checkout URL and `pending` state to the
   session Durable Object, which broadcasts it over the existing WebSocket.
8. The browser displays the Bit checkout. Refreshing restores the same URL from
   the Durable Object's session state.
9. PayMe's signed webhook is validated, changes D1 and the session to `paid`,
   and starts the fax-delivery Workflow. Signature verification remains blocked
   on PayMe's canonical signing instructions.

## Architecture

| Component | Responsibility |
| --- | --- |
| Next.js | Server-rendered page, interactive React client, and HTTP route handlers |
| OpenNext for Cloudflare | Packages Next.js as the deployed Worker |
| Custom Worker entry point | Routes WebSocket upgrades and exports Durable Objects and Workflows |
| Workers KV | Editable Israel market limits and pricing without redeployment |
| R2 | Private, temporary PDF storage with a 24-hour lifecycle rule |
| `FaxSession` Durable Object | Per-session SQLite state and live WebSocket snapshots |
| `PaymentWorkflow` | Durable PayMe sale creation, persistence, and browser-state publication |
| `FaxDeliveryWorkflow` | Durable paid-fax orchestration through InterFAX submission |
| D1 | Authoritative PayMe sale records and globally queryable InterFAX transactions |
| `FaxPollingCoordinator` Durable Object | Owns the single ten-second polling alarm |
| PayMe | Hosted payment checkout and asynchronous payment confirmation |
| InterFAX | Fax submission and delivery status provider |

The storage responsibilities are deliberately separate:

- The session Durable Object contains only browser-facing facts.
- D1 contains payment-provider records plus InterFAX transaction IDs and
  numeric fax state so global workflows and coordinators can query them.
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
| `src/server/payment` | PayMe boundary, Payment Workflow, and D1 payment persistence |
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
| `npm run logs:workflow` | Describe the latest delivery Workflow instance |
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

Interface states that normally require a paid and failed fax are reachable
without one. `/dev/cards` renders the three-card stack at each position and
`/dev/delivery` renders every delivery state, both from fabricated props
against the production components, so a correction made while looking at a
preview is a correction to the application itself.

Deploying does not run migrations. `npm run deploy` ships code and bindings
only, so a schema change needs `npm run db:d1:migrate:remote` as a separate
step; shipping code that writes a column the database lacks fails at the
Workflow step that stores the transmission.

### Reading production logs

`wrangler tail` streams what is happening now and keeps nothing, so it is only
useful when you can arrange to be watching before the thing you want to see.
Past requests come from the Workers Observability query API instead:

```
POST https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/observability/telemetry/query
{
  "queryId": "<any label>",
  "timeframe": { "from": <epoch ms>, "to": <epoch ms> },
  "parameters": { "datasets": ["cloudflare-workers"] },
  "view": "events",
  "limit": 1000
}
```

Two things make this fail silently rather than loudly. `view: "events"` is
required — without it the call still returns `success: true` and simply hands
back nothing, which reads exactly like a quiet period. And the token wrangler
holds will not work: its OAuth scopes cover `workers_tail (read)`, which is the
live stream only, so the query API answers `10000 Authentication error`.

The query therefore needs its own API token, created in the Cloudflare
dashboard with Workers Observability read. Keep it in `.cf-observability-token`
at the repository root, which `.gitignore` excludes:

```
TOKEN=$(tr -d '\n' < .cf-observability-token)
ACCOUNT_ID=094b9620db11564b5864c0afaebae778
```

The file is deliberately not committed, so a fresh clone has to be given one
before any of this works. If the token is missing or rejected, that is the
first thing to check rather than the query.

Each returned event carries `source.message` and `$workers`. Request lines
appear as `GET|POST <url>`; everything else is application logging, which is
why the structured log names are single searchable tokens (`beginDelivery`,
`fax_socket_closed`, `interfax_transaction_completed`) rather than sentences.
The HTTP status lives at `$workers.event.response.status`, and it is worth
looking at even for requests that report `outcome: "ok"` — a Worker that
returns 401 has run successfully from Cloudflare's point of view.

## Configuration

Operational market settings live in `config/market.il.json`. Publishing writes
the validated object to the `market:IL` KV key, allowing the page limit, upload
limit, and price to change without redeploying the application.

Local secrets are read from the ignored `.dev.vars` file. Production secrets
are stored through Wrangler. Current secret bindings include:

- `SESSION_COOKIE_PASSWORD`
- `INTERFAX_USERNAME`
- `INTERFAX_PASSWORD`
- `PAYME_SELLER_ID`

Cloudflare resource bindings are declared in `wrangler.jsonc`: KV, private R2,
D1, both Durable Object classes, the payment Workflow, and the delivery
Workflow. PayMe's base URL and callback URL are environment variables there.

### InterFAX transport

Production requests use `https://interfax.fax.direct`, which must remain routed
through the Cloudflare Tunnel to Caddy on `http://127.0.0.1:8080`. Caddy removes
`X-Forwarded-For` and proxies the request to `https://rest.interfax.net` with the
provider host and TLS SNI preserved. This proxy is required because InterFAX
returns 401 before evaluating Basic auth when `X-Forwarded-For` contains an IPv6
address, as it does for direct requests from Cloudflare Workers.

Caddy resolves the provider per request rather than at startup, so a momentary
DNS failure cannot leave the proxy down until someone restarts it. Its site
address matches any host, because cloudflared forwards the tunnel route's own
host header rather than the listener's address, and `default_bind` keeps the
socket on loopback so only the tunnel can reach it.

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
