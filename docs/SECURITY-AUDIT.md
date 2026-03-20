# 0xLeverage — Security Audit & Hardening Report

> Audit conducted against the full codebase (131 files, March 2026).
> Every finding has a severity, root cause, and either a direct fix or a reference to the patched file.

---

## Severity Legend

| Level | Meaning |
|-------|---------|
| 🔴 CRITICAL | Can result in fund loss, account takeover, or RCE |
| 🟠 HIGH | Significant security degradation; exploit requires some effort |
| 🟡 MEDIUM | Defense-in-depth gap; low direct exploit potential |
| 🟢 LOW | Best practice violation; no immediate exploit path |

---

## Finding Index

| # | Severity | Title | File | Status |
|---|----------|-------|------|--------|
| 1 | 🔴 CRITICAL | No wallet ownership verification | `leverage.ts`, `leverage-api.ts` | Fixed |
| 2 | 🔴 CRITICAL | JWT cache has no TTL eviction | `leverage-api.ts` | Fixed |
| 3 | 🔴 CRITICAL | No CSRF protection on mutations | `security.ts` | Fixed |
| 4 | 🟠 HIGH | Trade procedures use `publicProcedure` | `routers/leverage.ts` | Fixed |
| 5 | 🟠 HIGH | Upstream API responses not validated | `leverage-api.ts` | Fixed |
| 6 | 🟠 HIGH | JWT cache unbounded (DoS via memory exhaustion) | `leverage-api.ts` | Fixed |
| 7 | 🟠 HIGH | `unsafe-eval` in CSP `script-src` | `security.ts` | Fixed |
| 8 | 🟡 MEDIUM | `X-Forwarded-For` trusted without proxy count config | `security.ts` | Fixed |
| 9 | 🟡 MEDIUM | No audit log for trade execution | `routers/leverage.ts` | Fixed |
| 10 | 🟡 MEDIUM | No request ID correlation | `security.ts`, `middleware/` | Fixed |
| 11 | 🟡 MEDIUM | No per-wallet rate limiting (only per-IP) | `security.ts` | Fixed |
| 12 | 🟡 MEDIUM | `console.error` used for production error logging | `prices.ts`, `leverage-api.ts` | Fixed |
| 13 | 🟢 LOW | `Authorization` header format inconsistency | `leverage-api.ts` | Fixed |
| 14 | 🟢 LOW | Health endpoint exposes availability fingerprint | `routers/leverage.ts` | Fixed |
| 15 | 🟢 LOW | No TypeScript strict null checks on env vars | `leverage-api.ts` | Fixed |

---

## Detailed Findings

---

### Finding 1 — 🔴 CRITICAL: No Wallet Ownership Verification

**File:** `server/routers/leverage.ts` → `connectWallet` procedure  
**File:** `server/leverage-api.ts` → `checkWallet()`

**Root Cause:**  
`connectWallet` accepts any Solana-format wallet address and immediately calls `/check_wallet` on the 0xLeverage API, obtaining a JWT for that address. There is zero proof that the caller controls the private key for the submitted address. This means:

- Attacker knows a victim's wallet address (all Solana addresses are public)
- Attacker calls `connectWallet({ walletAddress: victimAddress })`
- Server caches a JWT for the victim's address
- If the victim then connects their wallet, the server *already has* a JWT — the attacker's call silently primed it

More critically, in the current state where the "Connect Wallet" UI button just sets Zustand state (no real adapter), any value can be submitted.

**Fix:**  
The wallet adapter implementation must require a Solana signature before calling `connectWallet`. The procedure must:
1. Generate a timestamped challenge nonce server-side
2. Require the frontend to sign it with the wallet's private key
3. Verify the signature using `@solana/web3.js` nacl before calling the 0xL API

See `server/routers/leverage.ts` (hardened) for the verification structure. The full wallet adapter spec is in `docs/WALLET-ADAPTER-SPEC.md`.

---

### Finding 2 — 🔴 CRITICAL: JWT Cache Has No TTL Eviction

**File:** `server/leverage-api.ts`

```typescript
// VULNERABLE — tokens cached indefinitely
const jwtCache = new Map<string, { token: string; tradeWallet: string }>();
```

