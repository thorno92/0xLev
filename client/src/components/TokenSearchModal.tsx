import { useState, useEffect, useRef } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const { allTokens } = useLivePrices();

  const filtered = allTokens.filter(
    (t) =>
      t.symbol.toLowerCase().includes(query.toLowerCase()) ||
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.address.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = (token: TokenInfo) => {
    setSelectedToken(token);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
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
      <DialogContent showCloseButton={false} className="sm:max-w-[480px] p-0 bg-card border-border gap-0 overflow-hidden mx-3 sm:mx-auto">
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
            className="border-0 bg-transparent h-11 text-[14px] focus-visible:ring-0 px-0"
          />
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              No tokens found
            </div>
          ) : (
            <div className="py-1">
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
