/**
 * SHARED SCREENER FILTERS
 * Reusable filter interface, empty state, filter row, dialog, and button.
 * Used by Markets.tsx and Trending.tsx.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FilterSolid } from 'iconoir-react';

/* ------------------------------------------------------------------ */
/*  FILTER STATE                                                       */
/* ------------------------------------------------------------------ */
export interface ScreenerFilters {
  liquidityMin: string; liquidityMax: string;
  mcapMin: string; mcapMax: string;
  fdvMin: string; fdvMax: string;
  pairAgeMin: string; pairAgeMax: string;
  txns24hMin: string; txns24hMax: string;
  buys24hMin: string; buys24hMax: string;
  sells24hMin: string; sells24hMax: string;
  volume24hMin: string; volume24hMax: string;
  change24hMin: string; change24hMax: string;
  txns6hMin: string; txns6hMax: string;
  buys6hMin: string; buys6hMax: string;
  sells6hMin: string; sells6hMax: string;
}

export const emptyFilters: ScreenerFilters = {
  liquidityMin: '', liquidityMax: '',
  mcapMin: '', mcapMax: '',
  fdvMin: '', fdvMax: '',
  pairAgeMin: '', pairAgeMax: '',
  txns24hMin: '', txns24hMax: '',
  buys24hMin: '', buys24hMax: '',
  sells24hMin: '', sells24hMax: '',
  volume24hMin: '', volume24hMax: '',
  change24hMin: '', change24hMax: '',
  txns6hMin: '', txns6hMax: '',
  buys6hMin: '', buys6hMax: '',
  sells6hMin: '', sells6hMax: '',
};