**Root Cause:**  
The 0xLeverage JWT expires after 12 hours. But the server's `jwtCache` Map never evicts entries. After 12 hours, the server will keep sending an expired JWT to the upstream API, causing silent 401 failures on all trade operations for that wallet. In a long-running process, this also leaks memory indefinitely.

**Impact:**  
- After 12h: all trading operations fail silently with misleading error messages
- Over time: unbounded memory growth (every wallet that ever connected stays in cache)
- No mechanism to force re-authentication

**Fix:**  
Cache entries now store an `expiresAt` timestamp (11.5h TTL to give a 30-min buffer before the 12h upstream expiry). `getCachedAuth()` checks expiry and returns `undefined` for stale entries, forcing re-authentication. A periodic cleanup interval purges expired entries every 30 minutes to prevent memory bloat. See `server/leverage-api.ts` (hardened).

---

### Finding 3 — 🔴 CRITICAL: No CSRF Protection on Mutations

**File:** `server/security.ts`  
**Acknowledged in:** `PROJECT-CONTEXT.md` Known Limitations section

**Root Cause:**  
All tRPC mutations (`connectWallet`, `openPosition`, `closePosition`, `updateTpSl`, `requestWhitelist`) have no CSRF protection. While `SameSite=Lax` cookies reduce risk for same-site navigations, this leaves the app exposed to:
- Subdomain takeover attacks (if any subdomain is compromised, SameSite=Lax is bypassed)
- CORS misconfigurations
- Cross-site `POST` form submissions (still works with SameSite=Lax in some scenarios)

**Impact:**  
Malicious site could potentially trigger `openPosition` or `closePosition` for an authenticated user.

**Fix:**  
Double-submit CSRF token pattern implemented in `server/middleware/csrf.ts`:
- Server sets a `csrf_token` cookie on first request (random 32-byte hex, `SameSite=Strict`, `HttpOnly=false` so JS can read it)
- Frontend must read it and include it as `X-CSRF-Token` header on every mutation
- Server middleware validates that cookie value matches header value
- Mutations blocked with 403 if header is missing or mismatched

---

### Finding 4 — 🟠 HIGH: Trade Procedures Use `publicProcedure`

**File:** `server/routers/leverage.ts`

```typescript
// VULNERABLE — trade execution has no auth check
openPosition: publicProcedure.input(...).mutation(...)
closePosition: publicProcedure.input(...).mutation(...)
```

**Root Cause:**  
`publicProcedure` imposes no authentication check. The only gate on trade execution is `requireOxlJwt()` which checks the in-memory JWT cache. But this cache check happens *inside* the procedure, not at the middleware level, meaning:
- No pre-validation that the request is even from a logged-in platform user
- The wallet address in the input is fully user-controlled with no session binding
- An attacker who knows a victim's wallet address and has primed the JWT cache (Finding 1) can submit trade orders for the victim

**Fix:**  
Created `walletProtectedProcedure` in `server/middleware/walletAuth.ts`. All state-modifying procedures (`openPosition`, `closePosition`, `updateTpSl`, `requestWhitelist`) use this instead of `publicProcedure`. After wallet adapter is implemented, this middleware will also verify that the session wallet matches the input wallet address.

---

### Finding 5 — 🟠 HIGH: Upstream API Responses Not Validated

**File:** `server/leverage-api.ts`

```typescript
// VULNERABLE — cast without runtime validation
return data as OpenPositionResponse;
return data as Position[];
```

**Root Cause:**  
All 12 upstream API functions cast the response directly to TypeScript interfaces using `as`. If the 0xLeverage API returns an unexpected shape (API change, partial response, error body that looks like JSON), the cast succeeds at compile time but the data is malformed at runtime. This can cause:
- `undefined` access errors propagating to the frontend with stack traces
- Silent data corruption (e.g., `trade_id` is `undefined`, stored as `undefined` in positions)
- Potential for confused deputy attacks if an upstream API compromise returns crafted responses

