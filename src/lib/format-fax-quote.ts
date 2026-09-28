import type { FaxSessionQuote } from "@/shared/session/fax-session.types"

/** Whole-shekel prices omit decimals; fractional prices retain both digits. */
const ILS_AMOUNT_FORMAT = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  trailingZeroDisplay: "stripIfInteger",
})

export function formatFaxQuote(quote: FaxSessionQuote | null): string {
  if (!quote) {
    return "—"
  }

  // The Academy of the Hebrew Language places ₪ to the left of the number and
  // without a space, exactly as $ is placed, even though right-to-left text
  // then shows it after the digits.
  return quote.currency === "ILS"
    ? `₪${ILS_AMOUNT_FORMAT.format(Number(quote.amount))}`
    : quote.amount
}
