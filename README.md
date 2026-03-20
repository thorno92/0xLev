# 0xLeverage — Developer Guide

> Single source of truth for architecture, security rules, and dev workflow.

---

## What This Is

A leveraged trading terminal for Solana memecoins. React 19 SPA + Express 4 backend.
The backend proxies all trading to the 0xLeverage protocol API — secrets never touch the client.

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TailwindCSS 4, Wouter (routing), Framer Motion |
| State | Zustand (client state), tRPC 11 + React Query (server state) |
| Backend | Express 4, tRPC 11, Superjson |
| Database | MySQL/TiDB via Drizzle ORM |
| Auth | OAuth (session cookies) + Solana wallet signature verification |
| Testing | Vitest (86+ server tests) |
| Charts | TradingView Advanced Chart widget |
| Prices | Jupiter (token prices), CoinGecko (market prices), Birdeye (orderbook/trades) |

---

## Quick Start

```bash
pnpm install
cp .env.example .env          # fill in required vars (see Environment Variables below)
pnpm db:push                   # push database schema (first time or after schema changes)
pnpm dev                       # Express + Vite with HMR on http://localhost:3000
pnpm test                      # 86+ tests — run before every commit
pnpm build && pnpm start       # production build
```

---

## Directory Map

```
client/src/
  pages/            7 page components (Terminal, Markets, Trending, Portfolio, Positions, Assistant)
  components/       25+ reusable components
    ui/             Base UI primitives (button, dialog, dropdown, etc.)
    Header.tsx      Main header — nav, search (Cmd+K), wallet connect, theme picker
    TradingPanel.tsx  Trade execution form (long/short, leverage, TP/SL)
    ChartPanel.tsx    TradingView chart wrapper
    BottomPanel.tsx   Data tables (transactions, positions, holders, social)
    TrendingBar.tsx   Auto-scrolling trending token ticker
    FloatingChatOrb.tsx  Floating assistant chat
    MobileBottomNav.tsx  Mobile tab bar navigation
  contexts/
    ThemeContext.tsx  10 themes (0x, cyberpunk, midnight, obsidian, ember, matrix, arctic, phantom, lavender, aurora)
  hooks/
    useWalletAuth.ts   Wallet connection + session resume (signature → JWT)
    useTrackPositions.ts  Live P&L + MARK price polling (Jupiter + trackTrade)
    useTradeWalletBalance.ts  Trade wallet SOL balance polling
    useWalletHoldings.ts  On-chain token holdings via Helius DAS API
    useLivePrices.ts   Price polling with 30s cache
    useFavorites.ts    Star/favorite tokens (localStorage)
    useComposition.ts  Composition event handling for inputs
    useMobile.tsx      Mobile breakpoint detection
    usePersistFn.ts    Stable function reference hook
  lib/
    store.ts         Zustand global state (wallet, token, positions)
    format.ts        ALL number/currency formatting — always import from here
    trpc.ts          tRPC client binding (httpBatchLink + CSRF headers)
    mockData.ts      Static mock orderbook — fallback when Birdeye key is missing
    tokenLogos.ts    Token logo URL resolver
    api.ts           CoinGecko API client (frontend)
    utils.ts         Tailwind cn() helper

server/
  routers/
    leverage.ts      All 12 tRPC procedures + Zod validation schemas
  middleware/
    csrf.ts          CSRF double-submit cookie protection
    audit.ts         Structured trade audit logging + request timer
    walletAuth.ts    Wallet JWT verification + per-wallet rate limiting
  leverage-api.ts    Axios client for 0xLeverage protocol, JWT cache (TTL-enforced)
  jupiter.ts         Jupiter Price API proxy (v2 free / v3 with key)
  security.ts        CSP · rate limiting · HSTS · request guards
  prices.ts          CoinGecko price service (Zod-validated, 30s cache) + SOL/USD helper
  birdeye.ts         Birdeye API for real-time trades/orderbook (Zod-validated, 15s cache)
  routers.ts         tRPC root router (merges all sub-routers)
  db.ts              Database helpers
  _core/             Framework plumbing — DO NOT EDIT

drizzle/
  schema.ts          DB schema (users table with OAuth fields + role-based access)

shared/
  const.ts           Shared constants — add new ones here
  types.ts           Shared TS types
```

