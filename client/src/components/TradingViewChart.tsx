/**
 * TradingViewChart — Official TradingView Advanced Chart widget.
 * Theme-aware: reads current theme to set appropriate background.
 * Optimized for fast initial paint with deferred loading.
 */

import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { getTradingViewSymbol } from '@/lib/tokenLogos';
import { useTheme } from '@/contexts/ThemeContext';

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
}

function ChartSkeleton() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
        <span className="text-[11px] text-muted-foreground font-data tracking-wider">LOADING CHART</span>
      </div>
    </div>
  );
}

const THEME_BG: Record<string, string> = {
  cyberpunk: '#09080F',
  midnight: '#07060C',
  lavender: '#FAFAFF',
};

function TradingViewChartInner({ symbol, interval = '15' }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [chartError, setChartError] = useState(false);
  const { theme, isDark } = useTheme();

  const loadWidget = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = '100%';
    widgetInner.style.width = '100%';
    widgetContainer.appendChild(widgetInner);

    container.appendChild(widgetContainer);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    const tvSymbol = getTradingViewSymbol(symbol);
    const bgColor = THEME_BG[theme] || THEME_BG.cyberpunk;

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: interval,
      timezone: 'Etc/UTC',
      theme: isDark ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      allow_symbol_change: false,
      calendar: false,
      details: false,
      hotlist: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      save_image: true,
      withdateranges: false,
      support_host: 'https://www.tradingview.com',
      backgroundColor: bgColor,
      gridColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)',
      studies: [],
      watchlist: [],
      compareSymbols: [],
    });

    script.onload = () => setIsLoaded(true);
    script.onerror = () => { setIsLoaded(true); setChartError(true); };
    widgetContainer.appendChild(script);
  }, [symbol, interval, theme, isDark]);

  useEffect(() => {
    setIsLoaded(false);
    setChartError(false);
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => loadWidget(), { timeout: 300 });
      return () => cancelIdleCallback(id);
    } else {
      const raf = requestAnimationFrame(() => {
        const timer = setTimeout(loadWidget, 50);
        return () => clearTimeout(timer);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [loadWidget]);

  useEffect(() => {
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  if (chartError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-card">
        <div className="text-center">
          <span className="text-[12px] text-muted-foreground">Chart unavailable for this token</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative" style={{ minHeight: 200 }}>
      {!isLoaded && (
        <div className="absolute inset-0 z-10">
          <ChartSkeleton />
        </div>
      )}
      <div
        ref={containerRef}
        className="h-full w-full"
      />
    </div>
  );
}

export const TradingViewChart = memo(TradingViewChartInner);
