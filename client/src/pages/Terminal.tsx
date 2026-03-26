import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { useRoute, useLocation } from 'wouter';
import { Header } from '@/components/Header';
import { TokenPriceBar } from '@/components/TokenPriceBar';
import { ChartPanel } from '@/components/ChartPanel';
import { BottomPanel } from '@/components/BottomPanel';
import { TokenLogo } from '@/components/TokenLogo';
import { WhitelistStatus } from '@/components/WhitelistStatus';
import { useStore } from '@/lib/store';
import { allTokens } from '@/lib/mockData';
import { formatPrice, formatPercent, formatNumber } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Settings, WarningTriangleSolid, InfoCircleSolid, XmarkCircleSolid, WalletSolid } from 'iconoir-react';
import { useTradeWalletBalance } from '@/hooks/useTradeWalletBalance';
import { WalletConnectModal } from '@/components/WalletConnectModal';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTrackPositions } from '@/hooks/useTrackPositions';

const leveragePresets = [2, 5, 10, 25, 50];
const slippagePresets = [0.5, 1.0, 2.0, 5.0];
const amountPresets = [25, 50, 75, 100];

/* ============================================================
   ORDER BOOK HELPERS
   ============================================================ */
function generateFallbackOrderBook(midPrice: number) {
  const asks: { price: number; size: number; total: number }[] = [];
  const bids: { price: number; size: number; total: number }[] = [];
  let askTotal = 0;
  for (let i = 0; i < 15; i++) {
    const spread = (i + 1) * (midPrice * 0.001) + (((i * 7 + 3) % 13) / 13) * midPrice * 0.0005;
    const price = midPrice + spread;
    const size = ((i * 11 + 5) % 50) + 5;
    askTotal += size;
    asks.push({ price, size, total: askTotal });
  }
  let bidTotal = 0;
  for (let i = 0; i < 15; i++) {
    const spread = (i + 1) * (midPrice * 0.001) + (((i * 7 + 3) % 13) / 13) * midPrice * 0.0005;
    const price = midPrice - spread;
    const size = ((i * 11 + 5) % 50) + 5;
    bidTotal += size;
    bids.push({ price, size, total: bidTotal });
  }
  return { asks: asks.reverse(), bids };
}

