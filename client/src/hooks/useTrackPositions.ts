import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useStore, type OpenPosition } from "@/lib/store";
import { allTokens } from "@/lib/mockData";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const tokenByAddress = new Map(allTokens.map((t) => [t.address, t]));

function symbolForAddress(addr: string): string {
  return tokenByAddress.get(addr)?.symbol ?? addr.slice(0, 6);
}

function calcLiquidationPrice(
  entryPriceUsd: number,
  leverage: number,
  side: "buy" | "sell",
): number {
  if (leverage <= 1 || entryPriceUsd <= 0) return 0;
  return side === "buy"
    ? entryPriceUsd * (1 - 1 / leverage)
    : entryPriceUsd * (1 + 1 / leverage);
}

/* ------------------------------------------------------------------ */
/*  Jupiter USD price fetcher — retry-hardened                         */
/* ------------------------------------------------------------------ */

const JUPITER_MAX_RETRIES = 2;
const JUPITER_RETRY_BASE_MS = 800;

/**
 * Fetch Jupiter USD prices via the server-side proxy.
 * Retries up to 2 times with exponential backoff.
 * Returns empty map on failure — callers keep previous values.
 */
async function fetchJupiterUsd(
  utils: ReturnType<typeof trpc.useUtils>,
  mints: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (mints.length === 0) return map;

  for (let attempt = 0; attempt <= JUPITER_MAX_RETRIES; attempt++) {
    try {
      const data = await utils.prices.jupiter.fetch(
        { mints },
        { staleTime: 0 },
      );
      for (const [mint, info] of Object.entries(data)) {
        if (info.usdPrice > 0) map.set(mint, info.usdPrice);
      }
      if (map.size > 0) return map;
    } catch {
      if (attempt < JUPITER_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, JUPITER_RETRY_BASE_MS * (attempt + 1)));
      }
    }
  }
  return map;
}

/**
 * 1. Syncs server-side positions into the Zustand store on initial load.
 * 2. Polls trackTrade + Jupiter for live P&L and MARK prices.
 *
 * The upstream API returns all values in SOL denomination.
 * We convert to USD using the live SOL/USD rate from Jupiter.
 */
