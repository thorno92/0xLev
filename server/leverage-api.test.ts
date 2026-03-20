import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Tests for the 0xLeverage tRPC router.
 * These test the router structure and input validation without
 * hitting the real API (no OXL_API_BASE_URL configured in test).
 */

/* Valid-looking Solana addresses for test fixtures */
const VALID_WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const VALID_CONTRACT = "So11111111111111111111111111111111111111112";

function createPublicContext(cookieHeader?: string): TrpcContext {
  return {
    user: null,
    requestId: "test-req-id",
    req: {
      protocol: "https",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("leverage router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
  });

  it("health returns ok status", async () => {
    const result = await caller.leverage.health();
    expect(result).toHaveProperty("ok");
    // The tRPC procedure always returns { ok: true } to callers
    // (upstream failures are logged but not exposed)
    expect(result.ok).toBe(true);
  });

  it("connectWallet rejects empty wallet address", async () => {
    await expect(
      caller.leverage.connectWallet({
        walletAddress: "",
        signature: "dGVzdA==",
        timestamp: Date.now(),
      }),
    ).rejects.toThrow();
  });

  it("connectWallet rejects invalid base58 address", async () => {
    await expect(
      caller.leverage.connectWallet({
        walletAddress: "0xInvalidEthStyleAddress000000000000000000",
        signature: "dGVzdA==",
        timestamp: Date.now(),
      }),
    ).rejects.toThrow();
  });

  it("connectWallet rejects expired timestamp", async () => {
    const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
    await expect(
      caller.leverage.connectWallet({
        walletAddress: VALID_WALLET,
        signature: "dGVzdA==",
        timestamp: sixMinutesAgo,
      }),
    ).rejects.toThrow("expired");
  });

  it("connectWallet rejects missing signature", async () => {
    await expect(
      caller.leverage.connectWallet({
        walletAddress: VALID_WALLET,
        signature: "",
        timestamp: Date.now(),
      }),
    ).rejects.toThrow();
  });

  it("getQuote rejects without prior wallet connection", async () => {
    await expect(
      caller.leverage.getQuote({
        walletAddress: VALID_WALLET,
        contractAddress: VALID_CONTRACT,
        leverage: 5,
        initialAmount: 1,
      }),
    ).rejects.toThrow("Wallet not connected");
  });

  it("getSolBalance rejects without prior wallet connection", async () => {
    await expect(
      caller.leverage.getSolBalance({ walletAddress: VALID_WALLET }),
    ).rejects.toThrow("Wallet not connected");
  });

  it("getPositions rejects without prior wallet connection", async () => {
    await expect(
      caller.leverage.getPositions({ walletAddress: VALID_WALLET }),
    ).rejects.toThrow("Wallet not connected");
  });

  it("openPosition validates leverage range (1-100)", async () => {
    await expect(
      caller.leverage.openPosition({
        walletAddress: VALID_WALLET,
        contractAddress: VALID_CONTRACT,
        amount: 1,
        leverage: 150, // exceeds max
        solTip: 0.001,
      }),
    ).rejects.toThrow();
  });

  it("openPosition validates amount is positive", async () => {
    await expect(
      caller.leverage.openPosition({
        walletAddress: VALID_WALLET,
        contractAddress: VALID_CONTRACT,
        amount: -1, // negative
        leverage: 5,
        solTip: 0.001,
      }),
    ).rejects.toThrow();
  });

  it("closePosition validates tokenAmount range (1-100)", async () => {
    await expect(
      caller.leverage.closePosition({
        walletAddress: VALID_WALLET,
        tradeId: "fake-trade",
        solTip: 0.001,
        slippage: 1,
        tokenAmount: 200, // exceeds max
      }),
    ).rejects.toThrow();
  });

  it("checkWhitelist rejects without prior wallet connection", async () => {
    await expect(
      caller.leverage.checkWhitelist({
        walletAddress: VALID_WALLET,
        contractAddress: VALID_CONTRACT,
      }),
    ).rejects.toThrow("Wallet not connected");
  });

  it("requestWhitelist rejects without prior wallet connection", async () => {
    await expect(
      caller.leverage.requestWhitelist({
        walletAddress: VALID_WALLET,
        contractAddress: VALID_CONTRACT,
      }),
    ).rejects.toThrow("Wallet not connected");
  });
});

/* ------------------------------------------------------------------ */
/*  Session management                                                 */
/* ------------------------------------------------------------------ */

describe("session management", () => {
  it("resumeSession returns null when no cookie is present", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leverage.resumeSession();
    expect(result).toEqual({ walletAddress: null, tradeWallet: null });
  });

  it("resumeSession returns null for an invalid/expired JWT cookie", async () => {
    const ctx = createPublicContext("wallet_session=invalid-jwt-token");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leverage.resumeSession();
    expect(result).toEqual({ walletAddress: null, tradeWallet: null });
  });

  it("disconnectWallet clears the session cookie", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leverage.disconnectWallet({
      walletAddress: VALID_WALLET,
    });
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalledWith(
      "wallet_session",
      expect.objectContaining({ path: "/" }),
    );
  });

  it("disconnectWallet rejects invalid wallet address", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.disconnectWallet({ walletAddress: "bad" }),
    ).rejects.toThrow();
  });
});
