/**
 * 0xLeverage API Proxy
 *
 * Server-side proxy for the 0xLeverage protocol API.
 * The API key and per-user JWTs are kept server-side — never exposed to the frontend.
 *
 * Security hardening applied:
 *   - JWT cache has TTL enforcement (11.5h, before the 12h upstream expiry)
 *   - JWT cache has a size cap (10,000 entries) to prevent memory DoS
 *   - Expired entries are evicted on read and by a periodic cleanup job
 *   - Upstream API responses are validated with Zod schemas (not blindly cast)
 *   - Missing env vars cause a fast startup failure instead of silent empty string
 *   - Authorization header sends "Bearer <jwt>" (docs show raw, but API rejects without Bearer prefix)
 *   - All errors are logged with structured context via the audit logger
 */

import axios from "axios";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AXIOS_TIMEOUT_MS } from "@shared/const";
import { logger } from "./middleware/audit";

/* ------------------------------------------------------------------ */
/*  Startup validation — fail fast on missing config                   */
/* ------------------------------------------------------------------ */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Fatal — do not allow server to start with missing trading config
    throw new Error(`FATAL: ${name} environment variable is not set. Server cannot start.`);
  }
  return value;
}

// These are called lazily (not at module load) so tests can override process.env
function getApiBaseUrl(): string {
  return requireEnv("OXL_API_BASE_URL");
}

function getApiKey(): string {
  return requireEnv("OXL_API_KEY");
}

/* ------------------------------------------------------------------ */
/*  JWT Cache — TTL-enforced, size-capped                             */
/* ------------------------------------------------------------------ */

const JWT_TTL_MS = 11.5 * 60 * 60 * 1000; // 11.5 hours (30-min buffer before 12h expiry)
const MAX_JWT_CACHE_SIZE = 10_000;          // Hard cap to prevent memory DoS
const CACHE_CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // Evict expired entries every 30 minutes

interface CachedAuth {
  token: string;
  tradeWallet: string;
  expiresAt: number; // unix ms
}

const jwtCache = new Map<string, CachedAuth>();

/** Returns cached auth for a wallet address, or undefined if missing/expired. */
export function getCachedAuth(walletAddress: string): Omit<CachedAuth, "expiresAt"> | undefined {
  const entry = jwtCache.get(walletAddress.toLowerCase());
  if (!entry) return undefined;

  // Evict expired entries on read
  if (Date.now() >= entry.expiresAt) {
    jwtCache.delete(walletAddress.toLowerCase());
    logger.info({ event: "jwt_cache_expired", walletAddress: maskWallet(walletAddress) });
    return undefined;
  }

  return { token: entry.token, tradeWallet: entry.tradeWallet };
}

/** Stores auth for a wallet address, with TTL and size enforcement. */
export function setCachedAuth(walletAddress: string, token: string, tradeWallet: string): void {
  const key = walletAddress.toLowerCase();

  // Enforce max size — evict oldest 20% when at capacity
  if (jwtCache.size >= MAX_JWT_CACHE_SIZE) {
    const evictCount = Math.floor(MAX_JWT_CACHE_SIZE * 0.2);
    const keys = jwtCache.keys();
    for (let i = 0; i < evictCount; i++) {
      const next = keys.next();
      if (!next.done) jwtCache.delete(next.value);
    }
    logger.warn({ event: "jwt_cache_eviction", evictedCount: evictCount });
  }

  jwtCache.set(key, {
    token,
    tradeWallet,
    expiresAt: Date.now() + JWT_TTL_MS,
  });
}

/** Remove cached auth for a wallet (call on explicit disconnect). */
export function clearCachedAuth(walletAddress: string): void {
  jwtCache.delete(walletAddress.toLowerCase());
}

/** Periodic cleanup — evicts all expired entries. Runs every 30 minutes. */
function startCacheCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of jwtCache) {
      if (now >= entry.expiresAt) {
        jwtCache.delete(key);
        evicted++;
      }
    }
    if (evicted > 0) {
      logger.info({ event: "jwt_cache_cleanup", evictedCount: evicted, remainingCount: jwtCache.size });
    }
  }, CACHE_CLEANUP_INTERVAL_MS);
}

// Start cleanup on module load (not in test environments)
if (process.env.NODE_ENV !== "test") {
  startCacheCleanup();
}

/* ------------------------------------------------------------------ */
/*  HTTP client                                                        */
/* ------------------------------------------------------------------ */

