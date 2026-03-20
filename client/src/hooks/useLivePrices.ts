/**
 * Hook to fetch live prices from the backend and merge with token metadata.
 * Refetches every 30 seconds to stay current.
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
    refetchInterval: 30_000, // refetch every 30s
    staleTime: 25_000,
    retry: 2,
  });

  const tokens = useMemo(() => {
    if (!livePrices || livePrices.length === 0) return allTokens;

    const priceMap = new Map<string, typeof livePrices[number]>();
    for (const p of livePrices) {
      priceMap.set(p.symbol, p);
    }

    return allTokens.map((token): TokenInfo => {
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
