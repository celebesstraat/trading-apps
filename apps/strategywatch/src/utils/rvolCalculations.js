/**
 * RVol (Relative Volume) calculation utilities
 *
 * RVol Formula:
 * RVol = Current Cumulative Volume (9:30 AM → Now) /
 *        Average Cumulative Volume at Same Time (Last 20 Days)
 *
 * Example at 10:15 AM:
 * - Today: Sum of all 5m candle volumes from 9:30 to 10:15 = 8M shares
 * - Historical: Average of 20 days' cumulative volume at 10:15 AM = 7.5M shares
 * - RVol = 8M / 7.5M = 1.07x
 */

// Market hours (Eastern Time)
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 30;
const MARKET_CLOSE_HOUR = 16;
const MARKET_CLOSE_MINUTE = 0;

/**
 * Get market open timestamp for a given date
 * @param {Date} date - Trading date
 * @returns {number} Unix timestamp (ms) for market open (9:30 AM ET)
 */
export const getMarketOpenTime = (date) => {
  const marketOpen = new Date(date);
  marketOpen.setHours(MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE, 0, 0);
  return marketOpen.getTime();
};

/**
 * Check if current time is during market hours
 * @param {Date} date - Date to check (default: now)
 * @returns {boolean}
 */
export const isMarketHours = (date = new Date()) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  const currentMinutes = hours * 60 + minutes;
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE;
  const closeMinutes = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
};

/**
 * Get minutes elapsed since market open
 * @param {Date} date - Current time (default: now)
 * @returns {number} Minutes since 9:30 AM, or 0 if before market open
 */
export const getMinutesSinceMarketOpen = (date = new Date()) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  const currentMinutes = hours * 60 + minutes;
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE;

  return Math.max(0, currentMinutes - openMinutes);
};

/**
 * Calculate cumulative volume from market open to current time
 * @param {Array} candles - Array of 5m candles (sorted by time ascending)
 *                          Each candle: { timestamp, volume, open, high, low, close }
 * @param {number} currentTime - Current timestamp (ms) to calculate up to
 * @returns {number} Cumulative volume in shares
 */
export const calculateCumulativeVolume = (candles, currentTime) => {
  if (!candles || candles.length === 0) {
    return 0;
  }

  let cumulativeVolume = 0;

  for (const candle of candles) {
    // Only count candles up to and including current time
    if (candle.timestamp <= currentTime) {
      cumulativeVolume += candle.volume || 0;
    } else {
      break; // Candles should be sorted, so we can stop here
    }
  }

  return cumulativeVolume;
};

/**
 * Get cumulative volume at a specific time-of-day from a single day's candles
 * @param {Array} candles - 5m candles for a single trading day
 * @param {number} targetMinutes - Minutes since market open (e.g., 45 for 10:15 AM)
 * @returns {number} Cumulative volume up to that time
 */
export const getCumulativeVolumeAtTime = (candles, targetMinutes) => {
  if (!candles || candles.length === 0) {
    return 0;
  }

  let cumulativeVolume = 0;

  for (const candle of candles) {
    const candleDate = new Date(candle.timestamp);
    const candleMinutes = getMinutesSinceMarketOpen(candleDate);

    // Sum volumes up to target time (inclusive of the 5m candle containing target time)
    if (candleMinutes <= targetMinutes) {
      cumulativeVolume += candle.volume || 0;
    } else {
      break;
    }
  }

  return cumulativeVolume;
};

/**
 * Calculate average cumulative volume at a specific time across multiple days
 * @param {Array} historicalData - Array of { date, candles } objects (last 20 days)
 * @param {number} targetMinutes - Minutes since market open to calculate average at
 * @returns {number} Average cumulative volume
 */
export const calculateAverageCumulativeVolume = (historicalData, targetMinutes) => {
  if (!historicalData || historicalData.length === 0) {
    return 0;
  }

  const cumulativeVolumes = [];

  for (const dayData of historicalData) {
    if (dayData.candles && dayData.candles.length > 0) {
      const dailyCumulative = getCumulativeVolumeAtTime(dayData.candles, targetMinutes);
      if (dailyCumulative > 0) {
        cumulativeVolumes.push(dailyCumulative);
      }
    }
  }

  if (cumulativeVolumes.length === 0) {
    return 0;
  }

  // Calculate average
  const sum = cumulativeVolumes.reduce((acc, vol) => acc + vol, 0);
  return sum / cumulativeVolumes.length;
};

/**
 * Calculate RVol for a ticker
 * @param {Array} todayCandles - Today's 5m candles (sorted by time)
 * @param {Array} historicalData - Array of { date, candles } for last 20 days
 * @param {Date} currentTime - Current time (default: now)
 * @returns {Object} { rvol, currentCumulative, avgCumulative, minutesSinceOpen, dataPoints }
 */
