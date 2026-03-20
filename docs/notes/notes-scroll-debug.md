# Markets Mobile Scroll Debug

## DOM Hierarchy at desktop (1280px):
- h-screen w-full flex flex-col overflow-hidden bg-background
  - HEADER: h-11, 44px, flex
  - DIV: hidden md:block flex-1 overflow-auto -> display:block, h:1056px (desktop view, visible)
  - DIV: relative overflow-hidden md:hidden flex-1 min-h-0 -> display:none (mobile PullToRefresh, hidden at desktop)

## At mobile viewport (375px), the PullToRefresh div should become visible.
- The structure: outer div (relative overflow-hidden flex-1 min-h-0) -> inner div (h-full overflow-y-auto)
- This should work because: parent is flex-col with h-screen, flex-1 gives remaining space, min-h-0 allows shrinking, inner h-full takes that height, overflow-y-auto enables scrolling.

## Possible issue:
- The `overflow-hidden` on the outer PullToRefresh div might be preventing scroll propagation
- But the inner div has its own overflow-y-auto, so it should scroll independently
- The real issue might be that on actual mobile Safari/Chrome, touch events on the inner div are being captured by the PullToRefresh touch handlers (onTouchStart/onTouchMove/onTouchEnd), preventing normal scroll behavior.

## Root cause analysis:
The PullToRefresh component attaches onTouchStart, onTouchMove, onTouchEnd to the scrollable div. When scrollTop > 0, it correctly bails out. BUT the issue is that the touch handlers are on the SAME element that needs to scroll. The `handleTouchStart` only sets `pullingRef.current = true` when `scrollTop === 0`, and `handleTouchMove` resets when `scrollTop > 0`. However, the problem is that the touch events might be interfering with the browser's native scroll behavior, especially on iOS where touch-action CSS is important.

## Fix: Add `touch-action: pan-y` to the scrollable container so the browser knows vertical scrolling is allowed.
Also, consider using `-webkit-overflow-scrolling: touch` for iOS momentum scrolling.
