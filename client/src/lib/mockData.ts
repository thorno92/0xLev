import type { TokenInfo, OpenPosition } from './store';

export const trendingTokens: TokenInfo[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    address: 'So11111111111111111111111111111111111111112',
    price: 145.67,
    change24h: 9.57,
    volume24h: 2200000,
    marketCap: 660000,
    liquidity: 99000,
    chain: 'solana',
  },
  {
    symbol: 'BONK',
    name: 'Bonk',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    price: 0.00002134,
    change24h: -2.34,
    volume24h: 1100000,
    marketCap: 1400000,
    liquidity: 45000,
    chain: 'solana',
  },
  {
    symbol: 'WIF',
    name: 'dogwifhat',
    address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    price: 1.23,
    change24h: 15.42,
    volume24h: 890000,
    marketCap: 1230000,
    liquidity: 67000,
    chain: 'solana',
  },
  {
    symbol: 'JUP',
    name: 'Jupiter',
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    price: 0.87,
    change24h: 4.21,
    volume24h: 560000,
    marketCap: 870000,
    liquidity: 34000,
    chain: 'solana',
  },
  {
    symbol: 'RAY',
    name: 'Raydium',
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    price: 3.45,
    change24h: -1.12,
    volume24h: 340000,
    marketCap: 345000,
    liquidity: 23000,
    chain: 'solana',
  },
];

