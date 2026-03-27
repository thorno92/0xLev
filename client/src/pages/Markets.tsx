/**
 * MARKETS v8 -- Premium muted design, Arteria-inspired quality
 * Soft sage/coral/violet palette. Clean spacing. Institutional feel.
 * No harsh neons. No vibe-code aesthetics.
 */

import { useState, useMemo, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { PullToRefresh } from '@/components/PullToRefresh';
import { PageTransition } from '@/components/PageTransition';
import { Header } from '@/components/Header';
import { useLivePrices } from '@/hooks/useLivePrices';
import { formatPrice, formatPercent, formatCompact } from '@/lib/format';
import { useStore, type Chain, type TokenInfo } from '@/lib/store';
import { useLocation } from 'wouter';
import { TokenLogo } from '@/components/TokenLogo';
import { WhitelistButton } from '@/components/WhitelistButton';
import { MiniSparkline, generateSparklineData } from '@/components/MiniSparkline';
import { toast } from 'sonner';
import { useFavorites } from '@/hooks/useFavorites';
import { Settings, FilterSolid, NavArrowDownSolid } from 'iconoir-react';
import { type ScreenerFilters, emptyFilters } from '@/components/ScreenerFilters';


// Dynamic web3icons for proper branded network logos
const NetworkIcon = lazy(() =>
  import('@web3icons/react/dynamic').then((mod) => ({
    default: mod.NetworkIcon,
  }))
);

/** Renders a proper branded network icon with fallback */
function ChainIcon({ network, size = 14 }: { network: string; size?: number }) {
  return (
    <Suspense fallback={<span className="inline-block rounded-full bg-foreground/[0.06]" style={{ width: size, height: size }} />}>
      <NetworkIcon name={network} size={size} variant="branded" className="shrink-0" fallback={
        <NetworkIcon name={network} size={size} variant="mono" className="shrink-0" />
      } />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */
const chains = [
  { label: 'All', value: 'all', network: null },
  { label: 'Solana', value: 'solana', network: 'solana' },
  { label: 'Ethereum', value: 'ethereum', network: 'ethereum' },
  { label: 'BNB', value: 'bnb', network: 'binance-smart-chain' },
  { label: 'Base', value: 'base', network: 'base' },
] as const;

type SortKey = 'price' | 'change1h' | 'change6h' | 'change24h' | 'volume' | 'mcap' | 'liquidity' | 'score';
type SortDir = 'asc' | 'desc';

/* ------------------------------------------------------------------ */
/*  FILTER STATE -- imported from @/components/ScreenerFilters          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */
function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getTimeframeChanges(address: string) {
  const h2 = seededRandom(address + '1h');
  const h3 = seededRandom(address + '6h');
  return {
    change1h: ((h2 % 2000) - 900) / 100,
    change6h: ((h3 % 4000) - 1800) / 100,
  };
}

function getTokenAge(address: string): string {
  const h = seededRandom(address + 'age');
  const ages = ['2h', '5h', '12h', '1d', '3d', '5d', '1w', '2w', '1mo', '2mo', '3mo', '6mo', '1y'];
  return ages[h % ages.length];
}

function getTxnCount(address: string): number {
  const h = seededRandom(address + 'txn');
  return 200 + (h % 50000);
}

function getBuySellRatio(address: string): number {
  const h = seededRandom(address + 'bsr');
  return 20 + (h % 60);
}

function getBuySellCounts(address: string): { buys: number; sells: number } {
  const txns = getTxnCount(address);
  const ratio = getBuySellRatio(address) / 100;
  return { buys: Math.round(txns * ratio), sells: Math.round(txns * (1 - ratio)) };
}

function getMakers(address: string): number {
  const h = seededRandom(address + 'mkr');
  return 50 + (h % 5000);
}

function getBuyVolSellVol(address: string, vol: number): { buyVol: number; sellVol: number } {
  const ratio = getBuySellRatio(address) / 100;
  return { buyVol: vol * ratio, sellVol: vol * (1 - ratio) };
}

function isWhitelisted(address: string): boolean {
  return seededRandom(address + 'wl') % 3 === 0;
}

/** Deterministic social links per token -- simulates real token metadata */
function getSocialLinks(address: string): { x?: string; tg?: string; web?: string } {
  const h = seededRandom(address + 'social');
  const links: { x?: string; tg?: string; web?: string } = {};
  // Most tokens have X (Twitter)
  if (h % 10 !== 0) links.x = '#';
  // ~70% have Telegram
  if (h % 10 < 7) links.tg = '#';
  // ~60% have a website
  if (h % 10 < 6) links.web = '#';
  return links;
}

/* ------------------------------------------------------------------ */
/*  SCREENER FILTER DIALOG -- imported from @/components/ScreenerFilters */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/*  ARTERIA-STYLE COLUMN CARD                                            */
/*  Large logo left, horizontal info rows, colored change badges,        */
/*  TX/V/MC inline, thin progress bar at bottom. Clean and compact.      */
/* ------------------------------------------------------------------ */
function ColumnCard({ token, onClick, whitelisted, whitelistPending, onRequestWhitelist, onTrade }: {
  token: TokenInfo;
  onClick: () => void;
  whitelisted: boolean;
  whitelistPending: boolean;
  onRequestWhitelist: (e: React.MouseEvent) => void;
  onTrade: (e: React.MouseEvent) => void;
}) {
  const chainLabel = token.chain === 'solana' ? 'SOL' : token.chain === 'ethereum' ? 'ETH' : token.chain === 'bnb' ? 'BNB' : 'BASE';
  const age = useMemo(() => getTokenAge(token.address), [token.address]);
  const txns = useMemo(() => getTxnCount(token.address), [token.address]);
  const buyRatio = useMemo(() => getBuySellRatio(token.address), [token.address]);
  const tf = useMemo(() => getTimeframeChanges(token.address), [token.address]);
  const makers = useMemo(() => getMakers(token.address), [token.address]);
  const socials = useMemo(() => getSocialLinks(token.address), [token.address]);
  const sparkData = useMemo(() => generateSparklineData(token.address), [token.address]);
  const [hovered, setHovered] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => setHovered(true), 400);
  };
  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHovered(false);
  };

  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  // Score for the progress bar (deterministic per token)
  const score = useMemo(() => {
    const h = seededRandom(token.address + 'score');
    return 8 + (h % 92);
  }, [token.address]);

  return (
    <div
      className="group relative rounded-lg bg-card/60 border border-foreground/[0.04] hover:border-primary/20 hover:bg-card/90 transition-all duration-200 cursor-pointer"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ---- HOVER PREVIEW POPUP ---- */}
      {hovered && (
        <div className="absolute z-50 left-full top-0 ml-2 w-[260px] rounded-xl bg-card border border-foreground/[0.06] shadow-2xl shadow-black/40 p-3.5 pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150 hidden sm:block">
          {/* Sparkline chart */}
          <div className="mb-3 rounded-lg bg-foreground/[0.02] p-2">
            <MiniSparkline data={sparkData} width={228} height={64} color={token.change24h >= 0 ? 'var(--color-success)' : 'var(--color-destructive)'} />
          </div>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <span className="text-[9px] text-muted-foreground/40 block">Price</span>
              <span className="text-[11px] font-semibold text-foreground tabular-nums">{formatPrice(token.price)}</span>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground/40 block">24H Change</span>
              <span className={`text-[11px] font-semibold tabular-nums ${token.change24h >= 0 ? 'text-success' : 'text-destructive'}`}>{formatPercent(token.change24h)}</span>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground/40 block">Volume</span>
              <span className="text-[11px] font-semibold text-foreground tabular-nums">{formatCompact(token.volume24h)}</span>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground/40 block">Market Cap</span>
              <span className="text-[11px] font-semibold text-foreground tabular-nums">{formatCompact(token.marketCap)}</span>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground/40 block">Liquidity</span>
              <span className="text-[11px] font-semibold text-foreground tabular-nums">{formatCompact(token.liquidity)}</span>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground/40 block">Buy/Sell</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-success tabular-nums">{buyRatio}%</span>
                <span className="text-[8px] text-muted-foreground/35">/</span>
                <span className="text-[10px] font-semibold text-destructive tabular-nums">{100 - buyRatio}%</span>
              </div>
            </div>
          </div>
          {/* Quick actions hint */}
          <div className="mt-3 pt-2.5 border-t border-foreground/[0.04] flex items-center justify-center gap-1">
            <span className="text-[9px] text-muted-foreground/45">Click to open in Terminal</span>
          </div>
        </div>
      )}

      <div className="flex gap-2.5 p-2.5 pb-1.5">
        {/* ---- LARGE LOGO ---- */}
        <div className="relative shrink-0 mt-0.5 w-[48px] h-[48px]">
          <TokenLogo symbol={token.symbol} size={48} />
          {whitelisted && (
            <div className="absolute -bottom-[3px] -right-[3px] w-[16px] h-[16px] rounded-full bg-success flex items-center justify-center ring-2 ring-card">
              <span className="text-[8px] text-white font-bold leading-none">{'\u2713'}</span>
            </div>
          )}
        </div>

        {/* ---- ALL INFO TO THE RIGHT ---- */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + ticker + chain + age */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors truncate">{token.symbol}</span>
              <span className="text-[10px] text-muted-foreground/40">{'\u00B7'}</span>
              <span className="text-[10px] text-muted-foreground/40 truncate">{token.name}</span>
              {whitelisted && <span className="text-[9px] text-success/60">{'\uD83D\uDD12'}</span>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[9px] tabular-nums font-medium px-1.5 py-[1px] rounded ${
                age.includes('h') ? 'bg-success/[0.08] text-success/70' :
                age === '1d' || age === '3d' || age === '5d' ? 'bg-warning/[0.08] text-warning/70' :
                age === '1w' || age === '2w' ? 'bg-primary/[0.08] text-primary/70' :
                'bg-foreground/[0.03] text-muted-foreground/35'
              }`}>{age}</span>
              <div onClick={(e) => e.stopPropagation()}>
                <WhitelistButton token={token} compact />
              </div>
            </div>
          </div>

          {/* Row 2: Social icons + chain badge + makers */}
          <div className="flex items-center gap-1.5 mt-1">
            {socials.x && (
              <a
                href={socials.x}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center w-[18px] h-[18px] rounded bg-foreground/[0.04] hover:bg-white/[0.08] transition-colors"
                title="X (Twitter)"
              >
                <svg className="w-[10px] h-[10px] text-muted-foreground/50" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            )}
            {socials.tg && (
              <a
                href={socials.tg}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center w-[18px] h-[18px] rounded bg-foreground/[0.04] hover:bg-white/[0.08] transition-colors"
                title="Telegram"
              >
                <svg className="w-[10px] h-[10px] text-muted-foreground/50" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>
            )}
            {socials.web && (
              <a
                href={socials.web}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center w-[18px] h-[18px] rounded bg-foreground/[0.04] hover:bg-white/[0.08] transition-colors"
                title="Website"
              >
                <svg className="w-[10px] h-[10px] text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </a>
            )}
            <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/50 font-medium bg-foreground/[0.04] px-1.5 py-[1px] rounded">
              <ChainIcon network={token.chain === 'bnb' ? 'binance-smart-chain' : token.chain} size={10} />
              {chainLabel}
            </span>
            <span className="text-[9px] text-muted-foreground/40">{'\uD83D\uDC65'}</span>
            <span className="text-[9px] text-muted-foreground/35 tabular-nums">{fmtNum(makers)}</span>
          </div>

          {/* Row 3: Colored change badges inline */}
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {[
              { label: '1H', value: tf.change1h },
              { label: '6H', value: tf.change6h },
              { label: '24H', value: token.change24h },
            ].map(item => (
              <span
                key={item.label}
                className={`text-[9px] tabular-nums font-semibold px-1.5 py-[1px] rounded ${
                  item.value >= 0
                    ? 'bg-success/[0.08] text-success/80'
                    : 'bg-destructive/[0.08] text-destructive/80'
                }`}
              >
                {item.label} {formatPercent(item.value)}
              </span>
            ))}
          </div>

          {/* Row 4: TX count with buy/sell dots + V + MC */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/50">TX</span>
              <span className="text-[10px] font-semibold text-foreground/70 tabular-nums">{fmtNum(txns)}</span>
              {/* Mini buy/sell ratio bar inline */}
              <div className="flex h-[4px] w-12 rounded-full overflow-hidden">
                <div className="bg-success/50 rounded-l-full" style={{ width: `${buyRatio}%` }} />
                <div className="bg-destructive/50 rounded-r-full flex-1" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground/50">
                V <span className="text-foreground/70 font-semibold tabular-nums">{formatCompact(token.volume24h)}</span>
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                MC <span className="text-foreground/70 font-semibold tabular-nums">{formatCompact(token.marketCap)}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- BOTTOM: Progress bar ---- */}
      <div className="px-2.5 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[3px] rounded-full bg-foreground/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-success/50 transition-all"
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground/45 tabular-nums shrink-0">{score}%</span>
        </div>
      </div>
    </div>
  );
}


/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
export default function Markets() {
  const { setSelectedToken } = useStore();
  const [, navigate] = useLocation();
  const { allTokens, refetch } = useLivePrices();
  const [chain, setChain] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const { isFavorite, toggleFavorite, favoriteAddresses } = useFavorites();
  const [filters, setFilters] = useState<ScreenerFilters>(emptyFilters);
  const [whitelistRequested, setWhitelistRequested] = useState<Set<string>>(new Set());

  // Column filter state
  const [gainerFilter, setGainerFilter] = useState<string>('all');
  const [volumeFilter, setVolumeFilter] = useState<string>('all');

  // Per-column chain filter state
  const [gainerChain, setGainerChain] = useState<string>('all');
  const [flashChain, setFlashChain] = useState<string>('all');
  const [volumeChain, setVolumeChain] = useState<string>('all');

  // Load More state (initial count per column)
  const INITIAL_COUNT = 8;
  const LOAD_MORE_COUNT = 8;
  const [gainerLimit, setGainerLimit] = useState(INITIAL_COUNT);
  const [flashLimit, setFlashLimit] = useState(INITIAL_COUNT);
  const [volumeLimit, setVolumeLimit] = useState(INITIAL_COUNT);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, [chain]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => v !== '').length;
  }, [filters]);

  // 3 column lists (full filtered lists, sliced by limit)
  const gainersFull = useMemo(() => {
    let base = [...allTokens];
    if (gainerChain !== 'all') base = base.filter(t => t.chain === gainerChain);

    // Primary: tokens with positive 24h change
    let list = base.filter(t => t.change24h > 0).sort((a, b) => b.change24h - a.change24h);

    // Fallback: if fewer than 6 gainers, fill with "best performers" (least negative)
    // so the section is never empty in a down market
    if (list.length < 6) {
      const remaining = base
        .filter(t => t.change24h <= 0)
        .sort((a, b) => b.change24h - a.change24h)
        .slice(0, 6 - list.length);
      list = [...list, ...remaining];
    }

    if (gainerFilter === '>10%') list = list.filter(t => t.change24h > 10);
    if (gainerFilter === '>5%') list = list.filter(t => t.change24h > 5);
    return list;
  }, [allTokens, gainerFilter, gainerChain]);
  const gainers = useMemo(() => gainersFull.slice(0, gainerLimit), [gainersFull, gainerLimit]);

  const flashSaleFull = useMemo(() => {
    let base = [...allTokens];
    if (flashChain !== 'all') base = base.filter(t => t.chain === flashChain);
    const negatives = base.filter(t => t.change24h < 0).sort((a, b) => a.change24h - b.change24h);
    if (negatives.length > 0) return negatives;
    return base.sort((a, b) => a.change24h - b.change24h);
  }, [allTokens, flashChain]);
  const flashSale = useMemo(() => flashSaleFull.slice(0, flashLimit), [flashSaleFull, flashLimit]);

  const topVolumeFull = useMemo(() => {
    let list = [...allTokens].sort((a, b) => b.volume24h - a.volume24h);
    if (volumeChain !== 'all') list = list.filter(t => t.chain === volumeChain);
    if (volumeFilter === 'rising') list = list.filter(t => t.change24h > 0);
    if (volumeFilter === 'new') list = list.filter(t => {
      const age = getTokenAge(t.address);
      return age.includes('h') || age === '1d' || age === '3d';
    });
    return list;
  }, [allTokens, volumeFilter, volumeChain]);
  const topVolume = useMemo(() => topVolumeFull.slice(0, volumeLimit), [topVolumeFull, volumeLimit]);

  // Full table tokens (filtered + sorted)
  const tokens = useMemo(() => {
    let list = chain === 'all' ? [...allTokens] : allTokens.filter(t => t.chain === chain);
    if (showFavoritesOnly) list = list.filter(t => isFavorite(t.address));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
    }
    if (filters.liquidityMin) list = list.filter(t => t.liquidity >= Number(filters.liquidityMin));
    if (filters.liquidityMax) list = list.filter(t => t.liquidity <= Number(filters.liquidityMax));
    if (filters.mcapMin) list = list.filter(t => t.marketCap >= Number(filters.mcapMin));
    if (filters.mcapMax) list = list.filter(t => t.marketCap <= Number(filters.mcapMax));
    if (filters.volume24hMin) list = list.filter(t => t.volume24h >= Number(filters.volume24hMin));
    if (filters.volume24hMax) list = list.filter(t => t.volume24h <= Number(filters.volume24hMax));
    if (filters.change24hMin) list = list.filter(t => t.change24h >= Number(filters.change24hMin));
    if (filters.change24hMax) list = list.filter(t => t.change24h <= Number(filters.change24hMax));

    list.sort((a, b) => {
      let va = 0, vb = 0;
      switch (sortKey) {
        case 'price': va = a.price; vb = b.price; break;
        case 'change1h': { const tfA = getTimeframeChanges(a.address); const tfB = getTimeframeChanges(b.address); va = tfA.change1h; vb = tfB.change1h; break; }
        case 'change6h': { const tfA = getTimeframeChanges(a.address); const tfB = getTimeframeChanges(b.address); va = tfA.change6h; vb = tfB.change6h; break; }
        case 'change24h': va = a.change24h; vb = b.change24h; break;
        case 'volume': va = a.volume24h; vb = b.volume24h; break;
        case 'mcap': va = a.marketCap; vb = b.marketCap; break;
        case 'liquidity': va = a.liquidity; vb = b.liquidity; break;
        case 'score': va = seededRandom(a.address) % 100; vb = seededRandom(b.address) % 100; break;
      }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
    return list;
  }, [chain, search, sortKey, sortDir, filters, allTokens, showFavoritesOnly, isFavorite]);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  const handleClick = useCallback((token: TokenInfo) => {
    setSelectedToken(token);
    navigate(`/terminal/${token.address}`);
  }, [setSelectedToken, navigate]);

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

  const handleRequestWhitelist = useCallback((e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    setWhitelistRequested(prev => new Set(prev).add(address));
    toast.success('Whitelist request submitted');
  }, []);

  const handleTrade = useCallback((e: React.MouseEvent, token: TokenInfo) => {
    e.stopPropagation();
    setSelectedToken(token);
    navigate(`/terminal/${token.address}`);
  }, [setSelectedToken, navigate]);

  // Computed dashboard sections (compact top cards)
  const dashGainers = useMemo(() => {
    return allTokens
      .filter((t) => t.change24h > 0)
      .sort((a, b) => b.change24h - a.change24h)
      .slice(0, 6);
  }, [allTokens]);

  const dashFlashSale = useMemo(() => {
    return allTokens
      .filter((t) => t.change24h < 0 && (t.liquidity ?? 0) > 50000)
      .sort((a, b) => a.change24h - b.change24h)
      .slice(0, 6);
  }, [allTokens]);

  const dashTopVolume = useMemo(() => {
    return [...allTokens]
      .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
      .slice(0, 6);
  }, [allTokens]);

  // Aggregate stats
  const totalVol = allTokens.reduce((s, t) => s + t.volume24h, 0);
  const totalMcap = allTokens.reduce((s, t) => s + t.marketCap, 0);
  const totalLiq = allTokens.reduce((s, t) => s + t.liquidity, 0);
  const avgChange = allTokens.reduce((s, t) => s + t.change24h, 0) / (allTokens.length || 1);

  /* ================================================================ */
  /*  FILTER PILL                                                      */
  /* ================================================================ */
  const FilterPill = ({ label, active, onClick: onPillClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onPillClick}
      className={`text-[10px] font-medium px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
        active
          ? 'bg-primary/[0.10] text-primary/90 border border-primary/20'
          : 'text-muted-foreground/35 hover:text-muted-foreground/60 border border-transparent hover:border-foreground/[0.04]'
      }`}
    >
      {label}
    </button>
  );

  /* ================================================================ */
  /*  COLUMN RENDERER                                                  */
  /* ================================================================ */
  /** Chain filter pills for columns */
  const ChainFilterRow = ({ activeChain, onChange }: { activeChain: string; onChange: (v: string) => void }) => (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/[0.02] bg-foreground/[0.01] shrink-0">
      <button
        onClick={() => onChange('all')}
        className={`text-[9px] font-medium px-2 py-[3px] rounded-md transition-all ${
          activeChain === 'all'
            ? 'bg-primary/[0.10] text-primary/90 border border-primary/20'
            : 'text-muted-foreground/35 hover:text-muted-foreground/60 border border-transparent hover:border-foreground/[0.04]'
        }`}
      >
        All
      </button>
      {chains.slice(1).map(c => (
        <button
          key={c.value}
          onClick={() => onChange(c.value)}
          className={`flex items-center gap-1 text-[9px] font-medium px-2 py-[3px] rounded-md transition-all ${
            activeChain === c.value
              ? 'bg-primary/[0.10] text-primary/90 border border-primary/20'
              : 'text-muted-foreground/35 hover:text-muted-foreground/60 border border-transparent hover:border-foreground/[0.04]'
          }`}
        >
          <ChainIcon network={c.network!} size={10} />
          <span className="hidden sm:inline">{c.label}</span>
        </button>
      ))}
    </div>
  );

  const renderColumn = (
    title: string,
    subtitle: string,
    accentColor: string,
    items: TokenInfo[],
    totalCount: number,
    emptyText: string,
    onLoadMore: () => void,
    columnChain: string,
    onChainChange: (v: string) => void,
    filterOptions?: { value: string; label: string }[],
    activeFilter?: string,
    onFilterChange?: (v: string) => void,
  ) => (
    <div className="flex flex-col rounded-xl overflow-visible bg-card/40 border border-foreground/[0.04] h-full">
      {/* Column header — fixed structure for alignment across columns */}
      <div className="px-3 py-2 border-b border-white/[0.03] shrink-0">
        <div className="flex items-center justify-between min-h-[24px]">
          <div className="flex items-center gap-2.5">
            <div className={`w-1.5 h-1.5 rounded-full ${accentColor}`} />
            <span className="text-[13px] font-semibold text-foreground tracking-wide">{title}</span>
            <span className="text-[10px] text-muted-foreground/45 tabular-nums">{totalCount}</span>
          </div>
          {/* Filter pills — always reserve space for alignment */}
          <div className="flex items-center gap-0.5 min-h-[22px]">
            {filterOptions && onFilterChange ? (
              filterOptions.map(opt => (
                <FilterPill
                  key={opt.value}
                  label={opt.label}
                  active={activeFilter === opt.value}
                  onClick={() => onFilterChange(opt.value)}
                />
              ))
            ) : null}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5 ml-4">{subtitle}</p>
      </div>

      {/* Chain filter row — consistent px-3 py-1.5 */}
      <ChainFilterRow activeChain={columnChain} onChange={onChainChange} />

      {/* Card list — flex-1 fills remaining height so all columns align */}
      <div className="flex-1 p-1.5 space-y-1.5 max-h-[720px] overflow-y-auto scrollbar-thin">
        {items.length === 0 ? (
          <div className="py-16 text-center text-[11px] text-muted-foreground/35">{emptyText}</div>
        ) : (
          <>
            {items.map((token) => (
              <ColumnCard
                key={token.address}
                token={token}
                onClick={() => handleClick(token)}
                whitelisted={isWhitelisted(token.address)}
                whitelistPending={whitelistRequested.has(token.address)}
                onRequestWhitelist={(e) => handleRequestWhitelist(e, token.address)}
                onTrade={(e) => handleTrade(e, token)}
              />
            ))}
            {items.length < totalCount && (
              <button
                onClick={onLoadMore}
                className="w-full py-2.5 text-[10px] font-medium text-muted-foreground/40 hover:text-primary/70 hover:bg-foreground/[0.02] rounded-lg transition-all border border-transparent hover:border-foreground/[0.04]"
              >
                Load More ({totalCount - items.length} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen-safe w-full flex flex-col overflow-hidden bg-background">
      <Header />
      {/* Desktop: normal scroll */}
      <div className="hidden md:block flex-1 overflow-auto">
        <PageTransition className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-6">

          {/* ========================================================== */}
          {/*  STATS BAR (desktop)                                       */}
          {/* ========================================================== */}
          <div className="flex items-center gap-4 sm:gap-8 mb-6 pb-4 border-b border-foreground/[0.04] overflow-x-auto scrollbar-none">
            {[
              { label: '24H Volume', value: formatCompact(totalVol), color: 'text-foreground' },
              { label: 'Market Cap', value: formatCompact(totalMcap), color: 'text-foreground' },
              { label: 'Liquidity', value: formatCompact(totalLiq), color: 'text-foreground' },
              { label: 'Avg 24H', value: formatPercent(avgChange), color: avgChange >= 0 ? 'text-success' : 'text-destructive' },
              { label: 'Tokens', value: String(allTokens.length), color: 'text-foreground' },
            ].map((stat, i) => (
              <div key={stat.label} className="shrink-0 flex items-center gap-4 sm:gap-8">
                <div>
                  <div className="text-[10px] text-muted-foreground/45 font-medium">{stat.label}</div>
                  <div className={`text-[15px] font-semibold tabular-nums mt-0.5 ${stat.color}`}>{stat.value}</div>
                </div>
                {i < 4 && <div className="w-px h-7 bg-foreground/[0.04] shrink-0" />}
              </div>
            ))}
          </div>

          {/* ========================================================== */}
          {/*  3 SIDE-BY-SIDE COLUMNS (desktop)                           */}
          {/* ========================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8 items-stretch">
            {renderColumn(
              'Gainers', 'Best performers by 24h change',
              'bg-success',
              gainers, gainersFull.length,
              'No gainers right now',
              () => setGainerLimit(prev => prev + LOAD_MORE_COUNT),
              gainerChain, setGainerChain,
              [{ value: 'all', label: 'All' }, { value: '>5%', label: '>5%' }, { value: '>10%', label: '>10%' }],
              gainerFilter, setGainerFilter,
            )}
            {renderColumn(
              'Flash Sale', 'Tokens with significant price drops',
              'bg-warning',
              flashSale, flashSaleFull.length,
              'No flash sales right now',
              () => setFlashLimit(prev => prev + LOAD_MORE_COUNT),
              flashChain, setFlashChain,
            )}
            {renderColumn(
              'Top Volume', 'Highest trading volume in 24 hours',
              'bg-primary',
              topVolume, topVolumeFull.length,
              'No volume data',
              () => setVolumeLimit(prev => prev + LOAD_MORE_COUNT),
              volumeChain, setVolumeChain,
              [{ value: 'all', label: 'All' }, { value: 'rising', label: 'Rising' }, { value: 'new', label: 'New' }],
              volumeFilter, setVolumeFilter,
            )}
          </div>

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

          {/* STATS BAR (mobile) — full-width grid matching tabs */}
          <div className="grid grid-cols-5 mb-4 pb-3 border-b border-foreground/[0.04]">
            {[
              { label: 'Volume', value: formatCompact(totalVol), color: 'text-foreground' },
              { label: 'MCap', value: formatCompact(totalMcap), color: 'text-foreground' },
              { label: 'Liq', value: formatCompact(totalLiq), color: 'text-foreground' },
              { label: '24H', value: formatPercent(avgChange), color: avgChange >= 0 ? 'text-success' : 'text-destructive' },
              { label: 'Tokens', value: String(allTokens.length), color: 'text-foreground' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-[9px] text-muted-foreground/45 font-medium uppercase">{stat.label}</div>
                <div className={`text-[14px] font-semibold tabular-nums mt-0.5 ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* MOBILE: Tab-based filter view instead of 3 stacked sections */}
          <MobileMarketTabs
            gainers={dashGainers}
            flashSale={dashFlashSale}
            topVolume={dashTopVolume}
            allTokens={tokens}
            onSelect={handleClick}
          />

        </PageTransition>
      </PullToRefresh>
    </div>
  );
}


