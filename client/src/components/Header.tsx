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
import { truncateAddress, formatNumber } from '@/lib/format';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { toast } from 'sonner';
import { TrendingBar } from './TrendingBar';
import { TokenSearchModal } from './TokenSearchModal';
import { useTheme, type ThemeName } from '@/contexts/ThemeContext';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

const navLinks = [
  { name: 'Terminal', path: '/' },
  { name: 'Markets', path: '/markets' },
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
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const {
    walletConnected,
    walletAddress,
    walletBalance,
    disconnectWallet,
    openPositions,
  } = useStore();
  const { setVisible } = useWalletModal();
  const { connected: adapterConnected } = useWallet();
  const { connect: walletAuthConnect, disconnect: walletAuthDisconnect, isConnecting } = useWalletAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rakebackOpen, setRakebackOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

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

  // Auto-trigger sign-message when wallet adapter connects
  const hasTriggeredAuth = useRef(false);
  useEffect(() => {
    if (adapterConnected && !walletConnected && !isConnecting && !hasTriggeredAuth.current) {
      hasTriggeredAuth.current = true;
      walletAuthConnect()
        .then(() => toast.success('Wallet connected'))
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to connect wallet');
          walletAuthDisconnect();
        })
        .finally(() => { hasTriggeredAuth.current = false; });
    }
    if (!adapterConnected) {
      hasTriggeredAuth.current = false;
    }
  }, [adapterConnected, walletConnected, isConnecting, walletAuthConnect, walletAuthDisconnect]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast.info('Refreshing data...');
    await new Promise((r) => setTimeout(r, 800));
    setIsRefreshing(false);
    toast.success('Data refreshed');
  };

  const handleConnectWallet = () => {
    setVisible(true);
  };

  const handleClaimRakeback = () => {
    const tweetText = encodeURIComponent('Liquidation RakeBack of $12.012025 Claimed on 0xLeverage');
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
    toast.success('RakeBack claimed successfully!');
    setRakebackOpen(false);
  };

  const currentThemeOption = themeOptions.find((t) => t.name === theme) ?? themeOptions[0];

  return (
    <>
      <header className="h-11 border-b border-border bg-card flex items-center px-2 sm:px-3 shrink-0 select-none neon-stream-top">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-baseline gap-0.5 mr-2 sm:mr-5 shrink-0 cursor-pointer group">
            <span className="text-[14px] sm:text-[15px] font-bold tracking-tight text-shimmer font-data">
              0xLeverage
            </span>
          </div>
        </Link>

        {/* Desktop Navigation -- hidden on mobile */}
        <nav className="hidden md:flex items-center gap-0.5 mr-3 shrink-0">
          {navLinks.map((link) => {
            const isActive = link.path === '/'
              ? location === '/' || location === '/terminal'
              : location === link.path;
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

        {/* Divider -- desktop only */}
        <div className="hidden md:block w-px h-4 bg-border mr-2 shrink-0" />

        {/* Dedicated Search Bar -- always visible on desktop */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 h-7 px-3 bg-secondary/30 border border-border/40 rounded text-[11px] text-muted-foreground/60 hover:text-muted-foreground hover:border-primary/30 hover:bg-secondary/50 transition-all mr-2 min-w-[180px] lg:min-w-[220px]"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">Search tokens...</span>
          <kbd className="text-[9px] bg-secondary/80 px-1.5 py-0.5 rounded font-data shrink-0">&#8984;K</kbd>
        </button>

        {/* Divider -- desktop only */}
        <div className="hidden lg:block w-px h-4 bg-border mr-2 shrink-0" />

        {/* Trending carousel -- desktop only, no "TRENDING" label */}
        <div className="hidden lg:block flex-1 overflow-hidden">
          <TrendingBar />
        </div>

        {/* Spacer for mobile */}
        <div className="flex-1 md:hidden" />
        <div className="hidden md:block lg:hidden flex-1" />

        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-3 shrink-0">
          {/* Mobile search icon */}
          <button
            onClick={() => setSearchOpen(true)}
            className="md:hidden text-muted-foreground hover:text-primary transition-colors p-1.5 rounded hover:bg-primary/8"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Mobile theme toggle -- tap to cycle, long-press to open picker sheet */}
          <button
            onTouchStart={handleThemeTouchStart}
            onTouchEnd={handleThemeTouchEnd}
            onTouchCancel={() => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
            }}
            onClick={(e) => {
              // Prevent click on touch devices (handled by touch events)
              // Only fire on non-touch (desktop fallback)
              if ('ontouchstart' in window) { e.preventDefault(); return; }
              const idx = themeOptions.findIndex(t => t.name === theme);
              const next = themeOptions[(idx + 1) % themeOptions.length];
              setTheme(next.name);
              toast.success(`Theme: ${next.label}`);
            }}
            className="sm:hidden flex items-center justify-center p-1.5 rounded hover:bg-primary/8 transition-colors select-none"
            title={`Theme: ${currentThemeOption.label} (hold for picker)`}
          >
            <span
              className="w-4 h-4 rounded-full ring-1 ring-white/20 ring-offset-1 ring-offset-background transition-colors"
              style={{ backgroundColor: currentThemeOption.color }}
            />
          </button>

          {/* Social Links -- desktop only */}
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex text-muted-foreground/70 hover:text-primary transition-all p-1.5 rounded hover:bg-primary/10 icon-btn-hover"
            title="Follow on X"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://telegram.org"
            target="_blank"
            rel="noopener noreferrer"
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
                      onClick={() => {
                        navigator.clipboard.writeText(walletAddress);
                        toast.info('Address copied');
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
                  <WalletRow label="Total Wallet Value" value="$12,450.00" />
                  <WalletRow label="Funded Wallet" value="$8,200.00" />
                  <WalletRow label="Balance" value={`${formatNumber(walletBalance ?? 0, 4)} SOL`} />
                  <div className="flex justify-between text-[12px] items-center">
                    <span className="text-muted-foreground">RakeBack</span>
                    <button
                      onClick={() => setRakebackOpen(true)}
                      className="font-data text-success hover:text-success/80 transition-colors"
                    >
                      $12.012025
                    </button>
                  </div>
                  <WalletRow label="Open Positions" value={String(openPositions.length || 3)} />
                  <WalletRow label="Open Orders" value="5" />
                </div>

                {/* Actions */}
                <div className="py-1">
                  <DropdownMenuItem className="text-[12px] text-foreground cursor-pointer gap-2 px-3">
                    <ClockSolid className="w-3.5 h-3.5 text-muted-foreground" />
                    Order History
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      walletAuthDisconnect();
                      toast.info('Wallet disconnected');
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
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-[11px] sm:text-[12px] font-medium gap-1 sm:gap-1.5 px-2 sm:px-3 neon-cta btn-hover"
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

      {/* RakeBack Claim Dialog */}
      <Dialog open={rakebackOpen} onOpenChange={setRakebackOpen}>
          <DialogContent className="bg-card border-border max-w-sm mx-3 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px] text-foreground">RakeBack Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Liquidation RakeBack
              </div>
              <div className="text-[28px] font-data font-bold text-success">$12.012025</div>
              <div className="text-[11px] text-muted-foreground mt-1">Claimed on 0xLeverage</div>
            </div>
            <button
              onClick={handleClaimRakeback}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors neon-cta"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share to X to claim your RakeBack
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