/* ------------------------------------------------------------------ */
/*  FILTER ROW — grid-aligned label + min/max inputs                   */
/* ------------------------------------------------------------------ */
function FilterRow({ label, minVal, maxVal, onMinChange, onMaxChange, prefix = '$', suffix }: {
  label: string;
  minVal: string;
  maxVal: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  const showPrefix = prefix === '$';
  const showSuffix = !!suffix;
  return (
    <div className="grid grid-cols-[90px_1fr_1fr] gap-2 items-center">
      <span className="text-[11px] text-muted-foreground/70 text-right pr-1 font-medium">{label}</span>
      <div className="flex items-center">
        {showPrefix && (
          <span className="text-[10px] text-muted-foreground/50 bg-secondary/50 border border-border/30 border-r-0 rounded-l-md px-1.5 h-8 flex items-center shrink-0">$</span>
        )}
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Min"
          value={minVal}
          onChange={(e) => onMinChange(e.target.value)}
          className={`h-8 text-[11px] bg-secondary/30 border-border/30 font-data ${showPrefix ? 'rounded-l-none' : ''} ${showSuffix ? 'rounded-r-none' : ''}`}
        />
        {showSuffix && (
          <span className="text-[10px] text-muted-foreground/50 bg-secondary/50 border border-border/30 border-l-0 rounded-r-md px-1.5 h-8 flex items-center shrink-0">{suffix}</span>
        )}
      </div>
      <div className="flex items-center">
        {showPrefix && (
          <span className="text-[10px] text-muted-foreground/50 bg-secondary/50 border border-border/30 border-r-0 rounded-l-md px-1.5 h-8 flex items-center shrink-0">$</span>
        )}
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Max"
          value={maxVal}
          onChange={(e) => onMaxChange(e.target.value)}
          className={`h-8 text-[11px] bg-secondary/30 border-border/30 font-data ${showPrefix ? 'rounded-l-none' : ''} ${showSuffix ? 'rounded-r-none' : ''}`}
        />
        {showSuffix && (
          <span className="text-[10px] text-muted-foreground/50 bg-secondary/50 border border-border/30 border-l-0 rounded-r-md px-1.5 h-8 flex items-center shrink-0">{suffix}</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SCREENER FILTER DIALOG                                             */
/* ------------------------------------------------------------------ */
export function ScreenerFilterDialog({ open, onOpenChange, filters, setFilters, onApply, onReset }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: ScreenerFilters;
  setFilters: (f: ScreenerFilters) => void;
  onApply: () => void;
  onReset?: () => void;
}) {
  const [filterTab, setFilterTab] = useState<'all' | 'dexes'>('all');
  const [profileToggles, setProfileToggles] = useState<string[]>(['Profile', 'Boosted', 'Ads', 'Launchpad']);

  const update = (key: keyof ScreenerFilters, val: string) => {
    setFilters({ ...filters, [key]: val });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 bg-card border-border gap-0 overflow-hidden max-h-[85vh] mx-3 sm:mx-auto">
        <DialogHeader className="px-5 pt-4 pb-3">
          <DialogTitle className="text-[14px] text-foreground flex items-center gap-2">
            <FilterSolid className="w-4 h-4 text-primary" />
            Customize Filters
          </DialogTitle>
        </DialogHeader>

        {/* Platform tabs */}
        <div className="grid grid-cols-2 gap-2 px-5 pb-3">
          <button
            onClick={() => setFilterTab('all')}
            className={`text-[12px] font-semibold py-2 rounded-lg border transition-all text-center ${
              filterTab === 'all'
                ? 'border-foreground/30 bg-secondary/60 text-foreground'
                : 'border-border/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            All Platforms
          </button>
          <button
            onClick={() => setFilterTab('dexes')}
            className={`text-[12px] font-semibold py-2 rounded-lg border transition-all text-center ${
              filterTab === 'dexes'
                ? 'border-foreground/30 bg-secondary/60 text-foreground'
                : 'border-border/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            All DEXes
          </button>
        </div>

        {/* Profile toggles */}
        <div className="px-5 pb-3">
          <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium mb-2">Filters (optional)</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(['Profile', 'Boosted', 'Ads', 'Launchpad'] as const).map((tag) => {
              const icons: Record<string, string> = { Profile: '\u{1F464}', Boosted: '\u26A1', Ads: '\u{1F50A}', Launchpad: '\u{1F680}' };
              const isActive = profileToggles.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => {
                    setProfileToggles((prev: string[]) =>
                      prev.includes(tag) ? prev.filter((t: string) => t !== tag) : [...prev, tag]
                    );
                  }}
                  className={`text-[11px] py-2 rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'border-primary/40 bg-primary/8 text-primary'
                      : 'border-border/40 text-muted-foreground/50 hover:text-foreground'
                  }`}
                >
                  <span>{icons[tag]}</span>
                  {tag}
                  {isActive && <span className="text-primary text-[10px]">{'\u2713'}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter rows — scrollable */}
        <div className="px-5 py-3 space-y-2.5 overflow-y-auto max-h-[40vh] scrollbar-thin border-t border-border/10">
          <FilterRow label="Liquidity" minVal={filters.liquidityMin} maxVal={filters.liquidityMax} onMinChange={v => update('liquidityMin', v)} onMaxChange={v => update('liquidityMax', v)} />
          <FilterRow label="Market cap" minVal={filters.mcapMin} maxVal={filters.mcapMax} onMinChange={v => update('mcapMin', v)} onMaxChange={v => update('mcapMax', v)} />
          <FilterRow label="FDV" minVal={filters.fdvMin} maxVal={filters.fdvMax} onMinChange={v => update('fdvMin', v)} onMaxChange={v => update('fdvMax', v)} />
          <FilterRow label="Pair age" minVal={filters.pairAgeMin} maxVal={filters.pairAgeMax} onMinChange={v => update('pairAgeMin', v)} onMaxChange={v => update('pairAgeMax', v)} prefix="" suffix="hrs" />

          <div className="h-px bg-border/15" />

          <FilterRow label="24H txns" minVal={filters.txns24hMin} maxVal={filters.txns24hMax} onMinChange={v => update('txns24hMin', v)} onMaxChange={v => update('txns24hMax', v)} prefix="" />
          <FilterRow label="24H buys" minVal={filters.buys24hMin} maxVal={filters.buys24hMax} onMinChange={v => update('buys24hMin', v)} onMaxChange={v => update('buys24hMax', v)} prefix="" />
          <FilterRow label="24H sells" minVal={filters.sells24hMin} maxVal={filters.sells24hMax} onMinChange={v => update('sells24hMin', v)} onMaxChange={v => update('sells24hMax', v)} prefix="" />
          <FilterRow label="24H volume" minVal={filters.volume24hMin} maxVal={filters.volume24hMax} onMinChange={v => update('volume24hMin', v)} onMaxChange={v => update('volume24hMax', v)} />
          <FilterRow label="24H change" minVal={filters.change24hMin} maxVal={filters.change24hMax} onMinChange={v => update('change24hMin', v)} onMaxChange={v => update('change24hMax', v)} prefix="" suffix="%" />

          <div className="h-px bg-border/15" />

          <FilterRow label="6H txns" minVal={filters.txns6hMin} maxVal={filters.txns6hMax} onMinChange={v => update('txns6hMin', v)} onMaxChange={v => update('txns6hMax', v)} prefix="" />
          <FilterRow label="6H buys" minVal={filters.buys6hMin} maxVal={filters.buys6hMax} onMinChange={v => update('buys6hMin', v)} onMaxChange={v => update('buys6hMax', v)} prefix="" />
          <FilterRow label="6H sells" minVal={filters.sells6hMin} maxVal={filters.sells6hMax} onMinChange={v => update('sells6hMin', v)} onMaxChange={v => update('sells6hMax', v)} prefix="" />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 px-5 py-4 border-t border-border/15">
          {onReset && (
            <button onClick={onReset} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors py-2 rounded-lg border border-border/30 hover:border-border/50">
              Reset All
            </button>
          )}
          <button
            onClick={() => { onApply(); onOpenChange(false); }}
            className={`flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground text-[12px] font-semibold rounded-lg hover:bg-primary/90 transition-colors ${onReset ? '' : 'col-span-2'}`}
          >
            <span>{'\u2713'}</span> Apply
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  FILTER PANEL BUTTON                                                */
/* ------------------------------------------------------------------ */
export function FilterPanel({ filters, setFilters, onReset }: {
  filters: ScreenerFilters;
  setFilters: (f: ScreenerFilters) => void;
  onReset: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => v !== '').length;
  }, [filters]);

  const handleApply = useCallback(() => {
    // filters are already set via setFilters in the dialog; just close
  }, []);

  return (
    <>
      <button
        onClick={() => setFiltersOpen(true)}
        className={`flex items-center gap-1.5 h-8 px-3.5 text-[11px] font-medium rounded-lg border transition-all shrink-0 ${
          activeFilterCount > 0
            ? 'bg-primary/[0.08] text-primary border-primary/20'
            : 'bg-white/[0.02] text-muted-foreground/50 border-white/[0.04] hover:text-foreground hover:border-primary/15'
        }`}
      >
        <FilterSolid className="w-3 h-3" />
        Filters
        {activeFilterCount > 0 && (
          <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-px rounded-full font-data ml-0.5">
            {activeFilterCount}
          </span>
        )}
      </button>

      <ScreenerFilterDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApply}
        onReset={onReset}
      />
    </>
  );
}
