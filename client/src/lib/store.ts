import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Chain = 'solana' | 'bnb' | 'ethereum' | 'base';
export type TradingMode = 'leverage' | 'spot';
export type OrderSide = 'buy' | 'sell';

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  chain: Chain;
  logoUrl?: string;
}

export interface OpenPosition {
  trade_id: string;
  symbol: string;
  contract_address: string;
  amount: number;
  leverage: number;
  entryPrice: number;
  currentPrice?: number;
  liveProfit?: number;
  liveProfitPercent?: number;
  liquidationPrice?: number;
  side: OrderSide;
  openedAt: number;
  tp?: number;
  sl?: number;
}

export interface ClosedPosition extends OpenPosition {
  closedAt: number;
  sellTx?: string;
  exitPrice: number;
  realizedPnl: number;
}

interface AppState {
  // UI State
  selectedChain: Chain;
  tradingMode: TradingMode;
  orderSide: OrderSide;

  // Wallet
  walletConnected: boolean;
  walletAddress: string | null;
  walletBalance: number | null;
  tradeWallet: string | null;

  // Selected Token
  selectedToken: TokenInfo | null;

  // Positions
  openPositions: OpenPosition[];
  closedPositions: ClosedPosition[];

  // Actions
  setSelectedChain: (chain: Chain) => void;
  setTradingMode: (mode: TradingMode) => void;
  setOrderSide: (side: OrderSide) => void;
  connectWallet: (address: string, tradeWallet?: string) => void;
  disconnectWallet: () => void;
  setWalletBalance: (balance: number | null) => void;
  setSelectedToken: (token: TokenInfo | null) => void;
  addOpenPosition: (position: OpenPosition) => void;
  setOpenPositions: (positions: OpenPosition[]) => void;
  removeOpenPosition: (tradeId: string) => void;
  updatePositionProfit: (tradeId: string, profit: number, profitPercent: number, currentPrice: number) => void;
  updatePositionTpSl: (tradeId: string, tp?: number, sl?: number) => void;
  addClosedPosition: (position: ClosedPosition) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      selectedChain: 'solana',
      tradingMode: 'leverage',
      orderSide: 'buy',
      walletConnected: false,
      walletAddress: null,
      walletBalance: null,
      tradeWallet: null,
      selectedToken: {
        symbol: 'SOL',
        name: 'Solana',
        address: 'So11111111111111111111111111111111111111112',
        price: 0,
        change24h: 9.57,
        volume24h: 2200000,
        marketCap: 660000,
        liquidity: 99000,
        chain: 'solana',
      },
      openPositions: [],
      closedPositions: [],

      setSelectedChain: (chain) => set({ selectedChain: chain }),
      setTradingMode: (mode) => set({ tradingMode: mode }),
      setOrderSide: (side) => set({ orderSide: side }),
      connectWallet: (address, tradeWallet) => set({ walletConnected: true, walletAddress: address, tradeWallet: tradeWallet ?? null }),
      disconnectWallet: () => set({
        walletConnected: false,
        walletAddress: null,
        walletBalance: null,
        tradeWallet: null,
        openPositions: [],
        closedPositions: [],
      }),
      setWalletBalance: (balance) => set({ walletBalance: balance }),
      setSelectedToken: (token) => set({ selectedToken: token }),
      addOpenPosition: (position) => set((s) => ({
        openPositions: [...s.openPositions, position],
      })),
      setOpenPositions: (positions) => set({ openPositions: positions }),
      removeOpenPosition: (tradeId) => set((s) => ({
        openPositions: s.openPositions.filter((p) => p.trade_id !== tradeId),
      })),
      updatePositionProfit: (tradeId, profit, profitPercent, currentPrice) => set((s) => ({
        openPositions: s.openPositions.map((p) =>
          p.trade_id === tradeId
            ? { ...p, liveProfit: profit, liveProfitPercent: profitPercent, currentPrice }
            : p
        ),
      })),
      updatePositionTpSl: (tradeId, tp, sl) => set((s) => ({
        openPositions: s.openPositions.map((p) =>
          p.trade_id === tradeId ? { ...p, tp, sl } : p
        ),
      })),
      addClosedPosition: (position) => set((s) => ({
        closedPositions: [position, ...s.closedPositions],
      })),
    }),
    {
      name: '0xleverage-storage',
      partialize: (state) => ({
        selectedChain: state.selectedChain,
        tradingMode: state.tradingMode,
        closedPositions: state.closedPositions,
      }),
    }
  )
);
