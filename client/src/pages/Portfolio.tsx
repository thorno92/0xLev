/*
 * PORTFOLIO v5 -- Exchange-grade dashboard.
 * Reference: Crypto exchange portfolio with balance + chart side-by-side,
 * stats row, action buttons, and clean data table.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { PageTransition, FadeIn } from '@/components/PageTransition';
import { TokenLogo } from '@/components/TokenLogo';
import { MiniSparkline, generateSparklineData } from '@/components/MiniSparkline';
import { useStore } from '@/lib/store';
import { formatPrice, formatPercent, formatNumber, formatCompact } from '@/lib/format';
import { Header } from '@/components/Header';
import { WalletConnectModal } from '@/components/WalletConnectModal';
import { toast } from 'sonner';
import { useWalletHoldings } from '@/hooks/useWalletHoldings';
import { useTradeWalletBalance } from '@/hooks/useTradeWalletBalance';

/* ------------------------------------------------------------------ */
/*  CONNECT WALLET STATE                                               */
/* ------------------------------------------------------------------ */
function ConnectState({ onConnect }: { onConnect: () => void }) {
  return (
    <PageTransition className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-24 md:pb-6 flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Connect your wallet</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Track your holdings, monitor performance, and manage positions across all chains.
          </p>
        </div>
        <button
          onClick={onConnect}
          className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6" />
          </svg>
          Connect Wallet
        </button>
      </div>
    </PageTransition>
  );
}

