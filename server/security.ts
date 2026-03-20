/**
 * Security middleware for Express.
 *
 * Three-tier rate limiting (API-only, never blocks static assets):
 *   1. General API         — 200 req/min per IP
 *   2. Leverage API        — 30 req/min per IP
 *   3. Trade execution     — 5 req/min per IP  +  10 per wallet (see walletAuth.ts)
 *
 * Content-Security-Policy:
 *   - unsafe-eval is REMOVED from production (was a security gap)
 *   - unsafe-eval only enabled in development for Vite HMR
 *
 * IP extraction:
 *   - Uses req.ip (set correctly by Express trust proxy) — not raw X-Forwarded-For
 *   - Raw header parsing was spoofable; req.ip is authoritative
 *
 * Request IDs:
 *   - Every request gets a nanoid request ID injected via X-Request-Id header
 *   - tRPC context picks this up for error correlation and audit logging
 */

import type { Express, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { nanoid } from "nanoid";

/* ------------------------------------------------------------------ */
/*  Environment helpers                                                */
/* ------------------------------------------------------------------ */

const isProd = process.env.NODE_ENV === "production";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Use req.ip which is set correctly by Express when trust proxy is configured.
 * Never read X-Forwarded-For directly — the leftmost value is user-controlled.
 */
function getClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

/* ------------------------------------------------------------------ */
/*  Request ID injection                                               */
/* ------------------------------------------------------------------ */

function attachRequestId(req: Request, res: Response, next: NextFunction) {
  const requestId = nanoid(12);
  // Attach to request for downstream use (tRPC context, audit logs)
  (req as Request & { requestId: string }).requestId = requestId;
  // Return to client for error correlation
  res.setHeader("X-Request-Id", requestId);
  next();
}

/* ------------------------------------------------------------------ */
/*  Rate Limiters                                                      */
/* ------------------------------------------------------------------ */

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
  keyGenerator: getClientIp,
  validate: { keyGeneratorIpFallback: false },
});

const leverageApiLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Rate limit exceeded on trading API. Please slow down." },
  keyGenerator: getClientIp,
  validate: { keyGeneratorIpFallback: false },
});

const tradeExecutionLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Trade execution rate limit exceeded. Maximum 5 trades per minute." },
  keyGenerator: getClientIp,
  validate: { keyGeneratorIpFallback: false },
});

const healthLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Rate limit exceeded." },
  keyGenerator: getClientIp,
  validate: { keyGeneratorIpFallback: false },
});

/**
 * connectWallet rate limiter — prevents brute-force wallet enumeration.
 * 10 attempts per 15 minutes per IP. Window is intentionally long because
 * legitimate users connect once per session.
 */
const connectWalletLimiter = rateLimit({
  windowMs: 15 * 60_000, // 15 minutes
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many wallet connection attempts. Please try again later." },
  keyGenerator: getClientIp,
  validate: { keyGeneratorIpFallback: false },
});

/* ------------------------------------------------------------------ */
/*  Content Security Policy                                            */
/* ------------------------------------------------------------------ */

function analyticsOriginFromEnv(): string | null {
  const raw = process.env.VITE_ANALYTICS_ENDPOINT?.trim();
  if (!raw) return null;
  try {
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(href).origin;
  } catch {
    return null;
  }
}

