import { useMemo } from 'react';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useStore, type TokenInfo } from '@/lib/store';
import { formatPercent } from '@/lib/format';
import { TokenLogo } from './TokenLogo';
import { useLocation } from 'wouter';

function TokenPill({ token, isActive, onSelect }: {
  token: TokenInfo;
  isActive: boolean;
  onSelect: () => void;
}) {
  const isPositive = token.change24h >= 0;
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] whitespace-nowrap transition-all duration-100 shrink-0 ticker-item-hover ${
        isActive
          ? 'bg-primary/10 border border-primary/25 text-foreground'
          : 'bg-secondary/60 hover:bg-secondary border border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <TokenLogo symbol={token.symbol} size={14} eager />
      <span className="font-medium">{token.symbol}</span>
      <span className={`text-[9px] font-data px-1 py-px rounded ${
        isActive ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
      }`}>
        {token.chain.slice(0, 3).toUpperCase()}
      </span>
      <span className={`font-data text-[10px] ${isPositive ? 'text-success' : 'text-destructive'}`}>
        {formatPercent(token.change24h)}
      </span>
    </button>
  );
}

export function TrendingBar() {
  const { setSelectedToken, selectedToken } = useStore();
  const [, navigate] = useLocation();

  const handleSelect = (token: TokenInfo) => {
    setSelectedToken(token);
    navigate(`/terminal/${token.address}`);
  };

  const { allTokens: liveTokens } = useLivePrices();

  // Sort by absolute 24h change — biggest movers are "trending"
  const tokens = useMemo(() => {
    return [...liveTokens]
      .filter((t) => t.chain === 'solana')  // Solana-only for now
      .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
      .slice(0, 10);
  }, [liveTokens]);

  return (
    <div className="flex items-center gap-1.5 overflow-hidden">
      {/* Ticker container -- duplicated for seamless infinite scroll */}
      <div className="flex-1 overflow-hidden relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-card to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none" />

        <div className="ticker-track gap-1.5" style={{ '--ticker-duration': '40s' } as React.CSSProperties}>
          {/* First set */}
          {tokens.map((token) => (
            <TokenPill
              key={`a-${token.address}`}
              token={token}
              isActive={selectedToken?.address === token.address}
              onSelect={() => handleSelect(token)}
            />
          ))}
          {/* Duplicate for seamless loop */}
          {tokens.map((token) => (
            <TokenPill
              key={`b-${token.address}`}
              token={token}
              isActive={selectedToken?.address === token.address}
              onSelect={() => handleSelect(token)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
