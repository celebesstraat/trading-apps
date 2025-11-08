/**
 * @typedef {Object} MarketQuote
 * @property {string} symbol - Stock ticker symbol
 * @property {number} price - Current price
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {number} volume - Trade volume
 * @property {number} [open] - Open price
 * @property {number} [high] - High price
 * @property {number} [low] - Low price
 * @property {number} [previousClose] - Previous close price
 * @property {string} source - Data provider name
 * @property {QuoteMetadata} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} QuoteMetadata
 * @property {string} [exchange] - Exchange code (e.g., 'IEX', 'NASDAQ')
 * @property {string[]} [conditions] - Trade conditions
 * @property {number} [bidPrice] - Bid price
 * @property {number} [bidSize] - Bid size
 * @property {number} [askPrice] - Ask price
 * @property {number} [askSize] - Ask size
 */

/**
 * @typedef {Object} MarketCandle
 * @property {string} symbol - Stock ticker symbol
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {number} open - Open price
 * @property {number} high - High price
 * @property {number} low - Low price
 * @property {number} close - Close price
 * @property {number} volume - Volume
 * @property {string} source - Data provider name
 */

/**
 * @typedef {Object} CandleData
 * @property {number[]} timestamps - Array of timestamps
 * @property {number[]} open - Array of open prices
 * @property {number[]} high - Array of high prices
 * @property {number[]} low - Array of low prices
 * @property {number[]} close - Array of close prices
 * @property {number[]} volume - Array of volumes
 * @property {string} symbol - Stock ticker symbol
 * @property {string} source - Data provider name
 */

/**
 * @typedef {Object} LiveDataUpdate
 * @property {string} type - Update type: 'trade' | 'quote' | 'bar'
 * @property {string} symbol - Stock ticker symbol
 * @property {number} price - Price (for trades) or close (for bars)
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {number} [volume] - Volume
 * @property {number} [size] - Trade size
 * @property {number} [bidPrice] - Bid price (for quotes)
 * @property {number} [bidSize] - Bid size (for quotes)
 * @property {number} [askPrice] - Ask price (for quotes)
 * @property {number} [askSize] - Ask size (for quotes)
 * @property {string} [exchange] - Exchange code
 * @property {string[]} [conditions] - Trade conditions
 * @property {string} source - Data provider name
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {string} [apiKeyId] - API key ID
 * @property {string} [secretKey] - Secret key
 * @property {string} [apiKey] - API key (alternative auth)
 * @property {string} [dataFeed] - Data feed type (e.g., 'iex', 'sip')
 * @property {boolean} [sandbox] - Use sandbox environment
 * @property {number} [rateLimit] - Rate limit (calls per minute)
 * @property {number} [reconnectDelay] - WebSocket reconnect delay (ms)
 * @property {number} [maxReconnectAttempts] - Max reconnection attempts
 */

/**
 * @typedef {Object} ConnectionState
 * @property {boolean} connected - WebSocket connection status
 * @property {string} [error] - Error message if any
 * @property {number} [lastConnected] - Last connection timestamp
 * @property {number} [reconnectAttempts] - Number of reconnect attempts
 */

/**
 * Candle resolution types
 * @typedef {'1' | '5' | '15' | '30' | '60' | 'D' | 'W' | 'M'} CandleResolution
 */

export const CANDLE_RESOLUTIONS = {
  MINUTE_1: '1',
  MINUTE_5: '5',
  MINUTE_15: '15',
  MINUTE_30: '30',
  HOUR_1: '60',
  DAY: 'D',
  WEEK: 'W',
  MONTH: 'M'
};

export const DATA_FEED_TYPES = {
  IEX: 'iex',           // Free tier - IEX exchange only
  SIP: 'sip',           // Paid tier - All US exchanges
  DELAYED_SIP: 'delayed_sip', // 15-minute delayed
  TEST: 'test'          // Test feed (available 24/5)
};

export const UPDATE_TYPES = {
  TRADE: 'trade',
  QUOTE: 'quote',
  BAR: 'bar'
};
