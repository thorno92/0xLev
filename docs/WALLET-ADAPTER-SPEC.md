# Wallet Adapter Implementation Spec

> **Priority 1** — The final critical security gap. Wallet ownership is not yet verified.
> Without this, anyone can impersonate any wallet address.

---

## Overview

The Solana wallet adapter packages are **already installed** in `package.json`. This spec covers the three files that need to be built and the one server procedure that needs updating.

### Dependencies (already in package.json)

```
@solana/wallet-adapter-base       0.9.24
@solana/wallet-adapter-react      0.15.36
@solana/wallet-adapter-react-ui   0.9.36
@solana/wallet-adapter-wallets    0.19.33
@solana/web3.js                   1.98.2
tweetnacl                         (for signature verification)
```

If `tweetnacl` isn't installed: `pnpm add tweetnacl && pnpm add -D @types/tweetnacl`

---

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `client/src/contexts/WalletContext.tsx` | **CREATE** | Wraps the app with Solana wallet adapter providers |
| `client/src/hooks/useWalletAuth.ts` | **CREATE** | Sign-message flow → calls `trpc.leverage.connectWallet` |
| `server/routers/leverage.ts` | **MODIFY** | Add signature + timestamp params, verify with nacl |
| `client/src/lib/store.ts` | **MODIFY** | Update `connectWallet` action to accept `tradeWallet` |

---

## Step 1 — WalletContext.tsx

```typescript
// client/src/contexts/WalletContext.tsx

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

import "@solana/wallet-adapter-react-ui/styles.css";

// IMPORTANT: Use a private RPC for production (Helius, QuickNode, Triton, etc.)
// Public RPC is rate-limited and unreliable under load.
const SOLANA_RPC = import.meta.env.VITE_SOLANA_RPC_URL
  ?? "https://api.mainnet-beta.solana.com";

interface WalletContextProviderProps {
  children: React.ReactNode;
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      {/* autoConnect=false: don't leak wallet address via analytics on page load */}
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

Wrap the app in `client/src/App.tsx` or `client/src/main.tsx`:
```tsx
<WalletContextProvider>
  {/* existing ThemeProvider, tRPC QueryClientProvider, etc. */}
</WalletContextProvider>
```

---

## Step 2 — useWalletAuth.ts

```typescript
// client/src/hooks/useWalletAuth.ts

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";

const AUTH_MESSAGE_PREFIX = "0xLeverage auth: ";

export function useWalletAuth() {
  const { publicKey, signMessage, disconnect: adapterDisconnect } = useWallet();
  const { connectWallet: storeConnect, disconnectWallet: storeDisconnect } = useStore();

  const connectMutation = trpc.leverage.connectWallet.useMutation();

  /**
   * Full wallet connect flow:
   *  1. Generate timestamped message
   *  2. Request signature from wallet (Phantom/Solflare popup)
   *  3. Send walletAddress + signature + timestamp to server
   *  4. Server verifies signature via nacl, calls 0xL API, returns tradeWallet
   *  5. Update Zustand store
   */
  const connect = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error("Wallet not ready. Please connect your wallet first.");
    }

    const walletAddress = publicKey.toBase58();
    const timestamp = Date.now();
    const message = `${AUTH_MESSAGE_PREFIX}${timestamp}`;

    // Encode message as UTF-8 bytes for signing
    const encodedMessage = new TextEncoder().encode(message);

    // Triggers wallet popup — user must approve
    const signatureBytes = await signMessage(encodedMessage);

    // Convert to base64 for transport
    const signature = Buffer.from(signatureBytes).toString("base64");

    const result = await connectMutation.mutateAsync({
      walletAddress,
      signature,
      timestamp,
    });

    // Update global store with wallet + trade wallet
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
```

Update the Zustand store (`client/src/lib/store.ts`) to accept `tradeWallet`:
```typescript
connectWallet: (address: string, tradeWallet?: string) => void;

