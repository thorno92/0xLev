import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { SkeletonTable } from '@/components/Skeleton';
import { OpenNewWindow, Globe } from 'iconoir-react';
import { TokenLogo } from '@/components/TokenLogo';
import { useStore } from '@/lib/store';
import { mockTransactions, mockTopTraders, mockHolderData, mockSocialPosts } from '@/lib/mockData';
import { formatPrice, formatNumber, formatPercent, formatCompact } from '@/lib/format';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useTrackPositions } from '@/hooks/useTrackPositions';

const tabs = ['Transactions', 'Open Positions', 'Top Traders', 'Holder Analysis', 'Social'] as const;
type Tab = typeof tabs[number];

export function BottomPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('Transactions');
  const [isLoading, setIsLoading] = useState(true);
  const { openPositions, selectedToken, walletAddress, walletConnected } = useStore();
  const posCount = openPositions.length;

  useTrackPositions();

  const wlRequestMutation = trpc.leverage.requestWhitelist.useMutation({
    onSuccess: (result) => {
      toast.success(result.alreadyWhitelisted ? 'Already whitelisted' : 'Whitelist requested');
    },
    onError: (err) => toast.error(err.message || 'Failed to request whitelist'),
  });
  const whitelistRequested = wlRequestMutation.isSuccess;

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, [selectedToken?.address]);

  const [tabLoading, setTabLoading] = useState(false);
  useEffect(() => {
    setTabLoading(true);
    const timer = setTimeout(() => setTabLoading(false), 400);
    return () => clearTimeout(timer);
  }, [activeTab]);

  return (
    <div className="flex flex-col bg-card border-t border-border h-full">
      {/* ── MOBILE Tab Bar: 3-col grid, whitelist fills the 6th cell ── */}
      <div className="sm:hidden shrink-0 border-b border-border">
        <div className="grid grid-cols-3 gap-px bg-border/30">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 text-[11px] font-medium transition-colors text-center relative ${
                activeTab === tab
                  ? 'text-foreground bg-card'
                  : 'text-muted-foreground/60 bg-card hover:text-foreground'
              }`}
            >
              <span className="flex items-center justify-center gap-1">
                {tab === 'Open Positions' ? 'Positions' : tab === 'Holder Analysis' ? 'Holders' : tab}
                {tab === 'Open Positions' && posCount > 0 && (
                  <span className="text-[9px] font-data bg-primary/12 text-primary px-1 py-px rounded font-medium">
                    {posCount}
                  </span>
                )}
              </span>
              {activeTab === tab && (
                <motion.div
                  layoutId="bottom-panel-tab-mobile"
                  className="absolute bottom-0 left-1 right-1 h-[2px] bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
          {/* 6th cell — Whitelist button fills the gap */}
          <button
            onClick={() => {
              if (!whitelistRequested && walletAddress && selectedToken?.address) {
                wlRequestMutation.mutate({ walletAddress, contractAddress: selectedToken.address });
              }
            }}
            disabled={wlRequestMutation.isPending || !walletConnected}
            className={`py-2 text-[11px] font-semibold transition-colors text-center bg-card flex items-center justify-center gap-1 ${
              !walletConnected
                ? 'text-muted-foreground/45 cursor-default'
                : whitelistRequested
                ? 'text-success'
                : 'text-primary'
            }`}
          >
            {whitelistRequested ? '✓ Whitelisted' : 'Whitelist'}
          </button>
        </div>
      </div>

      {/* ── DESKTOP Tab Bar: horizontal row ── */}
      <div className="hidden sm:flex items-center border-b border-border shrink-0">
        <div className="flex items-center shrink-0 px-0.5">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors relative flex items-center gap-1 tab-hover whitespace-nowrap shrink-0 ${
                activeTab === tab
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {tab === 'Open Positions' && posCount > 0 && (
                <span className="text-[9px] font-data bg-primary/12 text-primary px-1 py-px rounded font-medium">
                  {posCount}
                </span>
              )}
              {activeTab === tab && (
                <motion.div
                  layoutId="bottom-panel-tab"
                  className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-primary"
                  style={{ boxShadow: '0 0 8px var(--glow), 0 0 16px var(--glow-subtle)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Social Links */}
        <div className="flex items-center gap-0.5 mr-2 shrink-0">
          <a href="#" data-todo="0xLeverage-social-url" target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary icon-btn-hover"
            aria-label="Visit website"
            title="Website"
          >
            <Globe className="w-3 h-3" />
          </a>
          <a href="#" data-todo="0xLeverage-social-url" target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary icon-btn-hover"
            aria-label="Follow on X"
            title="Twitter"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a href="#" data-todo="0xLeverage-social-url" target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary icon-btn-hover"
            aria-label="Join Telegram"
            title="Telegram"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </a>
        </div>

        {/* Score */}
        <div className="flex items-center gap-1 mr-2 shrink-0">
          <span className="text-[9px] text-muted-foreground">Score</span>
          <span className="text-[11px] font-data font-bold text-warning">78/100</span>
        </div>

        {/* Request Whitelist Button */}
        <button
          onClick={() => {
            if (!whitelistRequested && walletAddress && selectedToken?.address) {
              wlRequestMutation.mutate({ walletAddress, contractAddress: selectedToken.address });
            }
          }}
          disabled={wlRequestMutation.isPending || !walletConnected}
          className={`px-3 py-1 text-[10px] font-semibold rounded transition-colors mr-1 flex items-center gap-1 btn-hover shrink-0 whitespace-nowrap ${
            whitelistRequested
              ? 'bg-success/10 text-success border border-success/20 cursor-default'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {whitelistRequested ? 'Whitelist Requested' : 'Request Whitelist'}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto data-scroll">
        <div key={`${activeTab}-${isLoading || tabLoading}`} className="tab-content-enter h-full">
          {(isLoading || tabLoading) ? (
            <SkeletonTable
              columns={activeTab === 'Transactions' ? 7 : activeTab === 'Open Positions' ? 8 : 6}
              rows={6}
              headers={activeTab === 'Transactions'
                ? ['DATE', 'TYPE', 'PRICE', 'UTILITY', 'SOL', 'MAKER', 'TXN']
                : activeTab === 'Open Positions'
                ? ['TOKEN', 'SIDE', 'AMOUNT', 'LEVERAGE', 'ENTRY', 'MARK', 'P&L', 'CLOSE']
                : ['RANK', 'MAKER', 'VOLUME', 'TXNS', 'P&L', 'WIN RATE']
              }
            />
          ) : (
            <>
              {activeTab === 'Transactions' && <TransactionsTable />}
              {activeTab === 'Open Positions' && <OpenPositionsTable />}
              {activeTab === 'Top Traders' && <TopTradersTable />}
              {activeTab === 'Holder Analysis' && <HolderAnalysis />}
              {activeTab === 'Social' && <SocialScanner />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(unixSeconds: number): { time: string; ago: string } {
  const d = new Date(unixSeconds * 1000);
  const time = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const diffS = Math.floor((Date.now() - unixSeconds * 1000) / 1000);
  const ago = diffS < 60 ? `${diffS}s ago` : diffS < 3600 ? `${Math.floor(diffS / 60)}m ago` : `${Math.floor(diffS / 3600)}h ago`;
  return { time, ago };
}

function truncateMaker(address: string): string {
  if (address.length <= 7) return address;
  return address.slice(0, 4) + '...' + address.slice(-3);
}

function TransactionsTable() {
  const { selectedToken } = useStore();
  const tokenAddress = selectedToken?.address ?? '';

  const utils = trpc.useUtils();
  useEffect(() => {
    if (tokenAddress) {
      utils.leverage.getTokenTrades.invalidate({ tokenAddress });
    }
  }, [tokenAddress, utils.leverage.getTokenTrades]);

  const { data: birdeyeTrades } = trpc.leverage.getTokenTrades.useQuery(
    { tokenAddress, limit: 20 },
    { enabled: !!tokenAddress, refetchInterval: 15_000 },
  );

  // Use Birdeye data if available, otherwise fall back to mock
  const transactions = useMemo(() => {
    if (birdeyeTrades && birdeyeTrades.length > 0) {
      return birdeyeTrades.map((t) => {
        const { time, ago } = formatTimeAgo(t.blockUnixTime);
        return {
          time,
          date: ago,
          type: t.side === 'buy' ? 'Buy' as const : 'Sell' as const,
          price: t.price,
          amount: t.volume,
          sol: t.volumeNative,
          maker: t.maker,
          txn: t.txHash.slice(0, 4) + '...',
          txHash: t.txHash,
        };
      });
    }
    return mockTransactions.map((tx) => ({
      ...tx,
      amount: tx.utility,
      txHash: '',
    }));
  }, [birdeyeTrades]);

  return (
    <>
      {/* Mobile card layout */}
      <div className="sm:hidden divide-y divide-border/50">
        {transactions.map((tx, i) => (
          <div key={i} className="px-3 py-2.5">
            {/* Row 1: Type badge + time + maker */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  tx.type === 'Buy' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                }`}>
                  {tx.type}
                </span>
                <span className="text-[10px] text-muted-foreground font-data">{tx.time}</span>
                <span className="text-[9px] text-muted-foreground/50 font-data">{tx.date}</span>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(tx.maker); toast.info('Address copied'); }}
                className="text-primary text-[10px] font-data"
              >
                {truncateMaker(tx.maker)}
              </button>
            </div>
            {/* Row 2: Price + Amount + SOL value */}
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-[9px] text-muted-foreground/50 mr-1">Price</span>
                  <span className="font-data font-medium text-foreground">{formatPrice(tx.price)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground/50 mr-1">Amt</span>
                  <span className="font-data text-foreground/80">{formatNumber(tx.amount, 0)}</span>
                </div>
              </div>
              <span className={`font-data font-medium ${tx.type === 'Buy' ? 'text-success/80' : 'text-destructive/80'}`}>
                {tx.sol.toFixed(4)} SOL
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>SOL</th>
              <th>Maker</th>
              <th style={{ textAlign: 'center', width: 40 }}>TXN</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => (
              <tr key={i} className="row-hover">
                <td className="whitespace-nowrap">
                  <div className="text-foreground font-medium font-data text-[12px] leading-tight">{tx.time}</div>
                  <div className="text-muted-foreground/70 text-[10px] font-data leading-tight">{tx.date}</div>
                </td>
                <td>
                  <span className={`font-medium ${tx.type === 'Buy' ? 'text-success' : 'text-destructive'}`}>
                    {tx.type}
                  </span>
                </td>
                <td className="numeric">{formatPrice(tx.price)}</td>
                <td className="numeric">{formatNumber(tx.amount, 0)}</td>
                <td className="numeric">{tx.sol.toFixed(4)}</td>
                <td>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tx.maker);
                      toast.info('Address copied');
                    }}
                    className="text-primary hover:text-primary/80 font-data transition-colors text-[12px] badge-hover"
                  >
                    {truncateMaker(tx.maker)}
                  </button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className="text-muted-foreground hover:text-foreground transition-colors p-0.5 icon-btn-hover">
                    <OpenNewWindow className="w-2.5 h-2.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OpenPositionsTable() {
  const { openPositions, removeOpenPosition, addClosedPosition, walletAddress } = useStore();
  const closeMutation = trpc.leverage.closePosition.useMutation();
  const [isClosing, setIsClosing] = useState<string | null>(null);
  const positions = openPositions;

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

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[12px] text-muted-foreground">
        No open positions
      </div>
    );
  }

  return (
    <>
      {/* Mobile card layout */}
      <div className="sm:hidden divide-y divide-border/50">
        {positions.map((pos) => {
          const pnlPositive = (pos.liveProfit ?? 0) >= 0;
          return (
            <div key={pos.trade_id} className="px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <TokenLogo symbol={pos.symbol} size={16} />
                  <span className="text-[12px] font-medium text-foreground">{pos.symbol}</span>
                  <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
                    pos.side === 'buy' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {pos.side === 'buy' ? 'BUY' : 'SELL'} {pos.leverage}x
                  </span>
                </div>
                <span className={`text-[11px] font-data font-medium ${pnlPositive ? 'text-success' : 'text-destructive'}`}>
                  {pnlPositive ? '+' : ''}{formatPrice(pos.liveProfit ?? 0)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mb-2">
                <div><span className="text-muted-foreground">Entry</span> <span className="font-data text-foreground">{formatPrice(pos.entryPrice)}</span></div>
                <div><span className="text-muted-foreground">Mark</span> <span className="font-data text-foreground">{formatPrice(pos.currentPrice ?? 0)}</span></div>
                <div><span className="text-muted-foreground">Liq.</span> <span className="font-data text-warning">{pos.liquidationPrice ? formatPrice(pos.liquidationPrice) : 'N/A'}</span></div>
                <div><span className="text-muted-foreground">Size</span> <span className="font-data text-foreground">{formatNumber(pos.amount, 4)} SOL</span></div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">P&L %</span>{' '}
                  <span className={`font-data ${pnlPositive ? 'text-success' : 'text-destructive'}`}>{formatPercent(pos.liveProfitPercent ?? 0)}</span>
                </div>
              </div>
              <button
                onClick={() => handleClosePosition(pos.trade_id, pos.symbol)}
                disabled={isClosing === pos.trade_id}
                className="w-full h-7 text-[10px] font-semibold rounded transition-all duration-100 bg-destructive/8 text-destructive border border-destructive/20 hover:bg-destructive/15 hover:border-destructive/30 disabled:opacity-50 btn-hover"
              >
                {isClosing === pos.trade_id ? (
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  'Close Position'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th style={{ textAlign: 'right' }}>Size</th>
              <th style={{ textAlign: 'right' }}>Lev</th>
              <th style={{ textAlign: 'right' }}>Entry</th>
              <th style={{ textAlign: 'right' }}>Mark</th>
              <th style={{ textAlign: 'right' }}>Liq. Price</th>
              <th style={{ textAlign: 'right' }}>P&L</th>
              <th style={{ textAlign: 'center', width: 72 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const pnlPositive = (pos.liveProfit ?? 0) >= 0;
              return (
                <tr key={pos.trade_id} className="row-hover">
                  <td>
                    <div className="flex items-center gap-1.5">
                      <TokenLogo symbol={pos.symbol} size={16} />
                      <span className="font-medium text-foreground">{pos.symbol}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${
                      pos.side === 'buy'
                        ? 'bg-success/10 text-success'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {pos.side === 'buy' ? 'BUY' : 'SELL'}
                    </span>
                  </td>
                  <td className="numeric">{formatNumber(pos.amount, 4)}</td>
                  <td className="numeric">{pos.leverage}x</td>
                  <td className="numeric">{formatPrice(pos.entryPrice)}</td>
                  <td className="numeric">{formatPrice(pos.currentPrice ?? 0)}</td>
                  <td className="numeric text-warning">{pos.liquidationPrice ? formatPrice(pos.liquidationPrice) : 'N/A'}</td>
                  <td className={`numeric font-medium ${pnlPositive ? 'text-success' : 'text-destructive'}`}>
                    <div className="flex flex-col items-end leading-tight">
                      <span>{pnlPositive ? '+' : ''}{formatPrice(pos.liveProfit ?? 0)}</span>
                      <span className="text-[9px] opacity-70">{formatPercent(pos.liveProfitPercent ?? 0)}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleClosePosition(pos.trade_id, pos.symbol)}
                      disabled={isClosing === pos.trade_id}
                      className="px-2.5 py-1 text-[10px] font-semibold rounded transition-all duration-100 bg-destructive/8 text-destructive border border-destructive/20 hover:bg-destructive/15 hover:border-destructive/30 disabled:opacity-50 whitespace-nowrap btn-hover"
                    >
                      {isClosing === pos.trade_id ? (
                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                      ) : (
                        'Close'
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TopTradersTable() {
  return (
    <>
      {/* Mobile card layout */}
      <div className="sm:hidden divide-y divide-border/50">
        {mockTopTraders.map((trader) => (
          <div key={trader.rank} className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-data w-4">#{trader.rank}</span>
                <button className="text-primary text-[11px] font-data">{trader.address}</button>
              </div>
              <span className="text-[11px] font-data text-success font-medium">+{formatCompact(trader.pnl)}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] ml-6">
              <span className="text-muted-foreground">Win <span className="text-foreground font-data">{trader.winRate}%</span></span>
              <span className="text-muted-foreground">Trades <span className="text-foreground font-data">{trader.trades}</span></span>
              <span className="text-muted-foreground">Vol <span className="text-foreground font-data">{formatCompact(trader.volume)}</span></span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Address</th>
              <th style={{ textAlign: 'right' }}>P&L</th>
              <th style={{ textAlign: 'right' }}>Win Rate</th>
              <th style={{ textAlign: 'right' }}>Trades</th>
              <th style={{ textAlign: 'right' }}>Volume</th>
            </tr>
          </thead>
          <tbody>
            {mockTopTraders.map((trader) => (
              <tr key={trader.rank} className="row-hover">
                <td className="text-muted-foreground font-data">{trader.rank}</td>
                <td>
                  <button className="text-primary hover:text-primary/80 font-data transition-colors text-[12px] badge-hover">
                    {trader.address}
                  </button>
                </td>
                <td className="numeric text-success font-medium">+{formatCompact(trader.pnl)}</td>
                <td className="numeric">{trader.winRate}%</td>
                <td className="numeric">{trader.trades}</td>
                <td className="numeric">{formatCompact(trader.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function HolderAnalysis() {
  const totalHeld = mockHolderData.reduce((acc, h) => acc + h.percentage, 0);

  return (
    <div className="p-3">
      {/* Key Metrics — responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="bg-secondary/30 rounded p-2 border border-border/50 hover-lift">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Holder Quality</div>
          <div className="text-[14px] sm:text-[16px] font-data font-bold text-success">82</div>
          <div className="text-[9px] text-success font-data">Good</div>
        </div>
        <div className="bg-secondary/30 rounded p-2 border border-border/50 hover-lift">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Total Holders</div>
          <div className="text-[14px] sm:text-[16px] font-data font-bold text-foreground">12,847</div>
          <div className="text-[9px] text-success font-data">+234 (24h)</div>
        </div>
        <div className="bg-secondary/30 rounded p-2 border border-border/50 hover-lift">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Top 10% Hold</div>
          <div className="text-[14px] sm:text-[16px] font-data font-bold text-foreground">{totalHeld.toFixed(1)}%</div>
          <div className="text-[9px] text-muted-foreground font-data">of supply</div>
        </div>
        <div className="bg-secondary/30 rounded p-2 border border-border/50 hover-lift">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Avg Hold Time</div>
          <div className="text-[14px] sm:text-[16px] font-data font-bold text-foreground">45d</div>
          <div className="text-[9px] text-muted-foreground font-data">Strong conviction</div>
        </div>
      </div>

      {/* Distribution bar — responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden flex">
          {mockHolderData.map((holder, i) => (
            <div
              key={i}
              className={`h-full ${
                holder.type === 'Whale' ? 'bg-warning' :
                holder.type === 'DEX' ? 'bg-primary' :
                holder.type === 'Large' ? 'bg-success' :
                'bg-muted-foreground'
              }`}
              style={{ width: `${(holder.percentage / totalHeld) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LegendDot color="bg-warning" label="Whale" />
          <LegendDot color="bg-primary" label="DEX" />
          <LegendDot color="bg-success" label="Large" />
          <LegendDot color="bg-muted-foreground" label="Medium" />
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="sm:hidden divide-y divide-border/50">
        {mockHolderData.map((holder, i) => (
          <div key={i} className="px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                  holder.type === 'Whale' ? 'bg-warning/10 text-warning' :
                  holder.type === 'DEX' ? 'bg-primary/10 text-primary' :
                  holder.type === 'Large' ? 'bg-success/10 text-success' :
                  'bg-secondary text-muted-foreground'
                }`}>{holder.type}</span>
                <span className="font-data text-primary text-[10px]">{holder.address}</span>
              </div>
              <span className="text-[11px] font-data text-foreground">{holder.percentage}%</span>
            </div>
            <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${
                holder.type === 'Whale' ? 'bg-warning' :
                holder.type === 'DEX' ? 'bg-primary' :
                holder.type === 'Large' ? 'bg-success' :
                'bg-muted-foreground'
              }`} style={{ width: `${holder.percentage * 4}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Address</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Share</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ width: 120 }}>Distribution</th>
            </tr>
          </thead>
          <tbody>
            {mockHolderData.map((holder, i) => (
              <tr key={i} className="row-hover">
                <td>
                  <span className="font-data text-primary text-[12px]">{holder.address}</span>
                </td>
                <td>
                  <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                    holder.type === 'Whale' ? 'bg-warning/10 text-warning' :
                    holder.type === 'DEX' ? 'bg-primary/10 text-primary' :
                    holder.type === 'Large' ? 'bg-success/10 text-success' :
                    'bg-secondary text-muted-foreground'
                  }`}>
                    {holder.type}
                  </span>
                </td>
                <td className="numeric">{holder.percentage}%</td>
                <td className="numeric">{formatNumber(holder.amount, 0)}</td>
                <td>
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        holder.type === 'Whale' ? 'bg-warning' :
                        holder.type === 'DEX' ? 'bg-primary' :
                        holder.type === 'Large' ? 'bg-success' :
                        'bg-muted-foreground'
                      }`}
                      style={{ width: `${holder.percentage * 4}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlatformIcon({ platform, size = 12 }: { platform: string; size?: number }) {
  const cls = `shrink-0 opacity-70`;
  switch (platform.toLowerCase()) {
    case 'twitter':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'telegram':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      );
    case 'discord':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      );
    case 'reddit':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
        </svg>
      );
    default:
      return <Globe className={`${cls}`} style={{ width: size, height: size }} />;
  }
}

function SocialScanner() {
  return (
    <div className="p-3">
      {/* Summary cards — responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[
          { platform: 'Twitter', mentions: 1243, sentiment: 82, change: '+12%' },
          { platform: 'Telegram', mentions: 567, sentiment: 71, change: '+8%' },
          { platform: 'Discord', mentions: 234, sentiment: 65, change: '-3%' },
          { platform: 'Reddit', mentions: 89, sentiment: 58, change: '+1%' },
        ].map((item) => (
          <div key={item.platform} className="bg-secondary/30 rounded p-2 sm:p-2.5 border border-border/50 hover-lift">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <div className="flex items-center gap-1.5">
                <PlatformIcon platform={item.platform} size={13} />
                <span className="text-[10px] sm:text-[11px] font-medium text-foreground">{item.platform}</span>
              </div>
              <span className={`text-[9px] sm:text-[10px] font-data ${
                item.change.startsWith('+') ? 'text-success' : 'text-destructive'
              }`}>
                {item.change}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Mentions</div>
                <div className="text-[12px] sm:text-[13px] font-data font-semibold text-foreground">
                  {formatNumber(item.mentions, 0)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Sentiment</div>
                <div className={`text-[12px] sm:text-[13px] font-data font-semibold ${
                  item.sentiment >= 70 ? 'text-success' :
                  item.sentiment >= 50 ? 'text-warning' :
                  'text-destructive'
                }`}>
                  {item.sentiment}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Social Posts Feed */}
      <div className="space-y-2">
        {mockSocialPosts.map((post) => (
          <div key={post.id} className="bg-secondary/20 rounded p-2 sm:p-2.5 border border-border/30">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <PlatformIcon platform={post.platform} size={11} />
                <span className="text-[10px] font-medium text-foreground">{post.username}</span>
                <span className="text-[9px] text-muted-foreground/50">on {post.platform}</span>
              </div>
              <span className="text-[9px] font-data text-primary">Influence: {post.influence}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-1.5">{post.content}</p>
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
              <span>♥ {post.likes}</span>
              <span>💬 {post.comments}</span>
              <span>🔄 {post.reposts}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}
