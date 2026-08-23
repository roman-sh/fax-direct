import { getCloudflareContext } from "@opennextjs/cloudflare"

import {
  legalConfigSchema,
  type LegalConfig,
} from "@/server/config/legal-config.schema"
import type { MarketCode } from "@/server/config/market-config.service"

/** Loads the public operator details kept outside the source repository. */
export async function getLegalConfig(
  market: MarketCode = "IL"
): Promise<LegalConfig> {
  const value = await getCloudflareContext().env.MARKET_CONFIG.get(
    `legal:${market}`,
    "json"
  )

  return legalConfigSchema.parse(value)
}
