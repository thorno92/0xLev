/**
 * Formatting utilities for the trading terminal.
 * All financial data formatting in one place.
 */

function safeNum(n: number): number {
  if (n == null || !isFinite(n)) return 0;
  return n;
}

export function formatPrice(price: number, decimals?: number): string {
  price = safeNum(price);
  if (price === 0) return '$0.00';
  const abs = Math.abs(price);
  const sign = price < 0 ? '-' : '';
  if (abs < 0.0001) return `${sign}$${abs.toFixed(8)}`;
  if (abs < 0.01) return `${sign}$${abs.toFixed(6)}`;
  if (abs < 1) return `${sign}$${abs.toFixed(4)}`;
  const d = decimals ?? 2;
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export function formatPriceSol(price: number): string {
  price = safeNum(price);
  if (price === 0) return '0 SOL';
  const abs = Math.abs(price);
  const sign = price < 0 ? '-' : '';
  if (abs < 0.00000001) return `${sign}${abs.toExponential(2)} SOL`;
  if (abs < 0.0001) return `${sign}${abs.toFixed(10)} SOL`;
  if (abs < 0.01) return `${sign}${abs.toFixed(8)} SOL`;
  if (abs < 1) return `${sign}${abs.toFixed(6)} SOL`;
  return `${sign}${abs.toFixed(4)} SOL`;
}

export function formatNumber(num: number, decimals: number = 2): string {
  num = safeNum(num);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompact(num: number): string {
  num = safeNum(num);
  if (num >= 1_000_000_000) {
    const b = num / 1_000_000_000;
    return `$${b >= 100 ? b.toFixed(0) : b >= 10 ? b.toFixed(1) : b.toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `$${m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2)}M`;
  }
  if (num >= 1_000) {
    const k = num / 1_000;
    return `$${k >= 100 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `$${num.toFixed(0)}`;
}

export function formatPercent(pct: number): string {
  pct = safeNum(pct);
  const sign = pct >= 0 ? '+' : '';
  const abs = Math.abs(pct);
  const d = abs >= 10 ? 1 : 2;
  return `${sign}${pct.toFixed(d)}%`;
}

export function formatSol(amount: number): string {
  amount = safeNum(amount);
  return `${amount.toFixed(4)} SOL`;
}

export function truncateAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
