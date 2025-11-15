/**
 * Relative Strength Engine v2.0 - Type Definitions
 *
 * Central type definitions and constants for the RS Engine.
 * Provides type safety and documentation for all data structures.
 */

// Core timeframes supported by the RS Engine
export const TIMEFRAMES = Object.freeze([
  '1m',   // 1-minute timeframe
  '5m',   // 5-minute timeframe
  '15m'   // 15-minute timeframe
]);

// Data types used throughout the engine
export const DATA_TYPES = Object.freeze({
  REALTIME: 'realtime',
  HISTORICAL: 'historical',
  CALCULATED: 'calculated',
  CACHED: 'cached'
});

// Relative Strength calculation ranges
export const RS_RANGE = Object.freeze({
  MIN: -50,      // Minimum RS value (strongly underperforming)
  MAX: 50,       // Maximum RS value (strongly outperforming)
  NEUTRAL: 0,    // Neutral RS value (equal performance)
  GOOD_THRESHOLD: 20,   // Good performance threshold
  WEAK_THRESHOLD: -20   // Weak performance threshold
});

// Cache configuration
export const CACHE_CONFIG = Object.freeze({
  maxSize: 1000,
  defaultTTL: 60000,    // 1 minute default TTL
  TTL: {
    '1m': 30000,         // 30 seconds for 1-minute data
    '5m': 120000,        // 2 minutes for 5-minute data
    '15m': 300000        // 5 minutes for 15-minute data
  }
});

// Precision settings
export const PERCENT_CHANGE_PRECISION = 2;
export const RS_VALUE_PRECISION = 1;
export const PRICE_PRECISION = 2;
export const VOLUME_PRECISION = 0;

// Error types
export const ERROR_TYPES = Object.freeze({
  NETWORK: 'network',
  VALIDATION: 'validation',
  CALCULATION: 'calculation',
  RATE_LIMIT: 'rate_limit',
  AUTHENTICATION: 'authentication',
  DATA_UNAVAILABLE: 'data_unavailable'
});

// Data quality levels
export const DATA_QUALITY = Object.freeze({
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  UNKNOWN: 'unknown'
});

// Technical indicator types
export const TECHNICAL_INDICATORS = Object.freeze({
  SMA: 'sma',           // Simple Moving Average
  EMA: 'ema',           // Exponential Moving Average
  RSI: 'rsi',           // Relative Strength Index
  MACD: 'macd',         // Moving Average Convergence Divergence
  BOLLINGER: 'bollinger', // Bollinger Bands
  VOLUME: 'volume'      // Volume indicators
});

// Market status
export const MARKET_STATUS = Object.freeze({
  PRE_MARKET: 'pre_market',
  MARKET_OPEN: 'market_open',
  MARKET_CLOSE: 'market_close',
  AFTER_HOURS: 'after_hours',
  WEEKEND: 'weekend',
  HOLIDAY: 'holiday'
});

// Trading session times (EST)
export const TRADING_SESSIONS = Object.freeze({
  PRE_MARKET: {
    start: '04:00',
    end: '09:30'
  },
  REGULAR: {
    start: '09:30',
    end: '16:00'
  },
  AFTER_HOURS: {
    start: '16:00',
    end: '20:00'
  }
});

// Default configuration values
export const DEFAULT_CONFIG = Object.freeze({
  benchmark: 'QQQ',
  updateInterval: 30000,    // 30 seconds
  maxRetries: 3,
  retryDelay: 1000,         // 1 second
  connectionTimeout: 10000,  // 10 seconds
  maxConcurrentRequests: 10
});

// Timeframe weights for overall RS calculation
export const TIMEFRAME_WEIGHTS = Object.freeze({
  '1m': {
    priceRS: 0.5,
    momentumRS: 0.4,
    volumeRS: 0.1
  },
  '5m': {
    priceRS: 0.3,
    momentumRS: 0.3,
    volumeRS: 0.2,
    orbAdjustedRS: 0.2
  },
  '15m': {
    priceRS: 0.3,
    momentumRS: 0.3,
    volumeRS: 0.2,
    trendRS: 0.2
  }
});

// TypeScript type definitions (for documentation and future use)

/**
 * @typedef {Object} RSDataPoint
 * @property {string} timeframe - Timeframe (1m, 5m, 15m)
 * @property {string} symbol - Stock symbol
 * @property {number} timestamp - Unix timestamp
 * @property {RSComponent} priceRS - Price-based RS
 * @property {RSComponent} momentumRS - Momentum-based RS
 * @property {RSComponent} volumeRS - Volume-based RS
 * @property {RSComponent} [orbAdjustedRS] - ORB-adjusted RS (5m only)
 * @property {RSComponent} [trendRS] - Trend RS (15m only)
 * @property {RSComponent} overallRS - Overall RS score
 * @property {boolean} isValid - Data validity flag
 * @property {string} [error] - Error message if invalid
 */