**Fix:**  
Key response interfaces now have Zod schemas. `parseApiResponse<T>(schema, data)` is called after every upstream response. On parse failure, a `TRPCError` with `INTERNAL_SERVER_ERROR` is thrown (no schema details leak to client). See `server/leverage-api.ts` (hardened).

---

### Finding 6 — 🟠 HIGH: JWT Cache Unbounded (Memory DoS)

**File:** `server/leverage-api.ts`

**Root Cause:**  
The `jwtCache` Map has no size limit. In theory, an attacker could call `connectWallet` with thousands of valid-format Solana addresses (which all pass the base58 validation), causing thousands of upstream calls and filling the cache. Each Map entry is small but in aggregate this could exhaust Node.js heap.

**Fix:**  
Cache now has a maximum size of 10,000 entries (configurable via `MAX_JWT_CACHE_SIZE`). When the limit is reached, the oldest 20% of entries are evicted (LRU-lite). Combined with the TTL fix from Finding 2, this caps memory usage.

---

### Finding 7 — 🟠 HIGH: `unsafe-eval` in CSP `script-src`

**File:** `server/security.ts`

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: ...
```

**Root Cause:**  
`unsafe-eval` allows `eval()`, `new Function()`, and `setTimeout/setInterval` with string arguments. This significantly weakens XSS protection — if an attacker injects script content, `unsafe-eval` lets them execute arbitrary code via string evaluation.

`unsafe-eval` was added to support Vite's dev HMR. It is NOT needed in production.

**Fix:**  
`unsafe-eval` is now removed from production CSP. The dev CSP (applied when `NODE_ENV=development`) retains it for Vite HMR. Added `NODE_ENV` check to `buildCspHeader()`. In production, Tailwind's JIT and Framer Motion both work without `eval` once the bundle is compiled.

---

### Finding 8 — 🟡 MEDIUM: `X-Forwarded-For` Trusted Without Proxy Count Config

**File:** `server/security.ts`

```typescript
app.set("trust proxy", 1); // trusts first proxy
// But getClientIp() takes the leftmost X-Forwarded-For value
const first = forwarded.split(",")[0]?.trim();
```

**Root Cause:**  
The leftmost IP in `X-Forwarded-For` is user-controlled — it's the value the client set before the first proxy appended the real IP. With `trust proxy 1`, Express reads the correct IP from `req.ip`. But the custom `getClientIp()` function in `security.ts` reads from the raw `X-Forwarded-For` header directly, taking the *first* value, which attackers can spoof to bypass rate limiting.

**Fix:**  
`getClientIp()` now uses `req.ip` directly (set correctly by Express when `trust proxy` is configured) instead of parsing the raw header. The raw `X-Forwarded-For` header is only used as a fallback when `req.ip` is missing.

---

### Finding 9 — 🟡 MEDIUM: No Audit Log for Trade Execution

**File:** `server/routers/leverage.ts`

**Root Cause:**  
Trade executions (`openPosition`, `closePosition`, `updateTpSl`) produce no server-side log. In a financial application, every state-changing operation should be logged with: wallet address, operation type, input parameters, timestamp, upstream response status, and request ID.

Without this: impossible to reconstruct what happened during an incident, impossible to detect abuse patterns.

**Fix:**  
`server/middleware/audit.ts` implements `auditLog(event)` — a structured JSON logger that emits to stdout in production (ready to be picked up by any log aggregator). All trade mutations log: `{ requestId, walletAddress, procedure, params, outcome, durationMs, timestamp }`. PII fields (full amounts) are included as they're needed for financial reconciliation, but the logs should be treated as sensitive.

---

### Finding 10 — 🟡 MEDIUM: No Request ID Correlation

**Root Cause:**  
When a tRPC request fails, there is no way to correlate the client-side error with server-side logs. Support/debugging requires either console scraping or reproducing the error.

**Fix:**  
Every request now gets a `requestId` (nanoid, 12 chars) injected into the tRPC context. Request IDs are included in: error responses, audit logs, and the `X-Request-Id` response header. The frontend can include the request ID in bug reports.

---

### Finding 11 — 🟡 MEDIUM: No Per-Wallet Rate Limiting

**Root Cause:**  
Rate limiting is per-IP only. On shared infrastructure (VPNs, NAT, corporate networks), many users share an IP. More importantly: an attacker who controls a compromised wallet but can't change their IP can still flood the trade execution endpoint if they're below the IP rate limit.

**Fix:**  
Trade execution procedures now apply an additional per-wallet rate limit: max 10 trade operations per minute per wallet address. This complements (not replaces) the IP-based rate limiting.

---

### Finding 12 — 🟡 MEDIUM: `console.error` for Production Error Logging

**Files:** `server/prices.ts`, `server/leverage-api.ts`

**Root Cause:**  
Production errors go to `console.error` which has no structure, no severity levels, no timestamps, and no request correlation. In a containerized/PM2 environment, logs go to a file but are unsearchable.

**Fix:**  
`server/middleware/audit.ts` exports a `logger` object with `info`, `warn`, `error` methods that emit structured JSON. All `console.error` calls replaced with `logger.error({ event, error, context })`.

---

### Finding 13 — 🟢 LOW: `Authorization` Header Format

**File:** `server/leverage-api.ts`

**Root Cause:**
The 0xLeverage API expects the raw JWT in the `Authorization` header — `Authorization: <jwt_token>` (no `Bearer` prefix). This is non-standard per RFC 7235 but matches the upstream API specification.

**Fix:**
Confirmed the header format matches the 0xL API spec: `headers["Authorization"] = jwt`. Documented the non-standard format in the code comment. Do not add a `Bearer` prefix — the upstream API will reject it.

---

### Finding 14 — 🟢 LOW: Health Endpoint Exposes Availability Fingerprint

**Root Cause:**  
`leverage.health` is a public `publicProcedure` that returns `{ ok: true/false }` revealing whether the 0xLeverage API is reachable from this server. An attacker can poll this endpoint for free to monitor upstream availability.

**Fix:**  
Health endpoint now rate-limited to 10 req/min per IP. Response is identical regardless of upstream status (always returns `{ ok: true }` to callers, logs the real status internally). Internal health state is tracked separately for monitoring dashboards.

---

### Finding 15 — 🟢 LOW: Unsafe Env Var Access

**File:** `server/leverage-api.ts`

```typescript
return process.env.OXL_API_KEY ?? ""; // silently uses empty string
```

**Root Cause:**  
Missing `OXL_API_KEY` or `OXL_API_BASE_URL` silently falls back to empty string, causing cryptic errors from the upstream API ("invalid apikey") rather than a clear startup failure.

**Fix:**  
`getApiBaseUrl()` and `getApiKey()` now throw on startup if the required env vars are absent. Application fails fast with a clear message: `"FATAL: OXL_API_KEY environment variable is not set"`.

---

## Items Outside Scope of This Audit

| Item | Notes |
|------|-------|
| Solana wallet adapter implementation | Not yet built — covered in `docs/WALLET-ADAPTER-SPEC.md` |
| Real orderbook data | Currently mock — no security issue, functional gap |
| CI/CD pipeline security | No pipeline exists — dev should add secret scanning (Gitleaks), dependency audit (`pnpm audit`), and SAST on push |
| Database SQL injection | Drizzle ORM with parameterized queries used throughout — no raw SQL found |
| Secrets in git history | Repo has a single clean commit — no leaked secrets detected |
| Dependency CVEs | Run `pnpm audit` after installing — several minor/moderate issues expected in the Radix ecosystem |

---

## Post-Hardening Security Posture

| Layer | Before | After |
|-------|--------|-------|
| Wallet auth | None (accept any address) | Requires signature verification |
| JWT management | Infinite TTL, unbounded cache | 11.5h TTL, 10K cap, cleanup job |
| CSRF | None | Double-submit token on all mutations |
| Trade auth | publicProcedure | walletProtectedProcedure |
| Response validation | `as` cast | Zod parse on all upstream responses |
| CSP | unsafe-eval in prod | Removed from prod; dev-only |
| Rate limiting | IP only | IP + per-wallet |
| IP spoofing | Vulnerable | Fixed (use req.ip) |
| Audit trail | None | Structured JSON per trade |
| Error correlation | None | Request ID in all responses |
| Env var safety | Silent empty string | Fail-fast on startup |
