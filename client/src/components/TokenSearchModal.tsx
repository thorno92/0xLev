import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, ArrowUpRightCircleSolid, ArrowDownRightCircleSolid } from 'iconoir-react';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useStore, type TokenInfo } from '@/lib/store';
import { formatPrice, formatPercent } from '@/lib/format';
import { TokenLogo } from './TokenLogo';

interface TokenSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TokenSearchModal({ open, onOpenChange }: TokenSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { setSelectedToken } = useStore();
  const [location, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { allTokens } = useLivePrices();

  const lowerQuery = query.toLowerCase();
  const filtered = allTokens.filter(
    (t) =>
      t.symbol.toLowerCase().includes(lowerQuery) ||
      t.name.toLowerCase().includes(lowerQuery) ||
      t.address.toLowerCase().includes(lowerQuery)
  );

  const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query.trim());
  const exactMatch = isSolanaAddress && filtered.some((t) => t.address === query.trim());
  const customToken: TokenInfo | null =
    isSolanaAddress && !exactMatch
      ? {
          symbol: query.trim().slice(0, 4) + '…',
          name: 'Unknown Token',
          address: query.trim(),
          price: 0,
          change24h: 0,
          volume24h: 0,
          marketCap: 0,
          liquidity: 0,
          chain: 'solana',
        }
      : null;

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = (token: TokenInfo) => {
    setSelectedToken(token);
    setLocation(`/terminal/${token.address}`);
    onOpenChange(false);
  };

  const resultsRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => {
        const next = Math.min(i + 1, filtered.length - 1);
        resultsRef.current?.children[0]?.children[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => {
        const next = Math.max(i - 1, 0);
        resultsRef.current?.children[0]?.children[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  };

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[480px] p-0 bg-card border-border gap-0 overflow-hidden mx-3 sm:mx-auto focus:outline-none focus-visible:outline-none focus-visible:ring-0">
        {/* Search Input */}
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            placeholder="Search tokens by name, symbol, or address..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="border-0 bg-transparent h-14 text-[14px] focus-visible:ring-0 focus:outline-none focus-visible:outline-none px-0"
          />
          <button
            onClick={() => onOpenChange(false)}
            className="text-[10px] font-data text-muted-foreground/60 hover:text-foreground transition-colors px-1.5 py-0.5 rounded bg-secondary/60 hover:bg-secondary shrink-0"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto">
          {filtered.length === 0 && !customToken ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              No tokens found
            </div>
          ) : (
            <div className="py-1">
              {customToken && (
                <button
                  onClick={() => handleSelect(customToken)}
                  className={`w-full flex items-center gap-3 px-4 py-3 sm:py-2.5 text-left transition-colors active:bg-secondary ${
                    filtered.length === 0 ? 'bg-secondary' : 'hover:bg-secondary/50'
                  } border-b border-border`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">?</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground">Use contract address</div>
                    <div className="text-[10px] text-muted-foreground font-data truncate">{query.trim()}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary border border-border">
                    Custom
                  </div>
                </button>
              )}
              {filtered.map((token, i) => {
                const isPositive = token.change24h >= 0;
                return (
                  <button
                    key={token.address}
                    onClick={() => handleSelect(token)}
                    className={`w-full flex items-center gap-3 px-4 py-3 sm:py-2.5 text-left transition-colors active:bg-secondary ${
                      i === selectedIndex ? 'bg-secondary' : 'hover:bg-secondary/50'
                    }`}
                  >
                    <TokenLogo symbol={token.symbol} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground">
                          {token.symbol}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {token.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-data px-1 py-px rounded bg-secondary text-muted-foreground">
                          {token.chain.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-data text-foreground">
                        {formatPrice(token.price)}
                      </div>
                      <div className={`text-[11px] font-data flex items-center justify-end gap-0.5 ${
                        isPositive ? 'text-success' : 'text-destructive'
                      }`}>
                        {isPositive ? <ArrowUpRightCircleSolid className="w-3 h-3" /> : <ArrowDownRightCircleSolid className="w-3 h-3" />}
                        {formatPercent(token.change24h)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="hidden sm:flex px-4 py-2 border-t border-border items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="bg-secondary px-1 py-0.5 rounded font-data">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-secondary px-1 py-0.5 rounded font-data">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-secondary px-1 py-0.5 rounded font-data">⌘K</kbd>
            Toggle
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
