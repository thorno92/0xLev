/**
 * CSRF Protection Middleware — Double-Submit Cookie Pattern
 *
 * How it works:
 *   1. On first request, server sets a `csrf_token` cookie (random 32-byte hex).
 *      HttpOnly=false so the frontend JS can read it.
 *      SameSite=Strict to prevent cross-site access.
 *
 *   2. For every tRPC mutation (state-changing request), the frontend must:
 *      - Read the `csrf_token` cookie value
 *      - Send it as the `X-CSRF-Token` header
 *
 *   3. Server validates that header value === cookie value.
 *      Mismatch → 403 Forbidden.
 *
 * Why this works:
 *   A cross-origin attacker can trigger the request but cannot read the
 *   HttpOnly=false cookie value due to the Same-Origin Policy. So they
 *   cannot forge the matching header.
 *
 * Frontend integration:
 *   import Cookies from 'js-cookie';
 *
 *   // Add to tRPC client headers config:
 *   headers: {
 *     'X-CSRF-Token': Cookies.get('csrf_token') ?? '',
 *   }
 *
 * Note: CSRF protection is not needed for GET/HEAD/OPTIONS requests.
 * tRPC queries (GET) are exempt. Only mutations (POST) are checked.
 */

import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const TOKEN_BYTE_LENGTH = 32;

function isStateMutatingMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function isTrpcBatchRequest(url: string): boolean {
  return url.includes("/api/trpc");
}

/** Issue a new CSRF token cookie if none exists. */
function ensureCsrfCookie(req: Request, res: Response): string {
  const existing = extractCookieValue(req, CSRF_COOKIE_NAME);
  if (existing) return existing;

  const token = randomBytes(TOKEN_BYTE_LENGTH).toString("hex");
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,      // Must be readable by frontend JS
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: "/",
  });
  return token;
}

/** Minimal cookie value extractor — avoids a full cookie-parser dependency. */
function extractCookieValue(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.trim().split("=");
    if (key?.trim() === name) {
      return valueParts.join("=").trim();
    }
  }
  return undefined;
}

/**
 * CSRF middleware. Apply to /api/trpc routes only.
 *
 * Usage in Express setup:
 *   import { csrfMiddleware } from './middleware/csrf';
 *   app.use('/api/trpc', csrfMiddleware);
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Always ensure the CSRF cookie exists (issue one if missing)
  const cookieToken = ensureCsrfCookie(req, res);

  // Only validate on state-mutating methods to tRPC routes
  if (!isStateMutatingMethod(req.method) || !isTrpcBatchRequest(req.originalUrl ?? req.url)) {
    return next();
  }

  const rawHeaderToken = req.headers[CSRF_HEADER_NAME];
  // Express can return string[] for duplicate headers — reject that case
  const headerToken = Array.isArray(rawHeaderToken) ? undefined : rawHeaderToken;

  if (!headerToken || headerToken !== cookieToken) {
    res.status(403).json({
      error: "CSRF token mismatch. Include the X-CSRF-Token header with the value from the csrf_token cookie.",
    });
    return;
  }

  next();
}