---

## Architecture

### Request Flow

```
React Component
  → trpc.leverage.openPosition.useMutation()
  → HTTP POST /api/trpc/leverage.openPosition
  → Express middleware (CORS → security headers → rate limiting → CSRF)
  → tRPC router (Zod input validation)
  → leverage-api.ts (server-side proxy, attaches JWT + API key)
  → 0xLeverage external API
```

### Architecture Rules

**1. tRPC is the only API layer.**
No raw fetch/axios calls from the frontend. Every API call is `trpc.something.useQuery()` or `.useMutation()`. If you need a new endpoint, add a tRPC procedure.

**2. Secrets never leave the server.**
`OXL_API_KEY` and the 0xL JWT are only ever in `server/`. The frontend passes the wallet address; the server looks up the cached JWT and attaches it to upstream calls. Never pass JWTs or API keys in tRPC responses.

**3. Every tRPC input is Zod-validated.**
No exceptions. Wallet addresses must pass `walletAddressSchema`. Contract addresses must pass `contractAddressSchema`. Trade IDs must pass `tradeIdSchema`. All numeric inputs are bounded. See the shared schemas at the top of `server/routers/leverage.ts`.

**4. Trade execution requires authenticated wallets.**
`openPosition` and `closePosition` must use `walletProtectedProcedure` (defined in `server/middleware/walletAuth.ts`). Do not use `publicProcedure` for any mutation that moves money.

**5. All format utilities live in `client/src/lib/format.ts`.**
Never format prices, percents, or SOL amounts inline. Use `formatPrice()`, `formatPercent()`, `formatSol()`, `formatCompact()`.

**6. Theme changes go in `client/src/index.css`.**
All 10 themes are CSS variable blocks. Adding a theme = adding a `[data-theme="name"]` block. Never hardcode colors in components.

---

## Security Rules — Non-Negotiable

### Do not weaken these
- **CSP:** `unsafe-eval` must stay OUT of `script-src` in production. The nonce-based inline script policy is intentional.
- **Rate limits:** 200 req/min (API) → 30 req/min (leverage) → 5 req/min (trade execution) → 10 req/15min (wallet connect). Do not raise these without a logged justification.
- **CSRF:** Every tRPC mutation must include the `X-CSRF-Token` header. The double-submit cookie pattern is implemented in `server/middleware/csrf.ts`. Do not bypass it.
- **Request size:** 1 MB hard cap (enforced in both `express.json()` and `requestSizeGuard`). Never raise this.
- **JWT TTL:** The in-memory JWT cache evicts entries after 11.5 hours (before the 12-hour 0xL expiry). Do not remove the eviction logic.
- **Input bounds:** `leverage` max 100x, `amount` max 10,000 SOL, `solTip` max 1 SOL. These match protocol limits.
- **Account lockout:** 10 failed wallet auth attempts → 15-minute lockout per wallet address.
- **Cookies:** `sameSite: "strict"`, `HttpOnly`, `Secure` in production, 24-hour max-age.

---

## Auth Flow

```
1. User clicks "Connect Wallet" in the UI
2. Solana wallet adapter (Phantom/Solflare) opens wallet picker modal
3. Frontend signs a known message: "0xLeverage auth: <timestamp>"
4. Frontend calls trpc.leverage.connectWallet({ walletAddress, signature, timestamp })
5. Server verifies ed25519 signature using nacl (proves wallet ownership)
6. Server calls POST /check_wallet → gets JWT + tradeWallet from 0xL API
7. JWT cached in-memory server-side with 11.5h TTL (keyed by wallet.toLowerCase())
8. All subsequent calls: frontend sends walletAddress, server looks up cached JWT
9. CSRF token issued on connect, required on all mutations
```

