// Watchlist configuration - modify this array to track different stocks

// ===== HIGH-FREQUENCY WATCHLIST (10 stocks) =====
// Most liquid stocks - updates every 1-3 seconds on Finnhub free tier
export const WATCHLIST = [
  'SPY',    // S&P 500 ETF - Most liquid
  'AAPL',   // Apple
  'TSLA',   // Tesla - High volatility
  'NVDA',   // NVIDIA
  'MSFT',   // Microsoft
  'AMZN',   // Amazon
  'META',   // Meta
  'QQQ',    // Nasdaq 100 ETF
  'AMD',    // AMD
  'GOOGL',  // Google
];

// ===== FULL WATCHLIST (30 stocks) =====
// More tickers = slower updates (20-30 sec delays on free tier)
// To use this list: comment out above and uncomment below
/*
export const WATCHLIST = [
  'AAPL',   // Apple
  'TSLA',   // Tesla
  'NVDA',   // NVIDIA
  'AMD',    // Advanced Micro Devices
  'MSFT',   // Microsoft
  'GOOGL',  // Alphabet (Google)
  'AMZN',   // Amazon
  'META',   // Meta (Facebook)
  'NFLX',   // Netflix
  'SPY',    // S&P 500 ETF
  'QQQ',    // Nasdaq 100 ETF
  'INTC',   // Intel
  'BABA',   // Alibaba
  'DIS',    // Disney
  'BA',     // Boeing
  'COIN',   // Coinbase
  'PLTR',   // Palantir
  'SOFI',   // SoFi
  'HOOD',   // Robinhood
  'F',      // Ford
  'GM',     // General Motors
  'NIO',    // NIO
  'LCID',   // Lucid
  'RIVN',   // Rivian
  'UPST',   // Upstart
  'SQ',     // Block (Square)
  'PYPL',   // PayPal
  'V',      // Visa
  'MA',     // Mastercard
  'JPM',    // JPMorgan Chase
];
*/

export default WATCHLIST;
