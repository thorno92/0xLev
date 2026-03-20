import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { leverageRouter } from "./routers/leverage";
import { fetchLivePrices } from "./prices";

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
  }),
});

export type AppRouter = typeof appRouter;
