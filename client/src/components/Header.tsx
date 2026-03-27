import { Link, useLocation } from 'wouter';
import {
  WalletSolid,
  RefreshCircleSolid,
  NavArrowDownSolid,
  Copy,
  LogOut,
  ClockSolid,
  Search,
} from 'iconoir-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStore } from '@/lib/store';
import { truncateAddress, formatNumber, formatPrice } from '@/lib/format';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletConnectModal } from './WalletConnectModal';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { useTradeWalletBalance } from '@/hooks/useTradeWalletBalance';
import { useWalletHoldings } from '@/hooks/useWalletHoldings';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

import { TokenSearchModal } from './TokenSearchModal';
import { useTheme, type ThemeName } from '@/contexts/ThemeContext';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const navLinks = [
  { name: 'Markets', path: '/' },
  { name: 'Terminal', path: '/terminal' },
  { name: 'Trending', path: '/trending' },
  { name: 'Portfolio', path: '/portfolio' },
  { name: 'Positions', path: '/positions' },
];

const themeOptions: { name: ThemeName; label: string; color: string; desc: string; preview: [string, string, string, string]; experimental?: boolean }[] = [
  { name: '0x', label: '0x Default', color: '#9333EA', desc: 'Purple neon terminal', preview: ['#0C0A14', '#9333EA', '#5CB88A', '#D4756B'] },
  { name: 'cyberpunk', label: 'Cyberpunk', color: '#06B6D4', desc: 'Cyan neon edge', preview: ['#0A0E17', '#06B6D4', '#5CB88A', '#D4756B'] },
  { name: 'midnight', label: 'Midnight City', color: '#6366F1', desc: 'Deep indigo night', preview: ['#0F0F1A', '#6366F1', '#5CB88A', '#D4756B'] },
  { name: 'obsidian', label: 'Obsidian', color: '#5B9BD5', desc: 'Ice-blue Bloomberg', preview: ['#08090C', '#5B9BD5', '#5CB88A', '#D4756B'] },
  { name: 'ember', label: 'Ember', color: '#D4943C', desc: 'Warm amber glow', preview: ['#110E0A', '#D4943C', '#6DBF73', '#C75B5B'] },
  { name: 'matrix', label: 'Matrix', color: '#4ADE80', desc: 'Green phosphor', preview: ['#050A05', '#4ADE80', '#4ADE80', '#D4756B'] },
  { name: 'arctic', label: 'Arctic', color: '#64B5F6', desc: 'Frost steel-blue', preview: ['#080C12', '#64B5F6', '#5CB88A', '#D4756B'] },
  { name: 'phantom', label: 'Phantom', color: '#AB7AE0', desc: 'Soft purple-pink', preview: ['#0D0A14', '#AB7AE0', '#5CB88A', '#E07A9A'] },
  { name: 'lavender', label: 'Lavender Haze', color: '#7C3AED', desc: 'Light mode', preview: ['#FAFAFE', '#7C3AED', '#5CB88A', '#D4756B'] },
  { name: 'aurora', label: 'Aurora', color: '#9B6DFF', desc: 'Animated shifting', preview: ['#06050E', '#9B6DFF', '#4AEAAA', '#FF6B8A'], experimental: true },
];

