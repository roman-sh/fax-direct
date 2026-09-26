/**
 * Implements Fax Direct's small InterFAX REST boundary. The service submits
 * one PDF directly or reads many provider statuses. Orchestration and
 * persistence remain elsewhere.
 */
import {
  interfaxFaxBatchSchema,
  type InterfaxFax,
} from "@/server/fax/interfax.schema"
import {
  createRejectedRequestError,
  InterfaxServiceError,
  readJson,
} from "@/server/fax/interfax.error"
import { INTERFAX_BASE_URL } from "@/config"

const INTERFAX_SINGLE_ATTEMPT = "1"
const INTERFAX_FINE_RESOLUTION = "Fine"

type InterfaxEnvironment = Pick<
  CloudflareEnv,
  "INTERFAX_USERNAME" | "INTERFAX_PASSWORD"
>

/** A PDF source whose bytes can be loaded immediately before submission. */
export type InterfaxDocumentSource = {
  sizeBytes: number
  read(): Promise<ArrayBuffer>
}

export type SendFaxInput = {
  document: InterfaxDocumentSource
  faxNumber: string
  reference: string
}

export type SendFaxResult = {
  transactionId: string
}

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
  }: SendFaxInput): Promise<SendFaxResult> {
    const pdf = await readDocument(document)
    const url = new URL("/outbound/faxes", INTERFAX_BASE_URL)
    url.searchParams.set("faxNumber", faxNumber)
    url.searchParams.set("reference", reference)
    url.searchParams.set("resolution", INTERFAX_FINE_RESOLUTION)
    url.searchParams.set("retriesToPerform", INTERFAX_SINGLE_ATTEMPT)
    url.searchParams.set("pageHeader", "N")

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: this.authorization,
        "Content-Type": "application/pdf",
      },
      body: pdf,
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

/** Loads the complete PDF and verifies the storage adapter's size contract. */
async function readDocument(
  document: InterfaxDocumentSource
): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(document.sizeBytes) || document.sizeBytes <= 0) {
    throw new InterfaxServiceError(
      "INVALID_DOCUMENT_SOURCE",
      "The PDF size is invalid."
    )
  }

  const bytes = await document.read()

  if (bytes.byteLength !== document.sizeBytes) {
    throw new InterfaxServiceError(
      "INVALID_DOCUMENT_SOURCE",
      `Expected ${document.sizeBytes} document bytes, received ${bytes.byteLength}.`
    )
  }

  return bytes
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

/** Extracts the provider transaction ID from the created fax's Location. */
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

  if (!transactionId) {
    throw new InterfaxServiceError(
      "INVALID_PROVIDER_RESPONSE",
      "InterFAX returned a Location without a transaction ID."
    )
  }

  return transactionId
}
