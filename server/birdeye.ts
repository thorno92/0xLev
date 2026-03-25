/**
 * Birdeye API client — fetches real-time trade data for Solana tokens.
 *
 * Docs: https://docs.birdeye.so/
 * Used to replace mock orderbook/transaction data in the terminal.
 */

import axios from "axios";
import { z } from "zod";
import { logger } from "./middleware/audit";

const BIRDEYE_BASE = "https://public-api.birdeye.so";
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY ?? "";

if (!BIRDEYE_API_KEY) {
  logger.warn({ event: "birdeye_disabled", reason: "BIRDEYE_API_KEY not set — orderbook/trades will return empty" });
}

const client = axios.create({
  baseURL: BIRDEYE_BASE,
  timeout: 10_000,
  headers: {
    "X-API-KEY": BIRDEYE_API_KEY,
    accept: "application/json",
  },
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BirdeyeTrade {
  txHash: string;
  blockUnixTime: number;
  side: "buy" | "sell";
  price: number;
  volume: number;        // in USD
  volumeNative: number;  // in SOL/native token
  maker: string;
  source: string;
}

export interface BirdeyeOrderbookLevel {
  price: number;
  size: number;
}

export interface BirdeyeOrderbook {
  asks: BirdeyeOrderbookLevel[];
  bids: BirdeyeOrderbookLevel[];
  lastUpdated: number;
}

/* ------------------------------------------------------------------ */
/*  Cache                                                              */
/* ------------------------------------------------------------------ */

interface CachedData<T> {
  data: T;
  timestamp: number;
}

const tradeCache = new Map<string, CachedData<BirdeyeTrade[]>>();
const TRADE_CACHE_TTL = 15_000; // 15 seconds
const MAX_CACHE_SIZE = 500;

/* ------------------------------------------------------------------ */
/*  Response validation schemas                                        */
/* ------------------------------------------------------------------ */

const birdeyeTradeItemSchema = z.object({
  txHash: z.string().default(""),
  blockUnixTime: z.number().finite().default(0),
  side: z.enum(["buy", "sell"]).catch("sell"),
  price: z.number().finite().nonnegative().default(0),
  volume: z.number().finite().nonnegative().default(0),
  volumeNative: z.number().finite().nonnegative().default(0),
  owner: z.string().optional(),
  from: z.string().optional(),
  source: z.string().default(""),
});

const birdeyeTradesResponseSchema = z.object({
  data: z.object({
    items: z.array(birdeyeTradeItemSchema),
  }),
});

const birdeyeOrderbookLevelSchema = z.object({
  price: z.number().finite().nonnegative().default(0),
  size: z.number().finite().nonnegative().default(0),
});

const birdeyeOrderbookResponseSchema = z.object({
  data: z.object({
    asks: z.array(birdeyeOrderbookLevelSchema).default([]),
    bids: z.array(birdeyeOrderbookLevelSchema).default([]),
  }),
});

/* ------------------------------------------------------------------ */
/*  API Functions                                                      */
/* ------------------------------------------------------------------ */

/**
 * Get recent trades for a token address.
 * Returns up to `limit` recent trades on Solana DEXes.
 */
export async function getRecentTrades(
  tokenAddress: string,
  limit: number = 20,
): Promise<BirdeyeTrade[]> {
  // Check cache
  const cached = tradeCache.get(tokenAddress);
  if (cached && Date.now() - cached.timestamp < TRADE_CACHE_TTL) {
    return cached.data;
  }

  if (!BIRDEYE_API_KEY) {
    // No API key — return empty array (frontend will show mock fallback)
    return [];
  }

  try {
    const res = await client.get("/defi/txs/token", {
      params: {
        address: tokenAddress,
        tx_type: "swap",
        sort_type: "desc",
        limit,
      },
      headers: { "x-chain": "solana" },
    });

    const parseResult = birdeyeTradesResponseSchema.safeParse(res.data);
    if (!parseResult.success) {
      logger.warn({ event: "birdeye_trades_invalid_response", issues: parseResult.error.issues.slice(0, 3) });
      return [];
    }

    const trades: BirdeyeTrade[] = parseResult.data.data.items.map((item) => ({
      txHash: item.txHash,
      blockUnixTime: item.blockUnixTime,
      side: item.side,
      price: item.price,
      volume: item.volume,
      volumeNative: item.volumeNative,
      maker: item.owner ?? item.from ?? "",
      source: item.source,
    }));

    if (tradeCache.size >= MAX_CACHE_SIZE) {
      const firstKey = tradeCache.keys().next().value;
      if (firstKey) tradeCache.delete(firstKey);
    }
    tradeCache.set(tokenAddress, { data: trades, timestamp: Date.now() });
    return trades;
  } catch (err) {
    logger.error({ event: "birdeye_trades_fetch_failed", error: err instanceof Error ? err.message : "unknown" });
    return [];
  }
}

/**
 * Get orderbook (aggregated price levels) for a token.
 */
export async function getOrderbook(
  tokenAddress: string,
): Promise<BirdeyeOrderbook> {
  if (!BIRDEYE_API_KEY) {
    return { asks: [], bids: [], lastUpdated: Date.now() };
  }

  try {
    const res = await client.get("/defi/orderbook", {
      params: { address: tokenAddress },
      headers: { "x-chain": "solana" },
    });

    const parseResult = birdeyeOrderbookResponseSchema.safeParse(res.data);
    if (!parseResult.success) {
      logger.warn({ event: "birdeye_orderbook_invalid_response", issues: parseResult.error.issues.slice(0, 3) });
      return { asks: [], bids: [], lastUpdated: Date.now() };
    }

    return {
      asks: parseResult.data.data.asks,
      bids: parseResult.data.data.bids,
      lastUpdated: Date.now(),
    };
  } catch (err) {
    logger.error({ event: "birdeye_orderbook_fetch_failed", error: err instanceof Error ? err.message : "unknown" });
    return { asks: [], bids: [], lastUpdated: Date.now() };
  }
}
