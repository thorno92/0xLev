import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";

const AUTH_MESSAGE_PREFIX = "0xLeverage auth: ";

export function useWalletAuth() {
  const { publicKey, signMessage, disconnect: adapterDisconnect } = useWallet();
  const { connectWallet: storeConnect, disconnectWallet: storeDisconnect } = useStore();

  const connectMutation = trpc.leverage.connectWallet.useMutation();

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

    const result = await connectMutation.mutateAsync({
      walletAddress,
      signature,
      timestamp,
    });

    storeConnect(walletAddress, result.tradeWallet);

    return result;
  }, [publicKey, signMessage, connectMutation, storeConnect]);

  const disconnect = useCallback(() => {
    adapterDisconnect();
    storeDisconnect();
  }, [adapterDisconnect, storeDisconnect]);

  return {
    connect,
    disconnect,
    isConnecting: connectMutation.isPending,
    error: connectMutation.error,
    walletAddress: publicKey?.toBase58() ?? null,
  };
}
