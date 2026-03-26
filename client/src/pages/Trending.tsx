/*
 * TRENDING -- Swiss Precision Design
 * Monospace labels, flat surfaces, hairline borders, data-first table.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PullToRefresh } from '@/components/PullToRefresh';
import { PageTransition, StaggerContainer } from '@/components/PageTransition';
import { Header } from '@/components/Header';
import { useLivePrices } from '@/hooks/useLivePrices';
import { formatPrice, formatPercent, formatCompact } from '@/lib/format';
import { useStore, type Chain, type TokenInfo } from '@/lib/store';
import { useLocation } from 'wouter';
import { TokenLogo } from '@/components/TokenLogo';
import { SkeletonTable, SkeletonCard } from '@/components/Skeleton';
import { MiniSparkline, generateSparklineData } from '@/components/MiniSparkline';
import { toast } from 'sonner';
import { useFavorites } from '@/hooks/useFavorites';
import { WhitelistButton } from '@/components/WhitelistButton';
import { FilterSolid } from 'iconoir-react';
import { type ScreenerFilters, emptyFilters, ScreenerFilterDialog } from '@/components/ScreenerFilters';
import { networkIcons } from '@web3icons/react';
const { NetworkSolana, NetworkEthereum, NetworkBase, NetworkBinanceSmartChain } = networkIcons;

const chainNetworkIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  solana: NetworkSolana,
  ethereum: NetworkEthereum,
  bnb: NetworkBinanceSmartChain,
  base: NetworkBase,
};

const filterNetworkIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Solana: NetworkSolana,
  Ethereum: NetworkEthereum,
  BNB: NetworkBinanceSmartChain,
  Base: NetworkBase,
};

const timeFilters = ['Trending', '5M', '1H', '24H', 'Top', 'Gainers', 'Favorites'] as const;
const networkFilters = ['All', 'Solana', 'Ethereum', 'BNB', 'Base'] as const;
const networkToChain: Record<string, Chain | 'all'> = {
  'All': 'all', 'Solana': 'solana', 'Ethereum': 'ethereum', 'BNB': 'bnb', 'Base': 'base',
};

/* ---- Screener Filters -- imported from @/components/ScreenerFilters ---- */

function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getHeatColor(value: number, positive: boolean): string {
  const intensity = Math.min(Math.abs(value) / 30, 1);
  // Muted sage green and coral red matching the global palette
  return positive
    ? `rgba(92, 184, 138, ${0.03 + intensity * 0.08})`
    : `rgba(212, 117, 107, ${0.03 + intensity * 0.08})`;
}

