
import { HISTORICAL_CONFIG } from '../config/constants';
import { announce } from '../utils/voiceAlerts';
import { calculateSingleCandleRVol } from '../utils/rvolCalculations';
import { Bar } from '../types/types';

export function calculateEMA(prices: number[], period: number): number | null {
  if (!prices || prices.length < period) {
    return null;
  }

  const k = 2 / (period + 1);
  let ema = prices[0];

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
}

export function calculateSMA(prices: number[], period: number): number | null {
  if (!prices || prices.length < period) {
    return null;
  }

  const slice = prices.slice(-period);
  const sum = slice.reduce((acc, price) => acc + price, 0);
  return sum / period;
}

interface MovingAverages {
  sma5: number | null;
  ema10: number | null;
  ema21: number | null;
  sma50: number | null;
  sma65: number | null;
  sma100: number | null;
  sma200: number | null;
}

export function getMovingAverages(dailyCandles: { c: number[] }): MovingAverages {
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

export function calculateADRPercent(dailyCandles: { h: number[], l: number[] }, period: number = 20): number | null {
  if (!dailyCandles || !dailyCandles.h || !dailyCandles.l) {
    return null;
  }

  if (dailyCandles.h.length < period || dailyCandles.l.length < period) {
    return null;
  }

  const ratios = dailyCandles.h.map((high, i) => {
    const low = dailyCandles.l[i];
    if (low === 0 || !low) return 1;
    return high / low;
  });

  const avgRatio = calculateSMA(ratios, period);

  if (!avgRatio) {
    return null;
  }

  return (avgRatio - 1) * 100;
}

export function calculateAvgFirst5mVolume(historicalFirst5mCandles: Bar[]): number | null {
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

export function isVolumeIncreasing(recentVolumes: number[], lookbackBars: number = 5): boolean {
  if (!recentVolumes || recentVolumes.length < lookbackBars + 1) {
    return false;
  }

  const currentVolume = recentVolumes[recentVolumes.length - 1];
  const previousVolumes = recentVolumes.slice(-lookbackBars - 1, -1);
  const avgPreviousVolume = previousVolumes.reduce((a, b) => a + b, 0) / previousVolumes.length;

  return currentVolume > avgPreviousVolume;
}

export function calculatePercentDifference(value: number, reference: number): number {
  if (!reference || reference === 0) {
    return 0;
  }
  return ((value - reference) / reference) * 100;
}

export function calculateCandleRangePercent(candle: Bar): number {
  if (!candle || !candle.high || !candle.low || !candle.close) {
    return 0;
  }

  const range = candle.high - candle.low;
  return (range / candle.close) * 100;
}

export function calculateBodyRatio(candle: Bar): number {
  if (!candle || !candle.high || !candle.low || !candle.close) {
    return 0;
  }

  const range = candle.high - candle.low;
  if (range === 0) {
    return 0;
  }

  return (candle.close - candle.low) / range;
}

interface ORBParams {
  first5mCandle: Bar | null;
  historicalFirst5mCandles: Bar[];
  config?: Partial<ORBConfig>;
}

interface ORBConfig {
  lowerQuantile: number;
  upperQuantile: number;
  minBodyFrac: number;
  requireGreen: boolean;
  rvolTier1: number;
  rvolTier2: number;
  minSamples: number;
}

export function evaluate5mORB({ first5mCandle, historicalFirst5mCandles = [], config = {} }: ORBParams): number | null {
  const {
    lowerQuantile = 0.20,
    upperQuantile = 0.80,
    minBodyFrac = 0.55,
    requireGreen = true,
    rvolTier1 = 0.25,
    rvolTier2 = 1.50,
    minSamples = 10
  } = config;

  if (!first5mCandle) {
    return null;
  }

  const { open, high, low, close, volume } = first5mCandle;

  if (
    open === null || open === undefined ||
    high === null || high === undefined ||
    low === null || low === undefined ||
    close === null || close === undefined ||
    volume === null || volume === undefined
  ) {
    return null;
  }

  const range = high - low;

  if (range <= 0) {
    return 0;
  }

  const openPos = (open - low) / range;
  const openLowQ = openPos <= lowerQuantile;

  const closePos = (close - low) / range;
  const closeHighQ = closePos >= upperQuantile;

  const body = Math.abs(close - open);
  const bodyOK = body >= range * minBodyFrac;

  const greenOK = requireGreen ? close > open : true;

  const priceOK = openLowQ && closeHighQ && bodyOK && greenOK;

  if (!priceOK) {
    return 0;
  }

  const historicalVolumes = historicalFirst5mCandles
    .map(candle => candle?.volume)
    .filter((vol): vol is number => vol !== null && vol !== undefined && vol > 0);

  if (historicalVolumes.length < minSamples) {
    return 0;
  }

  const rvolResult = calculateSingleCandleRVol(volume, historicalVolumes);

  if (rvolResult.error || rvolResult.rvol === null) {
    return 0;
  }

  const rvol = rvolResult.rvol;

  if (rvol >= rvolTier2) {
    return 2;
  }

  if (rvol >= rvolTier1) {
    return 1;
  }

  return 0;
}

export function get5mORBDetails({ first5mCandle, historicalFirst5mCandles = [], config = {} }: ORBParams) {
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
    .filter((vol): vol is number => vol !== null && vol !== undefined && vol > 0);

  let rvol: number | null = null;
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

export function checkPriceProximityToMA(currentPrice: number, maValue: number, adrPercent: number) {
  if (!currentPrice || !maValue || !adrPercent) {
    return {
      isClose: false,
      isModeratelyClose: false,
      distancePercent: 0,
      greenThreshold: 0,
      amberThreshold: 0
    };
  }

  const greenThreshold = adrPercent / 20;
  const amberThreshold = adrPercent / 10;

  const distancePercent = Math.abs(((currentPrice - maValue) / maValue) * 100);

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

const announcedMilestones = new Set<string>();

interface ADRAnnounceParams {
  symbol: string;
  currentPrice: number;
  dayOpen: number;
  adrPercent: number;
}

export function checkAndAnnounceADRMilestone({ symbol, currentPrice, dayOpen, adrPercent }: ADRAnnounceParams): number {
  if (!currentPrice || !dayOpen || !adrPercent || adrPercent === 0) {
    return 0;
  }

  const todayMovePercent = Math.abs(calculatePercentDifference(currentPrice, dayOpen));
  const adrRatio = todayMovePercent / adrPercent;
  const adrPercentage = Math.round(adrRatio * 100);

  const milestones = [75, 100, 150, 200, 300, 400, 500];

  for (const milestone of milestones) {
    const milestoneKey = `${symbol}-${milestone}`;

    if (adrPercentage >= milestone && !announcedMilestones.has(milestoneKey)) {
      announce(`${symbol} today's move is now at ${milestone}% of 20D ADR`, symbol);
      announcedMilestones.add(milestoneKey);

      if (milestone >= 100) {
        break;
      }
    }
  }

  return adrPercentage;
}

export function resetADRMilestones() {
  announcedMilestones.clear();
}

export function evaluate5mORBBearish({ first5mCandle, historicalFirst5mCandles = [], config = {} }: ORBParams): number | null {
  const {
    lowerQuantile = 0.20,
    upperQuantile = 0.80,
    minBodyFrac = 0.55,
    requireGreen = false,
    rvolTier1 = 0.25,
    rvolTier2 = 1.50,
    minSamples = 10
  } = config;

  if (!first5mCandle) {
    return null;
  }

  const { open, high, low, close, volume } = first5mCandle;

  if (
    open === null || open === undefined ||
    high === null || high === undefined ||
    low === null || low === undefined ||
    close === null || close === undefined ||
    volume === null || volume === undefined
  ) {
    return null;
  }

  const range = high - low;

  if (range <= 0) {
    return 0;
  }

  const openPos = (open - low) / range;
  const openHighQ = openPos >= upperQuantile;

  const closePos = (close - low) / range;
  const closeLowQ = closePos <= lowerQuantile;

  const body = Math.abs(close - open);
  const bodyOK = body >= range * minBodyFrac;

  const redOK = !requireGreen ? close < open : true;

  const priceOK = openHighQ && closeLowQ && bodyOK && redOK;

  if (!priceOK) {
    return 0;
  }

  const historicalVolumes = historicalFirst5mCandles
    .map(candle => candle?.volume)
    .filter((vol): vol is number => vol !== null && vol !== undefined && vol > 0);

  if (historicalVolumes.length < minSamples) {
    return 0;
  }

  const rvolResult = calculateSingleCandleRVol(volume, historicalVolumes);

  if (rvolResult.error || rvolResult.rvol === null) {
    return 0;
  }

  const rvol = rvolResult.rvol;

  if (rvol >= rvolTier2) {
    return 2;
  }

  if (rvol >= rvolTier1) {
    return 1;
  }

  return 0;
}

export function get5mORBBearishDetails({ first5mCandle, historicalFirst5mCandles = [], config = {} }: ORBParams) {
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
    .filter((vol): vol is number => vol !== null && vol !== undefined && vol > 0);

  let rvol: number | null = null;
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

interface VRS5mParams {
  stockCurrentClose: number;
  stockPreviousClose: number;
  stockADRPercent: number;
  benchmarkCurrentClose: number;
  benchmarkPreviousClose: number;
  benchmarkADRPercent: number;
}

export function calculateVRS5m({ stockCurrentClose, stockPreviousClose, stockADRPercent, benchmarkCurrentClose, benchmarkPreviousClose, benchmarkADRPercent }: VRS5mParams): number | null {
  if (
    stockCurrentClose === null || stockCurrentClose === undefined ||
    stockPreviousClose === null || stockPreviousClose === undefined ||
    benchmarkCurrentClose === null || benchmarkCurrentClose === undefined ||
    benchmarkPreviousClose === null || benchmarkPreviousClose === undefined
  ) {
    return null;
  }

  if (!stockADRPercent || stockADRPercent <= 0 || !benchmarkADRPercent || benchmarkADRPercent <= 0) {
    return null;
  }

  if (stockPreviousClose === 0 || benchmarkPreviousClose === 0) {
    return null;
  }

  const stockChangePercent = (stockCurrentClose - stockPreviousClose) / stockPreviousClose;

  const benchmarkChangePercent = (benchmarkCurrentClose - benchmarkPreviousClose) / benchmarkPreviousClose;

  const vrs = ((stockChangePercent / stockADRPercent) - (benchmarkChangePercent / benchmarkADRPercent)) * 100;

  return vrs;
}

export function calculateVRSEMA(vrsValues: number[], period: number = 12): number | null {
  if (!vrsValues || vrsValues.length === 0) {
    return null;
  }

  const alpha = 2 / (period + 1);
  let ema = vrsValues[0];

  for (let i = 1; i < vrsValues.length; i++) {
    ema = (vrsValues[i] * alpha) + (ema * (1 - alpha));
  }

  return ema;
}
