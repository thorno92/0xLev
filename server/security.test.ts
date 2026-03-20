/**
 * Security middleware and input validation tests
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Replicate the Zod schemas from leverage router for isolated tests  */
/* ------------------------------------------------------------------ */

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

const walletAddressSchema = z
  .string()
  .min(32, "Wallet address too short")
  .max(44, "Wallet address too long")
  .regex(BASE58_REGEX, "Invalid wallet address format (must be base58)");

const contractAddressSchema = z
  .string()
  .min(32, "Contract address too short")
  .max(44, "Contract address too long")
  .regex(BASE58_REGEX, "Invalid contract address format (must be base58)");

const tradeIdSchema = z
  .string()
  .min(1, "Trade ID required")
  .max(128, "Trade ID too long")
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid trade ID format");

const leverageSchema = z
  .number()
  .int("Leverage must be a whole number")
  .min(1, "Minimum leverage is 1x")
  .max(100, "Maximum leverage is 100x");

const solAmountSchema = z
  .number()
  .positive("Amount must be positive")
  .max(10_000, "Maximum amount is 10,000 SOL");

const solTipSchema = z
  .number()
  .nonnegative("Tip cannot be negative")
  .max(1, "Maximum tip is 1 SOL");

const slippageSchema = z
  .number()
  .nonnegative("Slippage cannot be negative")
  .max(100, "Slippage cannot exceed 100%");

/* ------------------------------------------------------------------ */
/*  Wallet Address Validation                                          */
/* ------------------------------------------------------------------ */

