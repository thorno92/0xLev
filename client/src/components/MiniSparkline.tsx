/**
 * MiniSparkline — Tiny inline SVG sparkline chart for token cards and tables.
 * Generates a smooth polyline from data points with optional gradient fill.
 * Pure SVG, no dependencies.
 */

import { memo, useMemo } from 'react';

interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showFill?: boolean;
  strokeWidth?: number;
  className?: string;
}

function MiniSparklineInner({
  data,
  width = 80,
  height = 28,
  color,
  showFill = true,
  strokeWidth = 1.5,
  className = '',
}: MiniSparklineProps) {
  const { path, fillPath, computedColor, id } = useMemo(() => {
    if (data.length < 2) return { path: '', fillPath: '', computedColor: 'var(--muted-foreground)', id: '' };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;

    const points = data.map((val, i) => ({
      x: padding + (i / (data.length - 1)) * w,
      y: padding + h - ((val - min) / range) * h,
    }));

    // Smooth curve using catmull-rom to bezier conversion
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    const fillD = `${d} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

    const isUp = data[data.length - 1] >= data[0];
    const autoColor = color || (isUp ? 'var(--success)' : 'var(--destructive)');
    const uniqueId = `spark-${Math.random().toString(36).slice(2, 8)}`;

    return { path: d, fillPath: fillD, computedColor: autoColor, id: uniqueId };
  }, [data, width, height, color, strokeWidth]);

  if (data.length < 2) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ display: 'block' }}
    >
      {showFill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={computedColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={computedColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill={`url(#${id})`} />
        </>
      )}
      <path
        d={path}
        fill="none"
        stroke={computedColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const MiniSparkline = memo(MiniSparklineInner);

/**
 * Generate deterministic sparkline data from a seed string.
 * Returns an array of numbers that looks like a price chart.
 */
export function generateSparklineData(seed: string, points: number = 20): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }

  const data: number[] = [];
  let value = 100 + (Math.abs(hash) % 50);

  for (let i = 0; i < points; i++) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    const change = ((Math.abs(hash) % 100) - 48) / 20;
    value = Math.max(10, value + change);
    data.push(value);
  }

  return data;
}