function createClient(jwt?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }
  return axios.create({
    baseURL: getApiBaseUrl(),
    timeout: AXIOS_TIMEOUT_MS,
    headers,
  });
}

/* ------------------------------------------------------------------ */
/*  Upstream response validation                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse an upstream API response against a Zod schema.
 * On failure: throws a sanitised TRPCError (no schema details leaked to client).
 * The raw validation error is logged server-side for debugging.
 */
function parseApiResponse<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    logger.error({
      event: "upstream_response_invalid",
      context,
      issues: result.error.issues,
      receivedData: data,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected response from trading API. Please try again.",
    });
  }
  return result.data;
}

/* ------------------------------------------------------------------ */
/*  Response schemas                                                   */
/* ------------------------------------------------------------------ */

const healthResponseSchema = z.object({
  ok: z.boolean(),
});

const checkWalletResponseSchema = z.object({
  access_token: z.string().min(1),
  "Trade Wallet": z.string().min(32).max(44),
});

const quoteResponseSchema = z.object({
  trade_cost: z.coerce.number(),
  liquidation_price: z.coerce.number(),
  current_price: z.coerce.number(),
}).passthrough();

const solBalanceResponseSchema = z.object({
  balance_sol: z.coerce.number(),
});

const whitelistCheckResponseSchema = z.object({
  message: z.string(),
});

const whitelistRequestResponseSchema = z.object({
  message: z.string(),
});

const openPositionResponseSchema = z.object({
  success: z.boolean(),
  trade_id: z.string().min(1),
  tx_hash: z.string().min(1),
});

const positionSchema = z.object({
  trade_id: z.string(),
  contract_address: z.string(),
  leverage: z.coerce.number(),
  amount: z.coerce.number(),
  entryPrice: z.coerce.number(),
  liveProfit: z.coerce.number().optional(),
  openedAt: z.coerce.number().optional(),
  symbol: z.string().optional(),
  tp: z.coerce.number().optional(),
  sl: z.coerce.number().optional(),
}).passthrough();

const openPositionsResponseSchema = z.object({
  success: z.boolean(),
  positions: z.array(positionSchema),
});

const tradeInfoResponseSchema = z.object({
  success: z.boolean(),
  trade: z.object({ trade_id: z.string() }).passthrough(),
});

const trackTradeResponseSchema = z.object({
  trade_id: z.string().optional(),
  tradeId: z.string().optional(),
  liveProfit: z.coerce.number(),
  currentPrice: z.coerce.number().optional(),
}).passthrough();

const updateTpSlResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
}).passthrough();

const closeResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  SellTx: z.string(),
});

/* ------------------------------------------------------------------ */
/*  Exported types (derived from schemas)                              */
/* ------------------------------------------------------------------ */

export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
export type OpenPositionResponse = z.infer<typeof openPositionResponseSchema>;
export type Position = z.infer<typeof positionSchema>;
export type CloseResponse = z.infer<typeof closeResponseSchema>;

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

