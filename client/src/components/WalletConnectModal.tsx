/* ------------------------------------------------------------------ */
/*  Custom Wallet Connect Modal — terminal-styled                      */
/* ------------------------------------------------------------------ */

import { useMemo } from 'react';
import { useWallet, type Wallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Xmark } from 'iconoir-react';

interface WalletConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Solana-only wallets we want to show */
const SOLANA_WALLETS = new Set([
  'Phantom',
  'Solflare',
  'Backpack',
  'Glow',
  'Ledger',
  'Coinbase Wallet',
  'Trust Wallet',
  'Brave Wallet',
]);

/** EVM wallets — show but mark as incompatible */
const EVM_ONLY = new Set(['MetaMask']);

export function WalletConnectModal({ open, onOpenChange }: WalletConnectModalProps) {
  const { wallets, select } = useWallet();

  const handleSelect = (wallet: Wallet) => {
    const ready =
      wallet.readyState === WalletReadyState.Installed ||
      wallet.readyState === WalletReadyState.Loadable;

    if (EVM_ONLY.has(wallet.adapter.name)) {
      return; // Don't connect EVM wallets
    }

    if (ready) {
      select(wallet.adapter.name);
      onOpenChange(false);
    } else if (wallet.adapter.url) {
      window.open(wallet.adapter.url, '_blank', 'noopener');
    }
  };

  // Deduplicate wallets by adapter name
  const uniqueWallets = useMemo(() => {
    const seen = new Set<string>();
    return wallets.filter(w => {
      if (seen.has(w.adapter.name)) return false;
      seen.add(w.adapter.name);
      return true;
    });
  }, [wallets]);

  // Split into detected, installable, and EVM
  const detected: Wallet[] = [];
  const installable: Wallet[] = [];
  const evm: Wallet[] = [];

  for (const w of uniqueWallets) {
    if (EVM_ONLY.has(w.adapter.name)) {
      evm.push(w);
    } else if (
      SOLANA_WALLETS.has(w.adapter.name) &&
      (w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable)
    ) {
      detected.push(w);
    } else if (SOLANA_WALLETS.has(w.adapter.name)) {
      installable.push(w);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[380px] p-0 bg-card border-border gap-0 overflow-hidden mx-3 sm:mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/0xLev-Clean.png"
              alt="0xLeverage"
              className="h-6 w-auto"
              draggable={false}
            />
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground/50 hover:text-foreground transition-colors p-2 rounded hover:bg-secondary"
          >
            <Xmark className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Subtitle */}
        <div className="px-5 pb-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Connect your Solana wallet to start trading
          </p>
        </div>

        {/* Wallet list */}
        <div className="px-3 pb-2 max-h-[300px] overflow-y-auto">
          {/* Detected wallets */}
          {detected.map((wallet) => (
            <button
              key={wallet.adapter.name}
              onClick={() => handleSelect(wallet)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors text-left"
            >
              <img
                src={wallet.adapter.icon}
                alt={wallet.adapter.name}
                className="w-8 h-8 rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-foreground">{wallet.adapter.name}</div>
              </div>
              <span className="text-[11px] font-data text-success shrink-0">Detected</span>
            </button>
          ))}

          {/* Installable wallets */}
          {installable.map((wallet) => (
            <button
              key={wallet.adapter.name}
              onClick={() => handleSelect(wallet)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors text-left"
            >
              <img
                src={wallet.adapter.icon}
                alt={wallet.adapter.name}
                className="w-8 h-8 rounded-lg opacity-50"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-muted-foreground">{wallet.adapter.name}</div>
              </div>
              <span className="text-[11px] font-data text-primary shrink-0">Install →</span>
            </button>
          ))}

          {/* EVM wallets */}
          {evm.map((wallet) => (
            <div
              key={wallet.adapter.name}
              className="flex items-center gap-3 p-3 rounded-lg opacity-40 cursor-not-allowed"
              title="This app uses Solana — use Phantom or Solflare"
            >
              <img
                src={wallet.adapter.icon}
                alt={wallet.adapter.name}
                className="w-8 h-8 rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-muted-foreground">{wallet.adapter.name}</div>
                <div className="text-[10px] text-muted-foreground/50">Solana wallets only</div>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {detected.length === 0 && installable.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-[13px] text-muted-foreground mb-2">No Solana wallets found</p>
              <a
                href="https://phantom.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-primary hover:text-primary/80 transition-colors"
              >
                Install Phantom →
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground/40 text-center">
            By connecting, you agree to the Terms of Service
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