/**
 * @typedef {Object} RSComponent
 * @property {number} value - RS value (0-100)
 * @property {boolean} isValid - Component validity
 * @property {string} [error] - Error message if invalid
 * @property {*} [additionalData] - Additional component-specific data
 */

/**
 * @typedef {Object} StockData
 * @property {string} symbol - Stock symbol
 * @property {number} currentPrice - Current price
 * @property {number} previousClose - Previous close price
 * @property {number} currentVolume - Current volume
 * @property {number} averageVolume - Average volume
 * @property {number[]} priceHistory - Historical prices
 * @property {Object} technicalIndicators - Technical indicators
 * @property {Object} dataQuality - Data quality metrics
 * @property {number} lastUpdate - Last update timestamp
 */

/**
 * @typedef {Object} TechnicalIndicators
 * @property {number} [sma] - Simple Moving Average
 * @property {number} [ema] - Exponential Moving Average
 * @property {number} [rsi] - Relative Strength Index
 * @property {number} [macd] - MACD
 * @property {number} [averageVolume] - Average volume
 */

/**
 * @typedef {Object} CacheEntry
 * @property {*} data - Cached data
 * @property {number} timestamp - Creation timestamp
 * @property {number} ttl - Time to live
 * @property {number} accessCount - Access count
 */

/**
 * @typedef {Object} RSState
 * @property {number} version - State version
 * @property {number} timestamp - State timestamp
 * @property {Object} rsData - RS data by timeframe
 * @property {Object} metadata - State metadata
 * @property {Object} system - System status
 */

/**
 * @typedef {Object} SystemStatus
 * @property {boolean} isHealthy - System health flag
 * @property {number} errorCount - Error count
 * @property {Object} lastError - Last error
 * @property {number} lastUpdate - Last update time
 * @property {number} uptime - System uptime
 * @property {number} version - System version
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {number} updates - Number of updates
 * @property {number} lastUpdateTime - Last update time
 * @property {number} averageUpdateDuration - Average update duration
 * @property {number} historySize - History size
 * @property {number} subscriberCount - Subscriber count
 * @property {number} stateSize - State size in bytes
 * @property {number} errorCount - Error count
 */

/**
 * @typedef {Object} WebSocketMessage
 * @property {string} T - Message type (t=trade, q=quote)
 * @property {string} S - Symbol
 * @property {number} p - Price (trade)
 * @property {number} s - Size (trade)
 * @property {number} t - Timestamp
 * @property {number} bp - Bid price (quote)
 * @property {number} ap - Ask price (quote)
 * @property {number} bs - Bid size (quote)
 * @property {number} as - Ask size (quote)
 */

/**
 * @typedef {Object} AlpacaBar
 * @property {string} t - Time
 * @property {number} o - Open price
 * @property {number} h - High price
 * @property {number} l - Low price
 * @property {number} c - Close price
 * @property {number} v - Volume
 * @property {number} vw - Volume weighted average price
 * @property {number} n - Number of trades
 */

/**
 * @typedef {Object} AlpacaQuote
 * @property {number} ap - Ask price
 * @property {number} as - Ask size
 * @property {number} bp - Bid price
 * @property {number} bs - Bid size
 * @property {number} c - Close price
 * @property {string} t - Timestamp
 * @property {number} prev_close - Previous close price
 * @property {number} ac - Accumulated volume
 */

/**
 * @typedef {Object} ORBData
 * @property {number} high - Opening range high
 * @property {number} low - Opening range low
 * @property {number} range - Opening range width
 * @property {number} performance - ORB performance percentage
 * @property {boolean} isBreakoutUp - Upward breakout flag
 * @property {boolean} isBreakoutDown - Downward breakout flag
 */

/**
 * @typedef {Object} RSNotification
 * @property {string} type - Notification type
 * @property {string} [timeframe] - Timeframe
 * @property {*} data - Notification data
 * @property {Object} metadata - Notification metadata
 * @property {number} timestamp - Notification timestamp
 * @property {Object} state - Current state
 */

/**
 * @typedef {Object} ErrorNotification
 * @property {string} type - Error type
 * @property {string} error - Error message
 * @property {string} [timeframe] - Affected timeframe
 * @property {number} timestamp - Error timestamp
 * @property {Object} state - Current state
 */

// Export all types for easy importing
export const TYPES = Object.freeze({
  TIMEFRAMES,
  DATA_TYPES,
  RS_RANGE,
  CACHE_CONFIG,
  ERROR_TYPES,
  DATA_QUALITY,
  TECHNICAL_INDICATORS,
  MARKET_STATUS,
  TRADING_SESSIONS,
  DEFAULT_CONFIG,
  TIMEFRAME_WEIGHTS,
  PRECISION: Object.freeze({
    PERCENT_CHANGE: PERCENT_CHANGE_PRECISION,
    RS_VALUE: RS_VALUE_PRECISION,
    PRICE: PRICE_PRECISION,
    VOLUME: VOLUME_PRECISION
  })
});

export default TYPES;