// Extended token list for Markets and Trending pages (multi-chain) -- 50+ tokens
export const allTokens: TokenInfo[] = [
  ...trendingTokens,

  // --- BTC ---
  { symbol: 'BTC', name: 'Bitcoin', address: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', price: 0, change24h: 0, volume24h: 0, marketCap: 0, liquidity: 0, chain: 'solana' as const },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', price: 0, change24h: 0, volume24h: 0, marketCap: 0, liquidity: 0, chain: 'ethereum' as const },

  // --- Solana ecosystem ---
  { symbol: 'PEPE', name: 'Pepe', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', price: 0.00001245, change24h: 22.5, volume24h: 4500000, marketCap: 5200000, liquidity: 320000, chain: 'ethereum' },
  { symbol: 'ORCA', name: 'Orca', address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', price: 4.12, change24h: 6.3, volume24h: 450000, marketCap: 412000, liquidity: 56000, chain: 'solana' },
  { symbol: 'PYTH', name: 'Pyth Network', address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', price: 0.34, change24h: -1.8, volume24h: 780000, marketCap: 340000, liquidity: 45000, chain: 'solana' },
  { symbol: 'RENDER', name: 'Render', address: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', price: 7.89, change24h: 12.1, volume24h: 1200000, marketCap: 3100000, liquidity: 210000, chain: 'solana' },
  { symbol: 'POPCAT', name: 'Popcat', address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', price: 0.67, change24h: 45.3, volume24h: 3400000, marketCap: 670000, liquidity: 89000, chain: 'solana' },
  { symbol: 'MEW', name: 'cat in a dogs world', address: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', price: 0.0034, change24h: -8.9, volume24h: 560000, marketCap: 340000, liquidity: 23000, chain: 'solana' },
  { symbol: 'JITO', name: 'Jito', address: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', price: 3.21, change24h: -4.7, volume24h: 920000, marketCap: 1280000, liquidity: 156000, chain: 'solana' },
  { symbol: 'MSOL', name: 'Marinade SOL', address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', price: 168.45, change24h: 8.2, volume24h: 340000, marketCap: 890000, liquidity: 234000, chain: 'solana' },
  { symbol: 'MNDE', name: 'Marinade', address: 'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey', price: 0.089, change24h: -12.3, volume24h: 120000, marketCap: 89000, liquidity: 12000, chain: 'solana' },
  { symbol: 'TENSOR', name: 'Tensor', address: 'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6', price: 0.45, change24h: -6.8, volume24h: 230000, marketCap: 180000, liquidity: 34000, chain: 'solana' },
  { symbol: 'W', name: 'Wormhole', address: '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ', price: 0.52, change24h: 3.4, volume24h: 670000, marketCap: 520000, liquidity: 78000, chain: 'solana' },
  { symbol: 'KMNO', name: 'Kamino', address: 'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS', price: 0.078, change24h: -15.2, volume24h: 89000, marketCap: 78000, liquidity: 9800, chain: 'solana' },
  { symbol: 'BOME', name: 'Book of Meme', address: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82', price: 0.0067, change24h: -18.4, volume24h: 450000, marketCap: 67000, liquidity: 8900, chain: 'solana' },
  { symbol: 'SLERF', name: 'Slerf', address: '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3', price: 0.12, change24h: -22.1, volume24h: 340000, marketCap: 120000, liquidity: 15000, chain: 'solana' },
  { symbol: 'SAMO', name: 'Samoyedcoin', address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', price: 0.0089, change24h: -9.5, volume24h: 67000, marketCap: 89000, liquidity: 6700, chain: 'solana' },
  { symbol: 'STEP', name: 'Step Finance', address: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT', price: 0.034, change24h: 2.1, volume24h: 45000, marketCap: 34000, liquidity: 4500, chain: 'solana' },
  { symbol: 'FIDA', name: 'Bonfida', address: 'EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp', price: 0.21, change24h: -7.3, volume24h: 89000, marketCap: 210000, liquidity: 23000, chain: 'solana' },

  // --- Ethereum ecosystem ---
  { symbol: 'DOGE', name: 'Dogecoin', address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', price: 0.082, change24h: -3.1, volume24h: 1800000, marketCap: 11200000, liquidity: 890000, chain: 'bnb' },
  { symbol: 'SHIB', name: 'Shiba Inu', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', price: 0.0000089, change24h: -5.2, volume24h: 890000, marketCap: 5300000, liquidity: 450000, chain: 'ethereum' },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', price: 6.78, change24h: 3.8, volume24h: 1200000, marketCap: 4100000, liquidity: 670000, chain: 'ethereum' },
  { symbol: 'AAVE', name: 'Aave', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', price: 89.45, change24h: 5.6, volume24h: 560000, marketCap: 1340000, liquidity: 345000, chain: 'ethereum' },
  { symbol: 'LDO', name: 'Lido DAO', address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', price: 1.89, change24h: -11.4, volume24h: 340000, marketCap: 1690000, liquidity: 230000, chain: 'ethereum' },
  { symbol: 'ARB', name: 'Arbitrum', address: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1', price: 0.78, change24h: -8.7, volume24h: 670000, marketCap: 2500000, liquidity: 340000, chain: 'ethereum' },
  { symbol: 'OP', name: 'Optimism', address: '0x4200000000000000000000000000000000000042', price: 1.45, change24h: -6.2, volume24h: 450000, marketCap: 1780000, liquidity: 210000, chain: 'ethereum' },
  { symbol: 'LINK', name: 'Chainlink', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', price: 14.56, change24h: 7.8, volume24h: 890000, marketCap: 8500000, liquidity: 1200000, chain: 'ethereum' },
  { symbol: 'MKR', name: 'Maker', address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', price: 1456.78, change24h: 2.3, volume24h: 230000, marketCap: 1310000, liquidity: 340000, chain: 'ethereum' },
  { symbol: 'CRV', name: 'Curve DAO', address: '0xD533a949740bb3306d119CC777fa900bA034cd52', price: 0.45, change24h: -14.6, volume24h: 340000, marketCap: 560000, liquidity: 89000, chain: 'ethereum' },
  { symbol: 'ENS', name: 'ENS', address: '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72', price: 18.90, change24h: -3.4, volume24h: 120000, marketCap: 570000, liquidity: 78000, chain: 'ethereum' },
  { symbol: 'BLUR', name: 'Blur', address: '0x5283D291DBCF85356A21bA090E6db59121208b44', price: 0.23, change24h: -19.8, volume24h: 230000, marketCap: 230000, liquidity: 34000, chain: 'ethereum' },
  { symbol: 'PENDLE', name: 'Pendle', address: '0x808507121B80c02388fAd14726482e061B8da827', price: 4.56, change24h: 11.2, volume24h: 560000, marketCap: 1140000, liquidity: 156000, chain: 'ethereum' },

  // --- BNB ecosystem ---
  { symbol: 'FLOKI', name: 'Floki Inu', address: '0xfb5B838b6cfEEdC2873aB27866079AC55363D37E', price: 0.000156, change24h: 8.7, volume24h: 670000, marketCap: 1500000, liquidity: 120000, chain: 'bnb' },
  { symbol: 'CAKE', name: 'PancakeSwap', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', price: 2.34, change24h: -4.5, volume24h: 340000, marketCap: 670000, liquidity: 89000, chain: 'bnb' },
  { symbol: 'XVS', name: 'Venus', address: '0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63', price: 5.67, change24h: -7.8, volume24h: 120000, marketCap: 170000, liquidity: 23000, chain: 'bnb' },
  { symbol: 'BAKE', name: 'BakeryToken', address: '0xE02dF9e3e622DeBdD69fb838bB799E3F168902c5', price: 0.23, change24h: -13.4, volume24h: 89000, marketCap: 69000, liquidity: 12000, chain: 'bnb' },
  { symbol: 'ALPACA', name: 'Alpaca Finance', address: '0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F', price: 0.12, change24h: -16.7, volume24h: 56000, marketCap: 36000, liquidity: 8900, chain: 'bnb' },
  { symbol: 'TWT', name: 'Trust Wallet', address: '0x4B0F1812e5Df2A09796481Ff14017e6005508003', price: 1.12, change24h: 1.9, volume24h: 230000, marketCap: 470000, liquidity: 67000, chain: 'bnb' },

  // --- Base ecosystem ---
  { symbol: 'BRETT', name: 'Brett', address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', price: 0.045, change24h: 31.2, volume24h: 2100000, marketCap: 450000, liquidity: 78000, chain: 'base' },
  { symbol: 'TOSHI', name: 'Toshi', address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', price: 0.00089, change24h: -5.6, volume24h: 340000, marketCap: 89000, liquidity: 34000, chain: 'base' },
  { symbol: 'DEGEN', name: 'Degen', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', price: 0.0078, change24h: 18.9, volume24h: 890000, marketCap: 234000, liquidity: 56000, chain: 'base' },
  { symbol: 'AERO', name: 'Aerodrome', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', price: 0.89, change24h: -10.3, volume24h: 560000, marketCap: 560000, liquidity: 120000, chain: 'base' },
  { symbol: 'WELL', name: 'Moonwell', address: '0xA88594D404727625A9437C3f886C7643872296AE', price: 0.034, change24h: -21.5, volume24h: 120000, marketCap: 102000, liquidity: 15000, chain: 'base' },
  { symbol: 'HIGHER', name: 'Higher', address: '0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe', price: 0.0023, change24h: 67.8, volume24h: 450000, marketCap: 23000, liquidity: 4500, chain: 'base' },
  { symbol: 'MOCHI', name: 'Mochi', address: '0xF6e932Ca12afa26665dC4dDE7e27be02A7c02e50', price: 0.00012, change24h: -25.3, volume24h: 89000, marketCap: 12000, liquidity: 2300, chain: 'base' },
  { symbol: 'VIRTUAL', name: 'Virtual Protocol', address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', price: 1.67, change24h: 28.4, volume24h: 1200000, marketCap: 1670000, liquidity: 230000, chain: 'base' },
  { symbol: 'NORM', name: 'Normie', address: '0x7F12d13B34F5F290Dd4C6ce0339a85F4b473e5C8', price: 0.0045, change24h: -31.2, volume24h: 67000, marketCap: 45000, liquidity: 5600, chain: 'base' },
  { symbol: 'KEYCAT', name: 'Keyboard Cat', address: '0x9a26F5433671751C3276a065f57e5a02D2817973', price: 0.0034, change24h: -17.6, volume24h: 120000, marketCap: 34000, liquidity: 4500, chain: 'base' },
];

// Time-based price changes for token header
export const tokenTimeChanges = {
  '5M': 4.70,
  '1H': -5.97,
  '6H': 19.89,
  '24H': 670,
};

// Market overview metrics for Assistant page
export const marketMetrics = [
  { label: 'Fear & Greed Index', value: '62', subLabel: 'Greed', change: '+5', color: 'success' as const },
  { label: 'Crypto Total MC', value: '$2.4T', subLabel: 'Market Cap', change: '+2.3%', color: 'success' as const },
  { label: 'ETH On-chain Volume', value: '$12.5B', subLabel: '24h Volume', change: '+8.7%', color: 'success' as const },
  { label: 'BASE On-chain Volume', value: '$890M', subLabel: '24h Volume', change: '+12.4%', color: 'success' as const },
  { label: 'SOL On-chain Volume', value: '$3.2B', subLabel: '24h Volume', change: '-3.2%', color: 'destructive' as const },
  { label: 'BNB On-chain Volume', value: '$1.8B', subLabel: '24h Volume', change: '+5.1%', color: 'success' as const },
];

// Trending page stats
export const trendingStats = {
  volume24h: '$9.10B',
  txns24h: '19,537,561',
  latestBlock: '376,537,408',
  blockAge: '5s ago',
};

export const mockTransactions = [
  { date: '34s ago', time: '23:01:19', type: 'Sell' as const, price: 13.50, utility: 17202, sol: 0.0703, maker: 'EzHFbr', txn: '5x2k...' },
  { date: '36s ago', time: '23:01:17', type: 'Buy' as const, price: 28.28, utility: 35581, sol: 0.1472, maker: '2isba9w', txn: '7m3n...' },
  { date: '48s ago', time: '23:01:05', type: 'Buy' as const, price: 44.43, utility: 55977, sol: 0.2315, maker: 'cbVTk3', txn: '9p4q...' },
  { date: '1m ago', time: '23:00:53', type: 'Sell' as const, price: 8.15, utility: 10409, sol: 0.0425, maker: 'J66Hb0', txn: '2r5s...' },
  { date: '1m ago', time: '23:00:41', type: 'Buy' as const, price: 30.92, utility: 38957, sol: 0.1608, maker: 'Y1Bi1u', txn: '4t6u...' },
  { date: '2m ago', time: '22:59:48', type: 'Buy' as const, price: 22.15, utility: 28340, sol: 0.1120, maker: 'Kp9mR2', txn: '6v7w...' },
  { date: '2m ago', time: '22:59:32', type: 'Sell' as const, price: 15.67, utility: 20100, sol: 0.0812, maker: 'Lm3nP4', txn: '8x9y...' },
  { date: '3m ago', time: '22:58:55', type: 'Buy' as const, price: 51.20, utility: 65500, sol: 0.2650, maker: 'Qr5sT6', txn: '1a2b...' },
  { date: '3m ago', time: '22:58:20', type: 'Sell' as const, price: 9.88, utility: 12640, sol: 0.0510, maker: 'Uv7wX8', txn: '3c4d...' },
  { date: '4m ago', time: '22:57:45', type: 'Buy' as const, price: 37.45, utility: 47900, sol: 0.1940, maker: 'Yz9aB0', txn: '5e6f...' },
];

export const mockOpenPositions: OpenPosition[] = [
  {
    trade_id: 'pos_001',
    symbol: 'SOL',
    contract_address: 'So11111111111111111111111111111111111111112',
    amount: 2.5,
    leverage: 5,
    entryPrice: 142.30,
    currentPrice: 145.67,
    liveProfit: 42.13,
    liveProfitPercent: 11.85,
    liquidationPrice: 118.58,
    side: 'buy',
    openedAt: Date.now() - 3600000,
  },
  {
    trade_id: 'pos_002',
    symbol: 'BONK',
    contract_address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    amount: 0.5,
    leverage: 10,
    entryPrice: 0.00002250,
    currentPrice: 0.00002134,
    liveProfit: -2.58,
    liveProfitPercent: -51.56,
    liquidationPrice: 0.00002025,
    side: 'buy',
    openedAt: Date.now() - 7200000,
  },
];

export const mockTopTraders = [
  { rank: 1, address: '7xKXtg...2mNp', pnl: 125340, winRate: 78.5, trades: 342, volume: 2450000 },
  { rank: 2, address: '3pRqYz...8kLm', pnl: 98210, winRate: 72.1, trades: 256, volume: 1890000 },
  { rank: 3, address: '9wFhJn...4vBc', pnl: 87650, winRate: 69.8, trades: 198, volume: 1560000 },
  { rank: 4, address: '5tGkMp...1xQr', pnl: 76430, winRate: 74.2, trades: 167, volume: 1230000 },
  { rank: 5, address: '2nHlSw...6yDf', pnl: 65890, winRate: 67.3, trades: 289, volume: 980000 },
];

export const mockHolderData = [
  { address: '7xKXtg...2mNp', percentage: 12.5, amount: 1250000, type: 'Whale' as const },
  { address: '3pRqYz...8kLm', percentage: 8.3, amount: 830000, type: 'Whale' as const },
  { address: '9wFhJn...4vBc', percentage: 5.1, amount: 510000, type: 'Large' as const },
  { address: '5tGkMp...1xQr', percentage: 3.2, amount: 320000, type: 'Large' as const },
  { address: '2nHlSw...6yDf', percentage: 2.8, amount: 280000, type: 'Medium' as const },
  { address: 'Raydium Pool', percentage: 15.4, amount: 1540000, type: 'DEX' as const },
  { address: 'Orca Pool', percentage: 9.7, amount: 970000, type: 'DEX' as const },
];

// Social scanner posts
export const mockSocialPosts = [
  { id: 1, platform: 'Twitter', username: '@CryptoWhale', influence: 92, content: 'SOL looking incredibly bullish here. The chart structure is clean and volume is picking up. This is the kind of setup you want to be long on.', likes: 1243, comments: 89, reposts: 234 },
  { id: 2, platform: 'Twitter', username: '@DeFiAlpha', influence: 85, content: 'Just aped into SOL leverage on 0xLeverage. 5x long from $142. TP at $160. Risk management is key.', likes: 567, comments: 45, reposts: 112 },
  { id: 3, platform: 'Telegram', username: 'SolanaTrader', influence: 71, content: 'SOL breaking out of the descending wedge. Next resistance at $155. Volume confirming the move.', likes: 234, comments: 67, reposts: 56 },
  { id: 4, platform: 'Twitter', username: '@MicroCapGems', influence: 78, content: 'The SOL ecosystem is on fire right now. Every memecoin is pumping. This is just the beginning.', likes: 890, comments: 123, reposts: 345 },
  { id: 5, platform: 'Discord', username: 'alpha_hunter', influence: 65, content: 'Watching SOL closely at this level. If it holds $140 support, we could see $180+ by end of week.', likes: 156, comments: 34, reposts: 23 },
];

// Assistant chat messages
export const aiWelcomeMessage = "Hello! How can I help you today? I can analyze tokens, provide market insights, discuss trading strategies, and more.";

export const aiSampleResponses: Record<string, string> = {
  default: "I understand your question. I can help you with token analysis, market data, trading strategies, and more. What specific information are you looking for?",
  sentiment: "Based on social media analysis, SOL sentiment is currently **bullish** with a score of 82/100. Twitter mentions are up 12% in the last 24h, with key influencers posting positive analysis. The Fear & Greed index sits at 62 (Greed), suggesting continued upward momentum.",
  holders: "SOL holder distribution shows healthy diversification. Top 10 holders control 42.3% of supply. Average hold time is 45 days, indicating strong conviction. New wallet creation is up 15% week-over-week.",
  volume: "SOL 24h volume is $2.2M with a buy/sell ratio of 1.8:1 (bullish). Volume has increased 670% over the past 24 hours. The majority of volume is coming from Raydium and Jupiter DEXs.",
};

// Generate mock candlestick data
export function generateCandlestickData(days: number = 7) {
  const data = [];
  let basePrice = 140;
  const now = Math.floor(Date.now() / 1000);
  const interval = 900; // 15 min candles

  for (let i = days * 96; i >= 0; i--) {
    const time = now - i * interval;
    const volatility = 0.02;
    const drift = (Math.random() - 0.48) * volatility;
    const open = basePrice;
    const close = open * (1 + drift);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);

    data.push({
      time: time as number,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });

    basePrice = close;
  }

  return data;
}

export function generateVolumeData(candleData: ReturnType<typeof generateCandlestickData>) {
  return candleData.map((candle) => ({
    time: candle.time,
    value: Math.floor(Math.random() * 5000000) + 500000,
    color: candle.close >= candle.open
      ? 'rgba(0, 192, 135, 0.3)'
      : 'rgba(255, 71, 87, 0.3)',
  }));
}
