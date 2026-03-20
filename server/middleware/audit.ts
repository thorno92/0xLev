/**
 * Structured Audit Logger
 *
 * Emits JSON-structured log lines to stdout.
 * In production, stdout is picked up by PM2/systemd/Docker and forwarded
 * to whatever log aggregator you use (Axiom, Datadog, Loki, etc.).
 *
 * Two surfaces:
 *
 *   1. logger — general-purpose structured logger (info/warn/error)
 *      Use for: startup events, cache events, API errors, anything non-trade
 *
 *   2. auditLog — trade-specific audit log
 *      Use for: openPosition, closePosition, updateTpSl, connectWallet
 *      These are financial records. Treat logs as sensitive data.
 *      Never log full SOL amounts or private keys.
 *
 * All entries include:
 *   - ISO timestamp
 *   - Log level
 *   - Event name (machine-readable, snake_case)
 *   - Request ID (if available — correlates with X-Request-Id header)
 *   - Duration (for audit events)
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface AuditEvent {
  requestId: string;
  walletAddress: string;    // Always masked — never log full addresses
  procedure: string;        // e.g. "openPosition"
  params?: Record<string, unknown>; // Sanitized params (no secrets)
  outcome: "success" | "error";
  errorCode?: string;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/*  Internal                                                           */
/* ------------------------------------------------------------------ */

function emit(level: LogLevel, data: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event: (data["event"] as string) ?? "log",
    ...data,
  };

  // Use process.stdout.write for non-buffered sync output
  process.stdout.write(JSON.stringify(entry) + "\n");
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** General-purpose structured logger. */
export const logger = {
  info(data: Record<string, unknown>): void {
    emit("info", data);
  },
  warn(data: Record<string, unknown>): void {
    emit("warn", data);
  },
  error(data: Record<string, unknown>): void {
    emit("error", data);
  },
};

/**
 * Trade audit log. Called after every state-changing trade operation.
 * These records are the financial paper trail — retain them.
 *
 * Example output:
 * {
 *   "timestamp": "2026-03-20T14:22:31.123Z",
 *   "level": "info",
 *   "event": "trade_audit",
 *   "requestId": "abc123xyz456",
 *   "walletAddress": "7xKX...sAsU",
 *   "procedure": "openPosition",
 *   "params": { "contractAddress": "So11...112", "leverage": 5, "amount": 1 },
 *   "outcome": "success",
 *   "durationMs": 342
 * }
 */
export function auditLog(event: AuditEvent): void {
  emit("info", {
    event: "trade_audit",
    ...event,
  });
}

/**
 * Helper: mask a Solana wallet address for safe logging.
 * Input:  "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
 * Output: "7xKX...sAsU"
 */
export function maskWallet(address: string): string {
  if (!address || address.length < 8) return "***";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Request timer — call start() before an operation, stop() after.
 * Returns duration in milliseconds.
 *
 * Usage:
 *   const timer = requestTimer();
 *   await doSomething();
 *   const durationMs = timer.stop();
 */
export function requestTimer(): { stop: () => number } {
  const start = Date.now();
  return { stop: () => Date.now() - start };
}
