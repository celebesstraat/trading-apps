/**
 * Data normalization utilities
 * Converts provider-specific data formats to unified structure
 */

/**
 * Normalize timestamp to Unix milliseconds
 * @param {number|string} timestamp - Timestamp in various formats
 * @returns {number} Unix timestamp in milliseconds
 */
export function normalizeTimestamp(timestamp) {
  if (typeof timestamp === 'string') {
    return new Date(timestamp).getTime();
  }

  // If timestamp is in seconds (< 10 billion), convert to milliseconds
  if (timestamp < 10000000000) {
    return timestamp * 1000;
  }

  return timestamp;
}

/**
 * Ensure timestamp is in Unix seconds
 * @param {number} timestamp - Timestamp in milliseconds or seconds
 * @returns {number} Unix timestamp in seconds
 */
export function toUnixSeconds(timestamp) {
  if (timestamp > 10000000000) {
    return Math.floor(timestamp / 1000);
  }
  return timestamp;
}

/**
 * Ensure timestamp is in Unix milliseconds
 * @param {number} timestamp - Timestamp in milliseconds or seconds
 * @returns {number} Unix timestamp in milliseconds
 */
export function toUnixMilliseconds(timestamp) {
  if (timestamp < 10000000000) {
    return timestamp * 1000;
  }
  return timestamp;
}

/**
 * Validate symbol format
 * @param {string} symbol - Stock ticker symbol
 * @returns {boolean}
 */
export function isValidSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    return false;
  }

  // Basic validation: 1-5 uppercase letters
  return /^[A-Z]{1,5}$/.test(symbol);
}

/**
 * Normalize symbol to uppercase
 * @param {string} symbol - Stock ticker symbol
 * @returns {string}
 */
export function normalizeSymbol(symbol) {
  return symbol.toUpperCase().trim();
}

/**
 * Validate and normalize price
 * @param {number|string} price - Price value
 * @returns {number|null}
 */
export function normalizePrice(price) {
  const parsed = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

/**
 * Round price to appropriate precision
 * @param {number} price - Price value
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {number}
 */
export function roundPrice(price, decimals = 2) {
  return Math.round(price * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Calculate percentage change
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {number} Percentage change
 */
export function calculatePercentChange(current, previous) {
  if (!previous || previous === 0) {
    return 0;
  }

  return ((current - previous) / previous) * 100;
}

/**
 * Check if market data is stale
 * @param {number} timestamp - Data timestamp in milliseconds
 * @param {number} [maxAgeMs=60000] - Maximum age in milliseconds (default: 1 minute)
 * @returns {boolean}
 */
export function isStaleData(timestamp, maxAgeMs = 60000) {
  return Date.now() - timestamp > maxAgeMs;
}

/**
 * Create a normalized quote object
 * @param {Object} data - Raw quote data
 * @param {string} source - Provider name
 * @returns {import('../types/market-data.js').MarketQuote|null}
 */
export function normalizeQuote(data, source) {
  if (!data) return null;

  try {
    return {
      symbol: normalizeSymbol(data.symbol),
      price: normalizePrice(data.price),
      timestamp: normalizeTimestamp(data.timestamp),
      volume: data.volume || 0,
      open: normalizePrice(data.open),
      high: normalizePrice(data.high),
      low: normalizePrice(data.low),
      previousClose: normalizePrice(data.previousClose),
      source,
      metadata: data.metadata || {}
    };
  } catch (error) {
    return null;
  }
}

/**
 * Create a normalized candle object
 * @param {Object} data - Raw candle data
 * @param {string} source - Provider name
 * @returns {import('../types/market-data.js').MarketCandle|null}
 */
export function normalizeCandle(data, source) {
  if (!data) return null;

  try {
    return {
      symbol: normalizeSymbol(data.symbol),
      timestamp: normalizeTimestamp(data.timestamp),
      open: normalizePrice(data.open),
      high: normalizePrice(data.high),
      low: normalizePrice(data.low),
      close: normalizePrice(data.close),
      volume: data.volume || 0,
      source
    };
  } catch (error) {
    return null;
  }
}
