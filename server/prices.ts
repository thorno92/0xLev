/**
 * Live crypto price service — CoinGecko API
 *
 * Hardening applied:
 *   - Structured logging via logger (replaces console.error)
 *   - CoinGecko Pro API key support (add COINGECKO_API_KEY to env)
 *   - Response validated with Zod before returning to callers
 *   - Cache state clearly typed (no implicit `any`)
 *   - getLivePriceMap() is a stable API contract — don't change the signature
 */

import { z } from "zod";
import axios from "axios";
import { logger } from "./middleware/audit";

/* ------------------------------------------------------------------ */
/*  Token map — symbol → CoinGecko ID                                */
/* ------------------------------------------------------------------ */

const SYMBOL_TO_COINGECKO_ID: Readonly<Record<string, string>> = {
  // Bitcoin
  BTC: "bitcoin",
  WBTC: "wrapped-bitcoin",
  // Solana ecosystem
  SOL: "solana",
  BONK: "bonk",
  WIF: "dogwifcoin",
  JUP: "jupiter-exchange-solana",
  RAY: "raydium",
  ORCA: "orca",
  PYTH: "pyth-network",
  RENDER: "render-token",
  POPCAT: "popcat",
  MEW: "cat-in-a-dogs-world",
  JITO: "jito-governance-token",
  MSOL: "msol",
  MNDE: "marinade",
  TENSOR: "tensor",
  W: "wormhole",
  KMNO: "kamino",
  BOME: "book-of-meme",
  SLERF: "slerf",
  SAMO: "samoyedcoin",
  STEP: "step-finance",
  FIDA: "bonfida",
  // Ethereum ecosystem
  PEPE: "pepe",
  SHIB: "shiba-inu",
  UNI: "uniswap",
  AAVE: "aave",
  LDO: "lido-dao",
  ARB: "arbitrum",
  OP: "optimism",
  LINK: "chainlink",
  MKR: "maker",
  CRV: "curve-dao-token",
  ENS: "ethereum-name-service",
  BLUR: "blur",
  PENDLE: "pendle",
  // BNB ecosystem
  DOGE: "dogecoin",
  FLOKI: "floki",
  CAKE: "pancakeswap-token",
  XVS: "venus",
  TWT: "trust-wallet-token",
  // Base ecosystem
  BRETT: "brett",
  TOSHI: "toshi",
  DEGEN: "degen-base",
  AERO: "aerodrome-finance",
  VIRTUAL: "virtual-protocol",
};

/* ------------------------------------------------------------------ */
/*  Response types                                                     */
/* ------------------------------------------------------------------ */

export interface LivePriceData {
  symbol: string;
  coingeckoId: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

/* ------------------------------------------------------------------ */
/*  Response schema                                                    */
/* ------------------------------------------------------------------ */

const coinGeckoTokenSchema = z.object({
  usd: z.number().optional(),
  usd_24h_change: z.number().optional(),
  usd_24h_vol: z.number().optional(),
  usd_market_cap: z.number().optional(),
});

const coinGeckoResponseSchema = z.record(z.string(), coinGeckoTokenSchema);

/* ------------------------------------------------------------------ */
/*  In-memory cache                                                    */
/* ------------------------------------------------------------------ */

let priceCache: LivePriceData[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 20_000;  // 20s — still respects CoinGecko free tier

if (!process.env.COINGECKO_API_KEY) {
  logger.warn({ event: "coingecko_free_tier", reason: "COINGECKO_API_KEY not set — using free tier (rate-limited under load)" });
}

/* ------------------------------------------------------------------ */
/*  API URL builder                                                    */
/* ------------------------------------------------------------------ */

function buildCoinGeckoUrl(ids: string): string {
  const apiKey = process.env.COINGECKO_API_KEY;
  const base = apiKey
    ? "https://pro-api.coingecko.com/api/v3"
    : "https://api.coingecko.com/api/v3";

  return `${base}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true`;
}

function buildCoinGeckoHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) {
    headers["x-cg-pro-api-key"] = apiKey;
  }
  return headers;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Fetch live prices. Returns cached data if still fresh (< 20s). */
export async function fetchLivePrices(): Promise<LivePriceData[]> {
  const now = Date.now();

  if (priceCache.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return priceCache;
  }

  const ids = Object.values(SYMBOL_TO_COINGECKO_ID).join(",");
  const url = buildCoinGeckoUrl(ids);

  try {
    const response = await axios.get(url, {
      headers: buildCoinGeckoHeaders(),
      timeout: 10_000,
    });

    const rawData = response.data;
    const parseResult = coinGeckoResponseSchema.safeParse(rawData);

    if (!parseResult.success) {
      logger.error({
        event: "coingecko_response_invalid",
        issues: parseResult.error.issues,
      });
      if (priceCache.length > 0) return priceCache;
      throw new Error("CoinGecko response failed validation");
    }

    const data = parseResult.data;
    const results: LivePriceData[] = [];

    for (const [symbol, geckoId] of Object.entries(SYMBOL_TO_COINGECKO_ID)) {
      const tokenData = data[geckoId];
      if (tokenData) {
        results.push({
          symbol,
          coingeckoId: geckoId,
          price: tokenData.usd ?? 0,
          change24h: tokenData.usd_24h_change ?? 0,
          volume24h: tokenData.usd_24h_vol ?? 0,
          marketCap: tokenData.usd_market_cap ?? 0,
        });
      }
    }

    priceCache = results;
    lastFetchTime = now;

    return results;
  } catch (error) {
    logger.error({
      event: "fetch_live_prices_failed",
      error: error instanceof Error ? error.message : "unknown",
      usingCache: priceCache.length > 0,
    });
    if (priceCache.length > 0) return priceCache;
    logger.warn({ event: "coingecko_unavailable_no_cache" });
    return [];
  }
}

/** Returns a symbol → price data Map for O(1) lookups. */
export async function getLivePriceMap(): Promise<Map<string, LivePriceData>> {
  const prices = await fetchLivePrices();
  const map = new Map<string, LivePriceData>();
  for (const p of prices) {
    map.set(p.symbol, p);
  }
  return map;
}

/** Quick SOL/USD lookup from the CoinGecko cache — never throws. */
export async function getSolUsdPrice(): Promise<number> {
  try {
    const prices = await fetchLivePrices();
    const sol = prices.find((p) => p.symbol === "SOL");
    return sol?.price ?? 0;
  } catch {
    return 0;
  }
}