export default function Trending() {
  const { setSelectedToken } = useStore();
  const [, navigate] = useLocation();
  const { allTokens, refetch, isLoading: isPricesLoading } = useLivePrices();
  const [activeTime, setActiveTime] = useState<string>('Trending');
  const [activeNet, setActiveNet] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('volume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ScreenerFilters>(emptyFilters);

  const { isFavorite, toggleFavorite } = useFavorites();

  const handleTokenClick = useCallback((token: TokenInfo) => {
    setSelectedToken(token);
    navigate(`/terminal/${token.address}`);
  }, [setSelectedToken, navigate]);

  const activeFilterCount = useMemo(() => Object.values(filters).filter(v => v !== '').length, [filters]);

  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(t);
  }, [activeNet, activeTime]);

  const filteredTokens = useMemo(() => {
    let tokens = [...allTokens];
    const chain = networkToChain[activeNet];
    if (chain !== 'all') tokens = tokens.filter(t => t.chain === chain);
    if (activeTime === 'Gainers') tokens = tokens.filter(t => t.change24h > 0);
    if (activeTime === 'Favorites') tokens = tokens.filter(t => isFavorite(t.address));
    // Apply screener filters
    if (filters.liquidityMin) tokens = tokens.filter(t => t.liquidity >= Number(filters.liquidityMin));
    if (filters.liquidityMax) tokens = tokens.filter(t => t.liquidity <= Number(filters.liquidityMax));
    if (filters.mcapMin) tokens = tokens.filter(t => t.marketCap >= Number(filters.mcapMin));
    if (filters.mcapMax) tokens = tokens.filter(t => t.marketCap <= Number(filters.mcapMax));
    if (filters.volume24hMin) tokens = tokens.filter(t => t.volume24h >= Number(filters.volume24hMin));
    if (filters.volume24hMax) tokens = tokens.filter(t => t.volume24h <= Number(filters.volume24hMax));
    if (filters.change24hMin) tokens = tokens.filter(t => t.change24h >= Number(filters.change24hMin));
    if (filters.change24hMax) tokens = tokens.filter(t => t.change24h <= Number(filters.change24hMax));
    tokens.sort((a, b) => {
      let aV = 0, bV = 0;
      switch (sortBy) {
        case 'price': aV = a.price; bV = b.price; break;
        case 'change': aV = a.change24h; bV = b.change24h; break;
        case 'volume': aV = a.volume24h; bV = b.volume24h; break;
        case 'mcap': aV = a.marketCap; bV = b.marketCap; break;
        case 'liquidity': aV = a.liquidity; bV = b.liquidity; break;
        default: aV = a.volume24h; bV = b.volume24h;
      }
      return sortDir === 'desc' ? bV - aV : aV - bV;
    });
    return tokens;
  }, [allTokens, activeNet, activeTime, sortBy, sortDir, filters, isFavorite]);

  const mockExtra = useMemo(() => {
    const m = new Map<string, { txns: number; makers: number; c5m: number; c1h: number; score: number }>();
    allTokens.forEach(t => {
      const s = seededRandom(t.address);
      m.set(t.address, {
        txns: (s % 5000) + 500,
        makers: ((s >> 8) % 200) + 50,
        c5m: (((s >> 4) % 1000) / 100) - 5,
        c1h: (((s >> 12) % 1500) / 100) - 7.5,
        score: 30 + (s % 65),
      });
    });
    return m;
  }, [allTokens]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    const wasFav = isFavorite(address);
    toggleFavorite(address);
    if (wasFav) {
      toast.info('Removed from favorites');
    } else {
      toast.success('Added to favorites');
    }
    if (navigator.vibrate) navigator.vibrate(10);
  }, [isFavorite, toggleFavorite]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const topGainer = useMemo(() => [...allTokens].sort((a, b) => b.change24h - a.change24h)[0], [allTokens]);
  const topLoser = useMemo(() => [...allTokens].sort((a, b) => a.change24h - b.change24h)[0], [allTokens]);

  const aggregateStats = useMemo(() => {
    const totalVolume = allTokens.reduce((sum, t) => sum + (t.volume24h ?? 0), 0);
    return {
      volume24h: formatCompact(totalVolume),
      txns24h: '\u2014',  // Requires Solana RPC subscription — not available without indexer
    };
  }, [allTokens]);

  const SortTh = ({ label, col, align = 'right' }: { label: string; col: string; align?: string }) => (
    <th
      onClick={() => handleSort(col)}
      className="cursor-pointer select-none"
      style={{ textAlign: align as React.CSSProperties['textAlign'] }}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortBy === col && <span className="text-primary text-[7px]">{sortDir === 'desc' ? '▼' : '▲'}</span>}
      </span>
    </th>
  );

  if (isPricesLoading) {
    return (
      <div className="h-screen-safe w-full flex flex-col overflow-hidden bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] text-muted-foreground font-data tracking-wider">LOADING</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen-safe w-full flex flex-col overflow-hidden bg-background">
      <Header />
      {/* Desktop: normal scroll */}
      <div className="hidden md:block flex-1 overflow-auto">
        <PageTransition className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-6">
          <StaggerContainer className="space-y-8">

            {/* == HEADER == */}
            <div className="space-y-5">
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">TRENDING</div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-data text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                    {filteredTokens.length}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">tokens tracked</span>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pr-4">
                  {timeFilters.map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveTime(f)}
                      className={`font-mono text-[10px] tracking-[0.1em] uppercase px-3 py-1.5 border transition-all whitespace-nowrap ${
                        activeTime === f
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f === 'Favorites' ? <><span className="text-warning">{'\u2605'}</span> {f}</> : f}
                    </button>
                  ))}
                </div>
                <div className="h-4 w-px bg-border hidden sm:block" />
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pr-4">
                  {networkFilters.map(n => {
                    const Icon = filterNetworkIcon[n];
                    return (
                      <button
                        key={n}
                        onClick={() => setActiveNet(n)}
                        className={`flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] uppercase px-2.5 py-1.5 border transition-all whitespace-nowrap ${
                          activeNet === n
                            ? 'border-primary/50 text-primary'
                            : 'border-transparent text-muted-foreground/60 hover:text-foreground'
                        }`}
                      >
                        {Icon && <Icon size={14} />}
                        {n}
                      </button>
                    );
                  })}
                </div>

                {/* Screener Filter Button */}
                <button
                  onClick={() => setFiltersOpen(true)}
                  className={`flex items-center gap-1.5 h-7 px-3 font-mono text-[10px] tracking-[0.1em] uppercase border transition-all ${
                    activeFilterCount > 0
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'text-muted-foreground border-border/30 hover:text-foreground hover:border-primary/20'
                  }`}
                >
                  <FilterSolid className="w-3 h-3" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="text-[9px] bg-primary text-primary-foreground px-1 py-px rounded-full font-data">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* == STATS == */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-[1px] bg-border/30 border border-border rounded overflow-hidden">
              {[
                { label: '24H VOLUME', value: aggregateStats.volume24h },
                { label: '24H TXNS', value: aggregateStats.txns24h },
                { label: 'TOP GAINER', value: topGainer?.symbol || '--', sub: topGainer ? formatPercent(topGainer.change24h) : '', color: 'text-success' },
                { label: 'TOP LOSER', value: topLoser?.symbol || '--', sub: topLoser ? formatPercent(topLoser.change24h) : '', color: 'text-destructive' },
              ].map(s => (
                <div key={s.label} className="p-4 bg-card/50">
                  <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground">{s.label}</div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className={`font-data text-lg font-semibold ${s.color || 'text-foreground'}`}>{s.value}</span>
                    {s.sub && <span className={`font-mono text-[10px] ${s.color || 'text-muted-foreground'}`}>{s.sub}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* == DESKTOP TABLE == */}
            <div className="hidden md:block border border-border overflow-hidden">
              <div className="overflow-x-auto">
                {isLoading ? (
                  <SkeletonTable
                    columns={12}
                    rows={10}
                    headers={['#', 'TOKEN', 'PRICE', 'CHART', 'TXNS', 'VOLUME', 'MAKERS', '5M', '1H', '24H', 'LIQ', 'MCAP']}
                  />
                ) : filteredTokens.length === 0 ? (
                  activeTime === 'Favorites' ? (
                    <div className="py-12 text-center">
                      <div className="text-[13px] text-muted-foreground mb-1">No favorites yet</div>
                      <div className="text-[11px] text-muted-foreground/50">Star tokens from the list to track them here</div>
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="text-[13px] text-muted-foreground mb-1">No tokens found</div>
                      <div className="text-[11px] text-muted-foreground/50">Try adjusting your filters or search criteria</div>
                    </div>
                  )
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 28 }}></th>
                        <th style={{ width: 36 }}>#</th>
                        <th>TOKEN</th>
                        <SortTh label="PRICE" col="price" />
                        <th style={{ textAlign: 'center', width: 80 }}>CHART</th>
                        <th style={{ textAlign: 'right' }}>TXNS</th>
                        <SortTh label="VOLUME" col="volume" />
                        <th style={{ textAlign: 'right' }}>MAKERS</th>
                        <th style={{ textAlign: 'right' }}>5M</th>
                        <th style={{ textAlign: 'right' }}>1H</th>
                        <SortTh label="24H" col="change" />
                        <SortTh label="LIQ" col="liquidity" />
                        <SortTh label="MCAP" col="mcap" />
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTokens.map((token, i) => {
                        const pos = token.change24h >= 0;
                        const ex = mockExtra.get(token.address) ?? { txns: 1000, makers: 100, c5m: 0, c1h: 0, score: 50 };
                        const spark = generateSparklineData(token.address, 20);
                        const hot = token.change24h > 20 || token.volume24h > 2000000;
                        return (
                          <tr
                            key={token.address}
                            className="cursor-pointer group hover:bg-secondary/15 transition-colors"
                            onClick={() => handleTokenClick(token)}
                          >
                            <td className="py-2">
                              <button
                                onClick={(e) => handleToggleFavorite(e, token.address)}
                                className="text-muted-foreground/15 hover:text-warning transition-colors p-0.5"
                              >
                                <span className={`text-[12px] ${isFavorite(token.address) ? 'text-warning' : ''}`}>{isFavorite(token.address) ? '\u2605' : '\u2606'}</span>
                              </button>
                            </td>
                            <td className="font-mono text-muted-foreground/50">{i + 1}</td>
                            <td>
                              <div className="flex items-center gap-2.5">
                                <TokenLogo symbol={token.symbol} size={22} />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors">{token.symbol}</span>
                                    {chainNetworkIcon[token.chain] ? (() => { const CI = chainNetworkIcon[token.chain]; return <CI size={12} />; })() : <span className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground/40">{token.chain.slice(0, 3)}</span>}
                                    {hot && <span className="font-mono text-[7px] tracking-wider uppercase text-warning">HOT</span>}
                                  </div>
                                  <div className="font-mono text-[9px] text-muted-foreground/40">{token.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="numeric font-semibold">{formatPrice(token.price)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="flex justify-center">
                                <MiniSparkline data={spark} width={60} height={22} strokeWidth={1} />
                              </div>
                            </td>
                            <td className="numeric">{ex.txns.toLocaleString()}</td>
                            <td className="numeric">{formatCompact(token.volume24h)}</td>
                            <td className="numeric">{ex.makers}</td>
                            <td className={`numeric ${ex.c5m >= 0 ? 'text-success' : 'text-destructive'}`} style={{ backgroundColor: getHeatColor(ex.c5m, ex.c5m >= 0) }}>
                              {formatPercent(ex.c5m)}
                            </td>
                            <td className={`numeric ${ex.c1h >= 0 ? 'text-success' : 'text-destructive'}`} style={{ backgroundColor: getHeatColor(ex.c1h, ex.c1h >= 0) }}>
                              {formatPercent(ex.c1h)}
                            </td>
                            <td className={`numeric font-semibold ${pos ? 'text-success' : 'text-destructive'}`} style={{ backgroundColor: getHeatColor(token.change24h, pos) }}>
                              {formatPercent(token.change24h)}
                            </td>
                            <td className="numeric">{formatCompact(token.liquidity)}</td>
                            <td className="numeric">{formatCompact(token.marketCap)}</td>
                            <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <WhitelistButton token={token} compact />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* == FOOTER == */}
            <div className="flex items-center justify-between py-4 border-t border-border">
              <span className="font-mono text-[10px] text-muted-foreground">
                {filteredTokens.length} of {allTokens.length} tokens
              </span>
              <span className="font-mono text-[9px] text-muted-foreground/40">Updated just now</span>
            </div>

          </StaggerContainer>
        </PageTransition>
      </div>

      {/* Mobile: PullToRefresh wrapper */}
      <PullToRefresh
        onRefresh={async () => {
          await refetch();
          toast.success('Prices refreshed');
        }}
        className="md:hidden flex-1 min-h-0"
      >
        <PageTransition className="max-w-[1600px] mx-auto px-4 py-5 pb-24">
          <StaggerContainer className="space-y-8">

            {/* == HEADER (mobile) == */}
            <div className="space-y-5">
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">TRENDING</div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-data text-3xl font-bold text-foreground tracking-tight">
                    {filteredTokens.length}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">tokens tracked</span>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pr-4">
                  {timeFilters.map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveTime(f)}
                      className={`font-mono text-[10px] tracking-[0.1em] uppercase px-3 py-1.5 border transition-all whitespace-nowrap ${
                        activeTime === f
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f === 'Favorites' ? <><span className="text-warning">{'\u2605'}</span> {f}</> : f}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pr-4">
                  {networkFilters.map(n => {
                    const Icon = filterNetworkIcon[n];
                    return (
                      <button
                        key={n}
                        onClick={() => setActiveNet(n)}
                        className={`font-mono text-[10px] tracking-[0.1em] uppercase px-3 py-1.5 border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                          activeNet === n
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {Icon && <Icon size={14} />}
                        {n}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setFiltersOpen(true)}
                  className={`self-start flex items-center gap-1.5 h-8 px-3.5 text-[11px] font-medium rounded-lg border transition-all ${
                    activeFilterCount > 0
                      ? 'bg-primary/[0.08] text-primary border-primary/20'
                      : 'bg-white/[0.02] text-muted-foreground/50 border-white/[0.04]'
                  }`}
                >
                  <FilterSolid className="w-3 h-3" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-px rounded-full font-data ml-0.5">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* MOBILE CARDS */}
            <div className="space-y-2">
              {filteredTokens.length === 0 ? (
                activeTime === 'Favorites' ? (
                  <div className="py-12 text-center">
                    <div className="text-[13px] text-muted-foreground mb-1">No favorites yet</div>
                    <div className="text-[11px] text-muted-foreground/50">Star tokens from the list to track them here</div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="text-[13px] text-muted-foreground mb-1">No tokens found</div>
                    <div className="text-[11px] text-muted-foreground/50">Try adjusting your filters or search criteria</div>
                  </div>
                )
              ) : null}
              {filteredTokens.map((token, idx) => {
                const spark = generateSparklineData(token.address, 20);
                return (
                  <div
                    key={token.address}
                    className="bg-card/40 border border-white/[0.04] rounded-lg p-3 active:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => handleTokenClick(token)}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => handleToggleFavorite(e, token.address)}
                        className="text-muted-foreground/15 hover:text-warning transition-colors shrink-0 p-1 -ml-1"
                      >
                        <span className={`text-[14px] ${isFavorite(token.address) ? 'text-warning' : ''}`}>{isFavorite(token.address) ? '\u2605' : '\u2606'}</span>
                      </button>
                      <TokenLogo symbol={token.symbol} size={36} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground">{token.symbol}</span>
                          <span className="text-[10px] text-muted-foreground/40">{token.name}</span>
                          {idx < 3 && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-data">#{idx + 1}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[12px] font-data text-foreground">{formatPrice(token.price)}</span>
                          <span className={`text-[11px] font-data ${
                            token.change24h >= 0 ? 'text-success' : 'text-destructive'
                          }`}>
                            {formatPercent(token.change24h)}
                          </span>
                        </div>
                      </div>
                      <div className="w-[60px] h-[28px]">
                        <MiniSparkline data={spark} color={token.change24h >= 0 ? 'var(--color-success)' : 'var(--color-destructive)'} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-white/[0.03]">
                      <div>
                        <div className="text-[9px] text-muted-foreground/40">VOL</div>
                        <div className="text-[11px] font-data text-foreground">{formatCompact(token.volume24h)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground/40">MCAP</div>
                        <div className="text-[11px] font-data text-foreground">{formatCompact(token.marketCap)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground/40">LIQ</div>
                        <div className="text-[11px] font-data text-foreground">{formatCompact(token.liquidity)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </StaggerContainer>
        </PageTransition>
      </PullToRefresh>

      {/* Screener Filter Dialog */}
      <ScreenerFilterDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        setFilters={setFilters}
        onApply={() => toast.success('Filters applied')}
        onReset={() => setFilters(emptyFilters)}
      />
    </div>
  );
}
