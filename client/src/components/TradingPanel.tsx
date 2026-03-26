import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, WarningTriangleSolid, InfoCircleSolid, WalletSolid } from 'iconoir-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStore } from '@/lib/store';
import { formatPrice, formatNumber, formatPercent } from '@/lib/format';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { WhitelistStatus } from './WhitelistStatus';
import { TokenLogo } from './TokenLogo';
import { WalletConnectModal } from './WalletConnectModal';
import { useTradeWalletBalance } from '@/hooks/useTradeWalletBalance';

const leveragePresets = [2, 5, 10, 25, 50];
const slippagePresets = [0.5, 1.0, 2.0, 5.0];

type PanelTab = 'buy' | 'positions';

export function TradingPanel() {
  const {
    tradingMode,
    setTradingMode,
    orderSide,
    setOrderSide,
    walletConnected,
    walletAddress,
    walletBalance,
    selectedToken,
    openPositions,
    addOpenPosition,
    removeOpenPosition,
    addClosedPosition,
  } = useStore();

  const [panelTab, setPanelTab] = useState<PanelTab>('buy');
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(5);
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [slippage, setSlippage] = useState(1.0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isClosing, setIsClosing] = useState<string | null>(null);

  const openMutation = trpc.leverage.openPosition.useMutation();
  const closeMutation = trpc.leverage.closePosition.useMutation();

  useTradeWalletBalance();

  const entryPrice = selectedToken?.price ?? 0;
  const amountNum = parseFloat(amount) || 0;
  const positionSize = tradingMode === 'leverage' ? amountNum * leverage : amountNum;
  const tradingFee = positionSize * 0.001;

  // Live quote from upstream API
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
    if (orderSide === 'buy') {
      return entryPrice * (1 - 1 / leverage);
    }
    return entryPrice * (1 + 1 / leverage);
  }, [entryPrice, leverage, orderSide]);

  const tpPercent = takeProfit && entryPrice > 0
    ? ((parseFloat(takeProfit) - entryPrice) / entryPrice * 100 * (orderSide === 'buy' ? 1 : -1)).toFixed(1)
    : null;
  const slPercent = stopLoss && entryPrice > 0
    ? ((parseFloat(stopLoss) - entryPrice) / entryPrice * 100 * (orderSide === 'buy' ? 1 : -1)).toFixed(1)
    : null;

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
    setIsExecuting(true);
    try {
      const tp = takeProfit ? parseFloat(takeProfit) : undefined;
      const sl = stopLoss ? parseFloat(stopLoss) : undefined;

      if (tp !== undefined && tp <= 0) {
        toast.error('Take Profit must be a positive price');
        setIsExecuting(false);
        return;
      }
      if (sl !== undefined && sl <= 0) {
        toast.error('Stop Loss must be a positive price');
        setIsExecuting(false);
        return;
      }

      if (orderSide === 'buy' || tradingMode === 'leverage') {
        if (tp !== undefined && entryPrice > 0 && tp <= entryPrice) {
          toast.error('Take Profit must be above entry price for Long positions');
          setIsExecuting(false);
          return;
        }
        if (sl !== undefined && entryPrice > 0 && sl >= entryPrice) {
          toast.error('Stop Loss must be below entry price for Long positions');
          setIsExecuting(false);
          return;
        }
      }

      if (tradingMode === 'spot' && orderSide === 'sell') {
        if (tp !== undefined && entryPrice > 0 && tp >= entryPrice) {
          toast.error('Take Profit must be below entry price for Sell orders');
          setIsExecuting(false);
          return;
        }
        if (sl !== undefined && entryPrice > 0 && sl <= entryPrice) {
          toast.error('Stop Loss must be above entry price for Sell orders');
          setIsExecuting(false);
          return;
        }
      }

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
      toast.success(`${tradingMode === 'leverage' ? 'Long' : orderSide === 'buy' ? 'Buy' : 'Sell'} position opened`);
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

  // Force buy side when switching to leverage mode
  useEffect(() => {
    if (tradingMode === 'leverage') {
      setOrderSide('buy');
    }
  }, [tradingMode, setOrderSide]);

  const tpNum = takeProfit ? parseFloat(takeProfit) : 0;
  const slNum = stopLoss ? parseFloat(stopLoss) : 0;
  const tpInvalid = tpNum > 0 && entryPrice > 0 && (
    ((orderSide === 'buy' || tradingMode === 'leverage') && tpNum <= entryPrice) ||
    (tradingMode === 'spot' && orderSide === 'sell' && tpNum >= entryPrice)
  );
  const slInvalid = slNum > 0 && entryPrice > 0 && (
    ((orderSide === 'buy' || tradingMode === 'leverage') && slNum >= entryPrice) ||
    (tradingMode === 'spot' && orderSide === 'sell' && slNum <= entryPrice)
  );

  const isBuy = orderSide === 'buy';
  const tokenPositions = openPositions.filter(
    (p) => p.contract_address === selectedToken?.address
  );

  return (
    <div className="h-full flex flex-col bg-card border-l border-border overflow-y-auto scrollbar-none">
      {/* Buy / Open Positions Tab Toggle */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setPanelTab('buy')}
          className={`flex-1 py-2 text-[12px] font-medium text-center transition-colors relative flex items-center justify-center gap-1 tab-hover ${
            panelTab === 'buy'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Buy
          {panelTab === 'buy' && (
            <motion.div
              layoutId="trading-panel-tab"
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
              style={{ boxShadow: '0 0 8px var(--glow), 0 0 16px var(--glow-subtle)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </button>
        <button
          onClick={() => setPanelTab('positions')}
          className={`flex-1 py-2 text-[12px] font-medium text-center transition-colors relative flex items-center justify-center gap-1 tab-hover ${
            panelTab === 'positions'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Open Positions
          {tokenPositions.length > 0 && (
            <span className="text-[9px] font-data bg-primary/12 text-primary px-1 py-px rounded ml-0.5">
              {tokenPositions.length}
            </span>
          )}
          {panelTab === 'positions' && (
            <motion.div
              layoutId="trading-panel-tab"
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
              style={{ boxShadow: '0 0 8px var(--glow), 0 0 16px var(--glow-subtle)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </button>
      </div>

      {panelTab === 'positions' ? (
        /* Open Positions View */
        <div className="flex-1 overflow-auto">
          {tokenPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-[12px] text-muted-foreground mb-1">No open positions</div>
              <div className="text-[10px] text-muted-foreground/60">
                for {selectedToken?.symbol ?? 'this token'}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {tokenPositions.map((pos) => {
                const pnlPositive = (pos.liveProfit ?? 0) >= 0;
                return (
                  <div key={pos.trade_id} className="px-3 py-2.5">
                    {/* Header: Side badge + Amount */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${
                          pos.side === 'buy'
                            ? 'bg-success/10 text-success'
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          {pos.side === 'buy' ? 'BUY' : 'SELL'} {pos.leverage}x
                        </span>
                        <span className="text-[11px] font-data text-foreground">
                          {formatNumber(pos.amount, 4)} SOL
                        </span>
                      </div>
                    </div>

                    {/* Price data */}
                    <div className="space-y-1">
                      <MiniRow label="Entry" value={formatPrice(pos.entryPrice)} />
                      <MiniRow label="Mark" value={formatPrice(pos.currentPrice ?? 0)} />
                      <MiniRow label="Liq." value={pos.liquidationPrice ? formatPrice(pos.liquidationPrice) : 'N/A'} warning />
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">P&L</span>
                        <span className={`font-data font-medium ${pnlPositive ? 'text-success' : 'text-destructive'}`}>
                          {pnlPositive ? '+' : ''}{formatNumber(pos.liveProfit ?? 0, 2)} ({formatPercent(pos.liveProfitPercent ?? 0)})
                        </span>
                      </div>
                    </div>

                    {/* Denomination note */}
                    <div className="text-[9px] text-muted-foreground/40 mt-1.5 text-right italic">
                      Prices in USD via Jupiter
                    </div>

                    {/* Close Position Button — prominent, full-width */}
                    <button
                      onClick={() => handleClosePosition(pos.trade_id, pos.symbol)}
                      disabled={isClosing === pos.trade_id}
                      className="mt-2 w-full h-7 flex items-center justify-center gap-1.5 text-[11px] font-semibold rounded transition-all duration-100 bg-destructive/8 text-destructive border border-destructive/20 hover:bg-destructive/15 hover:border-destructive/30 disabled:opacity-50 btn-hover"
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
          )}
        </div>
      ) : (
        /* Buy/Trade View */
        <>
          {/* Mode Toggle: Leverage / Spot */}
          <div className="flex border-b border-border shrink-0 pb-1">
            <button
              onClick={() => setTradingMode('leverage')}
              className={`flex-1 py-2 text-[12px] font-medium text-center transition-colors relative tab-hover ${
                tradingMode === 'leverage'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
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
                tradingMode === 'spot'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
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
            <div className="flex gap-1 px-3 pt-2.5 pb-2 shrink-0">
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

          <div className="flex-1 px-4 pt-8 pb-5 flex flex-col gap-6">
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
                  min={0}
                  max={10000}
                  step="any"
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
            </div>

            {/* Leverage Control */}
            {tradingMode === 'leverage' && (
              <div className="mt-1">
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
                  aria-label="Leverage"
                  className="mb-2"
                />

                <div className="flex gap-1 mb-1">
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Take Profit (USD)
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
                    className={`h-9 bg-secondary border-border text-foreground font-data text-[12px] input-hover placeholder:text-muted-foreground/30 ${tpInvalid ? 'border-destructive/50' : ''}`}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Stop Loss (USD)
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
                    className={`h-9 bg-secondary border-border text-foreground font-data text-[12px] input-hover placeholder:text-muted-foreground/30 ${slInvalid ? 'border-destructive/50' : ''}`}
                  />
                </div>
              </div>
            )}

            {/* Slippage Settings */}
            <div className="flex items-center justify-between py-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Slippage
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button aria-label="Slippage settings" className="flex items-center gap-1 text-[11px] font-data text-foreground hover:text-primary transition-colors">
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

            {/* Order Summary — always visible */}
            <div className="bg-secondary/40 rounded px-3 py-3 space-y-2 mt-1">
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
                  tooltip="Price at which your position will be liquidated"
                />
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Execute Button */}
            {walletConnected ? (
              <Button
                onClick={handleExecute}
                disabled={isExecuting || !amountNum || entryPrice <= 0}
                className={`w-full h-10 mt-3 text-[13px] font-semibold transition-all duration-100 rounded btn-hover ${
                  tradingMode === 'leverage' || isBuy
                    ? 'bg-success hover:bg-success/90 text-background'
                    : 'bg-destructive hover:bg-destructive/90 text-white'
                }`}
              >
                {isExecuting ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <span className="flex items-center gap-1.5 justify-center">
                    <TokenLogo symbol={selectedToken?.symbol ?? 'SOL'} size={16} />
                    {tradingMode === 'leverage'
                      ? `Long ${selectedToken?.symbol ?? 'Token'}`
                      : isBuy
                        ? `Buy ${selectedToken?.symbol ?? 'Token'}`
                        : `Sell ${selectedToken?.symbol ?? 'Token'}`
                    }
                  </span>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => setWalletModalOpen(true)}
                className="w-full h-10 mt-3 text-[13px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded btn-hover gap-1.5"
              >
                <WalletSolid className="w-3.5 h-3.5" />
                Connect Wallet
              </Button>
            )}
          </div>
        </>
      )}
      <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  warning,
  muted,
  tooltip,
}: {
  label: string;
  value: string;
  warning?: boolean;
  muted?: boolean;
  tooltip?: string;
}) {
  return (
    <div className={`flex justify-between text-[11px] ${muted ? 'opacity-40' : ''}`}>
      <span className="text-muted-foreground flex items-center gap-1">
        {label}
        {warning && <WarningTriangleSolid className="w-2.5 h-2.5 text-warning" />}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoCircleSolid className="w-2.5 h-2.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="text-[11px] bg-card border-border">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </span>
      <span className={`font-data ${warning ? 'text-warning' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function MiniRow({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-data ${warning ? 'text-warning' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}
