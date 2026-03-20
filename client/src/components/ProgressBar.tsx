/**
 * ProgressBar — Thin horizontal bar with animated fill.
 * Used for score indicators, health bars, and allocation percentages.
 */

import { memo, useEffect, useState } from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  bgColor?: string;
  height?: number;
  className?: string;
  animated?: boolean;
}

function ProgressBarInner({
  value,
  color = 'var(--primary)',
  bgColor = 'var(--secondary)',
  height = 3,
  className = '',
  animated = true,
}: ProgressBarProps) {
  const [width, setWidth] = useState(animated ? 0 : Math.min(100, Math.max(0, value)));

  useEffect(() => {
    if (animated) {
      const timer = requestAnimationFrame(() => {
        setWidth(Math.min(100, Math.max(0, value)));
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [value, animated]);

  return (
    <div
      className={`rounded-full overflow-hidden ${className}`}
      style={{ height, backgroundColor: bgColor }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${width}%`,
          backgroundColor: color,
          transition: animated ? 'width 800ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          boxShadow: `0 0 6px ${color}40`,
        }}
      />
    </div>
  );
}

export const ProgressBar = memo(ProgressBarInner);