export const calculateRVol = (todayCandles, historicalData, currentTime = new Date()) => {
  // Initialize default result
  const result = {
    rvol: null,
    currentCumulative: 0,
    avgCumulative: 0,
    minutesSinceOpen: 0,
    dataPoints: 0,
    error: null
  };

  // Validate inputs
  if (!todayCandles || todayCandles.length === 0) {
    result.error = 'No intraday data available';
    return result;
  }

  if (!historicalData || historicalData.length < 5) {
    result.error = 'Insufficient historical data (need at least 5 days)';
    return result;
  }

  // Calculate minutes since market open
  const minutesSinceOpen = getMinutesSinceMarketOpen(currentTime);
  result.minutesSinceOpen = minutesSinceOpen;

  if (minutesSinceOpen <= 0) {
    result.error = 'Market not yet open';
    return result;
  }

  // Calculate current cumulative volume (today)
  const currentCumulative = calculateCumulativeVolume(todayCandles, currentTime.getTime());
  result.currentCumulative = currentCumulative;

  // Calculate average cumulative volume (historical)
  const avgCumulative = calculateAverageCumulativeVolume(historicalData, minutesSinceOpen);
  result.avgCumulative = avgCumulative;
  result.dataPoints = historicalData.length;

  // Calculate RVol ratio
  if (avgCumulative > 0) {
    result.rvol = currentCumulative / avgCumulative;
  } else if (currentCumulative > 0) {
    // Edge case: historical average is 0 but current volume exists
    result.rvol = null;
    result.error = 'No historical volume data for comparison';
  } else {
    // Both are 0 (e.g., pre-market or very low volume stock)
    result.rvol = 0;
  }

  return result;
};

/**
 * Format RVol for display
 * @param {number|null} rvol - RVol ratio value
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted RVol string (e.g., "2.34x", "--")
 */
export const formatRVol = (rvol, decimals = 2) => {
  if (rvol === null || rvol === undefined || isNaN(rvol)) {
    return '--';
  }

  return `${rvol.toFixed(decimals)}x`;
};

/**
 * Get RVol color based on value (for UI highlighting)
 * @param {number|null} rvol - RVol ratio value
 * @returns {string} Color category: 'high', 'low', or 'normal'
 */
export const getRVolColor = (rvol) => {
  if (rvol === null || rvol === undefined || isNaN(rvol)) {
    return 'normal';
  }

  if (rvol >= 2.0) {
    return 'high'; // Unusually high volume (green)
  } else if (rvol < 0.5) {
    return 'low'; // Unusually low volume (red)
  } else {
    return 'normal'; // Normal range (default color)
  }
};

/**
 * Get granular RVol color class for progress bar styling
 * @param {number|null} rvol - RVol ratio value
 * @returns {string} CSS class name for the appropriate color range
 */
export const getRVolProgressColor = (rvol) => {
  if (rvol === null || rvol === undefined || isNaN(rvol)) {
    return 'rvol-normal';
  }

  if (rvol < 0.25) {
    return 'rvol-very-low'; // Red (0 - 0.25)
  } else if (rvol < 0.5) {
    return 'rvol-low'; // Amber (0.25 - 0.5)
  } else if (rvol < 1.5) {
    return 'rvol-normal'; // White (0.5 - 1.5)
  } else if (rvol < 2.0) {
    return 'rvol-high'; // Light green (1.5 - 2.0)
  } else {
    return 'rvol-very-high'; // Dark green (2.0+)
  }
};

/**
 * Map RVol value to progress bar width percentage
 * Centers on 1.0x at 50% width, scales logarithmically above and below
 * @param {number|null} rvol - RVol ratio value
 * @returns {number} Width percentage (0-100)
 */
export const getRVolProgressWidth = (rvol) => {
  if (rvol === null || rvol === undefined || isNaN(rvol)) {
    return 50; // Default to center line
  }

  // Handle values below 1.0x (scale from 0-50%)
  if (rvol <= 1.0) {
    // Map 0-1 range to 0-50%
    return rvol * 50;
  }

  // Handle values above 1.0x (scale from 50-100%)
  // Use logarithmic scaling for better visualization of high values
  const maxDisplay = 4.0; // Maximum value to display (hits 100%)
  const clampedRvol = Math.min(rvol, maxDisplay);

  // Map 1-4 range to 50-100%
  // 1.0x = 50%, 1.5x = ~63%, 2.0x = 75%, 3.0x = 92%, 4.0x = 100%
  const percentage = 50 + ((clampedRvol - 1.0) / (maxDisplay - 1.0)) * 50;

  return Math.min(100, Math.max(0, percentage));
};

/**
 * Map Today's Move ratio to progress bar width percentage
 * Centers on 1.0x at 50% width, scales logarithmically above and below
 * @param {number|null} ratio - Today's Move ratio (1.0 = 100% of ADR)
 * @returns {number} Width percentage (0-100)
 */
