import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('prices service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('should return an array of LivePriceData from CoinGecko', async () => {
    const mockResponse = {
      solana: { usd: 85.10, usd_24h_change: -1.37, usd_24h_vol: 3954204336, usd_market_cap: 48524452398 },
      bonk: { usd: 0.00000584, usd_24h_change: -0.90, usd_24h_vol: 38712492, usd_market_cap: 514028081 },
      dogwifcoin: { usd: 0.164554, usd_24h_change: 1.15, usd_24h_vol: 5000000, usd_market_cap: 100000000 },
    };

    mockedAxios.get.mockResolvedValue({ data: mockResponse });

    const { fetchLivePrices } = await import('./prices');
    const prices = await fetchLivePrices();

    expect(Array.isArray(prices)).toBe(true);
    expect(prices.length).toBeGreaterThan(0);

    const sol = prices.find(p => p.symbol === 'SOL');
    expect(sol).toBeDefined();
    expect(sol!.price).toBe(85.10);
    expect(sol!.change24h).toBe(-1.37);
    expect(sol!.volume24h).toBe(3954204336);
    expect(sol!.marketCap).toBe(48524452398);
    expect(sol!.coingeckoId).toBe('solana');

    const bonk = prices.find(p => p.symbol === 'BONK');
    expect(bonk).toBeDefined();
    expect(bonk!.price).toBe(0.00000584);

    const wif = prices.find(p => p.symbol === 'WIF');
    expect(wif).toBeDefined();
    expect(wif!.price).toBe(0.164554);
  });

  it('should map all expected symbols to CoinGecko IDs', async () => {
    const expectedSymbols = ['SOL', 'BONK', 'WIF', 'JUP', 'RAY', 'PEPE', 'DOGE', 'FLOKI', 'BRETT', 'TOSHI', 'ORCA', 'PYTH', 'RENDER', 'POPCAT', 'MEW'];

    const idMap: Record<string, string> = {
      SOL: 'solana', BONK: 'bonk', WIF: 'dogwifcoin', JUP: 'jupiter-exchange-solana',
      RAY: 'raydium', PEPE: 'pepe', DOGE: 'dogecoin', FLOKI: 'floki', BRETT: 'brett',
      TOSHI: 'toshi', ORCA: 'orca', PYTH: 'pyth-network', RENDER: 'render-token',
      POPCAT: 'popcat', MEW: 'cat-in-a-dogs-world',
    };

    const mockResponse: Record<string, { usd: number; usd_24h_change: number; usd_24h_vol: number; usd_market_cap: number }> = {};
    for (const [, geckoId] of Object.entries(idMap)) {
      mockResponse[geckoId] = { usd: 1.0, usd_24h_change: 0.5, usd_24h_vol: 1000, usd_market_cap: 50000 };
    }

    mockedAxios.get.mockResolvedValue({ data: mockResponse });

    const { fetchLivePrices } = await import('./prices');
    const prices = await fetchLivePrices();

    for (const sym of expectedSymbols) {
      const found = prices.find(p => p.symbol === sym);
      expect(found, `Missing symbol: ${sym}`).toBeDefined();
      expect(found!.price).toBe(1.0);
    }
  });

  it('should return empty array on API error with no cache', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Request failed with status code 429'));

    const { fetchLivePrices } = await import('./prices');

    const result = await fetchLivePrices();
    expect(result).toEqual([]);
  });

  it('getSolUsdPrice returns SOL price from cache', async () => {
    const mockResponse = {
      solana: { usd: 142.5, usd_24h_change: 1.0, usd_24h_vol: 1000, usd_market_cap: 50000 },
    };
    mockedAxios.get.mockResolvedValue({ data: mockResponse });

    const { getSolUsdPrice } = await import('./prices');
    const price = await getSolUsdPrice();
    expect(price).toBe(142.5);
  });

  it('getSolUsdPrice returns 0 when API fails and no cache', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network error'));

    const { getSolUsdPrice } = await import('./prices');
    const price = await getSolUsdPrice();
    expect(price).toBe(0);
  });
});
