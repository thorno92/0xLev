# 0xLeverage — Security Hardening Integration Guide

> How to apply the files in this package to the existing repo.
> Estimated integration time: 2–3 hours.

---

## What's In This Package

```
README.md                          → Drop in repo root (dev guide)
docs/SECURITY-AUDIT.md             → 15-finding security audit with severity ratings

server/security.ts                 → Replaces existing file
server/leverage-api.ts             → Replaces existing file
server/prices.ts                   → Replaces existing file
server/routers/leverage.ts         → Replaces existing file

server/middleware/csrf.ts          → NEW — add to Express setup
server/middleware/audit.ts         → NEW — structured logging
server/middleware/walletAuth.ts    → NEW — wallet JWT helpers + per-wallet rate limiting
```

---

## Step-by-Step Integration

### Step 1 — Drop README.md

```bash
cp README.md /path/to/0xLeverage/README.md
```

This file contains all architecture rules, security requirements, and dev workflow for the project.

---

### Step 2 — Add New Middleware Files

```bash
mkdir -p /path/to/0xLeverage/server/middleware

cp server/middleware/csrf.ts       /path/to/0xLeverage/server/middleware/csrf.ts
cp server/middleware/audit.ts      /path/to/0xLeverage/server/middleware/audit.ts
cp server/middleware/walletAuth.ts /path/to/0xLeverage/server/middleware/walletAuth.ts
```

---

### Step 3 — Replace Core Server Files

```bash
cp server/security.ts              /path/to/0xLeverage/server/security.ts
cp server/leverage-api.ts          /path/to/0xLeverage/server/leverage-api.ts
cp server/prices.ts                /path/to/0xLeverage/server/prices.ts
cp server/routers/leverage.ts      /path/to/0xLeverage/server/routers/leverage.ts
```

---

### Step 4 — Wire CSRF Middleware Into Express

Open `server/_core/index.ts` (or wherever `registerSecurityMiddleware` is called) and add:

```typescript
import { csrfMiddleware } from "../middleware/csrf";

// After registerSecurityMiddleware(app):
app.use("/api/trpc", csrfMiddleware);
```

The order matters — CSRF must run after security headers but before tRPC routes.

---

### Step 5 — Update tRPC Context to Include Request ID

The audit logger references `ctx.requestId`. Add it to the context:

Open `server/_core/context.ts` and add:

```typescript
export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  requestId: string;  // ← ADD THIS
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    requestId: (opts.req as any).requestId ?? "unknown",  // Set by attachRequestId middleware
  };
}
```

Then update the `"n/a"` requestId references in `server/routers/leverage.ts` to use `ctx.requestId`:

```typescript
// In each procedure, change:
auditLog({
  requestId: "n/a",
  ...
});

// To:
auditLog({
  requestId: ctx.requestId,
  ...
});
```

Note: The procedures currently don't destructure `ctx` — you'll need to add it:
```typescript
// procedures using auditLog:
.mutation(async ({ input, ctx }) => {   // ← add ctx
```

---

### Step 6 — Update Frontend for CSRF Tokens

The frontend needs to send the `X-CSRF-Token` header with all mutations.

Install `js-cookie` if not already present:
```bash
pnpm add js-cookie
pnpm add -D @types/js-cookie
```

Update `client/src/lib/trpc.ts`:
```typescript
import Cookies from 'js-cookie';

// In httpBatchLink headers config:
headers() {
  return {
    'X-CSRF-Token': Cookies.get('csrf_token') ?? '',
  };
},
```

---

### Step 7 — Verify Build

```bash
pnpm check      # TypeScript — should have zero errors
pnpm test       # All 69+ tests should pass
pnpm build      # Full production build
```

---

### Step 8 — Verify Security Headers in Production

After deploying, check headers with:
```bash
curl -I https://your-domain.com | grep -E "(Content-Security|X-Frame|Strict-Transport|X-Request-Id)"
```

Expected output in production:
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' blob: ...` (no unsafe-eval)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Request-Id: <12-char nanoid>`

---

## What's Still TODO (Not In This Package)

### Priority 1 — Wallet Signature Verification

The biggest remaining security gap. `connectWallet` currently accepts any Solana address without proof of ownership. 

Implementation path (see `docs/WALLET-ADAPTER-SPEC.md`):
1. Create `client/src/contexts/WalletContext.tsx` — wrap app with `@solana/wallet-adapter-react`
2. On connect: call `wallet.signMessage(encode("0xLeverage auth: " + timestamp))`
3. Pass `{ walletAddress, signature, timestamp }` to `connectWallet`
4. In the procedure: verify timestamp is < 5 min old, verify signature with nacl

### Priority 2 — Real Orderbook Data

Replace `client/src/lib/mockData.ts`. Options:
- Birdeye API (Solana-native, free tier available)
- Jupiter API (for Solana DEX liquidity)
- Helius websocket (for real-time orderbook updates)

### Priority 3 — Frontend Tests

No React Testing Library tests exist. Recommended additions:
- `TradingPanel.test.tsx` — form validation, leverage slider, submit behaviour
- `TokenSearchModal.test.tsx` — search filtering, keyboard navigation
- `Header.test.tsx` — theme switching, wallet button states

---

## Security Checklist for Go-Live

- [ ] Wallet signature verification implemented (Priority 1 above)
- [ ] `COINGECKO_API_KEY` set (avoids free tier rate limits under load)
- [ ] `OXL_API_KEY` stored securely (not in `.env` files committed to git)
- [ ] `JWT_SECRET` is at least 64 random chars
- [ ] Nginx configured to terminate TLS (don't expose Express directly)
- [ ] PM2 or systemd restart policy configured
- [ ] Log rotation configured for stdout/stderr
- [ ] `pnpm audit` run — no critical CVEs in dependencies
- [ ] CORS configured to allow only your production domain
- [ ] Security headers verified with `curl -I` in production environment
- [ ] TestingBuildBanner dismissed / removed for production launch
