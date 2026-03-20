# Mobile Audit Findings

## Terminal Page
1. Mobile sticky execute button: `bottom-[56px]` -- this is correct for the 56px bottom nav
2. Mobile scrollable area: `pb-[120px]` -- this accounts for sticky button + bottom nav
3. Chart height: `h-[45vh] min-h-[280px]` -- good
4. Mobile token bar: compact, looks fine
5. No issues found with Terminal mobile layout structure

## Markets Page
1. Stats bar: `gap-8` with `overflow-x-auto` -- on mobile the gap is too large, items may not be visible
2. Controls section: chain filter pills + search are `flex-wrap` -- good
3. Column cards: `grid-cols-1 md:grid-cols-3` -- stacks on mobile, good
4. Mobile cards section: has MobileRow component -- looks clean
5. Filter dialog: `max-h-[85vh]` -- good for mobile
6. Controls area: chain pills may overflow on small screens -- the container has `overflow-x-auto` but no scrollbar-none
7. Search input: `w-full sm:w-56` -- responsive, good
8. Stats bar gap-8 is too wide for mobile -- should be smaller on mobile
9. pb-24 md:pb-6 -- accounts for bottom nav on mobile

## Trending Page
1. pb-24 md:pb-6 -- correct bottom padding
2. Mobile cards section: `md:hidden space-y-1` -- good
3. Filter buttons: `overflow-x-auto scrollbar-none` -- good for horizontal scroll
4. Stats grid: `grid-cols-2 sm:grid-cols-4` -- responsive
5. Looks generally good on mobile

## Portfolio Page
1. pb-24 md:pb-6 -- correct
2. Balance text: `text-[42px] sm:text-[52px]` -- responsive
3. Balance + currency badge: on very small screens the badge may wrap awkwardly
4. Stats row: `flex flex-wrap` -- good
5. Action buttons: `flex-wrap` -- good
6. Mobile card for assets: `sm:hidden` -- has dedicated mobile layout
7. Chart: `hidden sm:block` -- hidden on mobile, good
8. Open Orders mobile card: `sm:hidden` -- has dedicated mobile layout

## Positions Page
1. pb-24 md:pb-6 -- correct
2. Risk metrics: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` -- responsive
3. Mobile cards: `md:hidden space-y-3` -- good
4. Expandable cards with tap interaction -- good for mobile
5. Risk Analysis + Allocation: `grid-cols-1 lg:grid-cols-2` -- stacks on mobile

## Header
1. Logo: responsive text size
2. Nav: `hidden md:flex` -- hidden on mobile (uses bottom nav instead)
3. Search: mobile icon only, desktop full bar
4. Social links: `hidden sm:flex` -- hidden on smallest screens
5. Wallet button: responsive sizing
6. No hamburger menu needed since bottom nav handles navigation

## MobileBottomNav
1. Fixed bottom, z-50
2. Safe area aware with `env(safe-area-inset-bottom)`
3. 4 tabs: Markets, Terminal, Portfolio, Positions
4. Missing Trending tab -- should be added or accessible

## Key Issues to Fix:
1. Markets stats bar: gap-8 too wide on mobile, reduce to gap-4 on mobile
2. Markets controls: chain filter pills container needs scrollbar-none on mobile
3. Trending page: missing from bottom nav (only 4 tabs)
4. Portfolio balance: currency badge may overflow on very small screens
5. General: ensure all touch targets are at least 44px