export default function Terminal() {
  const leftColRef = useRef<HTMLDivElement>(null);
  const [chartRatio, setChartRatio] = useState(0.6);
  const [isDragging, setIsDragging] = useState(false);

  // Right panel tab
  type RightTab = 'trade';
  const [rightTab, setRightTab] = useState<RightTab>('trade');

  // Mobile view tab
  type MobileTab = 'chart' | 'trade' | 'data';
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart');
  const [swipeDirection, setSwipeDirection] = useState(0); // -1 left, 1 right
  const mobileTabs: MobileTab[] = ['chart', 'trade', 'data'];

  const handleSwipeTab = useCallback((_: unknown, info: PanInfo) => {
    const SWIPE_THRESHOLD = 50;
    const VELOCITY_THRESHOLD = 300;
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD && Math.abs(info.velocity.x) < VELOCITY_THRESHOLD) return;
    const idx = mobileTabs.indexOf(mobileTab);
    if (info.offset.x > 0 || info.velocity.x > VELOCITY_THRESHOLD) {
      // Swipe right -> previous tab
      if (idx > 0) {
        setSwipeDirection(-1);
        setMobileTab(mobileTabs[idx - 1]);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    } else {
      // Swipe left -> next tab
      if (idx < mobileTabs.length - 1) {
        setSwipeDirection(1);
        setMobileTab(mobileTabs[idx + 1]);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    }
  }, [mobileTab]);

  // Trading state
  const {
    tradingMode,
    setTradingMode,
    orderSide,
    setOrderSide,
    walletConnected,
    walletAddress,
    walletBalance,
    selectedToken,
    setSelectedToken,
    openPositions,
    addOpenPosition,
    removeOpenPosition,
    addClosedPosition,
  } = useStore();

  // URL ↔ token sync
  const isSolanaAddr = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
  const [, matchTerminal] = useRoute('/terminal/:address');
  const [, matchRoot] = useRoute('/:address');
  const rawAddr = matchTerminal?.address ?? matchRoot?.address;
  const urlAddress = rawAddr && isSolanaAddr(rawAddr) ? rawAddr : undefined;
  const [location, setLocation] = useLocation();
  const syncedFromUrl = useRef(false);

  // On mount / URL change: resolve the address to a token and select it
  useEffect(() => {
    if (!urlAddress) return;
    if (selectedToken?.address === urlAddress) return;

    const known = allTokens.find((t) => t.address === urlAddress);
    if (known) {
      setSelectedToken(known);
    } else {
      setSelectedToken({
        symbol: urlAddress.slice(0, 4) + '…',
        name: 'Unknown Token',
        address: urlAddress,
        price: 0,
        change24h: 0,
        volume24h: 0,
        marketCap: 0,
        liquidity: 0,
        chain: 'solana',
      });
    }
    syncedFromUrl.current = true;
  }, [urlAddress]);

  // Force buy side when switching to leverage mode (no shorting on 0xL)
  useEffect(() => {
    if (tradingMode === 'leverage') {
      setOrderSide('buy');
    }
  }, [tradingMode, setOrderSide]);

  // When selected token changes (e.g. via search modal), update the URL
  useEffect(() => {
    if (!selectedToken) return;
    if (syncedFromUrl.current) {
      syncedFromUrl.current = false;
      return;
    }
    const base = location.startsWith('/terminal') ? '/terminal/' : '/';
    const target = `${base}${selectedToken.address}`;
    if (location !== target) {
      setLocation(target, { replace: true });
    }
  }, [selectedToken?.address]);

  const openMutation = trpc.leverage.openPosition.useMutation();
  const closeMutation = trpc.leverage.closePosition.useMutation();

  useTradeWalletBalance();
  useTrackPositions();

  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(5);
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [slippage, setSlippage] = useState(1.0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const { connecting: isWalletConnecting } = useWallet();

  const entryPrice = selectedToken?.price ?? 0;
  const amountNum = parseFloat(amount) || 0;
  const positionSize = tradingMode === 'leverage' ? amountNum * leverage : amountNum;
  const tradingFee = positionSize * 0.001;

  // Live quote from upstream API — replaces client-side estimates
  const quoteEnabled = !!walletAddress && walletConnected && !!selectedToken?.address && amountNum > 0 && tradingMode === 'leverage';
  const { data: quoteData } = trpc.leverage.getQuote.useQuery(
    {
      walletAddress: walletAddress!,
      contractAddress: selectedToken?.address ?? '',
      leverage,
      initialAmount: amountNum,
    },
    { enabled: quoteEnabled, staleTime: 5_000, refetchInterval: 15_000, retry: 1 },
  );

  const liquidationPrice = useMemo(() => {
    if (!entryPrice || leverage <= 1) return 0;
    if (orderSide === 'buy') return entryPrice * (1 - 1 / leverage);
    return entryPrice * (1 + 1 / leverage);
  }, [entryPrice, leverage, orderSide]);

  const tpPercent = takeProfit && entryPrice > 0
    ? ((parseFloat(takeProfit) - entryPrice) / entryPrice * 100 * (orderSide === 'buy' ? 1 : -1)).toFixed(1)
    : null;
  const slPercent = stopLoss && entryPrice > 0
    ? ((parseFloat(stopLoss) - entryPrice) / entryPrice * 100 * (orderSide === 'buy' ? 1 : -1)).toFixed(1)
    : null;

  const isBuy = orderSide === 'buy';

  // Real orderbook from Birdeye API
  const tokenAddress = selectedToken?.address ?? '';
  const { data: birdeyeOrderbook } = trpc.leverage.getOrderbook.useQuery(
    { tokenAddress },
    { enabled: !!tokenAddress, refetchInterval: 15_000 },
  );

  // Build orderbook: use real data if available, else fallback
  const orderBook = useMemo(() => {
    if (birdeyeOrderbook && (birdeyeOrderbook.asks.length > 0 || birdeyeOrderbook.bids.length > 0)) {
      let askTotal = 0;
      const asks = birdeyeOrderbook.asks.slice(0, 15).map(a => {
        askTotal += a.size;
        return { price: a.price, size: a.size, total: askTotal };
      }).reverse();
      let bidTotal = 0;
      const bids = birdeyeOrderbook.bids.slice(0, 15).map(b => {
        bidTotal += b.size;
        return { price: b.price, size: b.size, total: bidTotal };
      });
      return { asks, bids };
    }
    return generateFallbackOrderBook(entryPrice);
  }, [birdeyeOrderbook, entryPrice]);

  // Positions for right panel — real data from store
  const tokenPositions = openPositions.filter(
    (p) => p.contract_address === selectedToken?.address
  );

  // Quick amount handler
  const handleQuickAmount = (percent: number) => {
    if (walletBalance != null && walletBalance > 0) {
      const val = (walletBalance * percent / 100);
      setAmount(val.toFixed(4));
    } else {
      toast.info('Connect wallet to use quick amounts');
    }
  };

  const [isClosing, setIsClosing] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!walletConnected || !walletAddress) {
      toast.error('Connect wallet first');
      return;
    }
    if (!selectedToken) {
      toast.error('Select a token first');
      return;
    }
    if (!amountNum || amountNum <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amountNum < 0.001) {
      toast.error('Minimum amount is 0.001 SOL');
      return;
    }
    if (amountNum > 10_000) {
      toast.error('Maximum amount is 10,000 SOL');
      return;
    }

    const tpNum = takeProfit ? parseFloat(takeProfit) : undefined;
    const slNum = stopLoss ? parseFloat(stopLoss) : undefined;

    if (tpNum !== undefined && tpNum <= 0) { toast.error('Take Profit must be positive'); return; }
    if (slNum !== undefined && slNum <= 0) { toast.error('Stop Loss must be positive'); return; }

    // For Long positions (leverage is always long)
    if (tradingMode === 'leverage' || orderSide === 'buy') {
      if (tpNum !== undefined && entryPrice > 0 && tpNum <= entryPrice) {
        toast.error('Take Profit must be above entry price'); return;
      }
      if (slNum !== undefined && entryPrice > 0 && slNum >= entryPrice) {
        toast.error('Stop Loss must be below entry price'); return;
      }
    }

    setIsExecuting(true);
    try {
      const tp = tpNum;
      const sl = slNum;
      const result = await openMutation.mutateAsync({
        walletAddress,
        contractAddress: selectedToken.address,
        amount: amountNum,
        leverage,
        solTip: 0.001,
        tp,
        sl,
      });
      addOpenPosition({
        trade_id: result && typeof result === 'object' && 'trade_id' in result
          ? String((result as { trade_id: unknown }).trade_id)
          : `${Date.now()}`,
        symbol: selectedToken.symbol,
        contract_address: selectedToken.address,
        amount: amountNum,
        leverage,
        entryPrice: quoteData?.current_price ?? entryPrice,
        liquidationPrice: quoteData?.liquidation_price ?? liquidationPrice,
        side: orderSide,
        openedAt: Date.now(),
        tp,
        sl,
      });
      toast.success(`${isBuy ? 'Buy' : 'Sell'} position opened`);
      setAmount('');
      setTakeProfit('');
      setStopLoss('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open position';
      toast.error(message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClosePosition = async (tradeId: string, symbol: string) => {
    if (!walletAddress) return;
    setIsClosing(tradeId);
    try {
      await closeMutation.mutateAsync({
        walletAddress,
        tradeId,
        solTip: 0.001,
        slippage,
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

  // Vertical resize handle logic (for chart vs bottom panel split)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!leftColRef.current) return;
      const rect = leftColRef.current.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      setChartRatio(Math.max(0.25, Math.min(0.8, ratio)));
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="h-screen-safe w-full flex flex-col overflow-hidden bg-background bg-grain">
      {/* Header */}
      <Header />

      {/* Token Price Bar -- hidden on mobile */}
      <div className="hidden sm:block">
        <TokenPriceBar />
      </div>

      {/* Mobile: Compact token info bar */}
      <div className="sm:hidden h-9 border-b border-border bg-card flex items-center px-3 gap-2 shrink-0">
        <TokenLogo symbol={selectedToken?.symbol ?? 'SOL'} size={20} eager />
        <span className="text-[13px] font-semibold text-foreground">{selectedToken?.symbol ?? 'SOL'}</span>
        <span className="text-[13px] font-data font-bold text-foreground">{selectedToken ? formatPrice(selectedToken.price) : '\u2014'}</span>
        <span className={`text-[11px] font-data font-semibold ${(selectedToken?.change24h ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
          {selectedToken ? formatPercent(selectedToken.change24h) : '+5.2%'}
        </span>
      </div>

      {/* ============================================================
          DESKTOP LAYOUT: Two columns
          Left: Chart + Bottom Panel (resizable split)
          Right: Trading Panel + Order Book (fixed width ~320px)
          ============================================================ */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* LEFT COLUMN */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" ref={leftColRef}>
          {/* Chart */}
          <div style={{ flex: `${chartRatio} 0 0` }} className="min-h-0 contain-layout">
            <ChartPanel />
          </div>

          {/* Resize Handle */}
          <div
            onMouseDown={handleMouseDown}
            className={`h-[3px] shrink-0 cursor-row-resize relative group ${
              isDragging ? 'bg-primary/30' : 'hover:bg-primary/20'
            } transition-colors`}
          >
            <div className="absolute inset-x-0 -top-1 -bottom-1" />
            <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-0.5 rounded-full transition-colors ${
              isDragging ? 'bg-primary/60' : 'bg-border group-hover:bg-primary/40'
            }`} />
          </div>

          {/* Bottom Panel: Positions/Orders/History */}
          <div style={{ flex: `${1 - chartRatio} 0 0` }} className="min-h-0 overflow-hidden contain-layout">
            <BottomPanel />
          </div>
        </div>

        {/* RIGHT COLUMN: Trading Panel */}
        <div className="w-[280px] lg:w-[320px] xl:w-[340px] shrink-0 border-l border-border flex flex-col bg-card overflow-hidden">

            <div className="flex-1 overflow-y-auto scrollbar-none">
              {/* Mode Toggle: Leverage / Spot */}
              <div className="flex border-b border-border shrink-0">
                <button
                  onClick={() => setTradingMode('leverage')}
                  className={`flex-1 py-2 text-[12px] font-medium text-center transition-colors relative tab-hover ${
                    tradingMode === 'leverage' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Leverage
                  {tradingMode === 'leverage' && (
                    <motion.div
                      layoutId="mode-toggle-tab"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
                      style={{ boxShadow: '0 0 8px var(--glow), 0 0 16px var(--glow-subtle)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
                <button
                  onClick={() => setTradingMode('spot')}
                  className={`flex-1 py-2 text-[12px] font-medium text-center transition-colors relative tab-hover ${
                    tradingMode === 'spot' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Spot
                  {tradingMode === 'spot' && (
                    <motion.div
                      layoutId="mode-toggle-tab"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
                      style={{ boxShadow: '0 0 8px var(--glow), 0 0 16px var(--glow-subtle)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              </div>

              {/* Buy / Sell Toggle — only in SPOT mode */}
              {tradingMode === 'spot' && (
                <div className="flex gap-1 px-3 pt-3 pb-2 shrink-0">
                  <button
                    onClick={() => setOrderSide('buy')}
                    className={`flex-1 py-1.5 text-[12px] font-semibold rounded transition-all duration-100 btn-ghost-hover ${
                      isBuy
                        ? 'bg-success/12 text-success border border-success/25'
                        : 'bg-secondary text-muted-foreground border border-transparent hover:text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setOrderSide('sell')}
                    className={`flex-1 py-1.5 text-[12px] font-semibold rounded transition-all duration-100 btn-ghost-hover ${
                      !isBuy
                        ? 'bg-destructive/12 text-destructive border border-destructive/25'
                        : 'bg-secondary text-muted-foreground border border-transparent hover:text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Sell
                  </button>
                </div>
              )}

              <div className="px-4 pt-6 pb-5 flex flex-col gap-6">
                {/* Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Amount (SOL)
                    </label>
                    {walletConnected && walletBalance != null && (
                      <button
                        onClick={() => setAmount(String(walletBalance))}
                        className="text-[10px] text-primary hover:text-primary/80 transition-colors font-data"
                      >
                        Bal: {formatNumber(walletBalance, 4)}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="Enter amount..."
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-10 bg-secondary border-border text-foreground font-data text-[13px] pr-14 input-hover placeholder:text-muted-foreground/30"
                    />
                    <button
                      onClick={() => walletBalance != null && setAmount(String(walletBalance))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors badge-hover"
                    >
                      MAX
                    </button>
                  </div>
                  {/* Quick Amount Buttons */}
                  <div className="flex gap-1 mt-2">
                    {amountPresets.map((pct) => (
                      <button
                        key={pct}
                        onClick={() => handleQuickAmount(pct)}
                        className="flex-1 py-1.5 text-[10px] font-data rounded transition-colors bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-transparent badge-hover"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Leverage Control */}
                {tradingMode === 'leverage' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                        Leverage
                      </label>
                      <span className="text-[12px] font-data font-bold text-foreground">
                        {leverage}x
                      </span>
                    </div>
                    <Slider
                      value={[leverage]}
                      onValueChange={([v]) => setLeverage(v)}
                      min={1}
                      max={50}
                      step={1}
                      className="mb-2"
                    />
                    <div className="flex gap-1">
                      {leveragePresets.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setLeverage(preset)}
                          className={`flex-1 py-1.5 text-[10px] font-data rounded transition-colors badge-hover ${
                            leverage === preset
                              ? 'bg-primary/12 text-primary border border-primary/25'
                              : 'bg-secondary text-muted-foreground hover:text-foreground border border-transparent'
                          }`}
                        >
                          {preset}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* TP / SL */}
                {tradingMode === 'leverage' && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                          Take Profit
                        </label>
                        {tpPercent && (
                          <span className="text-[9px] text-success font-data font-medium">
                            {Number(tpPercent) > 0 ? '+' : ''}{tpPercent}%
                          </span>
                        )}
                      </div>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="Optional"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        className="h-9 bg-secondary border-border text-foreground font-data text-[12px] input-hover placeholder:text-muted-foreground/30"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                          Stop Loss
                        </label>
                        {slPercent && (
                          <span className="text-[9px] text-destructive font-data font-medium">
                            {Number(slPercent) > 0 ? '+' : ''}{slPercent}%
                          </span>
                        )}
                      </div>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="Optional"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        className="h-9 bg-secondary border-border text-foreground font-data text-[12px] input-hover placeholder:text-muted-foreground/30"
                      />
                    </div>
                  </div>
                )}

                {/* Slippage Settings */}
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Slippage
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 text-[11px] font-data text-foreground hover:text-primary transition-colors">
                        {slippage}%
                        <Settings className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-2.5 bg-card border-border" align="end">
                      <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">
                        Slippage Tolerance
                      </div>
                      <div className="flex gap-1">
                        {slippagePresets.map((preset) => (
                          <button
                            key={preset}
                            onClick={() => setSlippage(preset)}
                            className={`flex-1 py-1 text-[10px] font-data rounded transition-colors badge-hover ${
                              slippage === preset
                                ? 'bg-primary/12 text-primary'
                                : 'bg-secondary text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {preset}%
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Whitelist Status */}
                {walletConnected && (
                  <div className="py-0.5">
                    <WhitelistStatus />
                  </div>
                )}

                {/* Order Summary */}
                <div className="bg-secondary/40 rounded p-2 space-y-1">
                  <SummaryRow label="Entry Price" value={entryPrice > 0 ? formatPrice(quoteData?.current_price ?? entryPrice) : 'Awaiting price...'} />
                  <SummaryRow label="Position Size" value={amountNum > 0 ? `${formatNumber(positionSize, 4)} SOL` : '---'} muted={amountNum <= 0} />
                  {quoteData?.trade_cost != null && amountNum > 0 ? (
                    <SummaryRow label="Trade Cost" value={`${formatNumber(quoteData.trade_cost, 4)} SOL`} />
                  ) : (
                    <SummaryRow label="Est. Fee" value={amountNum > 0 ? `${formatNumber(tradingFee, 4)} SOL` : '---'} muted={amountNum <= 0} />
                  )}
                  {tradingMode === 'leverage' && (
                    <SummaryRow
                      label="Liq. Price"
                      value={amountNum > 0 ? formatPrice(quoteData?.liquidation_price ?? liquidationPrice) : 'N/A'}
                      warning={amountNum > 0}
                      muted={amountNum <= 0}
                    />
                  )}
                </div>

                {/* Execute Button */}
                {walletConnected ? (
                  <button
                    onClick={handleExecute}
                    disabled={isExecuting || !amountNum}
                    className={`w-full h-9 text-[13px] font-semibold transition-all duration-100 rounded flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed btn-hover ${
                      tradingMode === 'leverage' || isBuy
                        ? 'bg-success hover:bg-success/90 text-background'
                        : 'bg-destructive hover:bg-destructive/90 text-white'
                    }`}
                  >
                    {isExecuting ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <TokenLogo symbol={selectedToken?.symbol ?? 'SOL'} size={16} />
                        {tradingMode === 'leverage'
                          ? `Long ${selectedToken?.symbol ?? 'SOL'}`
                          : `${isBuy ? 'Buy' : 'Sell'} ${selectedToken?.symbol ?? 'SOL'}`}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => setWalletModalOpen(true)}
                    disabled={isWalletConnecting}
                    className="w-full h-10 mt-3 text-[13px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded btn-hover flex items-center justify-center gap-1.5 disabled:opacity-70"
                  >
                    <WalletSolid className="w-3.5 h-3.5" />
                    {isWalletConnecting ? 'Connecting...' : 'Connect Wallet'}
                  </button>
                )}

                {/* Open Positions for this token */}
                {tokenPositions.length > 0 && (
                  <div className="mt-1">
                    <div className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5">
                      Open Positions ({tokenPositions.length})
                    </div>
                    <div className="space-y-1.5">
                      {tokenPositions.map((pos) => {
                        const pnlPositive = (pos.liveProfit ?? 0) >= 0;
                        return (
                          <div key={pos.trade_id} className="bg-secondary/40 rounded p-2">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
                                  pos.side === 'buy'
                                    ? 'bg-success/10 text-success'
                                    : 'bg-destructive/10 text-destructive'
                                }`}>
                                  {pos.side === 'buy' ? 'BUY' : 'SELL'} {pos.leverage}x
                                </span>
                                <span className="text-[10px] font-data text-foreground">{formatNumber(pos.amount, 4)} SOL</span>
                              </div>
                              <button
                                onClick={() => handleClosePosition(pos.trade_id, pos.symbol)}
                                disabled={isClosing === pos.trade_id}
                                className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded hover:bg-destructive/10 disabled:opacity-50"
                              >
                                {isClosing === pos.trade_id ? (
                                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                                ) : (
                                  <XmarkCircleSolid className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="space-y-0.5">
                              <MiniRow label="Entry" value={formatPrice(pos.entryPrice)} />
                              <MiniRow label="Mark" value={formatPrice(pos.currentPrice ?? 0)} />
                              <div className="flex justify-between text-[10px]">
                                <span className="text-muted-foreground">P&L</span>
                                <span className={`font-data font-medium ${pnlPositive ? 'text-success' : 'text-destructive'}`}>
                                  {pnlPositive ? '+' : ''}{formatNumber(pos.liveProfit ?? 0, 2)} ({formatPercent(pos.liveProfitPercent ?? 0)})
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* ============================================================
          MOBILE LAYOUT -- tab-based with swipeable sections
          ============================================================ */}
      <div className="md:hidden flex flex-col flex-1 min-h-0 pb-[72px]">
        {/* Mobile Tab Bar */}
        <div className="flex bg-card border-b border-border shrink-0">
          {(['chart', 'trade', 'data'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                const allTabs = ['chart', 'trade', 'data'] as const;
                const fromIdx = allTabs.indexOf(mobileTab as typeof allTabs[number]);
                const toIdx = allTabs.indexOf(tab);
                setSwipeDirection(toIdx > fromIdx ? 1 : -1);
                setMobileTab(tab as MobileTab);
              }}
              className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all relative ${
                mobileTab === tab
                  ? 'text-primary'
                  : 'text-muted-foreground/50'
              }`}
            >
              {tab === 'chart' ? 'Chart' : tab === 'trade' ? 'Trade' : 'Data'}
              {mobileTab === tab && (
                <motion.div
                  layoutId="mobile-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content -- swipeable */}
        <AnimatePresence mode="popLayout" initial={false} custom={swipeDirection}>
          <motion.div
            key={mobileTab}
            custom={swipeDirection}
            initial={{ x: swipeDirection > 0 ? '40%' : '-40%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: swipeDirection > 0 ? '-40%' : '40%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 35, mass: 0.8 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleSwipeTab}
            className={`flex-1 min-h-0 overflow-y-auto ${mobileTab === 'trade' ? 'pb-[140px]' : 'pb-4'}`}
            style={{ touchAction: 'pan-y' }}
          >
          {/* 140px = execute bar (~52px) + bottom nav (~72px) + safe area */}
          {/* Chart Tab — fills all available space */}
          {mobileTab === 'chart' && (
            <div className="h-full">
              <ChartPanel />
            </div>
          )}

          {/* Trade Tab */}
          {mobileTab === 'trade' && (
            <>
        {/* Inline Trading Panel */}
        <div className="border-t border-border bg-card">
          <div className="px-3 py-3 space-y-3">
            {/* Mode Toggle */}
            <div className="flex bg-secondary rounded p-0.5">
              <button
                onClick={() => setTradingMode('leverage')}
                className={`flex-1 py-1.5 text-[12px] font-medium rounded transition-colors ${
                  tradingMode === 'leverage' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
                }`}
              >
                Leverage
              </button>
              <button
                onClick={() => setTradingMode('spot')}
                className={`flex-1 py-1.5 text-[12px] font-medium rounded transition-colors ${
                  tradingMode === 'spot' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
                }`}
              >
                Spot
              </button>
            </div>

            {/* Side Toggle — only in SPOT mode */}
            {tradingMode === 'spot' && (
              <div className="flex gap-1">
                <button
                  onClick={() => setOrderSide('buy')}
                  className={`flex-1 py-2 text-[13px] font-semibold rounded transition-all ${
                    isBuy
                      ? 'bg-success/12 text-success border border-success/25'
                      : 'bg-secondary text-muted-foreground border border-transparent'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setOrderSide('sell')}
                  className={`flex-1 py-2 text-[13px] font-semibold rounded transition-all ${
                    !isBuy
                      ? 'bg-destructive/12 text-destructive border border-destructive/25'
                      : 'bg-secondary text-muted-foreground border border-transparent'
                  }`}
                >
                  Sell
                </button>
              </div>
            )}

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Amount (SOL)</label>
                {walletConnected && walletBalance != null && (
                  <button
                    onClick={() => setAmount(String(walletBalance))}
                    className="text-[10px] text-primary font-data"
                  >
                    Bal: {formatNumber(walletBalance, 4)}
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Enter amount..."
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-10 bg-secondary border-border text-foreground font-data text-[13px] pr-14 placeholder:text-muted-foreground/30"
                />
                <button
                  onClick={() => walletBalance != null && setAmount(String(walletBalance))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded"
                >
                  MAX
                </button>
              </div>
              {/* Quick Amount Buttons -- Mobile */}
              <div className="flex gap-1 mt-1.5">
                {amountPresets.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleQuickAmount(pct)}
                    className="flex-1 py-1 text-[11px] font-data font-medium rounded transition-colors bg-secondary text-muted-foreground hover:text-foreground border border-transparent active:bg-secondary/60"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Leverage */}
            {tradingMode === 'leverage' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Leverage</label>
                  <span className="text-[12px] font-data font-bold text-foreground">{leverage}x</span>
                </div>
                <Slider
                  value={[leverage]}
                  onValueChange={([v]) => setLeverage(v)}
                  min={1}
                  max={50}
                  step={1}
                  className="mb-1.5"
                />
                <div className="flex gap-0.5">
                  {leveragePresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setLeverage(preset)}
                      className={`flex-1 py-1.5 text-[10px] font-data rounded transition-colors min-h-[32px] ${
                        leverage === preset
                          ? 'bg-primary/12 text-primary border border-primary/25'
                          : 'bg-secondary text-muted-foreground border border-transparent'
                      }`}
                    >
                      {preset}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TP / SL */}
            {tradingMode === 'leverage' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1">Take Profit</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="Optional"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className="h-9 bg-secondary border-border text-foreground font-data text-[12px] placeholder:text-muted-foreground/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1">Stop Loss</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="Optional"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="h-9 bg-secondary border-border text-foreground font-data text-[12px] placeholder:text-muted-foreground/30"
                  />
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-secondary/40 rounded p-2.5 space-y-1">
              <SummaryRow label="Entry Price" value={entryPrice > 0 ? formatPrice(quoteData?.current_price ?? entryPrice) : 'Awaiting price...'} />
              <SummaryRow label="Position Size" value={amountNum > 0 ? `${formatNumber(positionSize, 4)} SOL` : '---'} />
              {quoteData?.trade_cost != null && amountNum > 0 ? (
                <SummaryRow label="Trade Cost" value={`${formatNumber(quoteData.trade_cost, 4)} SOL`} />
              ) : (
                <SummaryRow label="Est. Fee" value={amountNum > 0 ? `${formatNumber(tradingFee, 4)} SOL` : '---'} />
              )}
              {tradingMode === 'leverage' && (
                <SummaryRow label="Liq. Price" value={amountNum > 0 ? formatPrice(quoteData?.liquidation_price ?? liquidationPrice) : 'N/A'} warning />
              )}
            </div>

            {/* Whitelist Status */}
            {walletConnected && <WhitelistStatus />}
          </div>
        </div>

          </>
          )}

          {/* Data Tab — Transactions, Open Positions, etc */}
          {mobileTab === 'data' && (
            <div className="h-full">
              <BottomPanel />
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ============================================================
          MOBILE: Sticky Execute Button at bottom (only on trade tab)
          ============================================================ */}
      <div className={`md:hidden fixed bottom-[72px] left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-3 py-2 transition-all ${mobileTab === 'trade' ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        {walletConnected ? (
          <button
            onClick={handleExecute}
            disabled={isExecuting || !amountNum}
            className={`w-full py-2.5 text-[13px] font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
              tradingMode === 'leverage' || isBuy
                ? 'bg-success hover:bg-success/90 text-background'
                : 'bg-destructive hover:bg-destructive/90 text-white'
            }`}
          >
            {isExecuting ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <TokenLogo symbol={selectedToken?.symbol ?? 'SOL'} size={16} />
                {tradingMode === 'leverage'
                  ? `Long ${selectedToken?.symbol ?? 'SOL'}`
                  : `${isBuy ? 'Buy' : 'Sell'} ${selectedToken?.symbol ?? 'SOL'}`}
                {amountNum > 0 && (
                  <span className="opacity-75 ml-1">
                    {formatNumber(amountNum, 2)} SOL
                    {tradingMode === 'leverage' && ` @ ${leverage}x`}
                  </span>
                )}
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => setWalletModalOpen(true)}
            disabled={isWalletConnecting}
            className="w-full py-2.5 text-[13px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-70"
          >
            <WalletSolid className="w-3.5 h-3.5" />
            {isWalletConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>
      <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </div>
  );
}

/* ============================================================
   MINI ORDER BOOK
   ============================================================ */
function MiniOrderBook({
  asks,
  bids,
  midPrice,
  symbol,
}: {
  asks: { price: number; size: number; total: number }[];
  bids: { price: number; size: number; total: number }[];
  midPrice: number;
  symbol: string;
}) {
  const asksRef = useRef<HTMLDivElement>(null);
  const maxTotal = Math.max(
    asks.length > 0 ? asks[asks.length - 1].total : 0,
    bids.length > 0 ? bids[bids.length - 1].total : 0
  );

  // Auto-scroll asks to bottom so lowest ask is always visible near spread
  useEffect(() => {
    if (asksRef.current) {
      asksRef.current.scrollTop = asksRef.current.scrollHeight;
    }
  }, [asks]);

  return (
    <div className="h-full flex flex-col text-[10px] font-data">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Order Book</span>
        <span className="text-[10px] text-muted-foreground">{symbol}/USD</span>
      </div>

      {/* Column headers */}
      <div className="flex items-center justify-between px-3 py-1 text-[9px] text-muted-foreground uppercase tracking-wider shrink-0">
        <span>Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>

      {/* Asks (sells) -- scrolled to bottom so lowest ask sits next to spread */}
      <div ref={asksRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-1">
        {asks.map((ask, i) => (
          <div key={`ask-${i}`} className="relative flex items-center justify-between px-2 py-[2px] hover:bg-secondary/30 rounded-sm">
            <div
              className="absolute right-0 top-0 bottom-0 bg-destructive/8 rounded-sm"
              style={{ width: `${(ask.total / maxTotal) * 100}%` }}
            />
            <span className="relative text-destructive">{formatPrice(ask.price)}</span>
            <span className="relative text-foreground/70">{ask.size.toFixed(2)}</span>
            <span className="relative text-foreground/50">{ask.total.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Spread / Mid Price */}
      <div className="flex items-center justify-center py-1.5 border-y border-border bg-secondary/20 mx-1 rounded shrink-0">
        <span className="text-[12px] font-bold text-foreground">{formatPrice(midPrice)}</span>
        <span className="text-[9px] text-muted-foreground ml-2">
          Spread: {asks.length > 0 && bids.length > 0
            ? formatPrice(asks[asks.length - 1].price - bids[0].price)
            : '---'}
        </span>
      </div>

      {/* Bids (buys) -- top-aligned so highest bid sits next to spread */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-1">
        {bids.map((bid, i) => (
          <div key={`bid-${i}`} className="relative flex items-center justify-between px-2 py-[2px] hover:bg-secondary/30 rounded-sm">
            <div
              className="absolute right-0 top-0 bottom-0 bg-success/8 rounded-sm"
              style={{ width: `${(bid.total / maxTotal) * 100}%` }}
            />
            <span className="relative text-success">{formatPrice(bid.price)}</span>
            <span className="relative text-foreground/70">{bid.size.toFixed(2)}</span>
            <span className="relative text-foreground/50">{bid.total.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, warning, muted }: { label: string; value: string; warning?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-[11px] ${muted ? 'opacity-40' : ''}`}>
      <span className="text-muted-foreground flex items-center gap-1">
        {label}
        {warning && <WarningTriangleSolid className="w-2.5 h-2.5 text-warning" />}
      </span>
      <span className={`font-data ${warning ? 'text-warning' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function MiniRow({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-data ${warning ? 'text-warning' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}
