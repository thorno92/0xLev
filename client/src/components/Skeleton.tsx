/*
 * ANIMATION: Skeleton Loading Components
 * Purple-tinted shimmer effect that matches the theme.
 * Used for data tables, cards, and content areas during loading states.
 */

import { type ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer rounded ${className}`}
      style={{ width, height }}
    />
  );
}

/*
 * Skeleton row for data tables — mimics a table row with shimmer bars
 */
interface SkeletonTableRowProps {
  columns: number;
  index?: number;
}

export function SkeletonTableRow({ columns, index = 0 }: SkeletonTableRowProps) {
  // Vary widths per column for realistic look
  const widths = ['60%', '40%', '50%', '70%', '45%', '55%', '35%', '65%'];

  return (
    <tr
      className="skeleton-row"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-2 py-2">
          <div
            className="skeleton-shimmer rounded h-3"
            style={{ width: widths[i % widths.length] }}
          />
        </td>
      ))}
    </tr>
  );
}

/*
 * Full skeleton table — renders header + N skeleton rows
 */
interface SkeletonTableProps {
  columns: number;
  rows?: number;
  headers?: string[];
}

export function SkeletonTable({ columns, rows = 8, headers }: SkeletonTableProps) {
  return (
    <table className="data-table">
      {headers && (
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} columns={columns} index={i} />
        ))}
      </tbody>
    </table>
  );
}

/*
 * Skeleton card — for stats cards and metric panels
 */
interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className = '', lines = 3 }: SkeletonCardProps) {
  return (
    <div className={`bg-secondary/30 rounded p-3 border border-border/50 space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer rounded h-3"
          style={{
            width: i === 0 ? '40%' : i === 1 ? '70%' : '55%',
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

/*
 * Loading wrapper — shows skeleton while loading, then fades in content
 */
interface LoadingWrapperProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}

export function LoadingWrapper({ loading, skeleton, children }: LoadingWrapperProps) {
  return loading ? <>{skeleton}</> : <div className="animate-fade-in">{children}</div>;
}
