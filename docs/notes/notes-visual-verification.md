# Visual Verification Notes

## Terminal Page
- Desktop layout looks correct with order book, chart, trading panel
- Mobile layout has pb-[120px] for sticky button + bottom nav clearance
- Sticky execute button positioned at bottom-[56px] to clear bottom nav
- Order book gap fix verified - uses flex-col justify-end for asks

## Markets Page
- Stats bar has flex-wrap for mobile
- Column cards have max-h-[400px] sm:max-h-[720px]
- Chain filters have overflow-x-auto scrollbar-none
- Search input stacks below filters on mobile
- MobileRow has active:bg-secondary/15 for touch feedback

## Trending Page
- Mobile cards have active:bg-secondary/20 for touch feedback
- Stats grid uses grid-cols-2 sm:grid-cols-4
- Filter dialog has mobile-friendly padding and scrolling
- Profile toggles wrap on mobile

## Portfolio Page
- Balance text scales down to text-[36px] on mobile
- Summary section wraps with flex-wrap
- Mobile holdings cards have proper touch targets
- Orders section has 2-col grid on mobile

## Positions Page
- Expanded details use grid-cols-2 sm:grid-cols-4
- Close position button has min-h-[40px] for touch
- Active state on cards for touch feedback

## Header
- Mobile search icon visible on small screens
- Desktop nav hidden on mobile (md:hidden)
- Wallet button shows "Connect" on mobile, "Connect Wallet" on desktop
- Social links hidden on mobile (hidden sm:flex)

## Bottom Nav
- Larger touch targets with min-w-[56px] w-full
- Better safe area padding
- Glass backdrop effect

## TokenSearchModal
- Mobile margins (mx-3 sm:mx-auto)
- Larger touch targets on results (py-3 sm:py-2.5)
- Keyboard shortcuts footer hidden on mobile

## Dialogs
- RakeBack dialog has mx-3 sm:mx-auto
- Markets screener dialog has mobile-friendly padding
- Trending filter dialog has mobile-friendly padding and wrapping
