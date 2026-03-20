/**
 * PULL-TO-REFRESH -- Mobile-only pull gesture to refresh data.
 * Wraps a scrollable container. Shows a spinner when pulled past threshold.
 * Only activates when scrollTop === 0 and user pulls downward.
 *
 * Key: touch handlers are on the OUTER wrapper, not the scroll container,
 * so native scrolling is never blocked. We only intercept when at the top
 * and pulling down.
 */

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
  /** Pull distance in px before triggering refresh (default 64) */
  threshold?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  className = '',
  threshold = 64,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const crossedThresholdRef = useRef(false);

  // Use native event listeners so we can check scrollTop without blocking scroll
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const scrollEl = scrollRef.current;
    if (!wrapper || !scrollEl) return;

    let pulling = false;
    let startY = 0;
    let currentPull = 0;
    let crossed = false;
    let refreshing = false;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      // Only start pull tracking if scroll container is at the very top
      if (scrollEl.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling || refreshing) return;

      // If user has scrolled down since touch start, cancel pull
      if (scrollEl.scrollTop > 0) {
        pulling = false;
        setPullDistance(0);
        currentPull = 0;
        return;
      }

      const deltaY = e.touches[0].clientY - startY;

      // If pulling up (scrolling down), let native scroll handle it
      if (deltaY <= 0) {
        if (currentPull > 0) {
          setPullDistance(0);
          currentPull = 0;
        }
        pulling = false;
        return;
      }

      // We are pulling down at scrollTop=0 -- prevent native overscroll
      e.preventDefault();

      const dampened = Math.min(deltaY * 0.45, threshold * 1.8);
      currentPull = dampened;
      setPullDistance(dampened);

      // Haptic tick when crossing the threshold
      if (dampened >= threshold && !crossed) {
        crossed = true;
        if (navigator.vibrate) navigator.vibrate(15);
      } else if (dampened < threshold) {
        crossed = false;
      }
    };

    const onTouchEnd = async () => {
      if (!pulling || refreshing) return;
      pulling = false;

      if (currentPull >= threshold) {
        refreshing = true;
        setIsRefreshing(true);
        setPullDistance(threshold * 0.6);
        if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
        try {
          await onRefresh();
        } catch {
          // Silently handle
        }
        refreshing = false;
        setIsRefreshing(false);
      }
      currentPull = 0;
      crossed = false;
      setPullDistance(0);
    };

    // Use { passive: false } on touchmove so we can call preventDefault
    // when pulling down at top, but passive on start/end
    wrapper.addEventListener('touchstart', onTouchStart, { passive: true });
    wrapper.addEventListener('touchmove', onTouchMove, { passive: false });
    wrapper.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      wrapper.removeEventListener('touchstart', onTouchStart);
      wrapper.removeEventListener('touchmove', onTouchMove);
      wrapper.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh, threshold]);

  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 4 || isRefreshing;

  return (
    <div ref={wrapperRef} className={`relative overflow-hidden ${className}`}>
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 top-0 flex items-center justify-center overflow-hidden pointer-events-none z-10"
        style={{
          height: showIndicator ? `${Math.max(pullDistance, isRefreshing ? 40 : 0)}px` : '0px',
          transition: pullDistance > 0 && !isRefreshing ? 'none' : 'height 0.25s ease-out',
        }}
      >
        <div
          className="flex items-center gap-2"
          style={{
            opacity: Math.min(progress * 1.5, 1),
            transition: pullDistance > 0 ? 'none' : 'opacity 0.2s ease-out',
          }}
        >
          {isRefreshing ? (
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              className="w-5 h-5 text-primary transition-transform"
              style={{
                transform: `rotate(${progress * 180}deg)`,
                transition: pullDistance > 0 ? 'none' : 'transform 0.2s ease-out',
              }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="7 13 12 18 17 13" />
              <line x1="12" y1="6" x2="12" y2="18" />
            </svg>
          )}
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {isRefreshing ? 'Refreshing...' : progress >= 1 ? 'Release' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      {/* Scrollable content -- touch-action ensures native scroll works */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto overscroll-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          transform: showIndicator ? `translateY(${pullDistance}px)` : 'translateY(0)',
          transition: pullDistance > 0 && !isRefreshing ? 'none' : 'transform 0.25s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
