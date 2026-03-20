/**
 * Visible "TESTING BUILD" banner pinned to the top of the viewport.
 * Bright amber/yellow to make it unmistakable that this is not production.
 * Dismissible per session via a small X button.
 */

import { useState } from 'react';

export function TestingBuildBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative z-[9999] w-full bg-amber-500 text-black text-center py-1 px-4 select-none shrink-0">
      <div className="flex items-center justify-center gap-2 text-[11px] sm:text-[12px] font-bold tracking-wider uppercase">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-black/60 animate-pulse" />
        Testing Build -- Not for Production Use
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-black/60 animate-pulse" />
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-black/60 hover:text-black transition-colors p-1"
        aria-label="Dismiss testing banner"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
