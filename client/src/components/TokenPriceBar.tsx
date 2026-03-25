import { useState, useMemo } from 'react';
import { NavArrowDownSolid, Search, Globe, OpenNewWindow, Copy } from 'iconoir-react';
import { useStore } from '@/lib/store';
import { formatPrice, formatPercent, formatCompact, truncateAddress } from '@/lib/format';
import { tokenTimeChanges } from '@/lib/mockData';
import { useLivePrices } from '@/hooks/useLivePrices';
import { TokenSearchModal } from './TokenSearchModal';
import { ScoreIndicator } from './ScoreIndicator';
import { TokenLogo } from './TokenLogo';
import { toast } from 'sonner';

export function TokenPriceBar() {
  const { selectedToken: storeToken } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const { allTokens } = useLivePrices();

  // Merge live price into the selected token
  const selectedToken = useMemo(() => {
    if (!storeToken) return null;
    const live = allTokens.find(t => t.symbol === storeToken.symbol);
    if (!live) return storeToken;
    return { ...storeToken, price: live.price, change24h: live.change24h, volume24h: live.volume24h, marketCap: live.marketCap };
  }, [storeToken, allTokens]);

  if (!selectedToken) return null;

  const isPositive = selectedToken.change24h >= 0;

  return (
    <>
      <div className="h-9 border-b border-border bg-card flex items-center px-2 sm:px-3 gap-1.5 sm:gap-2.5 shrink-0 text-[12px] overflow-x-auto scrollbar-none">
        {/* Token Identity — clickable to open search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-1 sm:gap-1.5 hover:bg-secondary/60 px-1 sm:px-1.5 py-0.5 -mx-1 sm:-mx-1.5 rounded transition-colors shrink-0 group"
        >
          <TokenLogo symbol={selectedToken.symbol} size={20} eager />
          <span className="text-[13px] sm:text-[14px] font-semibold text-foreground">
            {selectedToken.symbol}
          </span>
          <span className="hidden sm:inline text-[11px] text-muted-foreground">
            {selectedToken.name}
          </span>
          <NavArrowDownSolid className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>

        {/* Price */}
        <span className="text-[14px] sm:text-[16px] font-data font-bold text-foreground shrink-0 tracking-tight">
          {formatPrice(selectedToken.price)}
        </span>

        {/* 24h Change */}
        <span className={`text-[11px] sm:text-[12px] font-data font-semibold shrink-0 ${isPositive ? 'text-success' : 'text-destructive'}`}>
          {formatPercent(selectedToken.change24h)}
        </span>

        {/* Separator */}
        <div className="w-px h-4 bg-border shrink-0" />

        {/* Time-based Changes — hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {Object.entries(tokenTimeChanges).map(([period, change]) => (
            <TimeChange key={period} period={period} change={change} />
          ))}
        </div>

        {/* Separator — hidden on small */}
        <div className="hidden sm:block w-px h-4 bg-border shrink-0" />

        {/* Metrics Row */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <MetricItem label="MC" value={formatCompact(selectedToken.marketCap)} />
          <MetricItem label="VOL" value={formatCompact(selectedToken.volume24h)} />
          <span className="hidden md:inline"><MetricItem label="LIQ" value={formatCompact(selectedToken.liquidity)} /></span>
          <span className="hidden lg:inline"><MetricItem label="BUY VOL" value="$1.1M" accent="success" /></span>
          <span className="hidden lg:inline"><MetricItem label="SELL VOL" value="$1.1M" accent="destructive" /></span>
        </div>

        {/* Separator */}
        <div className="hidden md:block w-px h-4 bg-border shrink-0" />

        {/* Score — hidden on mobile */}
        <span className="hidden md:inline"><ScoreIndicator score={78} /></span>

        {/* Contract address — hidden on mobile */}
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(selectedToken.address);
              toast.success('Copied!');
            } catch {
              toast.error('Failed to copy');
            }
          }}
          className="hidden lg:flex items-center gap-1 text-[11px] font-data text-muted-foreground hover:text-foreground transition-colors shrink-0 badge-hover"
          title="Copy contract address"
        >
          <span>{truncateAddress(selectedToken.address, 4)}</span>
          <Copy className="w-2.5 h-2.5" />
        </button>

        {/* Social Links — hidden on mobile */}
        <div className="hidden lg:flex items-center gap-0.5 shrink-0">
          <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary icon-btn-hover" title="Website">
            <Globe className="w-3 h-3" />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary icon-btn-hover" title="Explorer">
            <OpenNewWindow className="w-3 h-3" />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Search hint — hidden on mobile */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0 btn-ghost-hover"
        >
          <Search className="w-3 h-3" />
          <kbd className="text-[9px] bg-secondary px-1.5 py-0.5 rounded font-data">⌘K</kbd>
        </button>

        {/* Mobile search icon */}
        <button
          onClick={() => setSearchOpen(true)}
          className="md:hidden text-muted-foreground hover:text-foreground transition-colors shrink-0 p-1"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        {/* Live indicator */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <div className="pulse-dot" />
          <span className="hidden sm:inline text-[10px] text-muted-foreground font-medium tracking-wider">LIVE</span>
        </div>
      </div>

      <TokenSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

function TimeChange({ period, change }: { period: string; change: number }) {
  const isPositive = change >= 0;
  return (
    <div className="flex items-center gap-1 shrink-0">
      <span className="text-[9px] text-muted-foreground tracking-wider font-medium">{period}</span>
      <span className={`text-[11px] font-data font-semibold ${isPositive ? 'text-success' : 'text-destructive'}`}>
        {isPositive ? '+' : ''}{change < 100 ? change.toFixed(2) : change.toFixed(0)}%
      </span>
    </div>
  );
}

function MetricItem({ label, value, accent }: { label: string; value: string; accent?: 'success' | 'destructive' }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <span className="text-[9px] text-muted-foreground tracking-wider font-medium">{label}</span>
      <span className={`text-[11px] sm:text-[12px] font-data ${accent === 'success' ? 'text-success' : accent === 'destructive' ? 'text-destructive' : 'text-foreground'}`}>
        {accent === 'success' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-success mr-0.5 align-middle" />}
        {accent === 'destructive' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive mr-0.5 align-middle" />}
        {value}
      </span>
    </div>
  );
}
