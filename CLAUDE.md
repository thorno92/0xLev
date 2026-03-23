# 0xLeverage Terminal — Development Context

## Project Overview

Solana leveraged trading terminal. Users connect a Phantom wallet, deposit SOL to a trade wallet, and open/close leveraged positions on any SPL token via the 0xLeverage protocol API (built by Looper). The frontend is a Bloomberg-style terminal with real-time prices, TradingView charts, position tracking, and social analytics.

Live testing: https://www.0xl-testing.xyz/

## Architecture

```
client/                         React 19 + Vite + Tailwind v4
├── src/
│   ├── components/             UI components (Header, TradingPanel, BottomPanel, etc.)
│   ├── contexts/               WalletContext (Solana adapter), ThemeContext (10 themes)
│   ├── hooks/                  Business logic hooks (prices, positions, auth, balance)
│   ├── lib/                    Utilities (store, format, trpc client, mock data)
│   └── pages/                  Route pages (Terminal, Markets, Trending, Portfolio, etc.)
│
server/                         Express + tRPC + Drizzle (MySQL optional)
├── _core/                      Framework plumbing (cookies, env, oauth, trpc, vite)
├── middleware/                  Security (rate limiting, CSP, request IDs, wallet auth)
├── routers/                    tRPC routers (leverage.ts = all trading endpoints)
├── leverage-api.ts             0xLeverage upstream API proxy (JWT cache, Zod validation)
├── prices.ts                   CoinGecko price service (20s cache)
├── jupiter.ts                  Jupiter Price API proxy (v2 free / v3 with key)
├── birdeye.ts                  Birdeye trade/orderbook data
└── security.ts                 Express security middleware (3-tier rate limiting, CSP)
```

## Data Flow

```
User Wallet (Phantom) ──> WalletContext ──> useWalletAuth ──> server/leverage connectWallet
                                                                  │
                                                                  ▼
                                                          0xLeverage API (Looper's)
                                                                  │
Position Tracking:                                                │
  useTrackPositions ──> server/leverage trackTrade ────────────────┘
       │                                                          │
       ▼                                                          ▼
  Jupiter prices (for MARK/USD)                          liveProfit (in SOL)
       │                                                          │
       └──────── SOL/USD conversion ──────────────────────────────┘
                        │
                        ▼
                  Zustand store (openPositions with USD values)
                        │
                        ▼
            TradingPanel / BottomPanel (render positions)
```

## Key Conventions (MUST FOLLOW)

### Server-Side

* **Structured logging only.** Use `logger.info/warn/error({ event: "snake_case", ... })`. Never `console.log`. Never log full wallet addresses — use `maskWallet()`.
* **Zod everything.** Every API response is validated with a Zod schema before use. Use `.passthrough()` for forward compatibility with new upstream fields.
* **Section dividers.** Use the exact 68-char comment divider:
  ```
  /* ------------------------------------------------------------------ */
  /*  Section Name                                                       */
  /* ------------------------------------------------------------------ */
  ```
* **JSDoc on exports.** Every exported function gets a `/** ... */` JSDoc comment explaining what it does, what it's for, and any gotchas.
* **Fail fast on config.** Missing required env vars = throw at startup, not silent empty string. Use the `requireEnv()` pattern.
* **Cache with TTL.** In-memory caches always have explicit TTL, size caps, and periodic cleanup.
* **Audit logging on mutations.** Every state-changing trade operation (open/close/updateTpSl) gets an `auditLog()` call with requestId, masked wallet, procedure name, and duration.
* **Error handling.** Catch → log structured error → rethrow as TRPCError with user-safe message. Never expose stack traces or internal state to the client.

### Client-Side

* **Zustand for global state.** The store is at `lib/store.ts`. Positions, wallet, selected token.
* **tRPC for all server calls.** Never raw `fetch()` to our own server. Use `trpc.X.Y.useQuery/useMutation`.
* **Format utilities.** Use `formatPrice()`, `formatPriceSol()`, `formatPercent()`, `formatCompact()` from `lib/format.ts`. Never inline `toFixed()` or `toLocaleString()`.
* **Token logos.** Use `<TokenLogo symbol={...} size={...} />` component. Never inline `<img>` for tokens.
* **Tailwind classes.** Use the design system CSS variables (`text-foreground`, `bg-card`, `text-primary`, `text-success`, `text-destructive`, `text-warning`, `text-muted-foreground`). Never hardcode hex colors.
* **Font classes.** `font-data` for numbers/data. Default font for UI text. Never override fonts inline.
* **Interactive hover states.** Use the utility classes: `tab-hover`, `btn-hover`, `btn-ghost-hover`, `icon-btn-hover`, `badge-hover`, `ticker-item-hover`, `hover-lift`, `row-hover`, `input-hover`.
* **No `any`.** TypeScript strict mode. No `@ts-ignore`. No `as any`.

### Naming

* Files: camelCase for hooks (`useLivePrices.ts`), PascalCase for components (`TradingPanel.tsx`)
* Server events: snake_case (`jwt_cache_expired`, `fetch_live_prices_failed`)
* Constants: SCREAMING_CASE (`CACHE_TTL_MS`, `MAX_JWT_CACHE_SIZE`)
* Functions: camelCase (`fetchLivePrices`, `getCachedAuth`)
* Types/Interfaces: PascalCase (`LivePriceData`, `OpenPosition`)

## Environment Variables

```bash
# Required
OXL_API_BASE_URL=           # 0xLeverage API base URL
OXL_API_KEY=                # 0xLeverage API key
JWT_SECRET=                 # Session JWT signing secret (32+ random chars)

# Solana RPC — DOMAIN-LOCK THIS KEY IN HELIUS (exposed to browser via VITE_ prefix)
VITE_SOLANA_RPC_URL=        # Helius RPC endpoint

# Price APIs (optional — degrades gracefully to free tiers)
JUPITER_API_KEY=            # Jupiter v3 key
COINGECKO_API_KEY=          # CoinGecko Pro key
BIRDEYE_API_KEY=            # Birdeye API key
```

## Commands

```bash
pnpm dev          # Start dev server (Vite + Express)
pnpm build        # Production build (Vite + esbuild)
pnpm check        # TypeScript type-check (must pass before commit)
pnpm test         # Run vitest
pnpm format       # Prettier
pnpm db:push      # Drizzle migrations
```

## Branch Convention

* `main` — production
* `fix/description` — bug fixes
* `feat/description` — new features

## DO NOT TOUCH

* `server/security.ts` — security middleware is locked
* `server/middleware/` — rate limiting, audit, wallet auth are stable
* `server/leverage-api.ts` — upstream API proxy works correctly
* Any tRPC procedure input/output shapes — API contract is stable
* The theme system in `contexts/ThemeContext.tsx` — 10 themes, all tested