**Session binding:** After initial signature verification, the server mints an `HttpOnly` session cookie (3-day TTL). On subsequent page loads, `resumeSession` restores the wallet without re-signing. The upstream 0xLeverage JWT is transparently refreshed via `checkWallet` when it expires.

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | YES | MySQL/TiDB connection string |
| `OXL_API_BASE_URL` | YES | 0xLeverage protocol API base URL |
| `OXL_API_KEY` | YES | Shared dapp API key (never expose to client) |
| `JWT_SECRET` | YES | Session JWT signing secret (min 64 random chars for production) |
| `NODE_ENV` | YES | `development` or `production` |
| `VITE_APP_ID` | YES | OAuth application ID |
| `OAUTH_SERVER_URL` | YES | OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | YES | Login portal URL (frontend) |
| `PORT` | NO | Server port (default: 3000) |
| `COINGECKO_API_KEY` | NO | Pro key to avoid free tier rate limits (warned at startup if missing) |
| `JUPITER_API_KEY` | NO | Jupiter Price API v3 key — uses free v2 endpoint if not set |
| `BIRDEYE_API_KEY` | NO | Birdeye API for real orderbook/trade data (warned at startup if missing) |
| `VITE_SOLANA_RPC_URL` | NO | Solana RPC endpoint — use Helius/QuickNode; defaults to public mainnet-beta |

Copy `.env.example` → `.env`. Never commit `.env`.

---

## Testing

```bash
pnpm test              # run all tests
pnpm test -- --watch   # watch mode
```

Test files live alongside the code they test:

| File | Coverage |
|------|----------|
| `server/pages.test.ts` | tRPC procedures — auth, input validation, error handling |
| `server/security.test.ts` | Security headers, rate limiting, CSRF, Zod schemas |
| `server/leverage-api.test.ts` | API proxy, JWT caching, session management, wallet disconnect |
| `server/jupiter.test.ts` | Jupiter price service — v2/v3 parsing, chunking, error handling |
| `server/prices.test.ts` | CoinGecko price fetcher, cache behaviour, SOL/USD fallback |
| `server/auth.logout.test.ts` | OAuth logout flow, cookie cleanup |

```typescript
// Pattern for testing a tRPC procedure:
const caller = appRouter.createCaller(createPublicContext());
await expect(caller.leverage.openPosition({ ... })).rejects.toThrow("Wallet not connected");

// Always test: valid input, invalid input (each field), missing JWT, upstream error
```

---

## Key Patterns

### Adding a New tRPC Endpoint

1. Add Zod schema at the top of `server/routers/leverage.ts` (reuse existing schemas)
2. Add the API function in `server/leverage-api.ts` with a typed response interface
3. Add the tRPC procedure — use `walletProtectedProcedure` if it modifies state or moves funds
4. Write tests in `server/pages.test.ts` covering: valid input, invalid input, missing JWT
5. Call it from the frontend: `trpc.leverage.newEndpoint.useQuery()` or `.useMutation()`
6. Update this file's Directory Map if you add a new file

### Adding a New Page

1. Create `client/src/pages/NewPage.tsx`
2. Add the route in `client/src/App.tsx`
3. Add nav link in `client/src/components/Header.tsx` (`navLinks` array)
4. Add mobile nav entry in `client/src/components/MobileBottomNav.tsx`

### Adding a Theme

1. Add `[data-theme="yourtheme"]` CSS variable block in `client/src/index.css`
2. Add the theme name to the array in `client/src/contexts/ThemeContext.tsx`

---

## Theming

10 built-in themes defined via CSS variables:

| Theme | Style |
|-------|-------|
| 0x (default) | Purple neon terminal |
| Cyberpunk | Cyan neon edge |
| Midnight City | Deep indigo night |
| Obsidian | Ice-blue Bloomberg |
| Ember | Warm amber glow |
| Matrix | Green phosphor |
| Arctic | Frost steel-blue |
| Phantom | Soft purple-pink |
| Lavender Haze | Light mode |
| Aurora (experimental) | Animated shifting gradients |

---

## Known TODOs (ordered by priority)

