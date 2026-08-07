/**
 * Implements Fax Direct's small InterFAX REST boundary. The service submits
 * one PDF, using InterFAX's chunked Documents API when needed, or reads many
 * provider statuses. Orchestration and persistence remain elsewhere.
 */
import "server-only"

import {
  interfaxFaxBatchSchema,
  type InterfaxFax,
} from "@/server/fax/interfax.schema"
import {
  InterfaxDocumentService,
  type InterfaxDocumentSource,
  type PreparedInterfaxDocument,
} from "@/server/fax/interfax-document.service"
import {
  createRejectedRequestError,
  InterfaxServiceError,
  readJson,
} from "@/server/fax/interfax.error"
import type { FaxResolution } from "@/server/fax/fax-transmission.schema"

const INTERFAX_BASE_URL = "https://rest.interfax.net"
const INTERFAX_SINGLE_ATTEMPT = "1"

type InterfaxEnvironment = Pick<
  CloudflareEnv,
  "INTERFAX_USERNAME" | "INTERFAX_PASSWORD"
>

export type SendFaxInput = {
  document: InterfaxDocumentSource
  faxNumber: string
  reference: string
  resolution: FaxResolution
}

export type SendFaxResult = {
  transactionId: string
}

export type { InterfaxDocumentSource } from "@/server/fax/interfax-document.service"
export {
  InterfaxServiceError,
  type InterfaxServiceErrorCode,
} from "@/server/fax/interfax.error"

/**
 * Creates a provider client from Cloudflare bindings. Supplying the bindings
 * explicitly keeps the service usable from both Next handlers and Workflows.
 */
export function createInterfaxService(
  env: InterfaxEnvironment
): InterfaxService {
  return new InterfaxService(env.INTERFAX_USERNAME, env.INTERFAX_PASSWORD)
}

/** Groups the two InterFAX operations required by the first delivery flow. */
export class InterfaxService {
  private readonly authorization: string
  private readonly documents: InterfaxDocumentService

  constructor(username: string, password: string) {
    if (!username || !password) {
      throw new InterfaxServiceError(
        "INVALID_CONFIGURATION",
        "InterFAX credentials are not configured."
      )
    }

    this.authorization = createBasicAuthorization(username, password)
    this.documents = new InterfaxDocumentService(this.authorization)
  }

  /**
   * Submits one PDF and returns the provider transaction ID from the Location
   * header. This POST is deliberately attempted once: retrying an ambiguous
   * network failure could submit the same paid fax twice.
   */
  async sendFax({
    document,
    faxNumber,
    reference,
    resolution,
  }: SendFaxInput): Promise<SendFaxResult> {
    const faxContent = createFaxContent(await this.documents.prepare(document))
    const url = new URL("/outbound/faxes", INTERFAX_BASE_URL)
    url.searchParams.set("faxNumber", faxNumber)
    url.searchParams.set("reference", reference)
    url.searchParams.set("resolution", resolution)
    url.searchParams.set("retriesToPerform", INTERFAX_SINGLE_ATTEMPT)
    url.searchParams.set("pageHeader", "N")

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: this.authorization,
        "Content-Type": faxContent.contentType,
      },
      body: faxContent.body,
    })

    if (response.status !== 201) {
      throw await createRejectedRequestError("Fax submission failed", response)
    }

    // InterFAX returns the created fax URL in Location, for example
    // `/outbound/faxes/1727669354`; its last segment is the transaction ID.
    const location = response.headers.get("Location")

    if (!location) {
      throw new InterfaxServiceError(
        "INVALID_PROVIDER_RESPONSE",
        "InterFAX accepted the fax without returning its Location header.",
        response.status
      )
    }

    return {
      transactionId: readTransactionId(location),
    }
  }

  /**
   * Retrieves many fax records in one provider request. InterFAX may return
   * them in a different order than requested, so callers must match by `id`.
   */
  async getFaxes(transactionIds: readonly string[]): Promise<InterfaxFax[]> {
    if (transactionIds.length === 0) {
      return []
    }

    const url = new URL("/outbound/search", INTERFAX_BASE_URL)
    url.searchParams.set("ids", transactionIds.join(","))

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: this.authorization,
      },
    })

    if (!response.ok) {
      throw await createRejectedRequestError(
        "Fax status lookup failed",
        response
      )
    }

    const body = await readJson(response)
    const result = interfaxFaxBatchSchema.safeParse(body)

    if (!result.success) {
      throw new InterfaxServiceError(
        "INVALID_PROVIDER_RESPONSE",
        "InterFAX returned an invalid fax status response.",
        response.status,
        null,
        { cause: result.error }
      )
    }

    return result.data
  }
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

type FaxContent = {
  body: BodyInit
  contentType: string
}

/** Converts a prepared document into the body expected by fax submission. */
function createFaxContent(document: PreparedInterfaxDocument): FaxContent {
  if (document.kind === "inline") {
    return {
      body: document.body,
      contentType: "application/pdf",
    }
  }

  const boundary = `fax-direct-${crypto.randomUUID()}`

  return {
    body: [
      `--${boundary}`,
      `Content-Location: ${document.url}`,
      "",
      `--${boundary}--`,
    ].join("\r\n"),
    contentType: `multipart/mixed; boundary=${boundary}`,
  }
}

/** Creates an RFC 7617 Basic authorization value using UTF-8 credentials. */
function createBasicAuthorization(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return `Basic ${btoa(binary)}`
}

/** Extracts and validates the numeric transaction ID from Location. */
function readTransactionId(location: string): string {
  let transactionId: string | undefined

  try {
    transactionId = new URL(location, INTERFAX_BASE_URL).pathname
      .split("/")
      .filter(Boolean)
      .at(-1)
  } catch (error) {
    throw new InterfaxServiceError(
      "INVALID_PROVIDER_RESPONSE",
      "InterFAX returned an invalid Location header.",
      null,
      null,
      { cause: error }
    )
  }

  if (!transactionId || !/^\d+$/.test(transactionId)) {
    throw new InterfaxServiceError(
      "INVALID_PROVIDER_RESPONSE",
      "InterFAX returned a Location without a transaction ID."
    )
  }

  return transactionId
}
