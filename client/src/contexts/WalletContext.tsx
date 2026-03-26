import { useCallback, useMemo } from "react";
import type { Adapter } from "@solana/wallet-adapter-base";
import { WalletError } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { CoinbaseWalletAdapter } from "@solana/wallet-adapter-coinbase";
import { TrustWalletAdapter } from "@solana/wallet-adapter-trust";
import { toast } from "sonner";

import "@solana/wallet-adapter-react-ui/styles.css";

const SOLANA_RPC =
  import.meta.env.VITE_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

interface WalletContextProviderProps {
  children: React.ReactNode;
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new CoinbaseWalletAdapter(),
    new TrustWalletAdapter(),
  ], []);

  /**
   * `autoConnect` must be enabled for the stock WalletModal flow: it only calls `select()`,
   * then WalletProviderBase runs `adapter.connect()` via the auto-connect effect when this is true.
   * With `autoConnect={false}`, many wallets never connect and failures can look like the modal “just vanishes”.
   *
   * On first visit there is no stored wallet, so nothing connects until the user picks one. Returning
   * users get `adapter.autoConnect()` only when a wallet name is already in localStorage.
   */
  const onWalletError = useCallback((error: WalletError, adapter?: Adapter) => {
    console.error("[Wallet adapter]", adapter?.name, error);
    const label = adapter?.name ?? "Wallet";
    const message = error.message?.trim() || "Wallet connection failed";
    toast.error(message, {
      description:
        label === "MetaMask"
          ? "This app uses Solana. Try Phantom or Solflare, or enable Solana in MetaMask (Snap) if your build supports it."
          : undefined,
      duration: 10_000,
    });
  }, []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={wallets} autoConnect onError={onWalletError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
