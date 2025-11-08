import { HISTORICAL_CONFIG } from '../config/constants';

/**
 * Calculates Exponential Moving Average (EMA)
 * @param {number[]} prices Array of prices (oldest to newest)
 * @param {number} period EMA period
 * @returns {number} EMA value
 */
export function calculateEMA(prices, period) {
  if (!prices || prices.length < period) {
    return null;
  }

  const k = 2 / (period + 1); // Smoothing factor
  let ema = prices[0]; // Start with first price

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
}

/**
 * Calculates Simple Moving Average (SMA)
 * @param {number[]} prices Array of prices
 * @param {number} period SMA period
 * @returns {number} SMA value
 */
export function calculateSMA(prices, period) {
  if (!prices || prices.length < period) {
    return null;
  }

  const slice = prices.slice(-period);
  const sum = slice.reduce((acc, price) => acc + price, 0);
  return sum / period;
}

/**
 * Calculates all moving averages from daily candles
 * Matches TradingView's standard EMA/SMA calculations
 * @param {object} dailyCandles Candle data with {c: [closes], ...}
 * @returns {object} Object with ema10, ema21, sma50, sma65, sma100, sma200
 */
export function getMovingAverages(dailyCandles) {
  if (!dailyCandles || !dailyCandles.c || dailyCandles.c.length === 0) {
    return {
      ema10: null,
      ema21: null,
      sma50: null,
      sma65: null,
      sma100: null,
      sma200: null
    };
  }

  const closes = dailyCandles.c;

  return {
    ema10: calculateEMA(closes, HISTORICAL_CONFIG.EMA_10_PERIOD),
    ema21: calculateEMA(closes, HISTORICAL_CONFIG.EMA_21_PERIOD),
    sma50: calculateSMA(closes, HISTORICAL_CONFIG.SMA_50_PERIOD),
    sma65: calculateSMA(closes, HISTORICAL_CONFIG.SMA_65_PERIOD),
    sma100: calculateSMA(closes, HISTORICAL_CONFIG.SMA_100_PERIOD),
    sma200: calculateSMA(closes, HISTORICAL_CONFIG.SMA_200_PERIOD)
  };
}

/**
 * Calculates the average volume for the first 5 minutes across multiple days
 * Used for ORB strategy to determine if today's first 5m volume is significant
 * @param {object[]} historicalFirst5mCandles Array of first 5m candles from past days
 * @returns {number} Average first 5m volume
 */
export function calculateAvgFirst5mVolume(historicalFirst5mCandles) {
  if (!historicalFirst5mCandles || historicalFirst5mCandles.length === 0) {
    return null;
  }

  const volumes = historicalFirst5mCandles
    .map(candle => candle.volume)
    .filter(vol => vol !== null && vol !== undefined);

  if (volumes.length === 0) {
    return null;
  }

  const sum = volumes.reduce((acc, vol) => acc + vol, 0);
  return sum / volumes.length;
}

/**
 * Checks if volume is currently increasing (compared to recent bars)
 * @param {number[]} recentVolumes Array of recent volume values (oldest to newest)
 * @param {number} lookbackBars Number of bars to compare (default: 5)
 * @returns {boolean} True if current volume > average of recent bars
 */
export function isVolumeIncreasing(recentVolumes, lookbackBars = 5) {
  if (!recentVolumes || recentVolumes.length < lookbackBars + 1) {
    return false;
  }

  const currentVolume = recentVolumes[recentVolumes.length - 1];
  const previousVolumes = recentVolumes.slice(-lookbackBars - 1, -1);
  const avgPreviousVolume = previousVolumes.reduce((a, b) => a + b, 0) / previousVolumes.length;

  return currentVolume > avgPreviousVolume;
}

/**
 * Calculates percentage difference between two values
 * @param {number} value Current value
 * @param {number} reference Reference value
 * @returns {number} Percentage difference
 */
export function calculatePercentDifference(value, reference) {
  if (!reference || reference === 0) {
    return 0;
  }
  return ((value - reference) / reference) * 100;
}

/**
 * Calculates the range of a candle as percentage of price
 * @param {object} candle Candle data with {high, low, close}
 * @returns {number} Range as percentage
 */
export function calculateCandleRangePercent(candle) {
  if (!candle || !candle.high || !candle.low || !candle.close) {
    return 0;
  }

  const range = candle.high - candle.low;
  return (range / candle.close) * 100;
}

/**
 * Calculates where the close is within the candle range (0-1)
 * 0 = close at low, 1 = close at high
 * @param {object} candle Candle data with {high, low, close}
 * @returns {number} Body ratio (0-1)
 */
export function calculateBodyRatio(candle) {
  if (!candle || !candle.high || !candle.low || !candle.close) {
    return 0;
  }

  const range = candle.high - candle.low;
  if (range === 0) {
    return 0;
  }

  return (candle.close - candle.low) / range;
}
