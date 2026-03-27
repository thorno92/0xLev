/*
 * POSITIONS -- Swiss Precision Design
 * Monospace labels, flat surfaces, hairline borders, data-first.
 */

import { useState, useMemo } from 'react';
import { PageTransition, StaggerContainer } from '@/components/PageTransition';
import { Header } from '@/components/Header';
import { useStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';
import { formatPrice, formatNumber, formatPercent, formatTimeAgo } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Xmark, EditPencil } from 'iconoir-react';
import { TokenLogo } from '@/components/TokenLogo';
import { MiniSparkline, generateSparklineData } from '@/components/MiniSparkline';
import { WalletConnectModal } from '@/components/WalletConnectModal';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import { useTradeWalletBalance } from '@/hooks/useTradeWalletBalance';
import { useTrackPositions } from '@/hooks/useTrackPositions';

/* ------------------------------------------------------------------ */
/*  SECTION LABEL                                                      */
/* ------------------------------------------------------------------ */
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */
function getLiqDistance(liqPrice: number, currentPrice: number, side: string) {
  if (!liqPrice || !currentPrice || currentPrice === 0) return 100;
  return side === 'buy'
    ? ((currentPrice - liqPrice) / currentPrice) * 100
    : ((liqPrice - currentPrice) / currentPrice) * 100;
}

function getHealthColor(dist: number) {
  if (dist > 20) return 'var(--success)';
  if (dist > 10) return 'var(--warning)';
  return 'var(--destructive)';
}

function getHealthLabel(dist: number) {
  if (dist > 20) return 'SAFE';
  if (dist > 10) return 'CAUTION';
  return 'DANGER';
}

