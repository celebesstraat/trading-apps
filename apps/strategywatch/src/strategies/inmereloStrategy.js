import { INMERELO_THRESHOLDS } from '../config/constants';
import { calculatePercentDifference } from '../services/calculations';

/**
 * Calculates INMERELO (Intraday Mean Reversion Long) score for a single moving average
 *
 * Strategy: Signals when price approaches key daily moving averages for potential bounce
 *
 * Scoring:
 * - Green (80-100): Price within 0.1-0.5% of MA + bouncing up + volume increasing
 * - Amber (50-79): Price within 0.5-1.5% of MA + approaching from above
 * - Red (0-49): Price > 1.5% from MA OR already below MA
 *
 * @param {object} params Strategy parameters
 * @param {number} params.currentPrice Current stock price
 * @param {number} params.previousPrice Previous price (for bounce detection)
 * @param {number} params.movingAverage Moving average value
 * @param {boolean} params.volumeIncreasing Whether volume is trending up
 * @param {string} params.maType MA type ('10D', '21D', '50D') for debugging
 * @returns {number} Score (0-100)
 */
export function calculateINMERELOScore({
  currentPrice,
  previousPrice,
  movingAverage,
  volumeIncreasing,
  _maType = 'MA'
}) {
  // Validate inputs
  if (!currentPrice || !movingAverage || currentPrice <= 0 || movingAverage <= 0) {
    return 0;
  }

  // Calculate distance from MA as percentage
  const distancePercent = calculatePercentDifference(currentPrice, movingAverage);

  // Check if price is bouncing (moving up)
  const isBouncing = previousPrice ? currentPrice > previousPrice : false;

  // === GREEN ZONE (80-100) ===
  // Price close to MA (0.1-0.5%), above it, bouncing up with volume
  if (
    distancePercent >= INMERELO_THRESHOLDS.GREEN_MIN_DISTANCE &&
    distancePercent <= INMERELO_THRESHOLDS.GREEN_MAX_DISTANCE
  ) {
    let score = 75; // Base green zone score

    // Bonus for bouncing
    if (isBouncing) {
      score += 10;
    }

    // Bonus for increasing volume
    if (volumeIncreasing) {
      score += 10;
    }

    // Adjust based on how close to MA (closer = better)
    const proximityBonus = ((INMERELO_THRESHOLDS.GREEN_MAX_DISTANCE - distancePercent) /
      (INMERELO_THRESHOLDS.GREEN_MAX_DISTANCE - INMERELO_THRESHOLDS.GREEN_MIN_DISTANCE)) * 5;
    score += proximityBonus;

    return Math.min(Math.round(score), 100);
  }

  // === AMBER ZONE (50-79) ===
  // Price approaching MA (0.5-1.5% away)
  if (
    distancePercent > INMERELO_THRESHOLDS.GREEN_MAX_DISTANCE &&
    distancePercent <= INMERELO_THRESHOLDS.AMBER_MAX_DISTANCE
  ) {
    // Calculate score based on proximity to green zone
    const rangeWidth = INMERELO_THRESHOLDS.AMBER_MAX_DISTANCE - INMERELO_THRESHOLDS.GREEN_MAX_DISTANCE;
    const distanceFromGreen = distancePercent - INMERELO_THRESHOLDS.GREEN_MAX_DISTANCE;
    const proximityRatio = 1 - (distanceFromGreen / rangeWidth);

    let score = 50 + (proximityRatio * 24); // 50-74 range

    // Small bonus for bouncing
    if (isBouncing) {
      score += 5;
    }

    return Math.min(Math.round(score), 79);
  }

  // === RED ZONE (0-49) ===
  // Either too far above MA or below MA

  // Below MA (price < MA)
  if (distancePercent < 0) {
    // The further below, the lower the score
    const belowScore = 30 + (distancePercent * 10); // Decreases as it goes further below
    return Math.max(Math.round(belowScore), 0);
  }

  // Too far above MA (> 1.5%)
  if (distancePercent > INMERELO_THRESHOLDS.AMBER_MAX_DISTANCE) {
    const excessDistance = distancePercent - INMERELO_THRESHOLDS.AMBER_MAX_DISTANCE;
    const farScore = 40 - (excessDistance * 5); // Decreases as distance increases
    return Math.max(Math.round(farScore), 0);
  }

  // Fallback (shouldn't reach here)
  return 40;
}

/**
 * Calculates INMERELO scores for all three moving averages
 * @param {object} params Strategy parameters
 * @param {number} params.currentPrice Current stock price
 * @param {number} params.previousPrice Previous price
 * @param {object} params.movingAverages Object with {ema10, ema21, sma50}
 * @param {boolean} params.volumeIncreasing Whether volume is increasing
 * @returns {object} Scores for each MA {score10D, score21D, score50D}
 */
export function calculateAllINMERELOScores({
  currentPrice,
  previousPrice,
  movingAverages,
  volumeIncreasing
}) {
  if (!movingAverages) {
    return {
      score10D: 0,
      score21D: 0,
      score50D: 0
    };
  }

  return {
    score10D: calculateINMERELOScore({
      currentPrice,
      previousPrice,
      movingAverage: movingAverages.ema10,
      volumeIncreasing,
      maType: '10D EMA'
    }),
    score21D: calculateINMERELOScore({
      currentPrice,
      previousPrice,
      movingAverage: movingAverages.ema21,
      volumeIncreasing,
      maType: '21D EMA'
    }),
    score50D: calculateINMERELOScore({
      currentPrice,
      previousPrice,
      movingAverage: movingAverages.sma50,
      volumeIncreasing,
      maType: '50D SMA'
    })
  };
}

/**
 * Gets detailed breakdown for tooltip
 * @param {object} params Same as calculateINMERELOScore
 * @returns {object} Detailed breakdown for display
 */
export function getINMERELOBreakdown({
  currentPrice,
  previousPrice,
  movingAverage,
  volumeIncreasing,
  maType
}) {
  const score = calculateINMERELOScore({
    currentPrice,
    previousPrice,
    movingAverage,
    volumeIncreasing,
    maType
  });

  const distancePercent = calculatePercentDifference(currentPrice, movingAverage);
  const isBouncing = previousPrice ? currentPrice > previousPrice : false;

  let status = 'Too far from MA';
  if (score >= 80) {
    status = 'Strong setup ✓';
  } else if (score >= 50) {
    status = 'Approaching MA';
  } else if (distancePercent < 0) {
    status = 'Below MA';
  }

  return {
    score,
    maLevel: movingAverage?.toFixed(2) || 'N/A',
    distance: distancePercent.toFixed(2) + '%',
    bouncing: isBouncing ? 'Yes ✓' : 'No',
    volumeIncreasing: volumeIncreasing ? 'Yes ✓' : 'No',
    status
  };
}