/** Mask wallet address for logs — never log full addresses. */
function maskWallet(address: string): string {
  if (address.length < 8) return "***";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/*  API functions                                                      */
/* ------------------------------------------------------------------ */

/** GET /health — no auth required */
export async function health(): Promise<{ ok: boolean }> {
  try {
    const client = createClient();
    const { data } = await client.get("/health");
    return parseApiResponse(healthResponseSchema, data, "health");
  } catch (err) {
    // Do not expose internal state — always return false on failure
    logger.error({ event: "health_check_failed", error: err instanceof Error ? err.message : "unknown" });
    return { ok: false };
  }
}

/** POST /check_wallet — exchange wallet address for 0xL JWT + trade wallet */
export async function checkWallet(walletAddress: string): Promise<{ accessToken: string; tradeWallet: string }> {
  const client = createClient();
  const { data } = await client.post("/check_wallet", {
    apikey: getApiKey(),
    user_id: walletAddress,
  });

  const parsed = parseApiResponse(checkWalletResponseSchema, data, "check_wallet");
  const token = parsed.access_token;
  const tradeWallet = parsed["Trade Wallet"];

  setCachedAuth(walletAddress, token, tradeWallet);
  logger.info({ event: "wallet_connected", wallet: maskWallet(walletAddress) });

  return { accessToken: token, tradeWallet };
}

/** POST /quote */
export async function getQuote(
  jwt: string,
  contractAddress: string,
  leverage: number,
  initialAmount: number,
): Promise<QuoteResponse> {
  const client = createClient(jwt);
  const { data } = await client.post("/quote", {
    apikey: getApiKey(),
    contract_address: contractAddress,
    leverage,
    initial_amount: initialAmount,
  });
  return parseApiResponse(quoteResponseSchema, data, "quote");
}

/** POST /sol_balance */
export async function getSolBalance(jwt: string): Promise<{ balance_sol: number }> {
  const client = createClient(jwt);
  const { data } = await client.post("/sol_balance", {
    apikey: getApiKey(),
  });
  return parseApiResponse(solBalanceResponseSchema, data, "sol_balance");
}

/** POST /wlcheck */
export async function checkWhitelist(jwt: string, contractAddress: string) {
  const client = createClient(jwt);
  const { data } = await client.post("/wlcheck", {
    apikey: getApiKey(),
    contract_address: contractAddress,
  });
  const parsed = parseApiResponse(whitelistCheckResponseSchema, data, "wlcheck");
  return {
    whitelisted: parsed.message === "Whitelisted",
    message: parsed.message,
  };
}

/** POST /wlrequest */
export async function requestWhitelist(jwt: string, contractAddress: string) {
  const client = createClient(jwt);
  const { data, status } = await client.post("/wlrequest", {
    apikey: getApiKey(),
    contract_address: contractAddress,
  });
  const parsed = parseApiResponse(whitelistRequestResponseSchema, data, "wlrequest");
  return {
    submitted: status === 201,
    alreadyWhitelisted: status === 200,
    message: parsed.message,
  };
}

/** POST /solopenlev */
export async function openLeveragePosition(
  jwt: string,
  params: {
    contractAddress: string;
    amount: number;
    leverage: number;
    solTip: number;
    tp?: number;
    sl?: number;
  },
): Promise<OpenPositionResponse> {
  const client = createClient(jwt);
  const body: Record<string, unknown> = {
    apikey: getApiKey(),
    contract_address: params.contractAddress,
    amount: params.amount,
    leverage: params.leverage,
    soltip: params.solTip,
  };
  if (params.tp !== undefined) body["TP"] = params.tp;
  if (params.sl !== undefined) body["SL"] = params.sl;

  const { data } = await client.post("/solopenlev", body);
  return parseApiResponse(openPositionResponseSchema, data, "solopenlev");
}

/** POST /solopenpositions */
export async function getOpenPositions(
  jwt: string,
): Promise<{ success: boolean; positions: Position[] }> {
  const client = createClient(jwt);
  const { data } = await client.post("/solopenpositions", {
    apikey: getApiKey(),
  });
  return parseApiResponse(openPositionsResponseSchema, data, "solopenpositions");
}

/** POST /soltradeinfo */
export async function getTradeInfo(jwt: string, tradeId: string) {
  const client = createClient(jwt);
  const { data } = await client.post("/soltradeinfo", {
    apikey: getApiKey(),
    trade_id: tradeId,
  });
  return parseApiResponse(tradeInfoResponseSchema, data, "soltradeinfo");
}

/** POST /soltrack */
export async function trackTrade(jwt: string, tradeId: string) {
  const client = createClient(jwt);
  const { data } = await client.post("/soltrack", {
    apikey: getApiKey(),
    trade_id: tradeId,
  });
  return parseApiResponse(trackTradeResponseSchema, data, "soltrack");
}

/** POST /solupdatetpsl */
export async function updateTpSl(
  jwt: string,
  tradeId: string,
  tp?: number,
  sl?: number,
) {
  const client = createClient(jwt);
  const body: Record<string, unknown> = {
    apikey: getApiKey(),
    trade_id: tradeId,
  };
  if (tp !== undefined) body["tp"] = tp;
  if (sl !== undefined) body["sl"] = sl;

  const { data } = await client.post("/solupdatetpsl", body);
  return parseApiResponse(updateTpSlResponseSchema, data, "solupdatetpsl");
}

/** POST /solcloselev */
export async function closeLeveragePosition(
  jwt: string,
  tradeId: string,
  solTip: number,
  slippage: number,
  tokenAmount = 100,
): Promise<CloseResponse> {
  const client = createClient(jwt);
  const { data } = await client.post("/solcloselev", {
    apikey: getApiKey(),
    trade_id: tradeId,
    sol_tip: solTip,
    slippage,
    token_amount: tokenAmount,
  });
  return parseApiResponse(closeResponseSchema, data, "solcloselev");
}