connectWallet: (address, tradeWallet) => set({
  walletConnected: true,
  walletAddress: address,
  tradeWallet: tradeWallet ?? null,
}),
```

---

## Step 3 — Update connectWallet Procedure (Server)

In `server/routers/leverage.ts`, the `connectWallet` procedure already accepts `signature` and `timestamp` params and has nacl verification logic. Verify these are active (not commented out):

```typescript
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

connectWallet: publicProcedure
  .input(
    z.object({
      walletAddress: walletAddressSchema,
      signature: z.string().min(1, "Signature required"),         // base64
      timestamp: z.number().int().positive("Invalid timestamp"),  // unix ms
    }),
  )
  .mutation(async ({ input, ctx }) => {
    // 1. Reject stale challenges (> 5 min prevents replay attacks)
    const AGE_LIMIT_MS = 5 * 60 * 1000;
    if (Date.now() - input.timestamp > AGE_LIMIT_MS) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Authentication challenge expired. Please try again.",
      });
    }

    // 2. Reconstruct the exact message that was signed
    const message = `0xLeverage auth: ${input.timestamp}`;
    const messageBytes = new TextEncoder().encode(message);

    // 3. Verify ed25519 signature via nacl
    let signatureValid = false;
    try {
      const publicKey = new PublicKey(input.walletAddress);
      const signatureBytes = Buffer.from(input.signature, "base64");
      signatureValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes(),
      );
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid signature format.",
      });
    }

    if (!signatureValid) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Signature verification failed.",
      });
    }

    // 4. Signature verified — call 0xL API to get JWT + tradeWallet
    const result = await api.checkWallet(input.walletAddress);
    return { success: true, tradeWallet: result.tradeWallet };
  }),
```

---

## Step 4 — Update UI Components

Replace mock wallet connections in `Header.tsx`, `Portfolio.tsx`, and `Positions.tsx`:

```typescript
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWalletAuth } from "@/hooks/useWalletAuth";

const { setVisible } = useWalletModal();
const { connect, disconnect, walletAddress, isConnecting } = useWalletAuth();

// Open wallet picker modal (Phantom / Solflare)
<button
  onClick={walletAddress ? disconnect : () => setVisible(true)}
  disabled={isConnecting}
>
  {isConnecting ? "Connecting..." : walletAddress ? truncateAddress(walletAddress) : "Connect Wallet"}
</button>
```

After the modal connects the wallet, trigger the sign-message flow:
```typescript
useEffect(() => {
  if (connected && publicKey && !walletAddress) {
    connect().catch(console.error);
  }
}, [connected, publicKey]);
```

---

## Step 5 — Handle JWT Expiry

JWTs expire after 12 hours. When a leverage API call returns an auth error:

1. The server clears the cached JWT for that wallet
2. Frontend catches the tRPC error and prompts re-authentication
3. User signs a new message → `connectWallet` is called again → fresh JWT

---

## CSP Note

The Solana RPC URL is already in the CSP `connect-src` directive in `server/security.ts`:
```
https://api.mainnet-beta.solana.com
```

If using a private RPC provider, add their domain to CSP as well.

---

## Security Properties After Implementation

| Property | Status |
|----------|--------|
| Proof of wallet ownership | nacl ed25519 signature verification |
| Replay attack prevention | 5-minute timestamp window |
| Message specificity | Domain-scoped prefix (`0xLeverage auth:`) prevents cross-app replay |
| Private key exposure | Never — only the detached signature leaves the wallet |
| Server-side JWT binding | JWT only issued after signature is verified |
| Account lockout | 10 failed attempts → 15-minute block (implemented in leverage.ts) |

---

## Testing Checklist

After implementation, verify:

- [ ] Phantom wallet connects and triggers sign-message popup
- [ ] Solflare wallet connects and triggers sign-message popup
- [ ] Rejecting the signature popup shows an error (not a crash)
- [ ] Expired timestamp (> 5 min old) is rejected by the server
- [ ] Invalid signature is rejected with `UNAUTHORIZED`
- [ ] Valid signature returns `tradeWallet` and updates the store
- [ ] Subsequent leverage calls work with the cached JWT
- [ ] Disconnect clears both wallet adapter and Zustand state
- [ ] Rate limiting still works (10 failures → lockout)
