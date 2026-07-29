import { getCloudflareContext } from "@opennextjs/cloudflare"

import {
  marketConfigSchema,
  type MarketConfig,
} from "@/config/market-config-schema"

export type MarketCode = "IL"

export class MarketConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "MarketConfigError"
  }
}

export async function getMarketConfig(
  market: MarketCode = "IL"
): Promise<MarketConfig> {
  let value: unknown

  try {
    value = await getCloudflareContext().env.MARKET_CONFIG.get(
      `market:${market}`,
      "json"
    )
  } catch (error) {
    throw new MarketConfigError(
      `Could not read configuration for market ${market}.`,
      { cause: error }
    )
  }

  const result = marketConfigSchema.safeParse(value)

  if (!result.success) {
    console.error(
      `Invalid configuration for market ${market}:`,
      result.error.issues
    )
    throw new MarketConfigError(
      `Configuration for market ${market} is missing or invalid.`
    )
  }

  return result.data
}
