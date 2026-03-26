/**
 * MOBILE BOTTOM NAV -- Premium bottom navigation
 * 5 tabs: Markets (home), Terminal, Trending, Portfolio, Positions
 * Glass backdrop, active indicator, safe-area aware.
 * Only visible on mobile (md:hidden).
 */

import { useLocation, Link } from 'wouter';

const tabs = [
  {
    name: 'Markets',
    path: '/',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    name: 'Terminal',
    path: '/terminal',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    name: 'Portfolio',
    path: '/portfolio',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
      </svg>
    ),
  },
  {
    name: 'Positions',
    path: '/positions',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    ),
  },
];

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      {/* Top edge */}
      <div className="h-px bg-border/50" />

      {/* Glass backdrop */}
      <div className="bg-card/90 backdrop-blur-xl">
        <div className="flex items-center justify-around px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tabs.map((tab) => {
            const isActive = tab.path === '/'
              ? location === '/' || location === '/markets'
              : location === tab.path || (tab.path === '/terminal' && location.startsWith('/terminal'));

            return (
              <Link key={tab.path} href={tab.path}>
                <button
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors duration-150 ${
                    isActive ? 'text-primary' : 'text-muted-foreground/60 active:text-foreground'
                  }`}
                >
                  {tab.icon(isActive)}
                  <span className={`text-[10px] mt-0.5 font-medium transition-colors duration-150 ${
                    isActive ? 'text-primary' : 'text-muted-foreground/50'
                  }`}>
                    {tab.name}
                  </span>
                  {/* Active dot */}
                  <div className={`w-1 h-1 rounded-full mt-0.5 transition-all duration-200 ${
                    isActive ? 'bg-primary' : 'bg-transparent'
                  }`} />
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
