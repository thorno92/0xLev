/**
 * Hook to fetch live prices from the backend and merge with token metadata.
 * Uses CoinGecko as primary source, Jupiter as fallback for uncovered Solana tokens.
 * Refetches every 15 seconds to stay current.
 */
import { useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { allTokens, trendingTokens } from '@/lib/mockData';
import type { TokenInfo } from '@/lib/store';

/**
 * Returns allTokens with live prices merged in.
 * Falls back to mock prices if the API call fails or is loading.
 */
export function useLivePrices() {
  const { data: livePrices, isLoading, error, refetch } = trpc.prices.live.useQuery(undefined, {
    refetchInterval: 15_000,  // 15s — markets move fast
    staleTime: 12_000,
    retry: 2,
  });

  // Identify Solana tokens that CoinGecko didn't cover
  const missingMints = useMemo(() => {
    if (!livePrices) return [];
    const coveredSymbols = new Set(livePrices.map((p) => p.symbol));
    return allTokens
      .filter((t) => t.chain === 'solana' && !coveredSymbols.has(t.symbol))
      .map((t) => t.address);
  }, [livePrices]);

  // Jupiter fallback for uncovered Solana tokens
  const { data: jupiterFallback } = trpc.prices.jupiter.useQuery(
    { mints: missingMints },
    {
      enabled: missingMints.length > 0,
      refetchInterval: 15_000,
      staleTime: 12_000,
      retry: 1,
    },
  );

  const tokens = useMemo(() => {
    if (!livePrices || livePrices.length === 0) return allTokens;

    const priceMap = new Map<string, typeof livePrices[number]>();
    for (const p of livePrices) {
      priceMap.set(p.symbol, p);
    }

    // Build Jupiter address→price map for fallback
    const jupMap = new Map<string, { usdPrice: number; change24h?: number }>();
    if (jupiterFallback) {
      for (const [mint, info] of Object.entries(jupiterFallback)) {
        jupMap.set(mint, info);
      }
    }

    return allTokens.map((token): TokenInfo => {
      // Try CoinGecko first
      const live = priceMap.get(token.symbol);
      if (live) {
        return {
          ...token,
          price: live.price,
          change24h: live.change24h,
          volume24h: live.volume24h,
          marketCap: live.marketCap,
        };
      }

      // Try Jupiter fallback (by mint address)
      const jup = jupMap.get(token.address);
      if (jup && jup.usdPrice > 0) {
        return {
          ...token,
          price: jup.usdPrice,
          change24h: jup.change24h ?? token.change24h,
        };
      }

      return token;
    });
  }, [livePrices, jupiterFallback]);

  const trending = useMemo(() => {
    if (!livePrices || livePrices.length === 0) return trendingTokens;

    const priceMap = new Map<string, typeof livePrices[number]>();
    for (const p of livePrices) {
      priceMap.set(p.symbol, p);
    }

    return trendingTokens.map((token): TokenInfo => {
      const live = priceMap.get(token.symbol);
      if (!live) return token;
      return {
        ...token,
        price: live.price,
        change24h: live.change24h,
        volume24h: live.volume24h,
        marketCap: live.marketCap,
      };
    });
  }, [livePrices]);

  return {
    allTokens: tokens,
    trendingTokens: trending,
    isLoading,
    error,
    isLive: !!livePrices && livePrices.length > 0,
    refetch,
  };
}
