/**
 * Token Logo Resolution System
 * Multi-source fallback: simplr-sh CDN → CoinGecko → cryptologos.cc → generated avatar
 *
 * Uses CoinGecko IDs for the simplr-sh CDN which hosts 16,119 logos via jsDelivr/Cloudflare.
 * No rate limits, no bandwidth limits, production-ready.
 */

// Direct CoinGecko CDN URLs for tokens that fail on simplr-sh CDN
const COINGECKO_DIRECT_URLS: Record<string, string> = {
  WIF: 'https://assets.coingecko.com/coins/images/33566/standard/dogwifhat.jpg',
  MOCHI: 'https://assets.coingecko.com/coins/images/36910/standard/mochi.png',
};

// CoinGecko ID mapping for known tokens
const COINGECKO_IDS: Record<string, string> = {
  // Major chains
  SOL: 'solana',
  ETH: 'ethereum',
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  BNB: 'binancecoin',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  ARB: 'arbitrum',
  OP: 'optimism',
  BASE: 'base-protocol',
  SUI: 'sui',
  APT: 'aptos',

  // Solana ecosystem
  BONK: 'bonk',
  WIF: 'dogwifhat',
  JUP: 'jupiter-exchange-solana',
  RAY: 'raydium',
  ORCA: 'orca',
  PYTH: 'pyth-network',
  RENDER: 'render-token',
  POPCAT: 'popcat',
  MEW: 'cat-in-a-dogs-world',
  JITO: 'jito-governance-token',
  MARINADE: 'marinade',
  MSOL: 'msol',
  BSOL: 'blazestake-staked-sol',
  SAMO: 'samoyedcoin',
  MNDE: 'marinade',
  HNT: 'helium',
  MOBILE: 'helium-mobile',
  IOT: 'helium-iot',
  TENSOR: 'tensor',
  W: 'wormhole',
  KMNO: 'kamino',
  DRIFT: 'drift-protocol',
  ZEUS: 'zeus-network',
  FIDA: 'bonfida',
  STEP: 'step-finance',
  SLERF: 'slerf',

  // Memecoins
  PEPE: 'pepe',
  DOGE: 'dogecoin',
  SHIB: 'shiba-inu',
  FLOKI: 'floki',
  BRETT: 'brett',
  TOSHI: 'toshi',
  MEME: 'memecoin-2',
  NEIRO: 'first-neiro-on-ethereum',
  MOG: 'mog-coin',
  SPX: 'spx6900',
  GIGA: 'gigachad-2',
  GOAT: 'goatseus-maximus',
  FWOG: 'fwog',
  AI16Z: 'ai16z',
  GRIFFAIN: 'griffain',
  PNUT: 'peanut-the-squirrel',
  CHILLGUY: 'just-a-chill-guy',
  BOME: 'book-of-meme',
  MOCHI: 'mochi-the-cat',
  NORM: 'normie-2',
  KEYCAT: 'keyboard-cat',
  HIGHER: 'higher',
  DEGEN: 'degen-base',

  // DeFi blue chips
  UNI: 'uniswap',
  AAVE: 'aave',
  MKR: 'maker',
  LINK: 'chainlink',
  CRV: 'curve-dao-token',
  LDO: 'lido-dao',
  SNX: 'havven',
  COMP: 'compound-governance-token',
  SUSHI: 'sushi',
  CAKE: 'pancakeswap-token',
  GMX: 'gmx',
  DYDX: 'dydx-chain',
  INJ: 'injective-protocol',
  TIA: 'celestia',
  SEI: 'sei-network',
  NEAR: 'near',
  FTM: 'fantom',
  ATOM: 'cosmos',
  DOT: 'polkadot',
  ADA: 'cardano',
  XRP: 'ripple',
  TRX: 'tron',
  TON: 'the-open-network',
  PENDLE: 'pendle',
  BLUR: 'blur',
  ENS: 'ethereum-name-service',
  VIRTUAL: 'virtual-protocol',
  WELL: 'moonwell-artemis',
  AERO: 'aerodrome-finance',
  TWT: 'trust-wallet-token',
  ALPACA: 'alpaca-finance',
  BAKE: 'bakerytoken',
  XVS: 'venus',

  // Stablecoins
  USDT: 'tether',
  USDC: 'usd-coin',
  DAI: 'dai',
  BUSD: 'binance-usd',
};

// Sizes available from simplr-sh CDN
type LogoSize = 'large' | 'standard' | 'small' | 'thumb';

