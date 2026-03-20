import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { leverageRouter } from "./routers/leverage";
import { fetchLivePrices, getSolUsdPrice } from "./prices";
import { fetchJupiterPrices } from "./jupiter";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  /** 0xLeverage API proxy -- all trading endpoints */
  leverage: leverageRouter,

  /** Live crypto prices from CoinGecko */
  prices: router({
    live: publicProcedure.query(async () => {
      return fetchLivePrices();
    }),
    /** Jupiter token prices by mint address (server-side — API key stays private) */
    jupiter: publicProcedure
      .input(z.object({ mints: z.array(z.string().min(32).max(44)).min(1).max(100) }))
      .query(async ({ input }) => {
        const prices = await fetchJupiterPrices(input.mints);
        const result: Record<string, { usdPrice: number; change24h?: number }> = {};
        for (const [mint, info] of prices) {
          result[mint] = { usdPrice: info.usdPrice, change24h: info.change24h };
        }

        // If Jupiter didn't return SOL, backfill from CoinGecko cache
        const SOL_MINT = "So11111111111111111111111111111111111111112";
        if (input.mints.includes(SOL_MINT) && !result[SOL_MINT]) {
          const solUsd = await getSolUsdPrice();
          if (solUsd > 0) {
            result[SOL_MINT] = { usdPrice: solUsd };
          }
        }

        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
