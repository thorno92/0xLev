/**
 * Vercel Serverless Function — tRPC catch-all handler
 *
 * Vercel auto-detects this file in api/trpc/ and deploys it
 * as a serverless function handling /api/trpc/* routes.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../../server/vercel-handler";

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Express app handles routing internally
  return app(req, res);
}