export function useTrackPositions() {
  const walletAddress = useStore((s) => s.walletAddress);
  const walletConnected = useStore((s) => s.walletConnected);
  const openPositions = useStore((s) => s.openPositions);
  const setOpenPositions = useStore((s) => s.setOpenPositions);
  const updatePositionProfit = useStore((s) => s.updatePositionProfit);
  const utils = trpc.useUtils();

  const positionsRef = useRef(openPositions);
  positionsRef.current = openPositions;

  const syncedRef = useRef<string | null>(null);

  // ── Sync server positions into the store once per wallet connection ──
  useEffect(() => {
    if (!walletAddress || !walletConnected) return;
    if (syncedRef.current === walletAddress) return;

    let cancelled = false;

    (async () => {
      try {
        const result = await utils.leverage.getPositions.fetch({
          walletAddress,
        });
        if (cancelled || !result?.positions) return;

        const serverPositions = result.positions as Array<Record<string, unknown>>;
        const existing = new Map(
          positionsRef.current.map((p) => [p.trade_id, p]),
        );

        // Fetch SOL/USD + all position token USD prices in one call
        const allMints = [
          SOL_MINT,
          ...serverPositions.map((sp) => sp.contract_address as string),
        ];
        const jupUsd = await fetchJupiterUsd(utils, [...new Set(allMints)]);
        const solUsd = jupUsd.get(SOL_MINT) ?? 0;

        const merged: OpenPosition[] = serverPositions.map((sp) => {
          const tradeId = sp.trade_id as string;
          const prev = existing.get(tradeId);
          const contractAddr = sp.contract_address as string;
          const rawEntrySol = sp.entryPrice as number;
          const leverage = sp.leverage as number;
          const side = prev?.side ?? "buy";

          // Never overwrite a valid price with zero — prefer previous value
          const entryUsd = solUsd > 0 && rawEntrySol > 0
            ? rawEntrySol * solUsd
            : (prev?.entryPrice ?? 0) > 0
              ? prev!.entryPrice
              : 0;

          // Prefer fresh Jupiter price, fall back to previous if valid
          const freshJup = jupUsd.get(contractAddr);
          const currentUsd = (freshJup && freshJup > 0)
            ? freshJup
            : (prev?.currentPrice ?? 0) > 0
              ? prev!.currentPrice
              : undefined;

          return {
            trade_id: tradeId,
            symbol: (sp.symbol as string | undefined) ?? prev?.symbol ?? symbolForAddress(contractAddr),
            contract_address: contractAddr,
            amount: sp.amount as number,
            leverage,
            entryPrice: entryUsd,
            currentPrice: currentUsd,
            liveProfit: prev?.liveProfit ?? (sp.liveProfit as number | undefined),
            liveProfitPercent: prev?.liveProfitPercent,
            liquidationPrice: entryUsd > 0 ? calcLiquidationPrice(entryUsd, leverage, side) : prev?.liquidationPrice,
            side,
            openedAt: (sp.openedAt as number | undefined) ?? prev?.openedAt ?? Date.now(),
            tp: (sp.tp as number | undefined) ?? prev?.tp,
            sl: (sp.sl as number | undefined) ?? prev?.sl,
          };
        });

        for (const local of positionsRef.current) {
          if (!serverPositions.some((sp) => sp.trade_id === local.trade_id)) {
            merged.push(local);
          }
        }

        if (cancelled) return;
        setOpenPositions(merged);
        syncedRef.current = walletAddress;
      } catch {
        // Will retry on next mount
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, walletConnected, utils, setOpenPositions]);

  useEffect(() => {
    if (!walletConnected) {
      syncedRef.current = null;
    }
  }, [walletConnected]);

  const hasPositions = openPositions.length > 0;

  // ── Poll loop: live MARK (USD) + P&L ──
  const pollingRef = useRef(false);

  useEffect(() => {
    if (!walletAddress || !walletConnected || !hasPositions) return;

    let cancelled = false;

    async function poll() {
      if (cancelled || pollingRef.current) return;
      pollingRef.current = true;

      try {
        const positions = positionsRef.current;

        // Fetch Jupiter USD prices for all position tokens + SOL
        const mints = [...new Set(positions.map((p) => p.contract_address))];
        if (!mints.includes(SOL_MINT)) mints.push(SOL_MINT);
        const jupUsd = await fetchJupiterUsd(utils, mints);
        if (cancelled) return;
        const solUsd = jupUsd.get(SOL_MINT) ?? 0;

        // If SOL/USD is unavailable, we can't convert P&L from SOL→USD.
        // Still update MARK prices from Jupiter (those are already USD).
        if (solUsd <= 0) {
          for (const pos of positions) {
            const jupPrice = jupUsd.get(pos.contract_address);
            if (jupPrice && jupPrice > 0) {
              updatePositionProfit(
                pos.trade_id,
                pos.liveProfit ?? 0,
                pos.liveProfitPercent ?? 0,
                jupPrice,
              );
            }
          }
          return;
        }

        // Fire all trackTrade calls in parallel
        const results = await Promise.allSettled(
          positions.map((pos) =>
            utils.leverage.trackTrade.fetch({
              walletAddress: walletAddress!,
              tradeId: pos.trade_id,
            }),
          ),
        );

        if (cancelled) return;

        for (let i = 0; i < positions.length; i++) {
          const pos = positions[i];
          const settled = results[i];

          // MARK price: Jupiter USD directly (no conversion needed)
          const jupPrice = jupUsd.get(pos.contract_address);
          const bestPrice = jupPrice ?? pos.currentPrice;
          if (!bestPrice) continue; // no price at all — skip

          if (settled.status === "fulfilled" && settled.value) {
            // liveProfit from API is in SOL — convert to USD
            const rawProfitSol = settled.value.liveProfit ?? 0;
            const profitUsd = solUsd > 0 ? rawProfitSol * solUsd : rawProfitSol;
            const pnlPct =
              pos.amount > 0 && pos.entryPrice > 0
                ? (profitUsd / (pos.amount * pos.entryPrice)) * 100
                : 0;
            updatePositionProfit(pos.trade_id, profitUsd, pnlPct, bestPrice);
          } else {
            // trackTrade failed — still update MARK if we have Jupiter data
            if (jupPrice) {
              updatePositionProfit(
                pos.trade_id,
                pos.liveProfit ?? 0,
                pos.liveProfitPercent ?? 0,
                jupPrice,
              );
            }
            // trackTrade rejected — silent, will retry next poll
          }
        }
      } finally {
        pollingRef.current = false;
      }
    }

    poll();
    const id = setInterval(poll, 5_000);  // 5s — positions need fast updates
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [walletAddress, walletConnected, hasPositions, utils, updatePositionProfit]);
}
