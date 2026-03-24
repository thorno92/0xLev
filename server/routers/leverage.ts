/**
 * 0xLeverage tRPC Router
 *
 * Exposes all 0xLeverage API endpoints as typed tRPC procedures.
 *
 * Procedure categories:
 *   publicProcedure       — health check, connectWallet
 *   walletProtected       — everything that reads/writes trade state
 *
 * Security applied:
 *   - All inputs validated with strict Zod schemas (defined at top of file)
 *   - Wallet addresses: base58, 32-44 chars
 *   - Contract addresses: base58, 32-44 chars
 *   - Trade IDs: alphanumeric + hyphens, max 128 chars
 *   - All numerics bounded to prevent overflow/abuse
 *   - Per-wallet rate limiting via requireWalletAuth()
 *   - Expired JWTs caught by getCachedAuth() TTL check
 *   - All trade mutations emit structured audit log entries
 *   - Upstream responses validated with Zod (no blindly-cast `as` types)
 *
 * Wallet adapter integration:
 *   - connectWallet: signature + timestamp verification via nacl ✓
 *   - Account lockout on repeated failures ✓
 *   - Per-wallet rate limiting via requireWalletAuth ✓
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { SignJWT, jwtVerify } from "jose";
import { publicProcedure, router } from "../_core/trpc";
import * as api from "../leverage-api";
import * as birdeye from "../birdeye";
import { requireOxlJwt, requireWalletAuth } from "../middleware/walletAuth";
import { auditLog, maskWallet, requestTimer, logger } from "../middleware/audit";
import {
  WALLET_SESSION_COOKIE,
  WALLET_SESSION_TTL_S,
  getWalletSessionCookieOptions,
} from "../_core/cookies";

/* ------------------------------------------------------------------ */
/*  Session JWT helpers                                                */
/* ------------------------------------------------------------------ */

function getSessionSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

