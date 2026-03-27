import { useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";

const AUTH_MESSAGE_PREFIX = "0xLeverage auth: ";

export function useWalletAuth() {
  const { publicKey, signMessage, disconnect: adapterDisconnect } = useWallet();
  const {
    connectWallet: storeConnect,
    disconnectWallet: storeDisconnect,
    walletConnected,
  } = useStore();

  const connectMutation = trpc.leverage.connectWallet.useMutation();
  const disconnectMutation = trpc.leverage.disconnectWallet.useMutation();

  const resumeQuery = trpc.leverage.resumeSession.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });

  const resumedRef = useRef(false);

  // When the resume query returns a valid session, restore state without a signature
  useEffect(() => {
    if (resumedRef.current || walletConnected) return;
    if (!resumeQuery.data) return;
    const { walletAddress, tradeWallet } = resumeQuery.data;
    if (walletAddress && tradeWallet) {
      resumedRef.current = true;
      storeConnect(walletAddress, tradeWallet);
    }
  }, [resumeQuery.data, walletConnected, storeConnect]);

  const connect = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error("Wallet not ready. Please connect your wallet first.");
    }

    const walletAddress = publicKey.toBase58();
    const timestamp = Date.now();
    const message = `${AUTH_MESSAGE_PREFIX}${timestamp}`;

    const encodedMessage = new TextEncoder().encode(message);
    const signatureBytes = await signMessage(encodedMessage);

    const signature = Buffer.from(signatureBytes).toString("base64");

    // Optimistic: show connected state immediately after signing
    // The server call may take a few seconds on cold starts
    storeConnect(walletAddress, '');

    // Attempt connection with one retry on timeout
    try {
      const result = await connectMutation.mutateAsync({
        walletAddress,
        signature,
        timestamp,
      });
      // Update with real trade wallet from server
      storeConnect(walletAddress, result.tradeWallet);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('imeout')) {
        const result = await connectMutation.mutateAsync({
          walletAddress,
          signature,
          timestamp,
        });
        storeConnect(walletAddress, result.tradeWallet);
        return result;
      }
      // Revert optimistic update on failure
      storeDisconnect();
      throw err;
    }
  }, [publicKey, signMessage, connectMutation, storeConnect, storeDisconnect]);

  const disconnect = useCallback(() => {
    const wallet = publicKey?.toBase58();
    if (wallet) {
      disconnectMutation.mutate({ walletAddress: wallet });
    }
    adapterDisconnect();
    storeDisconnect();
    resumedRef.current = false;
    // Prevent autoConnect from immediately reconnecting
    // Prevent autoConnect from immediately reconnecting
    try {
      localStorage.removeItem('walletName');
      localStorage.removeItem('walletAdapter');
      localStorage.removeItem('wallet-adapter-wallet');
    } catch { /* noop */ }
  }, [publicKey, adapterDisconnect, storeDisconnect, disconnectMutation]);

  const isSessionLoading = resumeQuery.isLoading;
  const sessionRestored = resumedRef.current || !!(
    resumeQuery.data?.walletAddress && resumeQuery.data?.tradeWallet
  );

  return {
    connect,
    disconnect,
    isConnecting: connectMutation.isPending,
    isSessionLoading,
    sessionRestored,
    error: connectMutation.error,
    walletAddress: publicKey?.toBase58() ?? null,
  };
}
