/**
 * 0xLeverage API Configuration
 * 
 * Base URL: https://api.0xleverage.io
 * 
 * This module provides the API client configuration for the 0xLeverage trading platform.
 * Currently configured for frontend-only mode with mock data.
 * When the backend is ready, swap mock data calls for real API calls using these endpoints.
 */

export const API_BASE_URL = 'https://api.0xleverage.io';

/**
 * API Endpoints Reference (from Leverage API Developer Docs)
 * 
 * Token Data:
 *   GET  /tokens/trending          - Get trending tokens
 *   GET  /tokens/:address          - Get token info by contract address
 *   GET  /tokens/:address/chart    - Get OHLCV chart data
 *   GET  /tokens/:address/holders  - Get holder distribution
 *   GET  /tokens/:address/txns     - Get recent transactions
 * 
 * Trading:
 *   POST /trade/open               - Open a leveraged position
 *   POST /trade/close              - Close a position
 *   GET  /trade/positions           - Get open positions for a wallet
 *   GET  /trade/history             - Get trade history for a wallet
 * 
 * Market:
 *   GET  /market/overview           - Market overview stats
 *   GET  /market/top-traders        - Top traders leaderboard
 *   GET  /market/new-listings       - Newly bonded tokens
 * 
 * Wallet:
 *   GET  /wallet/:address/balance   - Get wallet balance
 *   GET  /wallet/:address/rakeback  - Get rakeback info
 *   POST /wallet/:address/rakeback/claim - Claim rakeback
 * 
 * Whitelist:
 *   GET  /whitelist/:address/status - Check whitelist status
 *   POST /whitelist/request         - Request whitelist for a token
 */

// Helper to build full API URLs
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// Standard fetch wrapper with error handling (for future use)
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Typed API methods (ready to use when backend is live)
export const api = {
  // Token endpoints
  getTrendingTokens: () => apiFetch('/tokens/trending'),
  getTokenInfo: (address: string) => apiFetch(`/tokens/${address}`),
  getTokenChart: (address: string, interval?: string) => 
    apiFetch(`/tokens/${address}/chart${interval ? `?interval=${interval}` : ''}`),
  getTokenHolders: (address: string) => apiFetch(`/tokens/${address}/holders`),
  getTokenTransactions: (address: string) => apiFetch(`/tokens/${address}/txns`),

  // Trading endpoints
  openPosition: (data: { wallet: string; token: string; amount: number; leverage: number; side: string }) =>
    apiFetch('/trade/open', { method: 'POST', body: JSON.stringify(data) }),
  closePosition: (data: { wallet: string; tradeId: string }) =>
    apiFetch('/trade/close', { method: 'POST', body: JSON.stringify(data) }),
  getPositions: (wallet: string) => apiFetch(`/trade/positions?wallet=${wallet}`),
  getTradeHistory: (wallet: string) => apiFetch(`/trade/history?wallet=${wallet}`),

  // Market endpoints
  getMarketOverview: () => apiFetch('/market/overview'),
  getTopTraders: () => apiFetch('/market/top-traders'),
  getNewListings: () => apiFetch('/market/new-listings'),

  // Wallet endpoints
  getWalletBalance: (address: string) => apiFetch(`/wallet/${address}/balance`),
  getRakeback: (address: string) => apiFetch(`/wallet/${address}/rakeback`),
  claimRakeback: (address: string) => 
    apiFetch(`/wallet/${address}/rakeback/claim`, { method: 'POST' }),

  // Whitelist endpoints
  getWhitelistStatus: (address: string) => apiFetch(`/whitelist/${address}/status`),
  requestWhitelist: (data: { wallet: string; token: string }) =>
    apiFetch('/whitelist/request', { method: 'POST', body: JSON.stringify(data) }),
};
