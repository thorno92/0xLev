import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useStore } from "@/lib/store";

/**
 * Polls the trade wallet SOL balance via the upstream API and syncs it
 * to the store. Call once per view that displays balance.
 */
export function useTradeWalletBalance() {
  const walletAddress = useStore((s) => s.walletAddress);
  const walletConnected = useStore((s) => s.walletConnected);
  const setWalletBalance = useStore((s) => s.setWalletBalance);

  const { data } = trpc.leverage.getSolBalance.useQuery(
    { walletAddress: walletAddress! },
    {
      enabled: !!walletAddress && walletConnected,
      refetchInterval: 15_000,
      staleTime: 10_000,
      retry: 1,
    },
  );

  useEffect(() => {
    if (data?.balance_sol != null) {
      setWalletBalance(data.balance_sol);
    }
  }, [data?.balance_sol, setWalletBalance]);
}
