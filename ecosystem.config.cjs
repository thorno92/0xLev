/**
 * PM2 Ecosystem Config — 0xLeverage Trading Terminal
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs        # Start
 *   pm2 reload ecosystem.config.cjs       # Zero-downtime reload
 *   pm2 stop 0xl-terminal                 # Stop
 *   pm2 logs 0xl-terminal                 # Stream logs
 *   pm2 monit                             # Live process monitor
 *
 * Logs are written to ~/.pm2/logs/ by default.
 * Pipe to your log aggregator via pm2-axiom, pm2-datadog, or similar.
 */

module.exports = {
  apps: [
    {
      name: "0xl-terminal",
      script: "dist/index.js",

      // Run single instance (trading terminal has in-memory JWT cache — not cluster-safe yet)
      // To scale horizontally: move JWT cache to Redis first, then set instances: "max"
      instances: 1,

      // Restart policy
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,          // 3s between restarts
      exp_backoff_restart_delay: 100,

      // Memory guard — prevents runaway memory from leaking JWT cache or price data
      max_memory_restart: "512M",

      // Environment
      env: {
        NODE_ENV: "production",
        // Remaining vars (DATABASE_URL, OXL_API_KEY, etc.) should be in a .env file
        // or injected via your deployment system (e.g. Coolify, Render, Fly.io secrets)
      },

      // Log configuration
      out_file: "~/.pm2/logs/0xl-terminal-out.log",
      error_file: "~/.pm2/logs/0xl-terminal-err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS Z",

      // Graceful shutdown — give the server 10s to drain connections before SIGKILL
      kill_timeout: 10_000,

      // Watch mode: OFF in production (use reload for deployments)
      watch: false,
    },
  ],
};
