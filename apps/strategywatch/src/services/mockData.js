/**
 * Mock Data Generator for StrategyWatch
 * Generates realistic fake data for visual testing
 */

/**
 * Generates mock price data with varying high/low ranges
 * @param {string} ticker Stock symbol
 * @returns {object} Mock price data
 */
function generateMockPrice(ticker, index) {
  const basePrice = 50 + (index * 10); // Vary base price
  const now = Date.now();

  // Generate varied daily ranges (some tight, some wide, some very wide to exceed 100% ADR)
  // Include factors that will exceed 100% of ADR for visual testing
  const rangeFactor = [0.3, 0.6, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0][index % 8];
  const dailyRange = basePrice * 0.02 * rangeFactor; // 2% base range * factor

  const high = basePrice + (dailyRange * Math.random());
  const low = basePrice - (dailyRange * Math.random());
  const price = low + (high - low) * Math.random();

  return {
    price: Number(price.toFixed(2)),
    timestamp: now,
    open: Number((low + (high - low) * 0.3).toFixed(2)),
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
    previousClose: Number((basePrice * 0.98).toFixed(2)),
    volume: Math.floor(1000000 + Math.random() * 5000000)
  };
}

/**
 * Generates mock moving averages
 * @param {number} price Current price
 * @returns {object} Mock moving averages
 */
function generateMockMovingAverages(price, index) {
  // Create varied distances from MAs
  const ema10 = price * (0.95 + Math.random() * 0.1); // -5% to +5%
  const ema21 = price * (0.93 + Math.random() * 0.14); // -7% to +7%
  const sma50 = price * (0.90 + Math.random() * 0.15); // -10% to +5%
  const sma65 = price * (0.88 + Math.random() * 0.18); // -12% to +6%
  const sma100 = price * (0.85 + Math.random() * 0.20); // -15% to +5%

  // ADR% varies from 1.5% (low volatility) to 8.5% (high volatility)
  // Some low values to ensure we get >100% Today's Move for visual testing
  const adr20 = 1.5 + (index % 8);

  return {
    ema10: Number(ema10.toFixed(2)),
    ema21: Number(ema21.toFixed(2)),
    sma50: Number(sma50.toFixed(2)),
    sma65: Number(sma65.toFixed(2)),
    sma100: Number(sma100.toFixed(2)),
    adr20: Number(adr20.toFixed(2))
  };
}

/**
 * Generates mock 5M ORB data with varied tiers
 * @param {number} index Ticker index for variation
 * @param {number} price Current price
 * @returns {object} Mock 5M ORB data
 */
function generateMock5mORB(index, price) {
  // Cycle through tiers: null, 0, 1, 2
  const tierCycle = [null, 0, 1, 2, 1, 2, 0, 1];
  const tier = tierCycle[index % tierCycle.length];

  if (tier === null) {
    return {
      candle: null,
      historicalCandles: [],
      tier: null
    };
  }

  // Generate a 5m candle
  // For some tiers (2, 4, 5), make current price above ORB high to show breakout border
  const hasBreakout = (index % tierCycle.length === 2 || index % tierCycle.length === 4 || index % tierCycle.length === 5);

  let orbHigh, orbLow, orbOpen, orbClose;

  if (hasBreakout) {
    // Price has broken above ORB high - show border
    orbHigh = price * 0.998; // ORB high below current price
    orbLow = price * 0.990;
    orbOpen = price * 0.991;
    orbClose = price * 0.997;
  } else {
    // Normal ORB - price still within or below range
    orbHigh = price * 1.005; // ORB high slightly above current price
    orbLow = price * 0.995; // ORB low slightly below
    orbOpen = price * 0.996;
    orbClose = price * 1.004;
  }

  const candle = {
    open: Number(orbOpen.toFixed(2)),
    high: Number(orbHigh.toFixed(2)),
    low: Number(orbLow.toFixed(2)),
    close: Number(orbClose.toFixed(2)),
    volume: Math.floor(500000 + Math.random() * 2000000),
    timestamp: Date.now() - (60 * 60 * 1000) // 1 hour ago
  };

  // Generate some historical candles
  const historicalCandles = Array.from({ length: 20 }, (_, i) => ({
    open: Number((price * 0.98).toFixed(2)),
    high: Number((price * 1.01).toFixed(2)),
    low: Number((price * 0.97).toFixed(2)),
    close: Number((price * 1.00).toFixed(2)),
    volume: Math.floor(300000 + Math.random() * 1000000),
    timestamp: Date.now() - ((i + 2) * 24 * 60 * 60 * 1000)
  }));

  return {
    candle,
    historicalCandles,
    tier
  };
}

/**
 * Generates complete mock data for all tickers
 * @param {string[]} tickers Array of ticker symbols
 * @returns {object} Complete mock data structure
 */
export function generateMockData(tickers) {
  const pricesMap = {};
  const movingAveragesMap = {};
  const orb5mDataMap = {};

  tickers.forEach((ticker, index) => {
    const priceData = generateMockPrice(ticker, index);
    pricesMap[ticker] = priceData;
    movingAveragesMap[ticker] = generateMockMovingAverages(priceData.price, index);
    orb5mDataMap[ticker] = generateMock5mORB(index, priceData.price);
  });

  return {
    prices: pricesMap,
    movingAverages: movingAveragesMap,
    orb5mData: orb5mDataMap,
    connected: true,
    marketOpen: true,
    loading: false,
    error: null
  };
}
