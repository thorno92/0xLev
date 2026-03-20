import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TradingViewChart } from './TradingViewChart';

// TradingView interval values
const timeIntervals = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1h', value: '60' },
  { label: '4h', value: '240' },
  { label: 'D', value: 'D' },
  { label: 'W', value: 'W' },
] as const;

export function ChartPanel() {
  const [activeInterval, setActiveInterval] = useState<string>('15');
  const { selectedToken } = useStore();
  const symbol = selectedToken?.symbol ?? 'SOL';

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Chart Toolbar -- hidden on mobile since TradingView has its own */}
      <div className="h-8 hidden sm:flex items-center px-2 gap-0.5 border-b border-border shrink-0">
        {/* Time intervals */}
        <div className="flex items-center gap-0.5">
          {timeIntervals.map((interval) => (
            <button
              key={interval.value}
              onClick={() => setActiveInterval(interval.value)}
              className={`px-1.5 py-0.5 text-[11px] font-data rounded transition-colors duration-100 badge-hover ${
                activeInterval === interval.value
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              {interval.label}
            </button>
          ))}
        </div>

        <div className="w-px h-3.5 bg-border mx-1.5" />

        {/* Chart type label */}
        <span className="text-[11px] text-muted-foreground font-data">
          TradingView
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Symbol indicator */}
        <span className="text-[11px] font-data text-muted-foreground">
          {symbol}/USDT
        </span>
      </div>

      {/* TradingView Chart */}
      <div className="flex-1 min-h-0">
        <TradingViewChart
          symbol={symbol}
          interval={activeInterval}
        />
      </div>
    </div>
  );
}
