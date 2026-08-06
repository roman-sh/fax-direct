/**
 * Implements Fax Direct's small InterFAX REST boundary. The service submits
 * one PDF or reads many provider statuses; orchestration, persistence, and
 * user-facing status mapping remain in their respective application layers.
 */
import "server-only"

import {
  interfaxErrorSchema,
  interfaxFaxBatchSchema,
  type InterfaxError,
  type InterfaxFax,
} from "@/server/fax/interfax.schema"
import type { FaxResolution } from "@/server/fax/fax-transmission.schema"

const INTERFAX_BASE_URL = "https://rest.interfax.net"
const INTERFAX_SINGLE_ATTEMPT = "1"

type InterfaxEnvironment = Pick<
  CloudflareEnv,
  "INTERFAX_USERNAME" | "INTERFAX_PASSWORD"
>

export type SendFaxInput = {
  document: BodyInit
  faxNumber: string
  reference: string
  resolution: FaxResolution
}

export type SendFaxResult = {
  transactionId: string
}

export type InterfaxServiceErrorCode =
  | "INVALID_CONFIGURATION"
  | "INVALID_PROVIDER_RESPONSE"
  | "PROVIDER_REJECTED_REQUEST"

/** Preserves a stable application code while retaining provider diagnostics. */
export class InterfaxServiceError extends Error {
  constructor(
    readonly code: InterfaxServiceErrorCode,
    message: string,
    readonly status: number | null = null,
    readonly providerError: InterfaxError | null = null,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = "InterfaxServiceError"
  }
}

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

  constructor(username: string, password: string) {
    if (!username || !password) {
      throw new InterfaxServiceError(
        "INVALID_CONFIGURATION",
        "InterFAX credentials are not configured."
      )
    }

    this.authorization = createBasicAuthorization(username, password)
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
        "Content-Type": "application/pdf",
      },
      body: document,
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

/** Converts a rejected provider response into our stable service error. */
async function createRejectedRequestError(
  operation: string,
  response: Response
): Promise<InterfaxServiceError> {
  const body = await readJson(response)
  const providerError = interfaxErrorSchema.safeParse(body)
  const detail = providerError.success
    ? providerError.data.message
    : typeof body === "string"
      ? body
      : response.statusText

  return new InterfaxServiceError(
    "PROVIDER_REJECTED_REQUEST",
    `${operation}: HTTP ${response.status}${detail ? ` ${detail}` : ""}`,
    response.status,
    providerError.success ? providerError.data : null
  )
}

/** Reads JSON without allowing an invalid response body to escape parsing. */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
