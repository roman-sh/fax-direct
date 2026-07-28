# Fax Direct

**A locally adapted, one-time fax service — no registration, no subscription, no
unrelated customer fields.**

Fax Direct is for people who occasionally need to send a fax but no longer own a fax machine.
Upload documents, arrange the pages, enter a fax number, pay once, and follow the
transmission without leaving the page. The first market is Israel.

## Contents

- [Product thesis](#product-thesis)
- [Customer experience](#customer-experience)
- [Business model](#business-model)
- [Architecture](#architecture)
- [Fax lifecycle](#fax-lifecycle)
- [Reliability and privacy](#reliability-and-privacy)
- [Current status](#current-status)
- [Development](#development)
- [Open decisions](#open-decisions)

## Product thesis

Many global online fax services already exist. The opportunity is not inventing another
fax network — it is making the service **locally discoverable and locally comfortable
to use**.

People search for practical services in their native language. Initial Google Ads
Keyword Planner research indicated approximately one thousand monthly searches across
relevant Hebrew fax-sending terms in Israel. A focused Hebrew product can compete for
that intent without depending on expensive global English-language advertising.

> One shared product, introduced one local market at a time.

If Israel validates the model, the same application can enter additional countries
with:

- Native-language pages
- Local currency and pricing
- Familiar payment methods
- Country-specific number validation
- Appropriate legal information

Each market gets stable, indexable routes. IP detection may suggest a market, but it
does not replace explicit URLs, language selection, canonical metadata, and `hreflang`.

## Customer experience

The product is both the landing page and the application:

1. Upload one or more documents.
2. Review, reorder, rotate, add, or remove pages.
3. Produce one final PDF and calculate its billable page count.
4. Enter the recipient fax number.
5. See the complete price.
6. Pay once.
7. Watch the fax status update on the same page.

Starting another fax begins a fresh attempt. There is no dashboard and no permanent
customer account.

### Frictionless and privacy-conscious

Fax Direct deliberately avoids registration and profile creation. The customer should not need
to provide a name, email address, phone number, Israeli ID, password, or other
unrelated information unless a payment method or legal requirement makes a field
unavoidable.

The intended Bit experience is direct:

1. Choose Bit.
2. Scan a QR code on desktop, or open the Bit app through a mobile deep link.
3. Approve the payment.
4. Return to the fax already being processed.

This minimizes the information collected by Fax Direct; it does not make the payment
anonymous. Bit, the gateway, and the acquiring institutions still process the payer's
account. Fax Direct retains only what is needed to confirm the purchase, support a refund, and
meet legal obligations.

## Business model

The customer pays once based on the finalized page count. The planned Israeli price for
a typical fax is approximately ₪10, so payment-provider economics must support
microtransactions.

For example, a fee of ₪1 plus 5% costs ₪1.50 on a ₪10 purchase — an effective rate of
**15%**. Provider comparisons must therefore use the real cost of a ₪10 transaction,
not only a headline percentage.

The payment-provider decision considers:

- Fixed and percentage fees for cards, Bit, and other wallets
- Minimum transaction, monthly terminal, and minimum-volume charges
- Refund, chargeback, settlement, and accounting-document costs
- Whether Bit works without unrelated customer fields
- API quality, webhook reliability, and refund support

CardCom and Tranzila are leading low-friction candidates. Grow remains commercially
interesting because its indicative pricing appears friendly to small transactions, but
that advantage must be weighed against any mandatory name or phone fields.

The selected provider must combine acceptable effective cost at approximately ₪10 with
a clean Bit or wallet experience. Payment integration remains behind an internal
adapter so it can change without redesigning the fax workflow.

## Architecture

### Frontend

The website is a focused utility rather than a conventional SaaS dashboard. Its landing
page and application are the same page: the customer can begin uploading immediately,
while concise pricing, privacy, instructions, and frequently asked questions appear
below the working interface.

| Technology     | Role                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------- |
| **Next.js**    | Application structure and rendering                                                       |
| **shadcn/ui**  | Visual foundation for ordinary elements: buttons, inputs, cards, dialogs, alerts, FAQ     |
| **Syncfusion** | Mature document viewer and page organizer: preview, import, reorder, rotate, remove pages |

The interface is composed from the individual shadcn/ui components the product needs,
not from a large landing-page or dashboard template. This keeps the code and visual
hierarchy small while retaining a consistent design language.

Hebrew and right-to-left layout come first for the Israeli launch. Components use
logical spacing and responsive behavior so the same interface can later support
left-to-right languages and work comfortably on mobile.

Document preparation, recipient entry, pricing, payment, transmission, success, and
failure all appear as states of the same page. There is no account dashboard and no
separate status page.

### Backend

| Component                         | Responsibility                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| **Next.js route handlers**        | Uploads, payment creation, and webhook routes                                         |
| **OpenNext + Cloudflare Workers** | Run the Next.js application on Cloudflare                                             |
| **Cloudflare Workflow** (per fax) | Owns the durable business sequence, waits for provider events, retries external calls |
| **Durable Object** (per fax)      | Stores the latest browser-facing state and maintains the WebSocket connection         |
| **R2**                            | Temporarily holds the finalized PDF                                                   |
| **Phaxio**                        | Sends the fax — its HTTP API is called directly, not through its obsolete Node.js SDK |
| **Ky**                            | Wraps Fetch with the shared Phaxio request and error policy                           |
| **Market configuration**          | Locale, writing direction, pricing, payment options, recipient rules, metadata, legal |

The Workflow and Durable Object have deliberately separate responsibilities: the
Workflow executes paid work reliably; the Durable Object keeps the browser informed.

The MVP does not require PostgreSQL, MongoDB, Redis, BullMQ, Supabase, NestJS, or a
separate always-running server.

### Cloudflare plan

Cloudflare Free is sufficient for development and low-volume testing, but Workers Free
limits each invocation to 10 ms of CPU and the compressed Worker bundle to 3 MB;
exceeding free limits can fail requests. The plan is to develop on Free and upgrade to
Workers Paid, starting around $5 per month, before accepting real payments. Workers
Paid is separate from the website's Cloudflare Pro plan.

## Fax lifecycle

1. **Create the attempt.** The application generates a cryptographically random
   fax-session identifier, selects its Durable Object, and places the identifier in an
   HTTP-only secure cookie.
2. **Prepare the document.** The browser organizes the pages and produces one PDF. The
   server validates it, counts its pages, and calculates the price.
3. **Store temporarily.** The PDF is placed in R2 at an unguessable path derived from
   the session identifier. Its exact URL is public so Phaxio can fetch it. A one-day
   lifecycle rule removes abandoned and completed uploads.
4. **Create payment.** The server associates the payment and a new Workflow instance
   with the fax-session identifier.
5. **Confirm payment.** The Workflow waits for a `payment-confirmed` event. The
   verified payment webhook sends that event to the instance; Workflows can buffer it
   if it arrives before the matching wait.
6. **Submit the fax.** A durable step sends Phaxio the R2 URL, recipient number, and a
   unique tag equal to the session identifier. It persists the returned Phaxio fax ID.
7. **Follow transmission.** Verified Phaxio webhooks send events to the Workflow. The
   Workflow updates the Durable Object, which broadcasts honest states such as
   _submitting_, _transmitting_, _delivered_, or _failed_.
8. **Delete the provider copy.** After a terminal result, a durable cleanup step calls
   Phaxio's fax-file deletion endpoint. Phaxio otherwise retains the document for
   approximately thirteen months. The fax record itself remains.
9. **Finish.** The Workflow completes after cleanup. The Durable Object retains the
   latest presentation state so a page reload can restore the result.

Starting a new fax replaces the cookie with a new session identifier. The previous
Workflow can still receive late callbacks and finish cleanup.

## Reliability and privacy

- A **single identifier** connects the cookie, Workflow, Durable Object, R2 path,
  payment metadata, and Phaxio tag.
- **Workflow steps persist their results**, so later failures do not restart every
  completed operation.
- **Webhooks are verified and handled idempotently** because providers may deliver
  duplicates.
- **Retryable failures use bounded step retries.** Permanent validation errors are
  recorded without pointless retries. A `429 Too Many Requests` response is retried
  after the appropriate delay.
- **Submission timeouts are treated as ambiguous.** Phaxio may have accepted the fax
  even if its response was lost, so the application searches by the unique tag before
  submitting again. The tag helps reconciliation; it is not an idempotency key.
- **WebSocket loss never interrupts paid work.** Reloading reconnects through the
  cookie and retrieves the Durable Object's latest state.
- **Documents are short-lived.** R2 expires its copy after one day, and the Workflow
  explicitly deletes Phaxio's copy after transmission.

## Current status

The repository contains the initial Next.js application configured for Cloudflare
Workers through OpenNext. The product workflow described above has **not yet been
implemented**.

Planned application directories:

| Directory             | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `src/app`             | Pages and route handlers                        |
| `src/components`      | Interface components                            |
| `src/durable-objects` | Session state and WebSocket handling            |
| `src/workflows`       | Durable fax orchestration                       |
| `src/phaxio`          | Phaxio client and error policy                  |
| `src/payments`        | Payment abstraction and provider implementation |
| `src/markets`         | Country-specific product and recipient rules    |
| `src/locales`         | Native-language interface and search content    |

## Development

| Command                | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `npm install`          | Install dependencies                                  |
| `npm run dev`          | Run the normal Next.js development server             |
| `npm run build`        | Create a regular Next.js production build             |
| `npm run preview`      | Build and run in the local Cloudflare Workers runtime |
| `npm run deploy`       | Build through OpenNext and deploy to Cloudflare       |

Workflows, Durable Objects, and R2 can be simulated locally through Wrangler.
Production provider webhooks can be represented by test routes or forwarded to the
local Worker.

Deployment has not yet been performed. Production resource bindings, secrets, callback
URLs, domain routing, security rules, and retention policies still require
configuration.

## Open decisions

- Product and domain name
- Initial Hebrew keyword set, landing-page copy, and measurement plan
- Payment provider and exact checkout configuration
- Customer price, minimum charge, and maximum acceptable payment cost
- Supported upload formats and conversion policy
- Document organizer integration and mobile behavior
- User-facing failure categories and retry messages
- Webhook verification details
- Exact timeout and retry policies
- Long-term localized route and `hreflang` convention
