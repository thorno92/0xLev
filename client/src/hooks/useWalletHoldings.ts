import { useEffect, useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { trpc } from "@/lib/trpc";
import { useStore } from "@/lib/store";

const RPC_URL =
  import.meta.env.VITE_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export interface Holding {
  symbol: string;
  name: string;
  ticker: string;
  mint: string;
  amount: number;
  price: number;
  change: number;
  value: number;
  logoUrl?: string;
}

function resolveImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("ipfs://")) {
    return `https://cf-ipfs.com/ipfs/${url.slice(7)}`;
  }
  return url;
}

interface DASItem {
  id: string;
  interface: string;
  content?: {
    metadata?: { name?: string; symbol?: string };
    links?: { image?: string };
    files?: { uri?: string; mime?: string }[];
  };
  token_info?: {
    balance?: number;
    decimals?: number;
    price_info?: { price_per_token?: number };
  };
}

interface DASResult {
  items?: DASItem[];
  nativeBalance?: {
    lamports: number;
    price_per_sol?: number;
  };
}

export function useWalletHoldings() {
  const { publicKey, connected } = useWallet();
  const storeAddress = useStore((s) => s.walletAddress);
  const storeConnected = useStore((s) => s.walletConnected);
  // Use the AUTHENTICATED address from store, not the adapter's live publicKey
  // This prevents showing data from wallets the user cycles to in Phantom
  const effectiveAddress = storeConnected ? storeAddress : null;
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!effectiveAddress || !storeConnected) {
      setHoldings([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    async function fetchHoldings() {
      try {
        const res = await fetch(RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "wallet-holdings",
            method: "getAssetsByOwner",
            params: {
              ownerAddress: effectiveAddress!,
              displayOptions: {
                showFungible: true,
                showNativeBalance: true,
              },
            },
          }),
        });

        const json = await res.json();
        if (cancelled) return;

        const dasResult: DASResult = json.result ?? {};
        const items = dasResult.items ?? [];
        const nativeBalance = dasResult.nativeBalance;

        const result: Holding[] = [];

        if (nativeBalance && nativeBalance.lamports > 0) {
          const solAmount = nativeBalance.lamports / 1e9;
          const solPrice = nativeBalance.price_per_sol ?? 0;
          result.push({
            symbol: "SOL",
            name: "Solana",
            ticker: "SOL",
            mint: "So11111111111111111111111111111111111111112",
            amount: solAmount,
            price: solPrice,
            change: 0,
            value: solAmount * solPrice,
          });
        }

        const needsPricing: string[] = [];

        for (const item of items) {
          if (
            item.interface !== "FungibleToken" &&
            item.interface !== "FungibleAsset"
          )
            continue;

          const ti = item.token_info;
          if (!ti) continue;

          const decimals = ti.decimals ?? 0;
          const amount = (ti.balance ?? 0) / Math.pow(10, decimals);
          if (amount <= 0) continue;

          const price = ti.price_info?.price_per_token ?? 0;
          const symbol =
            item.content?.metadata?.symbol ?? item.id.slice(0, 4) + "…";
          const name = item.content?.metadata?.name ?? "Unknown Token";

          result.push({
            symbol,
            name,
            ticker: symbol,
            mint: item.id,
            amount,
            price,
            change: 0,
            value: amount * price,
            logoUrl: resolveImageUrl(
              item.content?.links?.image ||
              item.content?.files?.[0]?.uri,
            ),
          });

          if (price === 0) needsPricing.push(item.id);
        }

        if (needsPricing.length > 0 && !cancelled) {
          try {
            const jupData = await utils.prices.jupiter.fetch({ mints: needsPricing });
            for (const h of result) {
              const jp = jupData[h.mint];
              if (h.price === 0 && jp?.usdPrice) {
                h.price = jp.usdPrice;
                h.value = h.amount * h.price;
              }
            }
          } catch {
            // Jupiter unavailable — holdings keep DAS prices
          }
        }

        result.sort((a, b) => b.value - a.value);
        if (!cancelled) setHoldings(result);
      } catch (err) {
        console.error("[useWalletHoldings] fetch failed", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchHoldings();
    const id = setInterval(fetchHoldings, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [effectiveAddress, storeConnected]);

  const totalValue = useMemo(
    () => holdings.reduce((s, h) => s + h.value, 0),
    [holdings],
  );

  return { holdings, totalValue, isLoading, isEmpty: holdings.length === 0 };
}