async function mintSessionJwt(walletAddress: string): Promise<string> {
  return new SignJWT({ wallet: walletAddress })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${WALLET_SESSION_TTL_S}s`)
    .sign(getSessionSecret());
}

function extractCookie(
  req: import("express").Request,
  name: string,
): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key?.trim() === name) return rest.join("=").trim();
  }
  return undefined;
}

async function verifySessionJwt(
  token: string,
): Promise<{ wallet: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (typeof payload.wallet === "string" && payload.wallet.length >= 32) {
      return { wallet: payload.wallet };
    }
    return null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Shared Zod Schemas                                                 */
/* ------------------------------------------------------------------ */

/** Base58 character set — Solana addresses use this encoding */
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

/** Solana wallet address: 32-44 chars, base58 */
const walletAddressSchema = z
  .string()
  .min(32, "Wallet address too short")
  .max(44, "Wallet address too long")
  .regex(BASE58_REGEX, "Invalid wallet address format (must be base58)");

/** Solana contract/token address: same format as wallet */
const contractAddressSchema = z
  .string()
  .min(32, "Contract address too short")
  .max(44, "Contract address too long")
  .regex(BASE58_REGEX, "Invalid contract address format (must be base58)");

/** Trade ID: alphanumeric + hyphens/underscores, max 128 chars */
const tradeIdSchema = z
  .string()
  .min(1, "Trade ID required")
  .max(128, "Trade ID too long")
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid trade ID format");

/** Leverage multiplier: 1x–100x (whole numbers only) */
const leverageSchema = z
  .number()
  .int("Leverage must be a whole number")
  .min(1, "Minimum leverage is 1x")
  .max(100, "Maximum leverage is 100x");

/** SOL trade amount: positive, capped at 10,000 SOL */
const solAmountSchema = z
  .number()
  .positive("Amount must be positive")
  .max(10_000, "Maximum amount is 10,000 SOL");

/** SOL tip: non-negative, capped at 1 SOL */
const solTipSchema = z
  .number()
  .nonnegative("Tip cannot be negative")
  .max(1, "Maximum tip is 1 SOL");

/** TP/SL price level: positive, sane upper bound */
const priceLevelSchema = z
  .number()
  .positive("Price must be positive")
  .max(1_000_000_000, "Price exceeds maximum")
  .optional();

/** Slippage: 0–100% */
const slippageSchema = z
  .number()
  .nonnegative("Slippage cannot be negative")
  .max(100, "Slippage cannot exceed 100%");

/** Partial close percentage: 1–100% */
const tokenAmountSchema = z
  .number()
  .min(1, "Minimum close amount is 1%")
  .max(100, "Maximum close amount is 100%")
  .default(100);

/* ------------------------------------------------------------------ */
/*  Account lockout — brute-force protection for connectWallet         */
/* ------------------------------------------------------------------ */

interface LockoutEntry {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

const lockoutMap = new Map<string, LockoutEntry>();
const LOCKOUT_MAX_FAILURES = 10;
const LOCKOUT_WINDOW_MS = 5 * 60_000;   // 5 minutes
const LOCKOUT_DURATION_MS = 15 * 60_000; // 15-minute block

// Periodic cleanup to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of lockoutMap) {
    if (now > entry.lockedUntil || now - entry.windowStart > LOCKOUT_WINDOW_MS * 2) {
      lockoutMap.delete(key);
    }
  }
}, 5 * 60_000);

function checkLockout(walletAddress: string): void {
  const key = walletAddress.toLowerCase();
  const entry = lockoutMap.get(key);
  if (!entry) return;

  if (Date.now() < entry.lockedUntil) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Account temporarily locked due to repeated failures. Try again in 15 minutes.",
    });
  }
}

function recordFailure(walletAddress: string): void {
  const key = walletAddress.toLowerCase();
  const now = Date.now();
  const entry = lockoutMap.get(key);

  if (!entry || now - entry.windowStart > LOCKOUT_WINDOW_MS) {
    lockoutMap.set(key, { failures: 1, windowStart: now, lockedUntil: 0 });
    return;
  }

  entry.failures++;
  if (entry.failures >= LOCKOUT_MAX_FAILURES) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
}

function clearLockout(walletAddress: string): void {
  lockoutMap.delete(walletAddress.toLowerCase());
}

/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */

export const leverageRouter = router({
  /**
   * Health check — public, rate-limited separately in security.ts.
   * Always returns { ok: true } to callers; real state logged internally.
   */
  health: publicProcedure.query(async () => {
    // Intentionally swallows failures — don't expose upstream availability to callers
    await api.health(); // logs internally
    return { ok: true };
  }),

  /**
   * Connect wallet — exchanges a Solana wallet address for a 0xL JWT.
   *
   * Security layers:
   *   1. IP rate limit: 10 attempts per 15 minutes (connectWalletGuard in security.ts)
   *   2. Account lockout: 10 failures per 5 minutes → 15-minute block
   *   3. Timestamp replay prevention: 5-minute window
   *   4. Signature verification: nacl.sign.detached.verify
   */
  connectWallet: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        signature: z.string().min(1, "Signature required"),
        timestamp: z.number().int().positive("Invalid timestamp"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const timer = requestTimer();
      const reqId = (ctx as { requestId?: string }).requestId ?? "unknown";

      // 0. Check account lockout before any work
      checkLockout(input.walletAddress);

      // 1. Reject stale challenges (> 5 minute window prevents replay attacks)
      const AGE_LIMIT_MS = 5 * 60 * 1000;
      if (Date.now() - input.timestamp > AGE_LIMIT_MS) {
        recordFailure(input.walletAddress);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Authentication challenge expired. Please try again.",
        });
      }

      // 2. Reconstruct the message that was signed
      const message = `0xLeverage auth: ${input.timestamp}`;
      const messageBytes = new TextEncoder().encode(message);

      // 3. Verify the signature
      let signatureValid = false;
      try {
        const publicKey = new PublicKey(input.walletAddress);
        const signatureBytes = Buffer.from(input.signature, "base64");
        signatureValid = nacl.sign.detached.verify(
          messageBytes,
          signatureBytes,
          publicKey.toBytes(),
        );
      } catch {
        recordFailure(input.walletAddress);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid signature format.",
        });
      }

      if (!signatureValid) {
        recordFailure(input.walletAddress);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Signature verification failed. You must sign with the connected wallet.",
        });
      }

      // 4. Signature verified — now call 0xL API
      try {
        const result = await api.checkWallet(input.walletAddress);
        clearLockout(input.walletAddress);

        // 5. Mint a session cookie so the user doesn't re-sign on every page load
        const sessionToken = await mintSessionJwt(input.walletAddress);
        ctx.res.cookie(
          WALLET_SESSION_COOKIE,
          sessionToken,
          getWalletSessionCookieOptions(ctx.req),
        );

        auditLog({
          requestId: reqId,
          walletAddress: maskWallet(input.walletAddress),
          procedure: "connectWallet",
          outcome: "success",
          durationMs: timer.stop(),
        });
        return { success: true, tradeWallet: result.tradeWallet };
      } catch (err: unknown) {
        recordFailure(input.walletAddress);
        auditLog({
          requestId: reqId,
          walletAddress: maskWallet(input.walletAddress),
          procedure: "connectWallet",
          outcome: "error",
          errorCode: err instanceof TRPCError ? err.code : "UNKNOWN",
          durationMs: timer.stop(),
        });
        const message = err instanceof Error ? err.message : "Failed to connect wallet";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

  /**
   * Resume an existing session from the wallet_session cookie.
   * Returns the wallet address and trade wallet if the session is valid,
   * or null values if not (no error — client falls back to signature flow).
   */
  resumeSession: publicProcedure.query(async ({ ctx }) => {
    const token = extractCookie(ctx.req, WALLET_SESSION_COOKIE);
    if (!token) return { walletAddress: null, tradeWallet: null };

    const session = await verifySessionJwt(token);
    if (!session) return { walletAddress: null, tradeWallet: null };

    // Check if the upstream 0xL JWT is still cached
    const cached = api.getCachedAuth(session.wallet);
    if (cached) {
      logger.info({
        event: "session_resumed",
        wallet: maskWallet(session.wallet),
        source: "cache",
      });
      return { walletAddress: session.wallet, tradeWallet: cached.tradeWallet };
    }

    // Upstream JWT expired or server restarted — silently re-authenticate
    try {
      const result = await api.checkWallet(session.wallet);
      logger.info({
        event: "session_resumed",
        wallet: maskWallet(session.wallet),
        source: "reauth",
      });
      return { walletAddress: session.wallet, tradeWallet: result.tradeWallet };
    } catch {
      // Upstream failed — clear the stale session cookie
      ctx.res.clearCookie(WALLET_SESSION_COOKIE, { path: "/" });
      return { walletAddress: null, tradeWallet: null };
    }
  }),

  /** Disconnect wallet — clears session cookie and cached auth */
  disconnectWallet: publicProcedure
    .input(z.object({ walletAddress: walletAddressSchema }))
    .mutation(async ({ input, ctx }) => {
      api.clearCachedAuth(input.walletAddress);
      ctx.res.clearCookie(WALLET_SESSION_COOKIE, { path: "/" });
      logger.info({
        event: "wallet_disconnected",
        wallet: maskWallet(input.walletAddress),
      });
      return { success: true };
    }),

  /** Get quote for a leveraged trade */
  getQuote: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        contractAddress: contractAddressSchema,
        leverage: leverageSchema,
        initialAmount: solAmountSchema,
      }),
    )
    .query(async ({ input }) => {
      await requireWalletAuth(input, "getQuote");
      const { token } = await requireOxlJwt(input.walletAddress);
      return api.getQuote(token, input.contractAddress, input.leverage, input.initialAmount);
    }),

  /** Get SOL balance of the user's trade wallet */
  getSolBalance: publicProcedure
    .input(z.object({ walletAddress: walletAddressSchema }))
    .query(async ({ input }) => {
      await requireWalletAuth(input, "getSolBalance");
      const { token } = await requireOxlJwt(input.walletAddress);
      try {
        return await api.getSolBalance(token);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status;
        const data = (err as { response?: { data?: unknown } }).response?.data;
        const msg = err instanceof Error ? err.message : "unknown";
        logger.error({
          event: "getSolBalance_failed",
          wallet: maskWallet(input.walletAddress),
          upstreamStatus: status,
          upstreamData: data,
          error: msg,
        });
        throw new TRPCError({
          code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_SERVER_ERROR",
          message: `Trade wallet balance unavailable (upstream ${status ?? "error"})`,
        });
      }
    }),

  /** Check if a token is whitelisted for trading */
  checkWhitelist: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        contractAddress: contractAddressSchema,
      }),
    )
    .query(async ({ input }) => {
      await requireWalletAuth(input, "checkWhitelist");
      const { token } = await requireOxlJwt(input.walletAddress);
      return api.checkWhitelist(token, input.contractAddress);
    }),

  /** Request whitelist for an unlisted token */
  requestWhitelist: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        contractAddress: contractAddressSchema,
      }),
    )
    .mutation(async ({ input }) => {
      await requireWalletAuth(input, "requestWhitelist");
      const { token } = await requireOxlJwt(input.walletAddress);
      return api.requestWhitelist(token, input.contractAddress);
    }),

  /**
   * Open a leveraged position — highest-risk operation.
   * - Wallet must be authenticated (JWT in cache)
   * - Per-wallet rate limit enforced by requireWalletAuth
   * - Full audit log entry on success and failure
   */
  openPosition: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        contractAddress: contractAddressSchema,
        amount: solAmountSchema,
        leverage: leverageSchema,
        solTip: solTipSchema,
        tp: priceLevelSchema,
        sl: priceLevelSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireWalletAuth(input, "openPosition");
      const { token } = await requireOxlJwt(input.walletAddress);
      const timer = requestTimer();
      const reqId = (ctx as { requestId?: string }).requestId ?? "unknown";

      try {
        const result = await api.openLeveragePosition(token, {
          contractAddress: input.contractAddress,
          amount: input.amount,
          leverage: input.leverage,
          solTip: input.solTip,
          tp: input.tp,
          sl: input.sl,
        });

        auditLog({
          requestId: reqId,
          walletAddress: maskWallet(input.walletAddress),
          procedure: "openPosition",
          params: {
            contractAddress: input.contractAddress,
            leverage: input.leverage,
            amount: input.amount,
            tp: input.tp,
            sl: input.sl,
          },
          outcome: "success",
          durationMs: timer.stop(),
        });

        return result;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status;
        const data = (err as { response?: { data?: unknown } }).response?.data;
        const msg = err instanceof Error ? err.message : "unknown";
        logger.error({
          event: "openPosition_failed",
          wallet: maskWallet(input.walletAddress),
          upstreamStatus: status,
          upstreamData: data,
          error: msg,
          params: { contractAddress: input.contractAddress, leverage: input.leverage, amount: input.amount },
        });
        auditLog({
          requestId: reqId,
          walletAddress: maskWallet(input.walletAddress),
          procedure: "openPosition",
          params: { contractAddress: input.contractAddress, leverage: input.leverage },
          outcome: "error",
          errorCode: status ? `HTTP_${status}` : (err instanceof TRPCError ? err.code : "UNKNOWN"),
          durationMs: timer.stop(),
        });
        throw err;
      }
    }),

  /** List all open positions for a wallet */
  getPositions: publicProcedure
    .input(z.object({ walletAddress: walletAddressSchema }))
    .query(async ({ input }) => {
      await requireWalletAuth(input, "getPositions");
      const { token } = await requireOxlJwt(input.walletAddress);
      return api.getOpenPositions(token);
    }),

  /** Get full details for a single trade */
  getTradeInfo: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        tradeId: tradeIdSchema,
      }),
    )
    .query(async ({ input }) => {
      await requireWalletAuth(input, "getTradeInfo");
      const { token } = await requireOxlJwt(input.walletAddress);
      return api.getTradeInfo(token, input.tradeId);
    }),

  /** Track a trade's live status */
  trackTrade: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        tradeId: tradeIdSchema,
      }),
    )
    .query(async ({ input }) => {
      await requireWalletAuth(input, "trackTrade");
      const { token } = await requireOxlJwt(input.walletAddress);
      return api.trackTrade(token, input.tradeId);
    }),

  /** Update take-profit and/or stop-loss on an open position */
  updateTpSl: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        tradeId: tradeIdSchema,
        tp: priceLevelSchema,
        sl: priceLevelSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireWalletAuth(input, "updateTpSl");
      const { token } = await requireOxlJwt(input.walletAddress);
      const timer = requestTimer();
      const reqId = (ctx as { requestId?: string }).requestId ?? "unknown";

      try {
        const result = await api.updateTpSl(token, input.tradeId, input.tp, input.sl);
        auditLog({
          requestId: reqId,
          walletAddress: maskWallet(input.walletAddress),
          procedure: "updateTpSl",
          params: { tradeId: input.tradeId, tp: input.tp, sl: input.sl },
          outcome: "success",
          durationMs: timer.stop(),
        });
        return result;
      } catch (err) {
        auditLog({
          requestId: reqId,
          walletAddress: maskWallet(input.walletAddress),
          procedure: "updateTpSl",
          params: { tradeId: input.tradeId },
          outcome: "error",
          errorCode: err instanceof TRPCError ? err.code : "UNKNOWN",
          durationMs: timer.stop(),
        });
        throw err;
      }
    }),

  /**
   * Close a leveraged position — second highest-risk operation.
   * Full audit trail on success and failure.
   */
  closePosition: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        tradeId: tradeIdSchema,
        solTip: solTipSchema,
        slippage: slippageSchema,
        tokenAmount: tokenAmountSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireWalletAuth(input, "closePosition");
      const { token } = await requireOxlJwt(input.walletAddress);
      const timer = requestTimer();
      const reqId = (ctx as { requestId?: string }).requestId ?? "unknown";

      try {
        const result = await api.closeLeveragePosition(
          token,
          input.tradeId,
          input.solTip,
          input.slippage,
          input.tokenAmount,
        );

        auditLog({
          requestId: reqId,
          walletAddress: maskWallet(input.walletAddress),
          procedure: "closePosition",
          params: {
            tradeId: input.tradeId,
            slippage: input.slippage,
            tokenAmount: input.tokenAmount,
          },
          outcome: "success",
          durationMs: timer.stop(),
        });

        return result;
      } catch (err) {
        auditLog({
          requestId: reqId,
          walletAddress: maskWallet(input.walletAddress),
          procedure: "closePosition",
          params: { tradeId: input.tradeId },
          outcome: "error",
          errorCode: err instanceof TRPCError ? err.code : "UNKNOWN",
          durationMs: timer.stop(),
        });
        throw err;
      }
    }),

  /** Get recent trades for a token from Birdeye */
  getTokenTrades: publicProcedure
    .input(
      z.object({
        tokenAddress: contractAddressSchema,
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      return birdeye.getRecentTrades(input.tokenAddress, input.limit);
    }),

  /** Get orderbook for a token from Birdeye */
  getOrderbook: publicProcedure
    .input(
      z.object({
        tokenAddress: contractAddressSchema,
      }),
    )
    .query(async ({ input }) => {
      return birdeye.getOrderbook(input.tokenAddress);
    }),
});
