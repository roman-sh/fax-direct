import "server-only"

import type { MarketConfig } from "@/server/config/market-config.schema"
import type { FaxSessionQuote } from "@/shared/session/fax-session.types"

/**
 * Calculates the server-owned fax price.
 *
 * Pricing is currently a fixed market-config value. Keeping this behind a
 * service gives later country, page, and payment rules one focused home.
 */
export function calculateFaxQuote(
  config: MarketConfig
): FaxSessionQuote {
  return {
    amount: config.price.amount,
    currency: config.price.currency,
  }
}
