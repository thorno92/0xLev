/**
 * Server-side tests for the leverage router and auth procedures.
 * These validate the tRPC procedures that power the redesigned pages.
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/* ------------------------------------------------------------------ */
/*  Valid-looking Solana addresses for test fixtures                    */
/* ------------------------------------------------------------------ */
const VALID_WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const VALID_CONTRACT = "So11111111111111111111111111111111111111112";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    requestId: "test-req-id",
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "oauth",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    requestId: "test-req-id",
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user data for authenticated users", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Test User");
    expect(result?.email).toBe("test@example.com");
    expect(result?.role).toBe("user");
  });
});

describe("leverage.health", () => {
  it("returns a health status object", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leverage.health();
    // Should return an object (either { ok: true/false } or API response)
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});

describe("leverage.connectWallet", () => {
  it("rejects empty wallet address", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.connectWallet({
        walletAddress: "",
        signature: "dGVzdA==",
        timestamp: Date.now(),
      })
    ).rejects.toThrow();
  });

  it("rejects wallet address with invalid base58 characters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.connectWallet({
        walletAddress: "0xInvalidEthStyleAddress000000000000000000",
        signature: "dGVzdA==",
        timestamp: Date.now(),
      })
    ).rejects.toThrow();
  });

  it("rejects wallet address that is too short", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.connectWallet({
        walletAddress: "abc",
        signature: "dGVzdA==",
        timestamp: Date.now(),
      })
    ).rejects.toThrow();
  });

  it("rejects expired timestamp (> 5 minutes)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.connectWallet({
        walletAddress: VALID_WALLET,
        signature: "dGVzdA==",
        timestamp: Date.now() - 6 * 60 * 1000,
      })
    ).rejects.toThrow("expired");
  });

  it("rejects invalid signature format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.connectWallet({
        walletAddress: VALID_WALLET,
        signature: "not-valid-base64-sig",
        timestamp: Date.now(),
      })
    ).rejects.toThrow();
  });
});

describe("leverage.getQuote", () => {
  it("rejects when wallet is not connected (no cached JWT)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Use a valid-format address that has no cached JWT
    await expect(
      caller.leverage.getQuote({
        walletAddress: VALID_WALLET,
        contractAddress: VALID_CONTRACT,
        leverage: 5,
        initialAmount: 1,
      })
    ).rejects.toThrow("Wallet not connected");
  });

  it("rejects invalid contract address format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.getQuote({
        walletAddress: VALID_WALLET,
        contractAddress: "not-valid",
        leverage: 5,
        initialAmount: 1,
      })
    ).rejects.toThrow();
  });

  it("rejects leverage above maximum", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.getQuote({
        walletAddress: VALID_WALLET,
        contractAddress: VALID_CONTRACT,
        leverage: 200,
        initialAmount: 1,
      })
    ).rejects.toThrow();
  });

  it("rejects negative initial amount", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.getQuote({
        walletAddress: VALID_WALLET,
        contractAddress: VALID_CONTRACT,
        leverage: 5,
        initialAmount: -1,
      })
    ).rejects.toThrow();
  });
});

describe("leverage.getPositions", () => {
  it("rejects when wallet is not connected", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Use a valid-format address that has no cached JWT
    await expect(
      caller.leverage.getPositions({ walletAddress: VALID_WALLET })
    ).rejects.toThrow("Wallet not connected");
  });

  it("rejects invalid wallet address format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.getPositions({ walletAddress: "not-a-wallet" })
    ).rejects.toThrow();
  });
});

describe("leverage.closePosition", () => {
  it("rejects when wallet is not connected", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Use a valid-format address + valid trade ID that has no cached JWT
    await expect(
      caller.leverage.closePosition({
        walletAddress: VALID_WALLET,
        tradeId: "test-trade-123",
        solTip: 0,
        slippage: 1,
        tokenAmount: 100,
      })
    ).rejects.toThrow("Wallet not connected");
  });

  it("rejects invalid trade ID format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.closePosition({
        walletAddress: VALID_WALLET,
        tradeId: "../../../etc/passwd",
        solTip: 0,
        slippage: 1,
        tokenAmount: 100,
      })
    ).rejects.toThrow();
  });

  it("rejects negative tip", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.closePosition({
        walletAddress: VALID_WALLET,
        tradeId: "test-trade-123",
        solTip: -0.5,
        slippage: 1,
        tokenAmount: 100,
      })
    ).rejects.toThrow();
  });

  it("rejects slippage above 100%", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leverage.closePosition({
        walletAddress: VALID_WALLET,
        tradeId: "test-trade-123",
        solTip: 0,
        slippage: 150,
        tokenAmount: 100,
      })
    ).rejects.toThrow();
  });
});
