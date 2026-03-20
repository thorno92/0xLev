/**
 * Sets NODE_ENV before spawning tsx — works on Windows cmd/PowerShell without cross-env.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const env = { ...process.env, NODE_ENV: "development" };

const child = spawn(process.execPath, [tsxCli, "watch", "server/_core/index.ts"], {
  cwd: root,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