function getHealthTextClass(dist: number) {
  if (dist > 20) return 'text-success';
  if (dist > 10) return 'text-warning';
  return 'text-destructive';
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                               */
/* ------------------------------------------------------------------ */
export default function Positions() {
  const { openPositions, removeOpenPosition, addClosedPosition, updatePositionTpSl, walletConnected, walletAddress } = useStore();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const closeMutation = trpc.leverage.closePosition.useMutation();
  const updateTpSlMutation = trpc.leverage.updateTpSl.useMutation();
  const [isClosing, setIsClosing] = useState<string | null>(null);
  const [editingTpSl, setEditingTpSl] = useState<{ tradeId: string; tp: string; sl: string } | null>(null);

  useTradeWalletBalance();
  useTrackPositions();

  const positions = openPositions;

  const [, setLocation] = useLocation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleClosePosition = async (tradeId: string, symbol: string) => {
    if (!walletAddress) return;
    setIsClosing(tradeId);
    try {
      await closeMutation.mutateAsync({
        walletAddress,
        tradeId,
        solTip: 0.001,
        slippage: 1.0,
        tokenAmount: 100,
      });
      const pos = openPositions.find(p => p.trade_id === tradeId);
      if (pos) {
        addClosedPosition({
          ...pos,
          closedAt: Date.now(),
          exitPrice: pos.currentPrice ?? pos.entryPrice,
          realizedPnl: pos.liveProfit ?? 0,
        });
      }
      removeOpenPosition(tradeId);
      toast.success(`Closed ${symbol} position`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to close position';
      toast.error(message);
    } finally {
      setIsClosing(null);
    }
  };

  const handleUpdateTpSl = async () => {
    if (!walletAddress || !editingTpSl) return;
    const tp = editingTpSl.tp ? parseFloat(editingTpSl.tp) : undefined;
    const sl = editingTpSl.sl ? parseFloat(editingTpSl.sl) : undefined;
    try {
      await updateTpSlMutation.mutateAsync({
        walletAddress,
        tradeId: editingTpSl.tradeId,
        tp,
        sl,
      });
      updatePositionTpSl(editingTpSl.tradeId, tp, sl);
      toast.success('TP/SL updated');
      setEditingTpSl(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update TP/SL';
      toast.error(message);
    }
  };

  /* -- Metrics -- */
  const totalPnl = positions.reduce((a, p) => a + (p.liveProfit ?? 0), 0);
  const totalMargin = positions.reduce((a, p) => a + p.amount * p.entryPrice, 0);
  const totalNotional = positions.reduce((a, p) => a + p.amount * p.entryPrice * p.leverage, 0);
  const longCount = positions.filter(p => p.side === 'buy').length;
  const shortCount = positions.filter(p => p.side === 'sell').length;
  const avgLeverage = positions.length > 0 ? positions.reduce((a, p) => a + p.leverage, 0) / positions.length : 0;
  const maxLeverage = positions.length > 0 ? Math.max(...positions.map(p => p.leverage)) : 0;
  const winCount = positions.filter(p => (p.liveProfit ?? 0) >= 0).length;

  const riskScore = useMemo(() => {
    if (positions.length === 0) return 0;
    const leverageRisk = Math.min(avgLeverage / 50, 1) * 50;
    const concentrationRisk = (1 - (positions.length / 10)) * 30;
    const pnlRisk = totalPnl < 0 ? 20 : 0;
    return Math.max(0, Math.min(100, leverageRisk + concentrationRisk + pnlRisk));
  }, [positions, avgLeverage, totalPnl]);

  const nearestLiq = useMemo(() => {
    if (positions.length === 0) return { dist: 100, symbol: '' };
    return positions.reduce((min, p) => {
      const dist = getLiqDistance(p.liquidationPrice ?? 0, p.currentPrice ?? 0, p.side);
      return dist < min.dist ? { dist, symbol: p.symbol } : min;
    }, { dist: 100, symbol: '' });
  }, [positions]);

  const handleConnect = () => {
    setWalletModalOpen(true);
  };

  return (
    <div className="h-screen-safe w-full flex flex-col overflow-hidden bg-background">
      <Header />
      <div className="flex-1 overflow-auto">
        {!walletConnected ? (
          <PageTransition className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-24 md:pb-6 flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-sm space-y-6">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6" />
                </svg>
              </div>
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Connect your wallet</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  View and manage your open leverage positions in real-time.
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6" />
                </svg>
                Connect Wallet
              </button>
            </div>
          </PageTransition>
        ) : positions.length === 0 ? (
          <PageTransition className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-24 md:pb-6 flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md space-y-6">
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">NO OPEN POSITIONS</div>
              <p className="text-sm text-muted-foreground">Open a trade from the Terminal to see it here.</p>
              <button
                 onClick={() => setLocation('/terminal')}
                className="font-mono text-[11px] tracking-[0.1em] uppercase px-6 py-2.5 border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              >
                GO TO TERMINAL
              </button>
            </div>
          </PageTransition>
        ) : (
          <PageTransition className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-24 md:pb-6">
            <StaggerContainer className="space-y-10">

              {/* == HEADER == */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
                    OPEN POSITIONS
                  </div>
                  <div className="flex items-baseline gap-4 flex-wrap">
                    <span className="font-data text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                      {positions.length}
                    </span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-success font-mono text-[11px]">{longCount}L</span>
                      <span className="text-muted-foreground/45">/</span>
                      <span className="text-destructive font-mono text-[11px]">{shortCount}S</span>
                    </div>
                    <span className={`font-data text-lg font-medium ${totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {totalPnl >= 0 ? '+' : ''}${formatNumber(Math.abs(totalPnl), 2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* == RISK METRICS == */}
              <div>
                <SectionLabel label="RISK OVERVIEW" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-[1px] bg-border/30 border border-border rounded overflow-hidden">
                  {[
                    { label: 'TOTAL MARGIN', value: `$${formatNumber(totalMargin, 2)}`, positive: null as boolean | null },
                    { label: 'NOTIONAL', value: `$${formatNumber(totalNotional, 0)}`, positive: null },
                    { label: 'RISK SCORE', value: `${riskScore.toFixed(0)}/100`, positive: riskScore < 40 ? true : riskScore < 60 ? null : false },
                    { label: 'AVG LEVERAGE', value: `${avgLeverage.toFixed(1)}x`, positive: avgLeverage < 10 ? true : avgLeverage < 20 ? null : false },
                    { label: 'MAX LEVERAGE', value: `${maxLeverage}x`, positive: maxLeverage < 15 ? true : maxLeverage < 25 ? null : false },
                    { label: 'NEAREST LIQ', value: `${nearestLiq.dist.toFixed(1)}%`, positive: nearestLiq.dist > 20 ? true : nearestLiq.dist > 10 ? null : false },
                  ].map(stat => (
                    <div key={stat.label} className="p-4 bg-card/50">
                      <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground mb-1.5">{stat.label}</div>
                      <div className={`font-data text-base font-semibold ${
                        stat.positive === true ? 'text-success' : stat.positive === false ? 'text-destructive' : 'text-foreground'
                      }`}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* == POSITION LIST == */}
              <div>
                <SectionLabel label="ACTIVE POSITIONS" />

                {/* Desktop table */}
                <div className="hidden md:block border border-border overflow-hidden">
                  <div className="grid grid-cols-[2fr_80px_1fr_80px_1fr_1fr_1fr_1fr_80px_80px] gap-2 px-4 py-3 border-b border-border">
                    {['ASSET', 'SIDE', 'SIZE', 'LEV', 'ENTRY', 'MARK', 'LIQ', 'P&L', 'CHART', 'ACTION'].map(h => (
                      <div key={h} className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground">{h}</div>
                    ))}
                  </div>
                  {positions.map(pos => {
                    const pnl = pos.liveProfit ?? 0;
                    const isProfit = pnl >= 0;
                    const currentPrice = pos.currentPrice ?? pos.entryPrice;
                    const liqPrice = pos.liquidationPrice ?? 0;
                    const dist = getLiqDistance(liqPrice, currentPrice, pos.side);

                    return (
                      <div
                        key={pos.trade_id}
                        className="grid grid-cols-[2fr_80px_1fr_80px_1fr_1fr_1fr_1fr_80px_80px] gap-2 px-4 py-3 border-b border-border/30 hover:bg-secondary/20 transition-colors items-center"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <TokenLogo symbol={pos.symbol} size={24} />
                            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background" style={{ backgroundColor: getHealthColor(dist) }} />
                          </div>
                          <div>
                            <div className="font-medium text-sm text-foreground">{pos.symbol}</div>
                            <div className="font-mono text-[9px] text-muted-foreground/50">{formatTimeAgo(pos.openedAt)}</div>
                          </div>
                        </div>
                        <div>
                          <span className={`font-mono text-[10px] tracking-wider uppercase px-1.5 py-0.5 border ${
                            pos.side === 'buy' ? 'text-success border-success/30' : 'text-destructive border-destructive/30'
                          }`}>
                            {pos.side}
                          </span>
                        </div>
                        <div className="font-data text-sm text-foreground">{formatNumber(pos.amount, 4)}</div>
                        <div className={`font-data text-sm font-medium ${pos.leverage >= 25 ? 'text-destructive' : pos.leverage >= 10 ? 'text-warning' : 'text-foreground'}`}>
                          {pos.leverage}x
                        </div>
                        <div className="font-data text-sm text-foreground">{formatPrice(pos.entryPrice)}</div>
                        <div className="font-data text-sm text-foreground font-medium">{formatPrice(currentPrice)}</div>
                        <div>
                          <div className={`font-data text-sm ${getHealthTextClass(dist)}`}>
                            {liqPrice ? formatPrice(liqPrice) : 'N/A'}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="h-1 flex-1 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(dist * 2, 100)}%`, backgroundColor: getHealthColor(dist) }} />
                            </div>
                            <span className={`font-mono text-[8px] ${getHealthTextClass(dist)}`}>{getHealthLabel(dist)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-data text-sm font-semibold ${isProfit ? 'text-success' : 'text-destructive'}`}>
                            {isProfit ? '+' : ''}{formatPrice(pnl)}
                          </div>
                          <div className={`font-mono text-[10px] ${isProfit ? 'text-success/60' : 'text-destructive/60'}`}>
                            {formatPercent(pos.liveProfitPercent ?? 0)}
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <MiniSparkline
                            data={generateSparklineData(`pos-${pos.trade_id}`, 20)}
                            width={60}
                            height={22}
                            strokeWidth={1}
                            color={isProfit ? 'var(--success)' : 'var(--destructive)'}
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleClosePosition(pos.trade_id, pos.symbol)}
                            disabled={isClosing === pos.trade_id}
                            className="font-mono text-[10px] tracking-[0.05em] uppercase px-3 py-1.5 border border-destructive/30 text-destructive hover:bg-destructive hover:text-white transition-all disabled:opacity-50 whitespace-nowrap"
                          >
                            {isClosing === pos.trade_id ? 'CLOSING...' : 'CLOSE'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {positions.map(pos => {
                    const pnl = pos.liveProfit ?? 0;
                    const isProfit = pnl >= 0;
                    const currentPrice = pos.currentPrice ?? pos.entryPrice;
                    const liqPrice = pos.liquidationPrice ?? 0;
                    const dist = getLiqDistance(liqPrice, currentPrice, pos.side);
                    const isExpanded = expandedId === pos.trade_id;

                    return (
                      <div
                        key={pos.trade_id}
                        className="border border-border p-4 hover:border-primary/20 active:bg-secondary/10 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : pos.trade_id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <TokenLogo symbol={pos.symbol} size={28} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground truncate max-w-[120px]">{pos.symbol}</span>
                                <span className={`font-mono text-[10px] tracking-wider uppercase px-1.5 py-0.5 border ${
                                  pos.side === 'buy' ? 'text-success border-success/30' : 'text-destructive border-destructive/30'
                                }`}>
                                  {pos.side} {pos.leverage}x
                                </span>
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{formatTimeAgo(pos.openedAt)}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-data text-base font-semibold ${isProfit ? 'text-success' : 'text-destructive'}`}>
                              {isProfit ? '+' : ''}{formatPrice(pnl)}
                            </div>
                            <div className={`font-mono text-[10px] ${isProfit ? 'text-success/60' : 'text-destructive/60'}`}>
                              {formatPercent(pos.liveProfitPercent ?? 0)}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {[
                                { label: 'SIZE', value: formatNumber(pos.amount, 4) },
                                { label: 'ENTRY', value: formatPrice(pos.entryPrice) },
                                { label: 'MARK', value: formatPrice(currentPrice) },
                                { label: 'LIQ', value: liqPrice ? formatPrice(liqPrice) : 'N/A' },
                              ].map(s => (
                                <div key={s.label}>
                                  <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground">{s.label}</div>
                                  <div className="font-data text-[11px] text-foreground mt-0.5">{s.value}</div>
                                </div>
                              ))}
                            </div>

                            {/* TP/SL Edit */}
                            {editingTpSl?.tradeId === pos.trade_id ? (
                              <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                                <div>
                                  <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground mb-1">TAKE PROFIT</div>
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="TP price"
                                    value={editingTpSl.tp}
                                    onChange={(e) => setEditingTpSl({ ...editingTpSl, tp: e.target.value })}
                                    className="h-7 bg-secondary border-border text-foreground font-data text-[11px]"
                                  />
                                </div>
                                <div>
                                  <div className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground mb-1">STOP LOSS</div>
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="SL price"
                                    value={editingTpSl.sl}
                                    onChange={(e) => setEditingTpSl({ ...editingTpSl, sl: e.target.value })}
                                    className="h-7 bg-secondary border-border text-foreground font-data text-[11px]"
                                  />
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdateTpSl(); }}
                                  disabled={updateTpSlMutation.isPending}
                                  className="font-mono text-[10px] tracking-[0.1em] uppercase py-2 border border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-50"
                                >
                                  {updateTpSlMutation.isPending ? 'SAVING...' : 'SAVE'}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingTpSl(null); }}
                                  className="font-mono text-[10px] tracking-[0.1em] uppercase py-2 border border-border text-muted-foreground hover:text-foreground transition-all"
                                >
                                  CANCEL
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="flex gap-4 text-[10px]">
                                  <span className="text-muted-foreground">TP: <span className="text-success font-data">{pos.tp ? formatPrice(pos.tp) : '---'}</span></span>
                                  <span className="text-muted-foreground">SL: <span className="text-destructive font-data">{pos.sl ? formatPrice(pos.sl) : '---'}</span></span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTpSl({
                                      tradeId: pos.trade_id,
                                      tp: pos.tp?.toString() ?? '',
                                      sl: pos.sl?.toString() ?? '',
                                    });
                                  }}
                                  className="text-muted-foreground hover:text-primary transition-colors p-1"
                                  title="Edit TP/SL"
                                >
                                  <EditPencil className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground">LIQ DISTANCE</span>
                                <span className={`font-mono text-[10px] ${getHealthTextClass(dist)}`}>{dist.toFixed(1)}% {getHealthLabel(dist)}</span>
                              </div>
                              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(dist * 2, 100)}%`, backgroundColor: getHealthColor(dist) }} />
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleClosePosition(pos.trade_id, pos.symbol); }}
                              disabled={isClosing === pos.trade_id}
                              className="w-full font-mono text-[10px] tracking-[0.1em] uppercase py-2.5 border border-destructive/30 text-destructive hover:bg-destructive hover:text-white active:bg-destructive active:text-white transition-all min-h-[40px] disabled:opacity-50"
                            >
                              {isClosing === pos.trade_id ? 'CLOSING...' : 'CLOSE POSITION'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* == RISK ANALYSIS + ALLOCATION == */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Analysis */}
                <div>
                  <SectionLabel label="RISK ANALYSIS" />
                  <div className="border border-border overflow-hidden">
                    {[
                      { label: 'PORTFOLIO EXPOSURE', value: `$${formatNumber(totalNotional, 0)}`, sub: 'Total notional value' },
                      { label: 'MARGIN COMMITTED', value: `$${formatNumber(totalMargin, 2)}`, sub: 'Total margin in positions' },
                      { label: 'LONG/SHORT RATIO', value: `${longCount}/${shortCount}`, sub: `${positions.length > 0 ? ((longCount / positions.length) * 100).toFixed(0) : 0}% long` },
                      { label: 'NEAREST LIQUIDATION', value: `${nearestLiq.dist.toFixed(1)}%`, sub: `${nearestLiq.symbol} distance` },
                      { label: 'AVG POSITION SIZE', value: `$${formatNumber(totalMargin / Math.max(positions.length, 1), 2)}`, sub: 'Per position margin' },
                      { label: 'WIN / LOSS', value: `${winCount} / ${positions.length - winCount}`, sub: `${positions.length > 0 ? ((winCount / positions.length) * 100).toFixed(0) : 0}% win rate` },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between px-4 py-3 border-b border-border/30 last:border-0">
                        <div>
                          <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground">{item.label}</div>
                          <div className="font-mono text-[9px] text-muted-foreground/40 mt-0.5">{item.sub}</div>
                        </div>
                        <span className="font-data text-sm font-semibold text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Margin Allocation */}
                <div>
                  <SectionLabel label="MARGIN ALLOCATION" />
                  <div className="border border-border p-5">
                    <div className="space-y-3">
                      {positions.map((pos, i) => {
                        const margin = pos.amount * pos.entryPrice;
                        const pct = totalMargin > 0 ? (margin / totalMargin) * 100 : 0;
                        const colors = ['var(--primary)', 'var(--success)', 'var(--chart-2)', 'var(--warning)', 'var(--destructive)'];
                        return (
                          <div key={pos.trade_id}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <TokenLogo symbol={pos.symbol} size={18} />
                                <span className="font-mono text-[11px] text-foreground">{pos.symbol}</span>
                                <span className={`font-mono text-[9px] ${pos.side === 'buy' ? 'text-success' : 'text-destructive'}`}>
                                   {pos.side === 'buy' ? 'BUY' : 'SELL'} {pos.leverage}x                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-data text-[11px] text-foreground">${formatNumber(margin, 2)}</span>
                                <span className="font-mono text-[10px] text-muted-foreground/50 ml-2">{pct.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-8" />
            </StaggerContainer>
          </PageTransition>
        )}
      </div>
      <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </div>
  );
}