export const getTodayMoveProgressWidth = (ratio) => {
  if (ratio === null || ratio === undefined || isNaN(ratio)) {
    return 50; // Default to center line
  }

  // Handle values below 1.0x (scale from 0-50%)
  if (ratio <= 1.0) {
    // Map 0-1 range to 0-50%
    return ratio * 50;
  }

  // Handle values above 1.0x (scale from 50-100%)
  // Use logarithmic scaling for better visualization of high values
  const maxDisplay = 3.0; // Maximum value to display (hits 100%)
  const clampedRatio = Math.min(ratio, maxDisplay);

  // Map 1-3 range to 50-100%
  // 1.0x = 50%, 1.5x = ~67%, 2.0x = 75%, 2.5x = 83%, 3.0x = 100%
  const percentage = 50 + ((clampedRatio - 1.0) / (maxDisplay - 1.0)) * 50;

  return Math.min(100, Math.max(0, percentage));
};

/**
 * Get RVol tooltip message
 * @param {Object} rvolData - RVol calculation result
 * @returns {string} Tooltip text
 */
export const getRVolTooltip = (rvolData) => {
  if (!rvolData || rvolData.error) {
    return rvolData?.error || 'RVol data unavailable';
  }

  const { rvol, currentCumulative, avgCumulative, dataPoints } = rvolData;

  if (rvol === null) {
    return 'Insufficient data';
  }

  const formatVolume = (vol) => {
    if (vol >= 1000000) {
      return `${(vol / 1000000).toFixed(2)}M`;
    } else if (vol >= 1000) {
      return `${(vol / 1000).toFixed(1)}K`;
    } else {
      return vol.toFixed(0);
    }
  };

  return `Current: ${formatVolume(currentCumulative)} shares\nAverage (${dataPoints} days): ${formatVolume(avgCumulative)} shares\nRVol: ${formatRVol(rvol)}`;
};

/**
 * Validate candle data structure
 * @param {Array} candles - Candles array to validate
 * @returns {boolean}
 */
export const validateCandleData = (candles) => {
  if (!Array.isArray(candles) || candles.length === 0) {
    return false;
  }

  // Check first candle has required fields
  const firstCandle = candles[0];
  return (
    firstCandle &&
    typeof firstCandle.timestamp === 'number' &&
    typeof firstCandle.volume === 'number'
  );
};

/**
 * Sort candles by timestamp ascending (in-place)
 * @param {Array} candles - Candles array
 * @returns {Array} Sorted candles
 */
export const sortCandlesByTime = (candles) => {
  if (!candles || candles.length === 0) {
    return candles;
  }

  return candles.sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Filter candles to only include market hours (9:30 AM - 4:00 PM ET)
 * @param {Array} candles - Candles array
 * @returns {Array} Filtered candles
 */
export const filterMarketHoursCandles = (candles) => {
  if (!candles || candles.length === 0) {
    return candles;
  }

  return candles.filter(candle => {
    const candleDate = new Date(candle.timestamp);
    return isMarketHours(candleDate);
  });
};

/**
 * Calculate average volume from an array of volume values
 * Shared utility used by both main RVol and ORB RVol calculations
 * @param {Array} volumes - Array of volume values
 * @returns {number} Average volume, or 0 if no valid data
 */
export const calculateAverageVolume = (volumes) => {
  if (!volumes || volumes.length === 0) {
    return 0;
  }

  // Filter out null, undefined, and non-positive values
  const validVolumes = volumes.filter(vol =>
    vol !== null && vol !== undefined && !isNaN(vol) && vol > 0
  );

  if (validVolumes.length === 0) {
    return 0;
  }

  const sum = validVolumes.reduce((acc, vol) => acc + vol, 0);
  return sum / validVolumes.length;
};

/**
 * Calculate RVol for a single candle (e.g., first 5m candle for ORB)
 * @param {number} currentVolume - Current candle's volume
 * @param {Array} historicalVolumes - Array of historical volumes for same time period
 * @returns {Object} { rvol, avgVolume, sampleCount }
 */
export const calculateSingleCandleRVol = (currentVolume, historicalVolumes) => {
  const result = {
    rvol: null,
    avgVolume: 0,
    sampleCount: 0,
    error: null
  };

  // Validate inputs
  if (currentVolume === null || currentVolume === undefined || currentVolume <= 0) {
    result.error = 'Invalid current volume';
    return result;
  }

  if (!historicalVolumes || historicalVolumes.length === 0) {
    result.error = 'No historical data available';
    return result;
  }

  // Calculate average historical volume
  const avgVolume = calculateAverageVolume(historicalVolumes);
  result.avgVolume = avgVolume;
  result.sampleCount = historicalVolumes.filter(vol =>
    vol !== null && vol !== undefined && !isNaN(vol) && vol > 0
  ).length;

  if (avgVolume === 0) {
    result.error = 'No valid historical volume data';
    return result;
  }

  // Calculate RVol ratio
  result.rvol = currentVolume / avgVolume;

  return result;
};
