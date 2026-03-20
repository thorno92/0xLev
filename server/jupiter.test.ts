import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");
const mockedAxios = vi.mocked(axios);

describe("jupiter price service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.JUPITER_API_KEY;
  });

  it("returns prices from v2 response format (nested under data)", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        data: {
          So11111111111111111111111111111111111111112: {
            id: "So11111111111111111111111111111111111111112",
            price: "142.50",
          },
          EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: {
            id: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
            price: "0.85",
          },
        },
      },
    });

    const { fetchJupiterPrices } = await import("./jupiter");
    const prices = await fetchJupiterPrices([
      "So11111111111111111111111111111111111111112",
      "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    ]);

    expect(prices.size).toBe(2);
    expect(prices.get("So11111111111111111111111111111111111111112")?.usdPrice).toBe(142.5);
    expect(prices.get("EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm")?.usdPrice).toBe(0.85);
  });

  it("returns prices from v3 response format (flat)", async () => {
    process.env.JUPITER_API_KEY = "test-key";

    mockedAxios.get.mockResolvedValue({
      data: {
        So11111111111111111111111111111111111111112: {
          usdPrice: 142.5,
          decimals: 9,
          priceChange24h: -2.1,
        },
      },
    });

    const { fetchJupiterPrices } = await import("./jupiter");
    const prices = await fetchJupiterPrices([
      "So11111111111111111111111111111111111111112",
    ]);

    expect(prices.size).toBe(1);
    const sol = prices.get("So11111111111111111111111111111111111111112")!;
    expect(sol.usdPrice).toBe(142.5);
    expect(sol.change24h).toBe(-2.1);

    // Should use v3 URL with API key header
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("/v3"),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "test-key" }),
      }),
    );
  });

  it("uses v2 URL when no API key is set", async () => {
    mockedAxios.get.mockResolvedValue({ data: { data: {} } });

    const { fetchJupiterPrices } = await import("./jupiter");
    await fetchJupiterPrices(["So11111111111111111111111111111111111111112"]);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("/v2"),
      expect.objectContaining({
        headers: expect.not.objectContaining({ "x-api-key": expect.anything() }),
      }),
    );
  });

  it("returns empty map for empty mint list", async () => {
    const { fetchJupiterPrices } = await import("./jupiter");
    const prices = await fetchJupiterPrices([]);
    expect(prices.size).toBe(0);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("skips tokens with zero or missing price", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        data: {
          So11111111111111111111111111111111111111112: { price: "0" },
          EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: { price: "1.5" },
          DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: {},
        },
      },
    });

    const { fetchJupiterPrices } = await import("./jupiter");
    const prices = await fetchJupiterPrices([
      "So11111111111111111111111111111111111111112",
      "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
      "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    ]);

    expect(prices.size).toBe(1);
    expect(prices.has("EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm")).toBe(true);
  });

  it("returns empty map on API failure", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    const { fetchJupiterPrices } = await import("./jupiter");
    const prices = await fetchJupiterPrices([
      "So11111111111111111111111111111111111111112",
    ]);

    expect(prices.size).toBe(0);
  });

  it("chunks large mint lists into batches of 50", async () => {
    mockedAxios.get.mockResolvedValue({ data: { data: {} } });

    const mints = Array.from({ length: 75 }, (_, i) =>
      `${"A".repeat(43)}${String(i).padStart(1, "0")}`,
    );

    const { fetchJupiterPrices } = await import("./jupiter");
    await fetchJupiterPrices(mints);

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });
});