function buildCspHeader(): string {
  const analyticsOrigin = analyticsOriginFromEnv();

  // unsafe-eval is ONLY included in development for Vite HMR.
  // In production, eval is completely disallowed.
  const scriptSrc = isProd
    ? [
        "'self'",
        "'unsafe-inline'", // Tailwind CSS-in-JS still needs this — remove if you migrate to build-time CSS
        "blob:",
        "https://s3.tradingview.com",
        "https://maps.googleapis.com",
        "https://cdn.jsdelivr.net",
      ]
    : [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'", // Vite HMR needs eval in dev only
        "blob:",
        "https://s3.tradingview.com",
        "https://maps.googleapis.com",
        "https://cdn.jsdelivr.net",
      ];

  if (analyticsOrigin) {
    scriptSrc.push(analyticsOrigin);
  }

  const connectSrc = [
    "'self'",
    "https://*.tradingview.com",
    "https://api.coingecko.com",
    "https://pro-api.coingecko.com",
    "https://maps.googleapis.com",
    "wss://*.tradingview.com",
    "https://api.mainnet-beta.solana.com",
    "https://api.devnet.solana.com",
    "wss://api.mainnet-beta.solana.com",
    "wss://api.devnet.solana.com",
    "https://*.helius-rpc.com",
    "wss://*.helius-rpc.com",
    "https://api.jup.ag",
  ];
  if (analyticsOrigin) {
    connectSrc.push(analyticsOrigin);
  }

  const directives = [
    "default-src 'self'",

    `script-src ${scriptSrc.join(" ")}`,

    // Workers: self + blob (Vite HMR in dev, TradingView workers in prod)
    "worker-src 'self' blob:",

    // Styles: self + inline + Google Fonts
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",

    // Images: favicons/OG use CloudFront; token lists often use GitHub raw; wallet UIs may use misc HTTPS CDNs
    "img-src 'self' data: blob: https: http:",

    // Fonts: self + Google Fonts
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",

    // Connections: self + trading APIs + CoinGecko + Solana RPC (+ optional Umami)
    `connect-src ${connectSrc.join(" ")}`,

    // Frames: TradingView charts
    "frame-src 'self' https://s3.tradingview.com https://www.tradingview.com https://www.tradingview-widget.com https://*.tradingview-widget.com https://*.tradingview.com https://maps.googleapis.com",

    // Block all plugin content
    "object-src 'none'",

    // Prevent base-tag hijacking
    "base-uri 'self'",

    // Restrict form action targets
    "form-action 'self'",

    // Allow embedding from own domain only
    "frame-ancestors 'self' https://*.0xl-testing.xyz https://0xl-testing.xyz",

    // Force HTTPS for all sub-resources
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

/* ------------------------------------------------------------------ */
/*  Security Headers                                                   */
/* ------------------------------------------------------------------ */

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Limit referrer leakage
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Block all unnecessary browser features (camera, mic, payment, etc.)
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  );

  // Disable DNS prefetching
  res.setHeader("X-DNS-Prefetch-Control", "off");

  // Block cross-domain policy files
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  // HSTS: 1 year, subdomains, preload-eligible
  if (isProd) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // Prevent cross-origin window interactions
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

  // Prevent cross-origin resource loading (e.g. <script src="our-api">)
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");

  // Content Security Policy
  res.setHeader("Content-Security-Policy", buildCspHeader());

  // Remove server identification
  res.removeHeader("X-Powered-By");

  next();
}

/* ------------------------------------------------------------------ */
/*  Request Validation                                                 */
/* ------------------------------------------------------------------ */

/** Reject oversized payloads before route handlers. */
function requestSizeGuard(req: Request, res: Response, next: NextFunction) {
  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  const MAX_BODY_SIZE = 1_048_576; // 1 MB hard cap

  if (contentLength > MAX_BODY_SIZE) {
    res.status(413).json({ error: "Request payload too large." });
    return;
  }
  next();
}

/** Block malformed or unexpected content types on API routes. */
function contentTypeGuard(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  const contentType = req.headers["content-type"];
  if (
    contentType &&
    !contentType.includes("application/json") &&
    !contentType.includes("text/plain")
  ) {
    res.status(415).json({ error: "Unsupported content type." });
    return;
  }
  next();
}

/* ------------------------------------------------------------------ */
/*  Route Guards                                                       */
/* ------------------------------------------------------------------ */

function tradeExecutionGuard(req: Request, res: Response, next: NextFunction) {
  const url = req.originalUrl ?? req.url;
  if (url.includes("leverage.openPosition") || url.includes("leverage.closePosition")) {
    return tradeExecutionLimiter(req, res, next);
  }
  next();
}

function leverageApiGuard(req: Request, res: Response, next: NextFunction) {
  const url = req.originalUrl ?? req.url;
  if (url.includes("leverage.")) {
    return leverageApiLimiter(req, res, next);
  }
  next();
}

function healthGuard(req: Request, res: Response, next: NextFunction) {
  const url = req.originalUrl ?? req.url;
  if (url.includes("leverage.health")) {
    return healthLimiter(req, res, next);
  }
  next();
}

function connectWalletGuard(req: Request, res: Response, next: NextFunction) {
  const url = req.originalUrl ?? req.url;
  if (url.includes("leverage.connectWallet")) {
    return connectWalletLimiter(req, res, next);
  }
  next();
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Register all security middleware. Call BEFORE route registration. */
export function registerSecurityMiddleware(app: Express) {
  // Disable Express server identification
  app.disable("x-powered-by");

  // Trust first proxy for accurate IP extraction via req.ip
  // Change this to the number of proxies in your infra if > 1 (e.g. Cloudflare + Nginx = 2)
  app.set("trust proxy", 1);

  // Attach request ID to every request
  app.use(attachRequestId);

  // Security headers on all responses
  app.use(securityHeaders);

  // Request validation on API routes
  app.use("/api", requestSizeGuard);
  app.use("/api", contentTypeGuard);

  // Rate limiting (API routes only — never blocks static assets or page loads)
  app.use("/api", apiLimiter);
  app.use("/api/trpc", leverageApiGuard);
  app.use("/api/trpc", tradeExecutionGuard);
  app.use("/api/trpc", healthGuard);
  app.use("/api/trpc", connectWalletGuard);
}
