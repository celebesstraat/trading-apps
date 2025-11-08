import { ORB_THRESHOLDS } from '../config/constants';
import {
  calculatePercentDifference,
  calculateCandleRangePercent,
  calculateBodyRatio
} from '../services/calculations';

/**
 * Calculates Opening Range Breakout (ORB) score
 *
 * Strategy: Monitors first 5m candle (9:30-9:35 ET) and signals when price breaks above
 *          its high with "strong" criteria met
 *
 * Strong Criteria:
 * 1. Range: Candle range ≥ 0.3% of price (volatility)
 * 2. Body Ratio: Close in top 70% of range (bullish)
 * 3. Volume: Volume ≥ 2x average first 5m volume
 * 4. Direction: Close > Open (green candle)
 *
 * Scoring:
 * - Green (80-100): All 4 criteria met + price 0.1-0.5% above first 5m high
 * - Amber (50-79): 3/4 criteria met + price within 0.2% of high
 * - Red (0-49): < 3 criteria met OR price < first 5m high
 *
 * @param {object} params Strategy parameters
 * @param {number} params.currentPrice Current stock price
 * @param {object} params.first5mCandle First 5m candle {open, high, low, close, volume}
 * @param {number} params.avgFirst5mVolume Historical average first 5m volume
 * @returns {number} Score (0-100), or null if ORB not active yet
 */
export function calculateORBScore({
  currentPrice,
  first5mCandle,
  avgFirst5mVolume
}) {
  // If no first 5m candle data, return null (setup not ready)
  if (!first5mCandle) {
    return null;
  }

  // Validate inputs
  if (!currentPrice || currentPrice <= 0) {
    return 0;
  }

  const { open, high, low, close, volume } = first5mCandle;

  // === CHECK STRONG CRITERIA ===

  // 1. Range: Candle range ≥ 0.3% of price
  const rangePercent = calculateCandleRangePercent(first5mCandle);
  const criteriaRange = rangePercent >= ORB_THRESHOLDS.MIN_RANGE_PERCENT;

  // 2. Body Ratio: Close in top 70% of range
  const bodyRatio = calculateBodyRatio(first5mCandle);
  const criteriaBodyRatio = bodyRatio >= ORB_THRESHOLDS.MIN_BODY_RATIO;

  // 3. Volume: Volume ≥ 2x average
  const criteriaVolume = avgFirst5mVolume
    ? volume >= (avgFirst5mVolume * ORB_THRESHOLDS.MIN_VOLUME_MULTIPLIER)
    : false;

  // 4. Direction: Green candle
  const criteriaDirection = close > open;

  // Count how many criteria are met
  const criteriaMet = [
    criteriaRange,
    criteriaBodyRatio,
    criteriaVolume,
    criteriaDirection
  ].filter(Boolean).length;

  // === CALCULATE PRICE POSITION RELATIVE TO FIRST 5M HIGH ===

  const distanceFromHigh = calculatePercentDifference(currentPrice, high);

  // === SCORING ===

  // GREEN ZONE (80-100): All 4 criteria met + price breaking out
  if (
    criteriaMet === 4 &&
    distanceFromHigh >= ORB_THRESHOLDS.BREAKOUT_MIN_PERCENT &&
    distanceFromHigh <= ORB_THRESHOLDS.BREAKOUT_MAX_PERCENT
  ) {
    // Score increases the further it breaks out (within range)
    const breakoutRange = ORB_THRESHOLDS.BREAKOUT_MAX_PERCENT - ORB_THRESHOLDS.BREAKOUT_MIN_PERCENT;
    const breakoutProgress = (distanceFromHigh - ORB_THRESHOLDS.BREAKOUT_MIN_PERCENT) / breakoutRange;
    const score = 85 + (breakoutProgress * 15); // 85-100 range

    return Math.min(Math.round(score), 100);
  }

  // AMBER ZONE (50-79): 3/4 criteria met + near the high
  if (criteriaMet >= 3 && distanceFromHigh >= -ORB_THRESHOLDS.AMBER_DISTANCE_PERCENT) {
    // Score based on proximity to high
    const proximityRatio = (distanceFromHigh + ORB_THRESHOLDS.AMBER_DISTANCE_PERCENT) /
      (ORB_THRESHOLDS.BREAKOUT_MIN_PERCENT + ORB_THRESHOLDS.AMBER_DISTANCE_PERCENT);

    let score = 50 + (proximityRatio * 24); // 50-74 base range

    // Bonus if all 4 criteria met (just needs better breakout)
    if (criteriaMet === 4) {
      score += 5;
    }

    return Math.min(Math.round(score), 79);
  }

  // RED ZONE (0-49): Weak setup or price below high

  // If price is below the high
  if (distanceFromHigh < 0) {
    // Further below = lower score
    const belowScore = 40 + (distanceFromHigh * 5);
    return Math.max(Math.round(belowScore), 0);
  }

  // If price is above but criteria weak
  if (criteriaMet < 3) {
    const weakScore = (criteriaMet / 4) * 30; // 0-30 based on criteria
    return Math.round(weakScore);
  }

  // Fallback
  return 40;
}

/**
 * Gets detailed breakdown for tooltip
 * @param {object} params Same as calculateORBScore
 * @returns {object} Detailed breakdown for display
 */
export function getORBBreakdown({
  currentPrice,
  first5mCandle,
  avgFirst5mVolume
}) {
  if (!first5mCandle) {
    return {
      score: null,
      status: 'Waiting for first 5m candle...',
      rangePercent: 'N/A',
      volumeMultiplier: 'N/A',
      distanceFromHigh: 'N/A',
      criteriaMet: 'N/A'
    };
  }

  const score = calculateORBScore({ currentPrice, first5mCandle, avgFirst5mVolume });

  const { open, high, low, close, volume } = first5mCandle;
  const rangePercent = calculateCandleRangePercent(first5mCandle);
  const bodyRatio = calculateBodyRatio(first5mCandle);
  const distanceFromHigh = calculatePercentDifference(currentPrice, high);
  const volumeMultiplier = avgFirst5mVolume ? (volume / avgFirst5mVolume).toFixed(2) : 'N/A';

  // Check criteria
  const criteriaRange = rangePercent >= ORB_THRESHOLDS.MIN_RANGE_PERCENT;
  const criteriaBodyRatio = bodyRatio >= ORB_THRESHOLDS.MIN_BODY_RATIO;
  const criteriaVolume = avgFirst5mVolume
    ? volume >= (avgFirst5mVolume * ORB_THRESHOLDS.MIN_VOLUME_MULTIPLIER)
    : false;
  const criteriaDirection = close > open;

  const criteriaMet = [
    criteriaRange,
    criteriaBodyRatio,
    criteriaVolume,
    criteriaDirection
  ].filter(Boolean).length;

  let status = 'Weak setup';
  if (score >= 80) {
    status = 'Strong breakout ✓';
  } else if (score >= 50) {
    status = 'Approaching breakout';
  } else if (distanceFromHigh < 0) {
    status = 'Below first 5m high';
  }

  return {
    score,
    status,
    rangePercent: rangePercent.toFixed(2) + '%',
    volumeMultiplier: volumeMultiplier + 'x',
    distanceFromHigh: distanceFromHigh.toFixed(2) + '%',
    criteriaMet: `${criteriaMet}/4`,
    criteria: {
      range: criteriaRange ? '✓' : '✗',
      bodyRatio: criteriaBodyRatio ? '✓' : '✗',
      volume: criteriaVolume ? '✓' : '✗',
      direction: criteriaDirection ? '✓' : '✗'
    }
  };
}
