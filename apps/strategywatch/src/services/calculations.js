import { HISTORICAL_CONFIG } from '../config/constants';
import { announce } from '../utils/voiceAlerts';
import { calculateSingleCandleRVol } from '../utils/rvolCalculations';

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
 * @returns {object} Object with sma5, ema10, ema21, sma50, sma65, sma100, sma200
 */
export function getMovingAverages(dailyCandles) {
  if (!dailyCandles || !dailyCandles.c || dailyCandles.c.length === 0) {
    return {
      sma5: null,
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
    sma5: calculateSMA(closes, HISTORICAL_CONFIG.SMA_5_PERIOD),
    ema10: calculateEMA(closes, HISTORICAL_CONFIG.EMA_10_PERIOD),
    ema21: calculateEMA(closes, HISTORICAL_CONFIG.EMA_21_PERIOD),
    sma50: calculateSMA(closes, HISTORICAL_CONFIG.SMA_50_PERIOD),
    sma65: calculateSMA(closes, HISTORICAL_CONFIG.SMA_65_PERIOD),
    sma100: calculateSMA(closes, HISTORICAL_CONFIG.SMA_100_PERIOD),
    sma200: calculateSMA(closes, HISTORICAL_CONFIG.SMA_200_PERIOD)
  };
}

/**
 * Calculates Average Daily Range as a percentage (ADR%)
 * Matches TradingView's formula by ArmerSchlucker/MikeC/TheScrutiniser:
 * ADR% = 100 * (SMA(high / low, period) - 1)
 *
 * This measures the average percentage range (high to low ratio) over N days.
 * More accurate than dollar-based ranges as it's already normalized.
 *
 * @param {object} dailyCandles Candle data with {h: [highs], l: [lows]}
 * @param {number} period Number of days to average (default: 20)
 * @returns {number} ADR as percentage
 */
export function calculateADRPercent(dailyCandles, period = 20) {
  if (!dailyCandles || !dailyCandles.h || !dailyCandles.l) {
    return null;
  }

  if (dailyCandles.h.length < period || dailyCandles.l.length < period) {
    return null;
  }

  // Calculate high/low ratios for each day
  const ratios = dailyCandles.h.map((high, i) => {
    const low = dailyCandles.l[i];
    // Prevent division by zero
    if (low === 0 || !low) return 1;
    return high / low;
  });

  // Get simple moving average of the ratios
  const avgRatio = calculateSMA(ratios, period);

  if (!avgRatio) {
    return null;
  }

  // Convert to percentage: (avgRatio - 1) * 100
  return (avgRatio - 1) * 100;
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

/**
 * Evaluates the first 5-minute candle (9:30-9:35 ET) based on TradingView Pine Script criteria
 * Returns tier level: null (no data), 0 (doesn't qualify), 1 (tier-1: light green), 2 (tier-2: dark green)
 *
 * Matches the logic from "Andy's US Opening 5m Candle Highlighter" indicator:
 * - Open position <= 20% of range (opens near low)
 * - Close position >= 80% of range (closes near high)
 * - Body >= 55% of range
 * - Green candle (close > open)
 * - RVOL tier-1 >= 0.25x (light green)
 * - RVOL tier-2 >= 1.50x (dark green)
 *
 * @param {object} params
 * @param {object} params.first5mCandle The 9:30-9:35 ET candle {open, high, low, close, volume}
 * @param {object[]} params.historicalFirst5mCandles Array of historical first 5m candles for RVOL calc
 * @param {object} params.config Optional config overrides {lowerQuantile, upperQuantile, minBodyFrac, rvolTier1, rvolTier2, minSamples}
 * @returns {number|null} null (no data), 0 (no match), 1 (tier-1), 2 (tier-2)
 */
export function evaluate5mORB({
  first5mCandle,
  historicalFirst5mCandles = [],
  config = {}
}) {
  // Default Pine Script parameters
  const {
    lowerQuantile = 0.20,
    upperQuantile = 0.80,
    minBodyFrac = 0.55,
    requireGreen = true,
    rvolTier1 = 0.25,
    rvolTier2 = 1.50,
    minSamples = 10
  } = config;

  // No data yet
  if (!first5mCandle) {
    return null;
  }

  const { open, high, low, close, volume } = first5mCandle;

  // Validate candle data
  if (
    open === null || open === undefined ||
    high === null || high === undefined ||
    low === null || low === undefined ||
    close === null || close === undefined ||
    volume === null || volume === undefined
  ) {
    return null;
  }

  // === PRICE CRITERIA (priceOK in Pine Script) ===

  const range = high - low;

  // Range check (rngOK) - must have some range
  if (range <= 0) {
    return 0;
  }

  // Open position in range (should be <= 20%)
  const openPos = (open - low) / range;
  const openLowQ = openPos <= lowerQuantile;

  // Close position in range (should be >= 80%)
  const closePos = (close - low) / range;
  const closeHighQ = closePos >= upperQuantile;

  // Body ratio (body >= 55% of range)
  const body = Math.abs(close - open);
  const bodyOK = body >= range * minBodyFrac;

  // Green candle check
  const greenOK = requireGreen ? close > open : true;

  // Combined price check
  const priceOK = openLowQ && closeHighQ && bodyOK && greenOK;

  if (!priceOK) {
    return 0; // Doesn't meet price criteria
  }

  // === RVOL CALCULATION (TRUE opening-bar RVOL) ===

  // Extract historical volumes
  const historicalVolumes = historicalFirst5mCandles
    .map(candle => candle?.volume)
    .filter(vol => vol !== null && vol !== undefined && vol > 0);

  // Not enough samples
  if (historicalVolumes.length < minSamples) {
    return 0; // Can't calculate RVOL without enough history
  }

  // Use shared RVol calculation utility
  const rvolResult = calculateSingleCandleRVol(volume, historicalVolumes);

  if (rvolResult.error || rvolResult.rvol === null) {
    return 0; // Can't calculate RVOL
  }

  const rvol = rvolResult.rvol;

  // === TIER EVALUATION ===

  // Tier-2: RVOL >= 1.50x
  if (rvol >= rvolTier2) {
    return 2;
  }

  // Tier-1: RVOL >= 0.25x
  if (rvol >= rvolTier1) {
    return 1;
  }

  // Doesn't meet RVOL threshold
  return 0;
}

/**
 * Gets detailed 5m ORB information for debugging/display
 * @param {object} params Same as evaluate5mORB
 * @returns {object} Detailed breakdown
 */
export function get5mORBDetails({
  first5mCandle,
  historicalFirst5mCandles = [],
  config = {}
}) {
  const tier = evaluate5mORB({ first5mCandle, historicalFirst5mCandles, config });

  if (!first5mCandle) {
    return {
      tier: null,
      status: 'No data',
      rvol: null,
      priceOK: false
    };
  }

  const { open, high, low, close, volume } = first5mCandle;
  const range = high - low;

  if (range <= 0) {
    return {
      tier: 0,
      status: 'No range',
      rvol: null,
      priceOK: false
    };
  }

  const openPos = (open - low) / range;
  const closePos = (close - low) / range;
  const body = Math.abs(close - open);
  const bodyRatio = body / range;

  const historicalVolumes = historicalFirst5mCandles
    .map(candle => candle?.volume)
    .filter(vol => vol !== null && vol !== undefined && vol > 0);

  let rvol = null;
  if (historicalVolumes.length > 0) {
    const rvolResult = calculateSingleCandleRVol(volume, historicalVolumes);
    rvol = rvolResult.rvol;
  }

  const openLowQ = openPos <= (config.lowerQuantile || 0.20);
  const closeHighQ = closePos >= (config.upperQuantile || 0.80);
  const bodyOK = bodyRatio >= (config.minBodyFrac || 0.55);
  const greenOK = close > open;
  const priceOK = openLowQ && closeHighQ && bodyOK && greenOK;

  return {
    tier,
    status: tier === 2 ? 'Tier-2' : tier === 1 ? 'Tier-1' : tier === 0 ? 'No match' : 'No data',
    rvol: rvol !== null ? rvol.toFixed(2) : 'N/A',
    priceOK,
    openPos: (openPos * 100).toFixed(1) + '%',
    closePos: (closePos * 100).toFixed(1) + '%',
    bodyRatio: (bodyRatio * 100).toFixed(1) + '%',
    isGreen: greenOK,
    historicalSamples: historicalVolumes.length
  };
}

/**
 * Checks if current price is close to any Moving Average based on ADR% threshold
 * Highlights MA levels when price is within ±5% (green) or ±10% (amber) of 20D ADR%
 *
 * @param {number} currentPrice Current stock price
 * @param {number} maValue Moving average value to check
 * @param {number} adrPercent 20-Day ADR percentage
 * @returns {object} { isClose: boolean, isModeratelyClose: boolean, distancePercent: number, greenThreshold: number, amberThreshold: number }
 */
export function checkPriceProximityToMA(currentPrice, maValue, adrPercent) {
  if (!currentPrice || !maValue || !adrPercent) {
    return {
      isClose: false,
      isModeratelyClose: false,
      distancePercent: 0,
      greenThreshold: 0,
      amberThreshold: 0
    };
  }

  // Calculate thresholds:
  // Green box: ±5% of 20D ADR% (ADR% / 20 = ADR% * 0.05)
  // Amber box: ±10% of 20D ADR% (ADR% / 10 = ADR% * 0.10)
  const greenThreshold = adrPercent / 20;  // ±5%
  const amberThreshold = adrPercent / 10;  // ±10%

  // Calculate actual distance percentage
  const distancePercent = Math.abs(((currentPrice - maValue) / maValue) * 100);

  // Check if price is within thresholds
  const isClose = distancePercent <= greenThreshold;
  const isModeratelyClose = distancePercent <= amberThreshold;

  return {
    isClose,
    isModeratelyClose,
    distancePercent,
    greenThreshold,
    amberThreshold
  };
}

// Store announced ADR milestones to avoid duplicates
const announcedMilestones = new Set();

/**
 * Checks and announces ADR milestones for today's price movement
 * @param {object} params
 * @param {string} params.symbol Stock symbol
 * @param {number} params.currentPrice Current price
 * @param {number} params.dayOpen Opening price of the day
 * @param {number} params.adrPercent 20-day Average Daily Range percentage
 * @returns {number} Current move as percentage of ADR
 */
export function checkAndAnnounceADRMilestone({
  symbol,
  currentPrice,
  dayOpen,
  adrPercent
}) {
  if (!currentPrice || !dayOpen || !adrPercent || adrPercent === 0) {
    return 0;
  }

  // Calculate today's move as percentage of ADR
  const todayMovePercent = Math.abs(calculatePercentDifference(currentPrice, dayOpen));
  const adrRatio = todayMovePercent / adrPercent;
  const adrPercentage = Math.round(adrRatio * 100);

  // Define milestone thresholds
  const milestones = [75, 100, 150, 200, 300, 400, 500];

  // Check if any milestone is reached
  for (const milestone of milestones) {
    const milestoneKey = `${symbol}-${milestone}`;

    if (adrPercentage >= milestone && !announcedMilestones.has(milestoneKey)) {
      announce(`${symbol} today's move is now at ${milestone}% of 20D ADR`, symbol);
      announcedMilestones.add(milestoneKey);

      // Clean up old milestones (keep current day's data)
      if (milestone >= 100) {
        // Once we hit 100%, we can announce higher milestones too
        break;
      }
    }
  }

  return adrPercentage;
}

/**
 * Resets announced milestones for a new trading day
 * Call this at market open or when resetting data
 */
export function resetADRMilestones() {
  announcedMilestones.clear();
}

/**
 * Evaluates the first 5-minute candle (9:30-9:35 ET) for BEARISH opening candles
 * Returns tier level: null (no data), 0 (doesn't qualify), 1 (tier-1: light red), 2 (tier-2: dark red)
 *
 * Bearish version of evaluate5mORB - mirrors the bullish logic but for strong downward moves:
 * - Open position >= 80% of range (opens near high)
 * - Close position <= 20% of range (closes near low)
 * - Body >= 55% of range
 * - Red candle (close < open)
 * - RVOL tier-1 >= 0.25x (light red)
 * - RVOL tier-2 >= 1.50x (dark red)
 *
 * @param {object} params
 * @param {object} params.first5mCandle The 9:30-9:35 ET candle {open, high, low, close, volume}
 * @param {object[]} params.historicalFirst5mCandles Array of historical first 5m candles for RVOL calc
 * @param {object} params.config Optional config overrides {lowerQuantile, upperQuantile, minBodyFrac, rvolTier1, rvolTier2, minSamples}
 * @returns {number|null} null (no data), 0 (no match), 1 (tier-1), 2 (tier-2)
 */
export function evaluate5mORBBearish({
  first5mCandle,
  historicalFirst5mCandles = [],
  config = {}
}) {
  // Default Pine Script parameters (mirrored for bearish)
  const {
    lowerQuantile = 0.20,
    upperQuantile = 0.80,
    minBodyFrac = 0.55,
    requireGreen = false, // We want red candles
    rvolTier1 = 0.25,
    rvolTier2 = 1.50,
    minSamples = 10
  } = config;

  // No data yet
  if (!first5mCandle) {
    return null;
  }

  const { open, high, low, close, volume } = first5mCandle;

  // Validate candle data
  if (
    open === null || open === undefined ||
    high === null || high === undefined ||
    low === null || low === undefined ||
    close === null || close === undefined ||
    volume === null || volume === undefined
  ) {
    return null;
  }

  // === PRICE CRITERIA (priceOK in Pine Script - BEARISH VERSION) ===

  const range = high - low;

  // Range check (rngOK) - must have some range
  if (range <= 0) {
    return 0;
  }

  // Open position in range (should be >= 80% for bearish)
  const openPos = (open - low) / range;
  const openHighQ = openPos >= upperQuantile;

  // Close position in range (should be <= 20% for bearish)
  const closePos = (close - low) / range;
  const closeLowQ = closePos <= lowerQuantile;

  // Body ratio (body >= 55% of range)
  const body = Math.abs(close - open);
  const bodyOK = body >= range * minBodyFrac;

  // Red candle check (close < open for bearish)
  const redOK = !requireGreen ? close < open : true;

  // Combined price check for bearish
  const priceOK = openHighQ && closeLowQ && bodyOK && redOK;

  if (!priceOK) {
    return 0; // Doesn't meet price criteria
  }

  // === RVOL CALCULATION (TRUE opening-bar RVOL) ===

  // Extract historical volumes
  const historicalVolumes = historicalFirst5mCandles
    .map(candle => candle?.volume)
    .filter(vol => vol !== null && vol !== undefined && vol > 0);

  // Not enough samples
  if (historicalVolumes.length < minSamples) {
    return 0; // Can't calculate RVOL without enough history
  }

  // Use shared RVol calculation utility
  const rvolResult = calculateSingleCandleRVol(volume, historicalVolumes);

  if (rvolResult.error || rvolResult.rvol === null) {
    return 0; // Can't calculate RVOL
  }

  const rvol = rvolResult.rvol;

  // === TIER EVALUATION ===

  // Tier-2: RVOL >= 1.50x (very bearish)
  if (rvol >= rvolTier2) {
    return 2;
  }

  // Tier-1: RVOL >= 0.25x (bearish)
  if (rvol >= rvolTier1) {
    return 1;
  }

  // Doesn't meet RVOL threshold
  return 0;
}

/**
 * Gets detailed 5m ORB bearish information for debugging/display
 * @param {object} params Same as evaluate5mORBBearish
 * @returns {object} Detailed breakdown
 */
export function get5mORBBearishDetails({
  first5mCandle,
  historicalFirst5mCandles = [],
  config = {}
}) {
  const tier = evaluate5mORBBearish({ first5mCandle, historicalFirst5mCandles, config });

  if (!first5mCandle) {
    return {
      tier: null,
      status: 'No data',
      rvol: null,
      priceOK: false
    };
  }

  const { open, high, low, close, volume } = first5mCandle;
  const range = high - low;

  if (range <= 0) {
    return {
      tier: 0,
      status: 'No range',
      rvol: null,
      priceOK: false
    };
  }

  const openPos = (open - low) / range;
  const closePos = (close - low) / range;
  const body = Math.abs(close - open);
  const bodyRatio = body / range;

  const historicalVolumes = historicalFirst5mCandles
    .map(candle => candle?.volume)
    .filter(vol => vol !== null && vol !== undefined && vol > 0);

  let rvol = null;
  if (historicalVolumes.length > 0) {
    const rvolResult = calculateSingleCandleRVol(volume, historicalVolumes);
    rvol = rvolResult.rvol;
  }

  const openHighQ = openPos >= (config.upperQuantile || 0.80);
  const closeLowQ = closePos <= (config.lowerQuantile || 0.20);
  const bodyOK = bodyRatio >= (config.minBodyFrac || 0.55);
  const redOK = close < open;
  const priceOK = openHighQ && closeLowQ && bodyOK && redOK;

  return {
    tier,
    status: tier === 2 ? 'Tier-2 (Very Bearish)' : tier === 1 ? 'Tier-1 (Bearish)' : tier === 0 ? 'No match' : 'No data',
    rvol: rvol !== null ? rvol.toFixed(2) : 'N/A',
    priceOK,
    openPos: (openPos * 100).toFixed(1) + '%',
    closePos: (closePos * 100).toFixed(1) + '%',
    bodyRatio: (bodyRatio * 100).toFixed(1) + '%',
    isRed: redOK,
    historicalSamples: historicalVolumes.length
  };
}

/**
 * Calculates 5-minute ADR%-Normalized Relative Strength (VRS)
 * Compares a stock's 5m % change (normalized by its ADR%) against a benchmark's 5m % change (normalized by benchmark's ADR%)
 *
 * Formula:
 * VRS = (ΔC_Stock% / ADR_Stock%) - (ΔC_Benchmark% / ADR_Benchmark%)
 *
 * Where:
 * - ΔC% = (CurrentClose - PreviousClose) / PreviousClose
 * - ADR% = 20-Day Average Daily Range percentage (in decimal form, e.g., 0.02 for 2%)
 *
 * @param {object} params
 * @param {number} params.stockCurrentClose Current 5m close price of stock
 * @param {number} params.stockPreviousClose Previous 5m close price of stock
 * @param {number} params.stockADRPercent Stock's 20D ADR% (in decimal, e.g., 0.02 for 2%)
 * @param {number} params.benchmarkCurrentClose Current 5m close price of benchmark (e.g., QQQ)
 * @param {number} params.benchmarkPreviousClose Previous 5m close price of benchmark
 * @param {number} params.benchmarkADRPercent Benchmark's 20D ADR% (in decimal, e.g., 0.02 for 2%)
 * @returns {number|null} VRS value (positive = outperformance, negative = underperformance) or null if invalid inputs
 */
export function calculateVRS5m({
  stockCurrentClose,
  stockPreviousClose,
  stockADRPercent,
  benchmarkCurrentClose,
  benchmarkPreviousClose,
  benchmarkADRPercent
}) {
  // Validate all inputs
  if (
    stockCurrentClose === null || stockCurrentClose === undefined ||
    stockPreviousClose === null || stockPreviousClose === undefined ||
    benchmarkCurrentClose === null || benchmarkCurrentClose === undefined ||
    benchmarkPreviousClose === null || benchmarkPreviousClose === undefined
  ) {
    return null;
  }

  // ADR% must be positive and non-zero
  if (!stockADRPercent || stockADRPercent <= 0 || !benchmarkADRPercent || benchmarkADRPercent <= 0) {
    return null;
  }

  // Prevent division by zero
  if (stockPreviousClose === 0 || benchmarkPreviousClose === 0) {
    return null;
  }

  // Calculate 5m % change for stock
  const stockChangePercent = (stockCurrentClose - stockPreviousClose) / stockPreviousClose;

  // Calculate 5m % change for benchmark
  const benchmarkChangePercent = (benchmarkCurrentClose - benchmarkPreviousClose) / benchmarkPreviousClose;

  // Calculate VRS: normalized difference
  const vrs = (stockChangePercent / stockADRPercent) - (benchmarkChangePercent / benchmarkADRPercent);

  return vrs;
}

/**
 * Calculates 12-period Exponential Moving Average of VRS values
 * Uses α = 2/(N+1) = 2/13 ≈ 0.1538 for N=12
 *
 * Formula:
 * EMA_t = (VRS_t × α) + (EMA_t-1 × (1 - α))
 *
 * @param {number[]} vrsValues Array of VRS values (oldest to newest)
 * @param {number} period EMA period (default: 12)
 * @returns {number|null} EMA value or null if insufficient data
 */
export function calculateVRSEMA(vrsValues, period = 12) {
  if (!vrsValues || vrsValues.length === 0) {
    return null;
  }

  // For fewer values than period, still calculate EMA but note it's not fully "warmed up"
  // Initialize with first value
  const alpha = 2 / (period + 1);
  let ema = vrsValues[0];

  // Apply EMA formula iteratively
  for (let i = 1; i < vrsValues.length; i++) {
    ema = (vrsValues[i] * alpha) + (ema * (1 - alpha));
  }

  return ema;
}
