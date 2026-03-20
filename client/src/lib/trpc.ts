import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Read the csrf_token cookie value (set by server middleware).
 * The cookie is HttpOnly=false so JS can read it.
 */
export function getCsrfToken(): string {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrf_token="));
  return match ? match.split("=").slice(1).join("=") : "";
}