export function Header() {
  const [location, navigate] = useLocation();
  const { theme, setTheme } = useTheme();
  const {
    walletConnected,
    walletAddress,
    walletBalance,
    tradeWallet,
    disconnectWallet,
    openPositions,
  } = useStore();
  const { totalValue: walletTotalValue, holdings } = useWalletHoldings();
  useTradeWalletBalance();
  const utils = trpc.useUtils();
  const { connection } = useConnection();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const { publicKey, connected: adapterConnected, sendTransaction } = useWallet();
  const {
    connect: walletAuthConnect,
    disconnect: walletAuthDisconnect,
    isConnecting,
    isSessionLoading,
    sessionRestored,
  } = useWalletAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);

  const personalSol = holdings.find((h) => h.symbol === 'SOL')?.amount ?? 0;

  // Long-press detection for mobile theme toggle
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handleThemeTouchStart = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      // Haptic feedback on long-press
      if (navigator.vibrate) navigator.vibrate(30);
      setThemePickerOpen(true);
    }, 400);
  }, []);

  const handleThemeTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Short tap: cycle theme
    if (!didLongPress.current) {
      const idx = themeOptions.findIndex(t => t.name === theme);
      const next = themeOptions[(idx + 1) % themeOptions.length];
      setTheme(next.name);
      if (navigator.vibrate) navigator.vibrate(10);
      toast.success(`Theme: ${next.label}`);
    }
  }, [theme, setTheme]);

  // Auto-trigger sign-message when wallet adapter connects,
  // but wait for session resume to finish first, and skip if session was restored.
  const hasTriggeredAuth = useRef(false);
  // Track if user explicitly initiated connect (vs auto-connect on page load)
  const userInitiated = useRef(false);
  // Track intentional disconnect to prevent auto-reconnect loop
  const justDisconnected = useRef(false);

  useEffect(() => {
    if (justDisconnected.current) return;
    // Only block on session loading for auto-connect, not user-initiated
    if (isSessionLoading && !userInitiated.current) return;
    if (sessionRestored || walletConnected) return;
    if (adapterConnected && !isConnecting && !hasTriggeredAuth.current) {
      hasTriggeredAuth.current = true;
      walletAuthConnect()
        .then(() => {
          toast.success('Wallet connected');
          userInitiated.current = false;
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to connect wallet');
          walletAuthDisconnect();
          userInitiated.current = false;
        })
        .finally(() => { hasTriggeredAuth.current = false; });
    }
    if (!adapterConnected) {
      hasTriggeredAuth.current = false;
    }
  }, [adapterConnected, walletConnected, isConnecting, isSessionLoading, sessionRestored, walletAuthConnect, walletAuthDisconnect]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await utils.invalidate();
      toast.success('Data refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConnectWallet = () => {
    userInitiated.current = true;
    setWalletModalOpen(true);
  };

  const handleDeposit = useCallback(async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0 || !publicKey || !tradeWallet) return;
    if (amount > personalSol) {
      toast.error('Insufficient SOL balance');
      return;
    }

    setIsDepositing(true);
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(tradeWallet),
          lamports: Math.round(amount * LAMPORTS_PER_SOL),
        }),
      );
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');
      toast.success(`Deposited ${amount} SOL to trade wallet`);
      setDepositAmount('');
      setDepositOpen(false);
      utils.leverage.getSolBalance.invalidate();
      // Also refetch after 3s to catch upstream propagation delay
      setTimeout(() => { utils.leverage.getSolBalance.invalidate(); }, 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deposit failed';
      toast.error(msg);
    } finally {
      setIsDepositing(false);
    }
  }, [depositAmount, publicKey, tradeWallet, personalSol, sendTransaction, connection]);

  const currentThemeOption = themeOptions.find((t) => t.name === theme) ?? themeOptions[0];

  return (
    <>
      <header className="h-11 border-b border-border bg-card flex items-center px-2 sm:px-3 shrink-0 select-none neon-stream-top relative z-30">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center mr-2 sm:mr-5 shrink-0 cursor-pointer group logo-glow">
            <img
              src="/0xLev-Clean.png"
              alt="xLev"
              className="h-6 sm:h-7 w-auto"
              draggable={false}
            />
          </div>
        </Link>

        {/* Desktop Navigation -- hidden on mobile */}
        <nav className="hidden md:flex items-center gap-0.5 mr-3 shrink-0">
          {navLinks.map((link) => {
            const isActive = link.path === '/'
              ? location === '/' || location === '/markets'
              : location === link.path || (link.path === '/terminal' && location.startsWith('/terminal'));
            return (
              <Link key={link.path} href={link.path}>
                <span
                  className={`px-2.5 py-1 text-[12px] font-medium rounded transition-all duration-150 ${
                    isActive
                      ? 'text-primary bg-primary/10 border-glow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary nav-hover'
                  }`}
                >
                  {link.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Spacer — pushes search bar to center */}
        <div className="hidden md:block flex-1" />

        {/* Dedicated Search Bar -- centered, fixed width */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 h-8 px-4 bg-secondary/50 border border-border/60 rounded-md text-[12px] text-muted-foreground/50 hover:text-muted-foreground hover:border-primary/30 hover:bg-secondary/60 transition-all w-[280px] lg:w-[320px] shrink-0"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">Search tokens...</span>
          <kbd className="text-[9px] bg-secondary/80 px-1.5 py-0.5 rounded font-data shrink-0">&#8984;K</kbd>
        </button>

        {/* Spacer — balances the center */}
        <div className="hidden md:block flex-1" />

        {/* Spacer for mobile */}
        <div className="flex-1 md:hidden" />

        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-3 shrink-0">
          {/* Mobile search icon */}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search tokens"
            className="md:hidden text-muted-foreground hover:text-primary transition-colors p-2.5 rounded-md hover:bg-primary/8 border border-border/40"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Mobile theme toggle -- tap opens picker sheet */}
          <button
            onClick={() => setThemePickerOpen(true)}
            aria-label="Change theme"
            className="sm:hidden flex items-center justify-center p-2.5 rounded hover:bg-primary/8 transition-colors select-none"
            title={`Theme: ${currentThemeOption.label}`}
          >
            <span
              className="w-4 h-4 rounded-full ring-1 ring-white/20 ring-offset-1 ring-offset-background transition-colors"
              style={{ backgroundColor: currentThemeOption.color }}
            />
          </button>

          {/* Social Links -- desktop only */}
          <a
            href="#" data-todo="0xLeverage-social-url"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow on X"
            className="hidden sm:flex text-muted-foreground/70 hover:text-primary transition-all p-1.5 rounded hover:bg-primary/10 icon-btn-hover"
            title="Follow on X"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="#" data-todo="0xLeverage-social-url"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join Telegram"
            className="hidden sm:flex text-muted-foreground/70 hover:text-primary transition-all p-1.5 rounded hover:bg-primary/10 icon-btn-hover"
            title="Join Telegram"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </a>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh data"
            className="hidden sm:flex text-muted-foreground hover:text-primary transition-colors p-1.5 rounded hover:bg-primary/8 disabled:opacity-50 icon-btn-hover"
          >
            <RefreshCircleSolid className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Theme Selector -- desktop only */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium text-foreground/80 hover:text-primary hover:bg-primary/8 transition-all btn-ghost-hover border border-border/50 hover:border-primary/30">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/10"
                  style={{ backgroundColor: currentThemeOption.color }}
                />
                {currentThemeOption.label}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-card border-border p-1">
              <div className="px-2 py-1.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Theme</div>
              </div>
              <DropdownMenuSeparator />
              {themeOptions.map((opt) => {
                const isActive = theme === opt.name;
                return (
                  <DropdownMenuItem
                    key={opt.name}
                    onClick={() => setTheme(opt.name)}
                    className={`text-[12px] cursor-pointer gap-2.5 py-1.5 ${
                      isActive ? 'text-primary bg-primary/5' : 'text-foreground'
                    }`}
                  >
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/10"
                          style={{ backgroundColor: opt.color }}
                        />
                        <span className="text-[12px] font-medium">{opt.label}</span>
                        {opt.experimental && (
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 leading-none">Exp</span>
                        )}
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary neon-pulse" />
                        )}
                      </div>
                      <div className="flex h-1.5 rounded-full overflow-hidden ml-5">
                        <span className="flex-[3]" style={{ backgroundColor: opt.preview[0] }} />
                        <span className="flex-[2]" style={{ backgroundColor: opt.preview[1] }} />
                        <span className="flex-[1]" style={{ backgroundColor: opt.preview[2] }} />
                        <span className="flex-[1]" style={{ backgroundColor: opt.preview[3] }} />
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden sm:block w-px h-4 bg-border mx-0.5" />

          {/* Wallet -- responsive */}
          {walletConnected && walletAddress ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2.5 py-1.5 bg-secondary rounded hover:bg-secondary/80 transition-colors border border-border hover:border-primary/30 btn-ghost-hover">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span className="text-[11px] sm:text-[12px] font-data text-foreground">
                    {truncateAddress(walletAddress, 3)}
                  </span>
                  <span className="hidden sm:inline text-[11px] font-data text-muted-foreground">
                    {formatNumber(walletBalance ?? 0, 2)} SOL
                  </span>
                  <NavArrowDownSolid className="w-3 h-3 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-card border-border p-0">
                {/* Wallet Header */}
                <div className="px-3 py-2.5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Wallet</div>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(walletAddress);
                          toast.success('Copied!');
                        } catch {
                          toast.error('Failed to copy');
                        }
                      }}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-[12px] font-data text-foreground mt-0.5">{truncateAddress(walletAddress, 8)}</div>
                </div>

                {/* Wallet Stats */}
                <div className="px-3 py-2 space-y-1.5 border-b border-border">
                  <WalletRow label="Total Wallet Value" value={formatPrice(walletTotalValue)} />
                  <WalletRow label="Wallet SOL" value={`${formatNumber(personalSol, 4)} SOL`} />
                  <div className="flex justify-between text-[12px] items-center">
                    <span className="text-muted-foreground">Funded Wallet</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-data text-foreground">{formatNumber(walletBalance ?? 0, 4)} SOL</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDepositOpen(true); }}
                        className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        Deposit
                      </button>
                    </div>
                  </div>
                  <WalletRow label="Open Positions" value={String(openPositions.length)} />
                </div>

                {/* Rakeback */}
                <div className="py-1 border-t border-border/20">
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-muted-foreground/50 uppercase tracking-wider">Rakeback</span>
                      <span className="text-[11px] font-data font-semibold text-success">0.00 SOL</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const text = encodeURIComponent(`Trading on @xLev_io — the Solana leveraged trading terminal 🚀\n\nClaim your rakeback at xLev.io`);
                          window.open(`https://x.com/intent/tweet?text=${text}`, '_blank', 'noopener,width=550,height=420');
                          toast.success('Share to unlock rakeback claim');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-semibold py-1.5 rounded bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.10] transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        Share on X
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toast.info('Rakeback claiming coming soon');
                        }}
                        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold py-1.5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors disabled:opacity-40"
                        disabled
                      >
                        Claim
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="py-1 border-t border-border/20">
                  <DropdownMenuItem
                    onClick={() => navigate('/positions')}
                    className="text-[12px] text-foreground cursor-pointer gap-2 px-3"
                  >
                    <ClockSolid className="w-3.5 h-3.5 text-muted-foreground" />
                    Order History
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      justDisconnected.current = true;
                      walletAuthDisconnect();
                      toast.info('Wallet disconnected');
                      setTimeout(() => { justDisconnected.current = false; }, 2000);
                    }}
                    className="text-[12px] text-destructive cursor-pointer gap-2 px-3"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect Wallet
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={handleConnectWallet}
              disabled={isConnecting}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-[12px] font-medium gap-1.5 px-4 neon-cta btn-hover"
            >
              <WalletSolid className="w-3.5 h-3.5" />
              {isConnecting ? (
                <span>Connecting...</span>
              ) : (
                <>
                  <span className="hidden sm:inline">Connect Wallet</span>
                  <span className="sm:hidden">Connect</span>
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Token Search Modal */}
      <TokenSearchModal open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Custom Wallet Connect Modal */}
      <WalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />

      {/* Deposit SOL Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="bg-card border-border max-w-sm mx-3 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px] text-foreground">Deposit SOL</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">
                Transfer SOL from your wallet to your 0xLeverage trade wallet.
              </div>
              {tradeWallet && (
                <div className="text-[10px] text-muted-foreground font-data break-all">
                  Trade wallet: {tradeWallet}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Amount (SOL)</span>
                <button
                  onClick={() => setDepositAmount(String(Math.max(0, personalSol - 0.01)))}
                  className="text-primary hover:text-primary/80 transition-colors text-[10px] font-medium"
                >
                  Max ({formatNumber(personalSol, 4)})
                </button>
              </div>
              <input
                type="number"
                step="0.001"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-secondary border border-border rounded text-[13px] font-data text-foreground focus:outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
            <button
              onClick={handleDeposit}
              disabled={isDepositing || !depositAmount || parseFloat(depositAmount) <= 0}
              className="w-full py-2.5 rounded bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors neon-cta disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDepositing ? 'Confirming…' : 'Deposit'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Theme Picker Sheet (long-press) */}
      <Drawer open={themePickerOpen} onOpenChange={setThemePickerOpen}>
        <DrawerContent className="bg-card border-border pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-[14px] text-foreground font-semibold">Choose Theme</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 grid grid-cols-3 gap-2">
            {themeOptions.map((opt) => {
              const isActive = theme === opt.name;
              return (
                <button
                  key={opt.name}
                  onClick={() => {
                    setTheme(opt.name);
                    if (navigator.vibrate) navigator.vibrate(10);
                    setThemePickerOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all active:scale-95 ${
                    isActive
                      ? 'border-primary bg-primary/10'
                      : 'border-border/50 bg-secondary/30 hover:bg-secondary/50'
                  }`}
                >
                  {/* Color preview bar */}
                  <div className="flex w-full h-2 rounded-full overflow-hidden">
                    <span className="flex-[3]" style={{ backgroundColor: opt.preview[0] }} />
                    <span className="flex-[2]" style={{ backgroundColor: opt.preview[1] }} />
                    <span className="flex-[1]" style={{ backgroundColor: opt.preview[2] }} />
                    <span className="flex-[1]" style={{ backgroundColor: opt.preview[3] }} />
                  </div>
                  {/* Theme dot + label */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/10"
                      style={{ backgroundColor: opt.color }}
                    />
                    <span className={`text-[11px] font-medium truncate ${
                      isActive ? 'text-primary' : 'text-foreground/80'
                    }`}>
                      {opt.label}
                    </span>
                    {opt.experimental && (
                      <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 leading-none">Exp</span>
                    )}
                  </div>
                  {/* Active indicator */}
                  {isActive && (
                    <span className="w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function WalletRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-data text-foreground">{value}</span>
    </div>
  );
}