/**
 * Get the CDN URL for a token logo using the simplr-sh/coin-logos repository.
 * Falls back through multiple sources.
 */
export function getTokenLogoUrl(symbol: string, size: LogoSize = 'standard'): string {
  const upperSymbol = symbol.toUpperCase();

  // Check direct CoinGecko URLs first (for tokens with broken CDN links)
  if (COINGECKO_DIRECT_URLS[upperSymbol]) {
    return COINGECKO_DIRECT_URLS[upperSymbol];
  }

  const coingeckoId = COINGECKO_IDS[upperSymbol];

  if (coingeckoId) {
    return `https://cdn.jsdelivr.net/gh/simplr-sh/coin-logos/images/${coingeckoId}/${size}.png`;
  }

  // Fallback: try lowercase symbol as coingecko id (works for many tokens)
  return `https://cdn.jsdelivr.net/gh/simplr-sh/coin-logos/images/${symbol.toLowerCase()}/${size}.png`;
}

/**
 * Get the CoinGecko API URL for a token logo (secondary fallback).
 * Useful for tokens not in the simplr-sh CDN.
 */
export function getCoinGeckoLogoUrl(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  const coingeckoId = COINGECKO_IDS[upperSymbol];
  if (coingeckoId) {
    return `https://assets.coingecko.com/coins/images/${coingeckoId}/small/${coingeckoId}.png`;
  }
  return '';
}

/**
 * Generate a deterministic color from a string (for fallback avatars).
 */
export function getTokenColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 35%)`;
}

/**
 * Check if a CoinGecko ID exists for the given symbol.
 */
export function hasKnownLogo(symbol: string): boolean {
  return symbol.toUpperCase() in COINGECKO_IDS;
}

/**
 * Get the TradingView symbol format for a given token.
 * Maps common crypto symbols to their TradingView exchange:pair format.
 */
const TRADINGVIEW_SYMBOLS: Record<string, string> = {
  SOL: 'BINANCE:SOLUSDT',
  BTC: 'BINANCE:BTCUSDT',
  ETH: 'BINANCE:ETHUSDT',
  BNB: 'BINANCE:BNBUSDT',
  BONK: 'BINANCE:BONKUSDT',
  WIF: 'BINANCE:WIFUSDT',
  JUP: 'BINANCE:JUPUSDT',
  RAY: 'BINANCE:RAYUSDT',
  ORCA: 'BYBIT:ORCAUSDT',
  PYTH: 'BINANCE:PYTHUSDT',
  RENDER: 'BINANCE:RENDERUSDT',
  POPCAT: 'BYBIT:POPCATUSDT',
  MEW: 'BYBIT:MEWUSDT',
  PEPE: 'BINANCE:PEPEUSDT',
  DOGE: 'BINANCE:DOGEUSDT',
  FLOKI: 'BINANCE:FLOKIUSDT',
  BRETT: 'BYBIT:BRETTUSDT',
  TOSHI: 'BYBIT:TOSHIUSDT',
  LINK: 'BINANCE:LINKUSDT',
  UNI: 'BINANCE:UNIUSDT',
  AAVE: 'BINANCE:AAVEUSDT',
  AVAX: 'BINANCE:AVAXUSDT',
  NEAR: 'BINANCE:NEARUSDT',
  INJ: 'BINANCE:INJUSDT',
  TIA: 'BINANCE:TIAUSDT',
  SEI: 'BINANCE:SEIUSDT',
  SUI: 'BINANCE:SUIUSDT',
  APT: 'BINANCE:APTUSDT',
  ARB: 'BINANCE:ARBUSDT',
  OP: 'BINANCE:OPUSDT',
  FTM: 'BINANCE:FTMUSDT',
  ATOM: 'BINANCE:ATOMUSDT',
  DOT: 'BINANCE:DOTUSDT',
  ADA: 'BINANCE:ADAUSDT',
  XRP: 'BINANCE:XRPUSDT',
  TON: 'BINANCE:TONUSDT',
  JITO: 'BYBIT:JITOUSDT',
  VIRTUAL: 'BYBIT:VIRTUALUSDT',
  CAKE: 'BINANCE:CAKEUSDT',
  WBTC: 'BINANCE:WBTCUSDT',
};

export function getTradingViewSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  return TRADINGVIEW_SYMBOLS[upper] || `BYBIT:${upper}USDT`;
}
