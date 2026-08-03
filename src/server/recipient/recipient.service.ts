import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import { getMarketConfig } from "@/server/config/market-config.service"
import { calculateFaxQuote } from "@/server/quote/quote.service"
import { validateIsraeliFaxNumber } from "@/shared/phone/validate-israeli-fax-number"
import type {
  FaxSessionData,
  FaxSessionRecipient,
} from "@/shared/session/fax-session.types"

export type RecipientServiceErrorCode =
  | "DOCUMENT_REQUIRED"
  | "EMPTY"
  | "INVALID_NUMBER"
  | "UNSUPPORTED_COUNTRY"

export class RecipientServiceError extends Error {
  constructor(readonly code: RecipientServiceErrorCode) {
    super(code)
    this.name = "RecipientServiceError"
  }
}

/** Validates the recipient, calculates the quote, and persists both together. */
export async function saveFaxRecipient({
  input,
  sessionCode,
}: {
  input: string
  sessionCode: string
}): Promise<FaxSessionData> {
  const validation = validateIsraeliFaxNumber(input)

  if (!validation.ok) {
    throw new RecipientServiceError(validation.code)
  }

  const config = await getMarketConfig("IL")
  const recipient: FaxSessionRecipient = {
    displayValue: input.trim(),
    e164: validation.normalized,
  }
  const quote = calculateFaxQuote(config)
  const saved = await getCloudflareContext()
    .env.FAX_SESSIONS.getByName(sessionCode)
    .setRecipientAndQuote(recipient, quote)

  if (!saved) {
    throw new RecipientServiceError("DOCUMENT_REQUIRED")
  }

  return saved
}