type MobileFilter = 'all' | 'gainers' | 'flash' | 'volume';

/* ================================================================== */
/*  MOBILE MARKET TABS                                                 */
/* ================================================================== */
function MobileMarketTabs({ gainers, flashSale, topVolume, allTokens, onSelect }: {
  gainers: TokenInfo[];
  flashSale: TokenInfo[];
  topVolume: TokenInfo[];
  allTokens: TokenInfo[];
  onSelect: (token: TokenInfo) => void;
}) {
  const [filter, setFilter] = useState<MobileFilter>('all');

  const displayTokens = useMemo(() => {
    switch (filter) {
      case 'gainers': return gainers;
      case 'flash': return flashSale;
      case 'volume': return topVolume;
      default: return allTokens.slice(0, 50);
    }
  }, [filter, gainers, flashSale, topVolume, allTokens]);

  const tabs: { key: MobileFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'gainers', label: 'Gainers' },
    { key: 'flash', label: 'Flash Sale' },
    { key: 'volume', label: 'Volume' },
  ];

  return (
    <div className="mb-4">
      {/* Tab bar — full width, equal columns matching stats bar */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`text-[12px] font-medium py-2 rounded-md transition-all text-center ${
              filter === t.key
                ? 'bg-primary/12 text-primary border border-primary/20'
                : 'bg-foreground/[0.02] text-muted-foreground/50 border border-white/[0.03] hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Token list — same detailed cards as desktop */}
      <div className="space-y-1.5 px-1">
        {displayTokens.length === 0 ? (
          <div className="py-12 text-center text-[11px] text-muted-foreground/45">No tokens found</div>
        ) : (
          displayTokens.map(token => (
            <ColumnCard
              key={token.address}
              token={token}
              onClick={() => onSelect(token)}
              whitelisted={isWhitelisted(token.address)}
              whitelistPending={false}
              onRequestWhitelist={(e) => e.stopPropagation()}
              onTrade={(e) => e.stopPropagation()}
            />
          ))
        )}
      </div>
    </div>
  );
}
