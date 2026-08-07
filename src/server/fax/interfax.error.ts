/**
 * Defines the errors shared by InterFAX service modules and converts rejected
 * provider responses into stable application errors with provider details.
 */
import "server-only"

import {
  interfaxErrorSchema,
  type InterfaxError,
} from "@/server/fax/interfax.schema"

export type InterfaxServiceErrorCode =
  | "INVALID_CONFIGURATION"
  | "INVALID_DOCUMENT_SOURCE"
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

/** Converts a rejected provider response into our stable service error. */
export async function createRejectedRequestError(
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
export async function readJson(response: Response): Promise<unknown> {
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
