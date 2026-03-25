/**
 * Wallet Authentication Middleware for tRPC
 *
 * Provides:
 *   1. walletProtectedProcedure — use this for any procedure that modifies
 *      state or executes trades. Ensures a valid JWT exists for the wallet.
 *
 *   2. Per-wallet rate limiting — max 10 trade operations per wallet per minute,
 *      independent of IP-based rate limiting.
 *
 * Current behaviour (pre-wallet-adapter):
 *   Validates that the wallet has a cached JWT (i.e. connectWallet was called).
 *   Does NOT yet verify that the request came from the actual wallet owner.
 *
 * Post-wallet-adapter (TODO):
 *   After signature verification is implemented in connectWallet, add session
 *   binding here: verify that ctx.user (platform session) matches the submitted
 *   walletAddress to prevent session confusion attacks.
 */

import { TRPCError } from "@trpc/server";
import { getCachedAuthWithExpiry, checkWallet } from "../leverage-api";
import { logger, maskWallet } from "./audit";

/* ------------------------------------------------------------------ */
/*  Per-wallet rate limiting                                           */
/* ------------------------------------------------------------------ */

interface WalletRateLimitEntry {
  count: number;
  windowStart: number;
}

// NOTE: In-memory Map resets on restart and is not shared across instances.
// For horizontal scaling (multiple processes/containers), replace with
// Redis-backed rate limiting (e.g. rate-limit-redis or ioredis + sliding window).
const walletRateLimitMap = new Map<string, WalletRateLimitEntry>();
const WALLET_RATE_LIMIT_MAX = 60;   // max operations per window
const WALLET_RATE_LIMIT_WINDOW = 60_000; // 1 minute window

// Clean up old entries periodically to prevent unbounded growth
setInterval(() => {
  const cutoff = Date.now() - WALLET_RATE_LIMIT_WINDOW;
  for (const [key, entry] of walletRateLimitMap) {
    if (entry.windowStart < cutoff) {
      walletRateLimitMap.delete(key);
    }
  }
}, 5 * 60_000);

/** Returns true if the wallet has exceeded the per-wallet rate limit. */
function isWalletRateLimited(walletAddress: string): boolean {
  const key = walletAddress.toLowerCase();
  const now = Date.now();
  const entry = walletRateLimitMap.get(key);

  if (!entry || now - entry.windowStart > WALLET_RATE_LIMIT_WINDOW) {
    // New window
    walletRateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > WALLET_RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Middleware                                                         */
/* ------------------------------------------------------------------ */

/**
 * Validates that:
 *   1. A walletAddress field exists in the input (shape check only — full
 *      validation is done by the procedure's Zod schema)
 *   2. A valid (non-expired) JWT exists for that wallet
 *   3. The wallet is not exceeding the per-wallet rate limit
 *
 * If the cached JWT has expired, transparently re-authenticates with the
 * upstream API using checkWallet (no user signature needed).
 */
export async function requireWalletAuth<TInput extends { walletAddress: string }>(
  input: TInput,
  procedureName: string,
): Promise<void> {
  const { walletAddress } = input;

  // Try cache first, then transparent re-auth
  await requireOxlJwt(walletAddress);

  // Per-wallet rate limit check
  if (isWalletRateLimited(walletAddress)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded for wallet. Maximum ${WALLET_RATE_LIMIT_MAX} operations per minute.`,
    });
  }
}

/**
 * Get cached auth for the wallet. If near expiry, fires a background
 * refresh (non-blocking) so the next request gets a fresh token.
 * If fully expired or missing, does a blocking re-auth.
 */
export async function requireOxlJwt(walletAddress: string) {
  const cached = getCachedAuthWithExpiry(walletAddress);

  if (cached) {
    // Token still valid — but if close to expiry, refresh in background
    if (cached.nearExpiry) {
      checkWallet(walletAddress)
        .then(() => {
          logger.info({
            event: "jwt_proactive_refresh",
            wallet: maskWallet(walletAddress),
          });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn({ event: "jwt_proactive_refresh_failed", wallet: maskWallet(walletAddress), error: msg });
        });
    }
    return { token: cached.token, tradeWallet: cached.tradeWallet };
  }

  // Expired or missing — blocking re-auth
  try {
    const result = await checkWallet(walletAddress);
    logger.info({
      event: "jwt_auto_refreshed",
      wallet: maskWallet(walletAddress),
    });
    return { token: result.accessToken, tradeWallet: result.tradeWallet };
  } catch {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Wallet not connected to 0xLeverage. Call connectWallet first.",
    });
  }
}