/* ------------------------------------------------------------------ */
/*  PORTFOLIO CHART -- Clean area chart for the hero section           */
/* ------------------------------------------------------------------ */
function PortfolioChart({ data, positive }: { data: number[]; positive: boolean }) {
  const color = positive ? 'var(--success)' : 'var(--destructive)';

  const { linePath, areaPath } = useMemo(() => {
    if (data.length < 2) return { linePath: '', areaPath: '' };
    const mn = Math.min(...data);
    const mx = Math.max(...data);
    const range = mx - mn || 1;
    const w = 500;
    const h = 180;
    const padY = 8;

    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * w,
      y: padY + (h - padY * 2) - ((v - mn) / range) * (h - padY * 2),
    }));

    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    const area = `${d} L ${pts[pts.length - 1].x},${h} L ${pts[0].x},${h} Z`;
    return { linePath: d, areaPath: area };
  }, [data]);

  if (data.length < 2) return null;

  return (
    <svg viewBox="0 0 500 180" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="portfolio-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="40%" stopColor={color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#portfolio-grad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB BUTTON                                                         */
/* ------------------------------------------------------------------ */
type TabId = 'assets' | 'orders';

function TabBtn({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative text-[12px] uppercase tracking-wider font-semibold pb-3 transition-colors ${
        active ? 'text-foreground' : 'text-muted-foreground/50 hover:text-foreground/60'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {label}
        {count !== undefined && (
          <span className={`text-[10px] tabular-nums ${active ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}>
            {count}
          </span>
        )}
      </span>
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  STAT CELL -- for the stats row below the balance                   */
/* ------------------------------------------------------------------ */
function StatCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="pr-6">
      <div className="text-[11px] text-muted-foreground/50 mb-1">{label}:</div>
      <div className={`text-[13px] font-medium tabular-nums ${valueColor || 'text-foreground'}`}>{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN PORTFOLIO                                                     */
/* ------------------------------------------------------------------ */
export default function Portfolio() {
  const [, navigate] = useLocation();
  const { walletConnected, walletAddress, openPositions, walletBalance } = useStore();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('assets');
  const [timePeriod, setTimePeriod] = useState<'1D' | '7D' | '1M' | '1Y' | 'ALL'>('7D');
  const [valueDisplay, setValueDisplay] = useState<'usd' | 'sol'>('usd');

  useTradeWalletBalance();
  const positions = openPositions;

  // Real on-chain holdings via Solana RPC
  const { holdings: realHoldings, totalValue: holdingsTotalValue, isLoading: holdingsLoading } = useWalletHoldings();

  const portfolioData = useMemo(() => {
    const totalValue = holdingsTotalValue;
    const totalPnl = realHoldings.reduce((s, h) => s + h.value * (h.change / 100), 0);
    const totalPnlPct = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;
    const withAllocation = realHoldings.map(h => ({
      ...h,
      ticker: h.ticker,
      allocation: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
    }));

    return { totalValue, totalPnl, totalPnlPct, holdings: withAllocation };
  }, [realHoldings, holdingsTotalValue]);

  const handleConnect = useCallback(() => {
    setWalletModalOpen(true);
  }, []);

  const handleExportCSV = useCallback(() => {
    const headers = ['Name', 'Allocation', '24h Change', 'Price', 'Balance', 'Estimated Value'];
    const rows = portfolioData.holdings.map(h => {
      const fmtBal = h.amount >= 1_000_000
        ? `${(h.amount / 1_000_000).toFixed(2)}M ${h.ticker}`
        : h.amount >= 1_000
        ? `${(h.amount / 1_000).toFixed(1)}K ${h.ticker}`
        : `${h.amount.toFixed(4)} ${h.ticker}`;
      return [h.name, `${h.allocation.toFixed(2)}%`, `${h.change}%`, h.price, fmtBal, `$${h.value.toFixed(2)}`];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '0xleverage_portfolio.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Portfolio exported');
  }, [portfolioData]);

  const periods = ['1D', '7D', '1M', '1Y', 'ALL'] as const;
  const pnlPositive = portfolioData.totalPnl >= 0;
  // Derive sparkline from actual holdings — simulate equity curve from 24h changes
  const equityData = useMemo(() => {
    if (portfolioData.holdings.length === 0 || portfolioData.totalValue === 0) {
      return generateSparklineData(`equity-${timePeriod}`, 80);
    }
    // Weighted average 24h change across all holdings
    const weightedChange = portfolioData.holdings.reduce(
      (sum, h) => sum + (h.change / 100) * (h.allocation / 100), 0
    );
    const points = 80;
    const data: number[] = [];
    const startValue = portfolioData.totalValue / (1 + weightedChange);
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      // Simulate gradual change with slight noise from holdings count
      const noise = Math.sin(i * 0.3 + portfolioData.holdings.length) * startValue * 0.003;
      const value = startValue + (portfolioData.totalValue - startValue) * progress + noise;
      data.push(Math.max(0, value));
    }
    return data;
  }, [portfolioData, timePeriod]);

  const solPrice = useMemo(() => {
    const sol = realHoldings.find(h => h.symbol === 'SOL');
    return sol?.price ?? 0;
  }, [realHoldings]);

  const displayValue = valueDisplay === 'usd'
    ? portfolioData.totalValue
    : solPrice > 0 ? portfolioData.totalValue / solPrice : 0;

  const balanceStr = formatNumber(displayValue, valueDisplay === 'usd' ? 3 : 4);
  const dotIdx = balanceStr.indexOf('.');
  const balanceInt = dotIdx >= 0 ? balanceStr.slice(0, dotIdx) : balanceStr;
  const balanceDec = dotIdx >= 0 ? balanceStr.slice(dotIdx) : valueDisplay === 'usd' ? '.000' : '.0000';

  return (
    <div className="h-screen-safe w-full flex flex-col overflow-hidden bg-background">
      <Header />

      {!walletConnected ? (
        <ConnectState onConnect={handleConnect} />
      ) : (
        <div className="flex-1 overflow-auto">
          <PageTransition className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-24 md:pb-6">

            {/* ============================================ */}
            {/* HERO: Estimated Balance + Chart side by side  */}
            {/* ============================================ */}
            <FadeIn className="pb-0">
              {/* Top label row */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-[12px] text-muted-foreground/50 uppercase tracking-wider font-medium">Estimated Balance</div>
                <div className="flex items-center gap-1">
                  {periods.map(p => (
                    <button
                      key={p}
                      onClick={() => setTimePeriod(p)}
                      className={`text-[11px] font-semibold w-8 h-7 rounded-md flex items-center justify-center transition-all ${
                        timePeriod === p
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'text-muted-foreground/40 hover:text-muted-foreground/60 hover:bg-secondary/30'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Balance + Chart row */}
              <div className="flex flex-col sm:flex-row items-start gap-0">
                {/* Left: Balance number */}
                <div className="shrink-0 pr-0 sm:pr-10 w-full sm:w-auto">
                  <div className="flex items-baseline mb-3">
                    <span className="text-[36px] sm:text-[52px] font-bold text-foreground tracking-tight leading-none tabular-nums">
                      {valueDisplay === 'usd' ? '$' : ''}{balanceInt}
                    </span>
                    <span className="text-[36px] sm:text-[52px] font-bold text-foreground/30 tracking-tight leading-none tabular-nums">
                      {balanceDec}
                    </span>
                    <div className="ml-3 flex items-center gap-1 self-center">
                      <button
                        onClick={() => setValueDisplay('usd')}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-all ${
                          valueDisplay === 'usd'
                            ? 'bg-primary/15 text-primary border border-primary/25'
                            : 'text-muted-foreground/50 hover:text-muted-foreground'
                        }`}
                      >
                        USD
                      </button>
                      <button
                        onClick={() => setValueDisplay('sol')}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-all ${
                          valueDisplay === 'sol'
                            ? 'bg-primary/15 text-primary border border-primary/25'
                            : 'text-muted-foreground/50 hover:text-muted-foreground'
                        }`}
                      >
                        SOL
                      </button>
                    </div>
                  </div>

                  {/* UPD timestamp */}
                  <div className="text-[11px] text-muted-foreground/40 mb-5 flex items-center gap-1.5">
                    UPD: 28 MIN. AGO
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/40 cursor-pointer hover:text-muted-foreground/50 transition-colors">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                    </svg>
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap items-start gap-0 mb-5">
                    <div className="pr-4 sm:pr-6 border-r border-border/20">
                      <div className="text-[11px] text-muted-foreground/40 mb-1">Today PnL:</div>
                      <div className={`text-[13px] font-medium tabular-nums ${pnlPositive ? 'text-success' : 'text-destructive'}`}>
                        {formatPercent(portfolioData.totalPnlPct)} ({pnlPositive ? '+' : ''}{formatPrice(portfolioData.totalPnl)})
                      </div>
                    </div>
                    <div className="px-4 sm:px-6 border-r border-border/20">
                      <div className="text-[11px] text-muted-foreground/40 mb-1">Funded Wallet:</div>
                      <div className="text-[13px] font-medium tabular-nums text-foreground">
                        {formatNumber(walletBalance ?? 0, 4)} SOL
                      </div>
                    </div>
                    <div className="pl-4 sm:pl-6">
                      <div className="text-[11px] text-muted-foreground/40 mb-1">Open Positions:</div>
                      <div className="text-[13px] font-medium tabular-nums text-foreground">
                        {openPositions.length}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => toast('Deposit coming soon')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[12px] font-semibold rounded-lg hover:bg-primary/90 transition-colors uppercase tracking-wide"
                    >
                      Deposit
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <button
                      onClick={() => toast('Trade feature coming soon')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-secondary/60 text-foreground text-[12px] font-semibold rounded-lg border border-border/30 hover:bg-secondary/80 transition-colors uppercase tracking-wide"
                    >
                      Trade
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="17 1 21 5 17 9" />
                        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                        <polyline points="7 23 3 19 7 15" />
                        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                    </button>
                    <button
                      onClick={() => toast('Send feature coming soon')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-secondary/60 text-foreground text-[12px] font-semibold rounded-lg border border-border/30 hover:bg-secondary/80 transition-colors uppercase tracking-wide"
                    >
                      Send
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="7" y1="17" x2="17" y2="7" />
                        <polyline points="7 7 17 7 17 17" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Right: Chart */}
                <div className="flex-1 min-w-0 pt-2 hidden sm:block">
                  <div className="h-[200px] w-full">
                    <PortfolioChart data={equityData} positive={pnlPositive} />
                  </div>
                  {/* Time axis labels */}
                  <div className="flex justify-between px-1 mt-1">
                    {['06:00', '12:00', '18:00', '00:00', '06:00', '12:00', '18:00'].map((t, i) => (
                      <span key={i} className="text-[9px] text-muted-foreground/40 tabular-nums">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Divider */}
            <div className="border-t border-border/15 mt-8 mb-0" />

            {/* ============================================ */}
            {/* PORTFOLIO TABLE SECTION                       */}
            {/* ============================================ */}
            <FadeIn delay={80}>
              <div className="flex items-center justify-between mt-6 mb-4">
                <h2 className="text-[16px] font-semibold text-foreground">Portfolio</h2>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
                >
                  View all
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-6 border-b border-border/20 mb-0">
                <TabBtn active={activeTab === 'assets'} label="Assets" onClick={() => setActiveTab('assets')} />
                <TabBtn active={activeTab === 'orders'} label="Open Orders" count={positions.length} onClick={() => setActiveTab('orders')} />
              </div>
            </FadeIn>

            {/* ============================================ */}
            {/* TABLE CONTENT                                */}
            {/* ============================================ */}
            <FadeIn delay={120} className="pb-16">

              {/* --- ASSETS TAB --- */}
              {activeTab === 'assets' && (
                <div>
                  {holdingsLoading && portfolioData.holdings.length === 0 && (
                    <div className="flex items-center justify-center py-16">
                      <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
                      <span className="text-[13px] text-muted-foreground/40">Loading holdings...</span>
                    </div>
                  )}

                  {!holdingsLoading && portfolioData.holdings.length === 0 && (
                    <div className="text-center py-16">
                      <p className="text-[13px] text-muted-foreground/40">No token holdings found</p>
                      <p className="text-[11px] text-muted-foreground/40 mt-1">Deposit SOL or SPL tokens to see them here</p>
                    </div>
                  )}

                  {/* Column headers */}
                  {portfolioData.holdings.length > 0 && (
                  <>
                  <div className="hidden sm:grid grid-cols-[minmax(140px,1.5fr)_90px_90px_100px_120px_130px_40px] items-center gap-3 px-3 py-3 border-b border-border/10">
                    <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold">Name</span>
                    <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold text-right">Allocation</span>
                    <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold text-right">24H Change</span>
                    <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold text-right">Price</span>
                    <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold text-right">Balance</span>
                    <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold text-right">Estimated Value</span>
                    <span />
                  </div>

                  {/* Token rows */}
                  {portfolioData.holdings.map((h, i) => {
                    const isUp = h.change >= 0;
                    const fmtBal = h.amount >= 1_000_000
                      ? `${(h.amount / 1_000_000).toFixed(2)}M ${h.ticker}`
                      : h.amount >= 1_000
                      ? `${(h.amount / 1_000).toFixed(1)}K ${h.ticker}`
                      : `${h.amount.toFixed(h.amount < 1 ? 6 : 4)} ${h.ticker}`;

                    return (
                      <React.Fragment key={h.symbol}>
                        {/* Desktop row */}
                        <div
                          onClick={() => navigate(`/terminal/${h.mint}`)}
                          className="hidden sm:grid grid-cols-[minmax(140px,1.5fr)_90px_90px_100px_120px_130px_40px] items-center gap-3 px-3 py-3.5 border-b border-border/6 hover:bg-secondary/15 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <TokenLogo symbol={h.symbol} size={32} logoUrl={h.logoUrl} />
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">{h.name}</div>
                              <div className="text-[11px] text-muted-foreground/40 truncate">{h.ticker}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[13px] text-foreground/80 tabular-nums font-medium">{h.allocation.toFixed(2)}%</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-[13px] tabular-nums font-medium ${isUp ? 'text-success' : 'text-destructive'}`}>
                              {isUp ? '+' : ''}{h.change.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[13px] text-foreground/70 tabular-nums">{formatPrice(h.price)} USD</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[13px] text-foreground/70 tabular-nums">{fmtBal}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[13px] font-semibold text-foreground tabular-nums">{formatPrice(h.value)} USD</span>
                          </div>
                          <div className="text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); toast('Token details coming soon'); }}
                              className="text-[11px] text-muted-foreground/45 hover:text-muted-foreground/60 transition-colors flex items-center gap-0.5 ml-auto"
                            >
                              MORE
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Mobile card */}
                        <div
                          onClick={() => navigate(`/terminal/${h.mint}`)}
                          className="sm:hidden flex items-center gap-3 px-3 py-3.5 border-b border-border/6 active:bg-secondary/15 transition-colors cursor-pointer"
                        >
                          <TokenLogo symbol={h.symbol} size={36} logoUrl={h.logoUrl} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[14px] font-semibold text-foreground truncate">{h.name}</span>
                              <span className="text-[14px] font-semibold text-foreground tabular-nums">{formatPrice(h.value)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[12px] text-muted-foreground/50">{h.ticker} - {h.allocation.toFixed(1)}%</span>
                              <span className={`text-[12px] tabular-nums font-medium ${isUp ? 'text-success' : 'text-destructive'}`}>
                                {isUp ? '+' : ''}{h.change.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                  </>
                  )}
                </div>
              )}

              {/* --- OPEN ORDERS TAB --- */}
              {activeTab === 'orders' && (
                <div>
                  {positions.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-12 h-12 mx-auto rounded-xl bg-secondary/20 flex items-center justify-center mb-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/45">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5" />
                          <path d="M2 12l10 5 10-5" />
                        </svg>
                      </div>
                      <p className="text-[13px] text-muted-foreground/40">No open orders</p>
                      <p className="text-[11px] text-muted-foreground/40 mt-1">Open a trade from the Terminal</p>
                    </div>
                  ) : (
                    <>
                      {/* Column headers - desktop only */}
                      <div className="hidden sm:grid grid-cols-[1.5fr_80px_90px_90px_100px_100px_80px] items-center gap-3 px-3 py-3 border-b border-border/10">
                        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold">Pair</span>
                        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold text-right">Side</span>
                        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold text-right">Size</span>
                        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold text-right">Entry</span>
                        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold text-right">Mark</span>
                        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold text-right">PnL</span>
                        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold text-right">Liq.</span>
                      </div>

                      {positions.map(pos => {
                        const pnl = pos.liveProfit ?? 0;
                        const pnlPct = pos.liveProfitPercent ?? 0;
                        const isProfit = pnl >= 0;
                        const currentPrice = pos.currentPrice ?? pos.entryPrice;

                        return (
                          <React.Fragment key={pos.trade_id}>
                            {/* Desktop row */}
                            <div
                              className="hidden sm:grid grid-cols-[1.5fr_80px_90px_90px_100px_100px_80px] items-center gap-3 px-3 py-3.5 border-b border-border/6 hover:bg-secondary/15 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <TokenLogo symbol={pos.symbol} size={28} />
                                <div>
                                  <span className="text-[13px] font-semibold text-foreground">{pos.symbol}/USDT</span>
                                  <span className="text-[11px] text-muted-foreground/45 block">{pos.leverage}x</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded ${
                                  pos.side === 'buy'
                                    ? 'bg-success/10 text-success'
                                    : 'bg-destructive/10 text-destructive'
                                }`}>
                                  {pos.side === 'buy' ? 'BUY' : 'SELL'}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[13px] text-foreground/70 tabular-nums">{pos.amount.toFixed(4)} SOL</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[13px] text-foreground/70 tabular-nums">{formatPrice(pos.entryPrice)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[13px] text-foreground tabular-nums font-medium">{formatPrice(currentPrice)}</span>
                              </div>
                              <div className="text-right">
                                <div className={`text-[13px] font-semibold tabular-nums ${isProfit ? 'text-success' : 'text-destructive'}`}>
                                  {isProfit ? '+' : ''}{formatPrice(pnl)}
                                </div>
                                <div className={`text-[10px] tabular-nums ${isProfit ? 'text-success/50' : 'text-destructive/50'}`}>
                                  {formatPercent(pnlPct)}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[13px] text-destructive/60 tabular-nums">
                                  {pos.liquidationPrice ? formatPrice(pos.liquidationPrice) : 'N/A'}
                                </span>
                              </div>
                            </div>

                            {/* Mobile card */}
                            <div
                              className="sm:hidden px-3 py-4 border-b border-border/6 active:bg-secondary/15 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <TokenLogo symbol={pos.symbol} size={28} />
                                  <div>
                                    <span className="text-[14px] font-semibold text-foreground">{pos.symbol}/USDT</span>
                                    <span className="text-[11px] text-muted-foreground/40 ml-1.5">{pos.leverage}x</span>
                                  </div>
                                </div>
                                <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded ${
                                  pos.side === 'buy'
                                    ? 'bg-success/10 text-success'
                                    : 'bg-destructive/10 text-destructive'
                                }`}>
                                  {pos.side === 'buy' ? 'BUY' : 'SELL'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground/40">Size</span>
                                  <span className="text-foreground/70 tabular-nums">{pos.amount.toFixed(4)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground/40">Entry</span>
                                  <span className="text-foreground/70 tabular-nums">{formatPrice(pos.entryPrice)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground/40">Mark</span>
                                  <span className="text-foreground tabular-nums font-medium">{formatPrice(currentPrice)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground/40">PnL</span>
                                  <span className={`tabular-nums font-semibold ${isProfit ? 'text-success' : 'text-destructive'}`}>
                                    {isProfit ? '+' : ''}{formatPrice(pnl)} ({formatPercent(pnlPct)})
                                  </span>
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}

                      {/* Summary */}
                      <div className="flex items-center gap-4 sm:gap-8 px-3 py-4 mt-1 flex-wrap">
                        <div>
                          <span className="text-[10px] text-muted-foreground/45 uppercase tracking-wider">Total Margin</span>
                          <span className="text-[13px] font-medium text-foreground tabular-nums ml-2">
                            {positions.reduce((s, p) => s + p.amount, 0).toFixed(4)} SOL
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground/45 uppercase tracking-wider">Unrealized PnL</span>
                          <span className={`text-[13px] font-medium tabular-nums ml-2 ${
                            positions.reduce((s, p) => s + (p.liveProfit ?? 0), 0) >= 0 ? 'text-success' : 'text-destructive'
                          }`}>
                            {positions.reduce((s, p) => s + (p.liveProfit ?? 0), 0) >= 0 ? '+' : ''}
                            {formatPrice(positions.reduce((s, p) => s + (p.liveProfit ?? 0), 0))}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </FadeIn>

          </PageTransition>
        </div>
      )}
      <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </div>
  );
}
