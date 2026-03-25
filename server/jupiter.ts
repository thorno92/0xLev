/**
 * Jupiter Price API — server-side proxy
 *
 * Uses v2 (free, no key required) by default.
 * If JUPITER_API_KEY is set, uses v3 with authentication.
 */

import axios from "axios";
import { logger } from "./middleware/audit";

const JUPITER_API_KEY = process.env.JUPITER_API_KEY ?? "";
const JUPITER_PRICE_URL = JUPITER_API_KEY
  ? "https://api.jup.ag/price/v3"
  : "https://api.jup.ag/price/v2";
const MAX_IDS_PER_REQUEST = 50;

if (!JUPITER_API_KEY) {
  logger.info({
    event: "jupiter_using_free_tier",
    reason: "JUPITER_API_KEY not set — using v2 free endpoint",
  });
}

export interface JupiterPrice {
  mint: string;
  usdPrice: number;
  decimals?: number;
  change24h?: number;
}

/**
 * Fetch USD prices for a list of Solana token mint addresses.
 * Returns a map of mint → USD price. Tokens without a price are omitted.
 */
export async function fetchJupiterPrices(
  mints: string[],
): Promise<Map<string, JupiterPrice>> {
  const prices = new Map<string, JupiterPrice>();
  if (mints.length === 0) return prices;

  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += MAX_IDS_PER_REQUEST) {
    chunks.push(mints.slice(i, i + MAX_IDS_PER_REQUEST));
  }

  for (const chunk of chunks) {
    try {
      const headers: Record<string, string> = {};
      if (JUPITER_API_KEY) headers["x-api-key"] = JUPITER_API_KEY;

      const { data } = await axios.get(JUPITER_PRICE_URL, {
        params: { ids: chunk.join(",") },
        headers,
        timeout: 8_000,
      });

      // v2 nests prices under `data`, v3 returns flat
      const priceMap = (data?.data ?? data) as Record<string, unknown> | undefined;
      if (!priceMap || typeof priceMap !== "object") continue;

      for (const [mint, info] of Object.entries(priceMap)) {
        const entry = info as {
          price?: string | number;
          usdPrice?: number;
          decimals?: number;
          priceChange24h?: number;
        };
        const usdPrice = typeof entry?.usdPrice === 'number' ? entry.usdPrice
          : typeof entry?.price === 'string' ? Number(entry.price)
          : typeof entry?.price === 'number' ? entry.price
          : NaN;
        if (!isFinite(usdPrice) || usdPrice <= 0) continue;
        prices.set(mint, {
          mint,
          usdPrice,
          decimals: entry.decimals,
          change24h: entry.priceChange24h,
        });
      }
    } catch (err) {
      logger.error({
        event: "jupiter_price_fetch_failed",
        error: err instanceof Error ? err.message : "unknown",
        mintCount: chunk.length,
      });
    }
  }

  return prices;
}
