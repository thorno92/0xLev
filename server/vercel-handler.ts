/**
 * Vercel Serverless Function — tRPC API handler
 *
 * Minimal Express app for Vercel's serverless runtime. Mounts the same
 * tRPC router and middleware as the full server, minus Vite/static-serving
 * (Vercel handles static assets natively).
 *
 * Caveats vs. the persistent Express server:
 *   - In-memory rate-limit counters reset on cold starts
 *   - In-memory caches (JWT, prices) don't persist across invocations
 *   - Cold-start latency on first request after idle
 */

import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { csrfMiddleware } from "./middleware/csrf";
import { registerSecurityMiddleware } from "./security";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

const isProd = process.env.NODE_ENV === "production";
const ALLOWED_ORIGINS = [
  "https://0xl-testing.xyz",
  "https://www.0xl-testing.xyz",
  "https://0x-lev-neon.vercel.app",
];
app.use(
  cors({
    origin: isProd
      ? (origin, cb) => {
          if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".vercel.app")) {
            cb(null, true);
          } else {
            cb(new Error("CORS blocked"));
          }
        }
      : true,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization"],
    maxAge: 86400,
  }),
);

registerSecurityMiddleware(app);

app.use("/api/trpc", csrfMiddleware);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

export default app;
