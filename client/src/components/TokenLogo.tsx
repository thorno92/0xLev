/**
 * TokenLogo -- Reusable token logo component with multi-source fallback.
 * 
 * Fallback chain:
 *   1. CDN image (CoinGecko/simplr-sh)
 *   2. @web3icons/react dynamic TokenIcon with built-in fallback prop
 *   3. Generated color avatar with initials
 *
 * PERF: Uses loading="eager" for above-fold logos (header, price bar),
 *       loading="lazy" for below-fold (tables, lists).
 *       Includes decoding="async" to avoid blocking main thread.
 */

import { useState, memo, Suspense, lazy, useMemo } from 'react';
import { getTokenLogoUrl, getTokenColor } from '@/lib/tokenLogos';

// Lazy-load the dynamic TokenIcon to avoid bloating the initial bundle
const Web3TokenIcon = lazy(() =>
  import('@web3icons/react/dynamic').then((mod) => ({
    default: mod.TokenIcon,
  }))
);

interface TokenLogoProps {
  symbol: string;
  size?: number;
  className?: string;
  /** Set to true for logos visible on initial paint (header, price bar) */
  eager?: boolean;
  /** Direct image URL — takes precedence over CDN lookup when provided */
  logoUrl?: string;
}

/** Generated color avatar as the final fallback */
function GeneratedAvatar({ symbol, size, className }: { symbol: string; size: number; className: string }) {
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: getTokenColor(symbol),
        fontSize: Math.max(8, size * 0.38),
      }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}

/** Web3Icons fallback -- renders the branded TokenIcon from @web3icons/react */
function Web3IconFallback({ symbol, size, className }: {
  symbol: string;
  size: number;
  className: string;
}) {
  // Use the built-in fallback prop to render generated avatar when icon is not found
  const fallbackElement = useMemo(
    () => <GeneratedAvatar symbol={symbol} size={size} className={className} />,
    [symbol, size, className]
  );

  return (
    <Suspense fallback={fallbackElement}>
      <div
        className={`rounded-full overflow-hidden shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <Web3TokenIcon
          symbol={symbol.toUpperCase()}
          size={size}
          variant="branded"
          className="w-full h-full"
          fallback={fallbackElement}
        />
      </div>
    </Suspense>
  );
}

function TokenLogoInner({ symbol, size = 20, className = '', eager = false, logoUrl: directUrl }: TokenLogoProps) {
  const [imgError, setImgError] = useState(false);
  const cdnUrl = getTokenLogoUrl(symbol, size > 40 ? 'large' : size > 24 ? 'standard' : 'small');
  const logoUrl = directUrl && !imgError ? directUrl : cdnUrl;

  // Stage 2: Web3Icons fallback with built-in fallback to generated avatar (CDN failed)
  if (imgError) {
    return (
      <Web3IconFallback
        symbol={symbol}
        size={size}
        className={className}
      />
    );
  }

  // Stage 1: CDN image (primary)
  return (
    <img
      src={logoUrl}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      className={`rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onError={() => setImgError(true)}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}

export const TokenLogo = memo(TokenLogoInner);