| # | Task | Spec / File |
|---|------|-------------|
| ~~1~~ | ~~Implement Solana wallet adapter + signature verification~~ | Done ✓ |
| 2 | Replace mock orderbook with real market depth | `client/src/lib/mockData.ts` → Birdeye API (backend ready) |
| 3 | Frontend test coverage (React Testing Library) | `client/src/__tests__/` (create) |
| ~~4~~ | ~~CI/CD pipeline (GitHub Actions)~~ | Done ✓ — `.github/workflows/ci.yml` |
| 5 | Structured logging → external sink (Axiom/Datadog) | `server/middleware/audit.ts` |
| 6 | Redis-backed rate limiting for multi-instance deployment | `server/middleware/walletAuth.ts`, `server/security.ts` |

---

## Do Not Touch

- `server/_core/` — framework plumbing. If you need to extend auth or context, ask first.
- `patches/wouter@3.7.1.patch` — fixes a wouter router bug. Do not remove.
- `drizzle/0000_freezing_garia.sql` — initial migration. Never edit migrations after they're applied.

---

## Git Hygiene

- Branch naming: `feat/wallet-adapter`, `fix/csrf-token`, `chore/add-ci`
- Commit style: `feat: implement wallet signature verification`
- Never commit: `.env`, `node_modules/`, `dist/`, `.DS_Store`
- Pre-commit hook: Gitleaks secret scanning (configured in `.pre-commit-config.yaml`)
- Run `pnpm check` (TypeScript) and `pnpm test` before pushing

---

## Deployment (Production)

```bash
pnpm build
NODE_ENV=production pnpm start
```

### PM2 (recommended)

An `ecosystem.config.cjs` is included in the repo root:
```js
module.exports = {
  apps: [{
    name: '0xl-terminal',
    script: 'dist/index.js',
    env: { NODE_ENV: 'production' },
    instances: 1,
    autorestart: true,
    max_memory_restart: '512M',
  }]
};
```

### Nginx

Nginx should terminate TLS and proxy to the Express port. An `nginx.conf.example` is included in the repo root. Key points:
- Proxy `localhost:3000` (or whatever `PORT` is set to)
- HSTS is set by the app layer (1 year + preload) — do not duplicate in Nginx
- WebSocket upgrade headers if using live price WebSockets in future

### Operational Commands

```bash
# Deploy update (zero-downtime)
git pull && pnpm install && pnpm build && pm2 reload ecosystem.config.cjs

# View logs
pm2 logs 0xl-terminal --lines 100

# Monitor memory/CPU
pm2 monit

# Verify security headers after deploy
curl -I https://your-domain.com | grep -E "(Content-Security|X-Frame|Strict-Transport|X-Request-Id)"

# Check for dependency vulnerabilities
pnpm audit

# Generate a secure JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Pre-deployment Checklist

- [ ] All env vars set (see Environment Variables above)
- [ ] `JWT_SECRET` is at least 64 random characters
- [ ] `OXL_API_KEY` stored securely (not in `.env` files committed to git)
- [ ] CORS origin updated in `server/_core/index.ts` to your production domain
- [ ] `pnpm check` passes with zero TypeScript errors
- [ ] `pnpm test` passes (86+ tests)
- [ ] `pnpm audit` run — no critical CVEs
- [ ] Security headers verified with `curl -I https://your-domain.com`
- [ ] Log rotation configured for stdout/stderr
- [ ] TestingBuildBanner dismissed / removed for production launch

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| `README.md` (this file) | Architecture, security rules, dev workflow |
| `docs/SECURITY-AUDIT.md` | 15-finding security audit with severity ratings (all fixed) |
| `docs/WALLET-ADAPTER-SPEC.md` | Complete wallet adapter implementation spec (Priority 1) |
| `docs/INTEGRATION-GUIDE.md` | Step-by-step integration guide for security hardening files |
| `docs/vibe-coder-security-bible.md` | General security best practices reference |
| `docs/dev-team-auth-conversation.md` | Context from 0xL API team on auth flow design |
| `docs/notes/` | Development notes (mobile audit, orderbook gaps, theme design, etc.) |