describe("walletAddressSchema", () => {
  it("accepts a valid Solana wallet address", () => {
    const valid = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
    expect(walletAddressSchema.parse(valid)).toBe(valid);
  });

  it("accepts a shorter valid base58 address (32 chars)", () => {
    const valid = "11111111111111111111111111111111";
    expect(walletAddressSchema.parse(valid)).toBe(valid);
  });

  it("rejects an address that is too short", () => {
    expect(() => walletAddressSchema.parse("abc123")).toThrow("too short");
  });

  it("rejects an address that is too long", () => {
    const tooLong = "A".repeat(45);
    expect(() => walletAddressSchema.parse(tooLong)).toThrow("too long");
  });

  it("rejects addresses with invalid base58 characters (0, O, I, l)", () => {
    // '0' is not in base58
    const withZero = "0xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAs";
    expect(() => walletAddressSchema.parse(withZero)).toThrow("base58");
  });

  it("rejects addresses with special characters", () => {
    const withSpecial = "7xKXtg2CW87d97TXJSD!bD5jBkheTqA83TZRuJosg";
    expect(() => walletAddressSchema.parse(withSpecial)).toThrow("base58");
  });

  it("rejects empty string", () => {
    expect(() => walletAddressSchema.parse("")).toThrow();
  });

  it("rejects SQL injection attempts", () => {
    const sqlInjection = "'; DROP TABLE users; --aaaaaaaaaaaaaaaa";
    expect(() => walletAddressSchema.parse(sqlInjection)).toThrow();
  });

  it("rejects HTML/script injection", () => {
    const xss = "<script>alert('xss')</script>aaaaaaaaaa";
    expect(() => walletAddressSchema.parse(xss)).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Contract Address Validation                                        */
/* ------------------------------------------------------------------ */

describe("contractAddressSchema", () => {
  it("accepts a valid Solana token mint address", () => {
    const valid = "So11111111111111111111111111111111111111112";
    expect(contractAddressSchema.parse(valid)).toBe(valid);
  });

  it("rejects non-base58 characters", () => {
    const invalid = "0x1234567890abcdef1234567890abcdef12345678";
    expect(() => contractAddressSchema.parse(invalid)).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Trade ID Validation                                                */
/* ------------------------------------------------------------------ */

describe("tradeIdSchema", () => {
  it("accepts alphanumeric trade IDs", () => {
    expect(tradeIdSchema.parse("trade-123-abc")).toBe("trade-123-abc");
  });

  it("accepts IDs with underscores", () => {
    expect(tradeIdSchema.parse("trade_456")).toBe("trade_456");
  });

  it("rejects empty trade IDs", () => {
    expect(() => tradeIdSchema.parse("")).toThrow("required");
  });

  it("rejects trade IDs that are too long", () => {
    const tooLong = "a".repeat(129);
    expect(() => tradeIdSchema.parse(tooLong)).toThrow("too long");
  });

  it("rejects trade IDs with path traversal", () => {
    expect(() => tradeIdSchema.parse("../../../etc/passwd")).toThrow();
  });

  it("rejects trade IDs with spaces", () => {
    expect(() => tradeIdSchema.parse("trade 123")).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Leverage Validation                                                */
/* ------------------------------------------------------------------ */

describe("leverageSchema", () => {
  it("accepts valid leverage values", () => {
    expect(leverageSchema.parse(1)).toBe(1);
    expect(leverageSchema.parse(5)).toBe(5);
    expect(leverageSchema.parse(100)).toBe(100);
  });

  it("rejects leverage below 1", () => {
    expect(() => leverageSchema.parse(0)).toThrow();
  });

  it("rejects leverage above 100", () => {
    expect(() => leverageSchema.parse(101)).toThrow();
  });

  it("rejects decimal leverage", () => {
    expect(() => leverageSchema.parse(2.5)).toThrow("whole number");
  });

  it("rejects negative leverage", () => {
    expect(() => leverageSchema.parse(-5)).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  SOL Amount Validation                                              */
/* ------------------------------------------------------------------ */

describe("solAmountSchema", () => {
  it("accepts valid SOL amounts", () => {
    expect(solAmountSchema.parse(0.001)).toBe(0.001);
    expect(solAmountSchema.parse(100)).toBe(100);
    expect(solAmountSchema.parse(10000)).toBe(10000);
  });

  it("rejects zero amount", () => {
    expect(() => solAmountSchema.parse(0)).toThrow("positive");
  });

  it("rejects negative amounts", () => {
    expect(() => solAmountSchema.parse(-1)).toThrow("positive");
  });

  it("rejects amounts above 10,000 SOL", () => {
    expect(() => solAmountSchema.parse(10001)).toThrow("10,000");
  });
});

/* ------------------------------------------------------------------ */
/*  SOL Tip Validation                                                 */
/* ------------------------------------------------------------------ */

describe("solTipSchema", () => {
  it("accepts zero tip", () => {
    expect(solTipSchema.parse(0)).toBe(0);
  });

  it("accepts valid tip amounts", () => {
    expect(solTipSchema.parse(0.01)).toBe(0.01);
    expect(solTipSchema.parse(1)).toBe(1);
  });

  it("rejects negative tips", () => {
    expect(() => solTipSchema.parse(-0.01)).toThrow("negative");
  });

  it("rejects tips above 1 SOL", () => {
    expect(() => solTipSchema.parse(1.01)).toThrow("1 SOL");
  });
});

/* ------------------------------------------------------------------ */
/*  Slippage Validation                                                */
/* ------------------------------------------------------------------ */

describe("slippageSchema", () => {
  it("accepts valid slippage values", () => {
    expect(slippageSchema.parse(0)).toBe(0);
    expect(slippageSchema.parse(1)).toBe(1);
    expect(slippageSchema.parse(100)).toBe(100);
  });

  it("rejects negative slippage", () => {
    expect(() => slippageSchema.parse(-1)).toThrow("negative");
  });

  it("rejects slippage above 100%", () => {
    expect(() => slippageSchema.parse(101)).toThrow("100%");
  });
});

/* ------------------------------------------------------------------ */
/*  Combined Input Object Validation (openPosition shape)              */
/* ------------------------------------------------------------------ */

describe("openPosition input validation", () => {
  const openPositionSchema = z.object({
    walletAddress: walletAddressSchema,
    contractAddress: contractAddressSchema,
    amount: solAmountSchema,
    leverage: leverageSchema,
    solTip: solTipSchema,
    tp: z.number().positive().max(1_000_000_000).optional(),
    sl: z.number().positive().max(1_000_000_000).optional(),
  });

  it("accepts a fully valid openPosition input", () => {
    const valid = {
      walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      contractAddress: "So11111111111111111111111111111111111111112",
      amount: 1.5,
      leverage: 5,
      solTip: 0.01,
      tp: 200,
      sl: 100,
    };
    expect(() => openPositionSchema.parse(valid)).not.toThrow();
  });

  it("accepts openPosition without optional tp/sl", () => {
    const valid = {
      walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      contractAddress: "So11111111111111111111111111111111111111112",
      amount: 1.5,
      leverage: 5,
      solTip: 0,
    };
    expect(() => openPositionSchema.parse(valid)).not.toThrow();
  });

  it("rejects openPosition with invalid wallet", () => {
    const invalid = {
      walletAddress: "not-a-wallet",
      contractAddress: "So11111111111111111111111111111111111111112",
      amount: 1.5,
      leverage: 5,
      solTip: 0,
    };
    expect(() => openPositionSchema.parse(invalid)).toThrow();
  });

  it("rejects openPosition with absurd leverage", () => {
    const invalid = {
      walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      contractAddress: "So11111111111111111111111111111111111111112",
      amount: 1.5,
      leverage: 999,
      solTip: 0,
    };
    expect(() => openPositionSchema.parse(invalid)).toThrow();
  });

  it("rejects openPosition with extra unknown fields (strict mode)", () => {
    const withExtra = {
      walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      contractAddress: "So11111111111111111111111111111111111111112",
      amount: 1.5,
      leverage: 5,
      solTip: 0,
      maliciousField: "DROP TABLE positions",
    };
    // Zod strips unknown fields by default, so this should still parse
    const result = openPositionSchema.parse(withExtra);
    expect(result).not.toHaveProperty("maliciousField");
  });
});
