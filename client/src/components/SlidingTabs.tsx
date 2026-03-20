/**
 * SlidingTabs — smooth morphing indicator that follows the active tab
 * Inspired by 21st.dev animated tab components
 * Uses framer-motion layoutId for fluid transitions
 */

import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  badge?: string | number;
}

interface SlidingTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
  /** Style variant */
  variant?: 'underline' | 'pill';
  /** Unique layout group ID to prevent conflicts between multiple tab sets */
  layoutId?: string;
}

export function SlidingTabs({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  variant = 'underline',
  layoutId = 'tab-indicator',
}: SlidingTabsProps) {
  return (
    <div className={`flex items-center relative ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative px-2.5 py-1.5 text-[11px] font-medium transition-colors flex items-center gap-1 ${
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.badge != null && (
              <span className="text-[9px] font-data bg-primary/12 text-primary px-1 py-px rounded font-medium">
                {tab.badge}
              </span>
            )}
            {isActive && variant === 'underline' && (
              <motion.div
                layoutId={layoutId}
                className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-primary"
                style={{
                  boxShadow: '0 0 8px var(--glow), 0 0 16px var(--glow-subtle)',
                }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}
            {isActive && variant === 'pill' && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-primary/10 border border-primary/20 rounded"
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Two-tab toggle variant (Buy / Positions style) */
export function SlidingToggle({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  layoutId = 'toggle-indicator',
}: SlidingTabsProps) {
  return (
    <div className={`flex relative ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2 text-[12px] font-medium text-center transition-colors relative flex items-center justify-center gap-1 ${
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="relative z-10">{tab.label}</span>
            {tab.badge != null && (
              <span className="text-[9px] font-data bg-primary/12 text-primary px-1 py-px rounded ml-0.5 relative z-10">
                {tab.badge}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
                style={{
                  boxShadow: '0 0 8px var(--glow), 0 0 16px var(--glow-subtle)',
                }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
