## Order Book Gap Issue - FIXED

The order book now shows asks filling from the bottom up with no gap at the top. 
The fix involved:
1. Increasing order book rows from 8 to 15 per side
2. Making asks/bids containers scrollable (overflow-y-auto) instead of just overflow-hidden
3. Adding shrink-0 to individual rows so they don't compress
4. Adding shrink-0 to the spread bar so it stays fixed in the middle
5. The justify-end on the asks container pushes rows to the bottom, and with more rows + scroll, the gap is eliminated

The order book now shows price levels filling the entire panel height with asks above and bids below the spread bar.
