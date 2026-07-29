import { parsePhoneNumberFromString } from "libphonenumber-js/max"

export type IsraeliFaxNumberValidationResult =
  | {
      ok: true
      normalized: string
    }
  | {
      ok: false
      code: "EMPTY" | "INVALID_NUMBER" | "UNSUPPORTED_COUNTRY"
    }

export function validateIsraeliFaxNumber(
  input: string
): IsraeliFaxNumberValidationResult {
  const value = input.trim()

  if (!value) {
    return { ok: false, code: "EMPTY" }
  }

  const internationalValue = value.startsWith("00")
    ? `+${value.slice(2)}`
    : value
  const phoneNumber = parsePhoneNumberFromString(internationalValue, {
    defaultCountry: "IL",
    extract: false,
  })

  if (!phoneNumber || !phoneNumber.isValid()) {
    return { ok: false, code: "INVALID_NUMBER" }
  }

  if (phoneNumber.country !== "IL") {
    return { ok: false, code: "UNSUPPORTED_COUNTRY" }
  }

  return {
    ok: true,
    normalized: phoneNumber.number,
  }
}
