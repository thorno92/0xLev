/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

/* ------------------------------------------------------------------ */
/*  0xLeverage Types                                                   */
/* ------------------------------------------------------------------ */

export interface WalletConnection {
  walletAddress: string;
  tradeWallet: string;
  connected: boolean;
}

export interface QuoteParams {
  contractAddress: string;
  leverage: number;
  initialAmount: number;
}

export interface QuoteResult {
  trade_cost: number;
  liquidation_price: number;
  current_price: number;
}

export interface OpenPositionParams {
  contractAddress: string;
  amount: number;
  leverage: number;
  solTip: number;
  tp?: number;
  sl?: number;
}

export interface LeveragePosition {
  trade_id: string;
  contract_address: string;
  leverage: number;
  amount: number;
  entry_price: number;
  current_price?: number;
  pnl?: number;
  tp?: number;
  sl?: number;
  [key: string]: unknown;
}

export interface ClosePositionParams {
  tradeId: string;
  solTip: number;
  slippage: number;
  tokenAmount?: number;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  contractAddress: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  logoUrl?: string;
}
