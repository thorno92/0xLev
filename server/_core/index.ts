import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerSecurityMiddleware } from "../security";
import { csrfMiddleware } from "../middleware/csrf";
import { logger } from "../middleware/audit";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Body parser — 1 MB hard cap (matches requestSizeGuard in security.ts)
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // CORS — explicit origin allowlist (never wildcard in production)
  const isProd = process.env.NODE_ENV === "production";
  app.use(
    cors({
      origin: isProd
        ? ["https://0xl-testing.xyz", "https://www.0xl-testing.xyz"]
        : true, // allow all in development
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization"],
      maxAge: 86400, // preflight cache: 24 hours
    }),
  );

  // Security: rate limiting, CSP headers, security headers
  registerSecurityMiddleware(app);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // CSRF protection on tRPC routes (double-submit cookie pattern)
  app.use("/api/trpc", csrfMiddleware);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn({ event: "port_fallback", preferred: preferredPort, actual: port });
  }

  server.listen(port, () => {
    logger.info({ event: "server_started", port, nodeEnv: process.env.NODE_ENV ?? "development" });
  });

  // Graceful shutdown logging
  const shutdown = (signal: string) => {
    logger.info({ event: "server_shutdown", signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000); // force exit after 10s
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  logger.error({ event: "server_start_failed", error: err instanceof Error ? err.message : "unknown" });
  process.exit(1);
});
