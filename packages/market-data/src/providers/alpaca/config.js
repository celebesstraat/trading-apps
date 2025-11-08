/**
 * Alpaca Markets API configuration
 */

export const ALPACA_CONFIG = {
  // REST API endpoints
  REST_URL_PROD: 'https://data.alpaca.markets',
  REST_URL_SANDBOX: 'https://data.sandbox.alpaca.markets',

  // WebSocket endpoints
  WS_URL_PROD: 'wss://stream.data.alpaca.markets',
  WS_URL_SANDBOX: 'wss://stream.data.sandbox.alpaca.markets',

  // API versions
  API_VERSION: 'v2',

  // Data feeds
  FEED_IEX: 'iex',        // Free tier - real-time IEX data
  FEED_SIP: 'sip',        // Paid tier - consolidated tape
  FEED_TEST: 'test',      // Test feed (available 24/5)

  // Rate limits (calls per minute)
  RATE_LIMIT_FREE: 200,
  RATE_LIMIT_PAID: 10000,

  // WebSocket limits
  WS_SYMBOLS_LIMIT_FREE: 30,
  WS_SYMBOLS_LIMIT_PAID: 1000,

  // Reconnection settings
  RECONNECT_DELAY_MS: 1000,
  RECONNECT_MAX_DELAY_MS: 30000,
  RECONNECT_MAX_ATTEMPTS: 10,

  // Timeouts
  AUTH_TIMEOUT_MS: 10000,
  REQUEST_TIMEOUT_MS: 30000,

  // Candle resolutions mapping
  RESOLUTIONS: {
    '1': '1Min',
    '5': '5Min',
    '15': '15Min',
    '30': '30Min',
    '60': '1Hour',
    'D': '1Day',
    'W': '1Week',
    'M': '1Month'
  }
};

/**
 * Get REST API base URL
 * @param {boolean} sandbox - Use sandbox environment
 * @returns {string}
 */
export function getRestBaseUrl(sandbox = false) {
  return sandbox ? ALPACA_CONFIG.REST_URL_SANDBOX : ALPACA_CONFIG.REST_URL_PROD;
}

/**
 * Get WebSocket URL
 * @param {string} feed - Data feed type ('iex', 'sip', 'test')
 * @param {boolean} sandbox - Use sandbox environment
 * @returns {string}
 */
export function getWebSocketUrl(feed, sandbox = false) {
  const baseUrl = sandbox ? ALPACA_CONFIG.WS_URL_SANDBOX : ALPACA_CONFIG.WS_URL_PROD;
  return `${baseUrl}/${ALPACA_CONFIG.API_VERSION}/${feed}`;
}

/**
 * Get rate limit for plan
 * @param {boolean} isPaid - Is paid plan
 * @returns {number}
 */
export function getRateLimit(isPaid = false) {
  return isPaid ? ALPACA_CONFIG.RATE_LIMIT_PAID : ALPACA_CONFIG.RATE_LIMIT_FREE;
}

/**
 * Convert resolution to Alpaca timeframe
 * @param {string} resolution - Candle resolution
 * @returns {string}
 */
export function convertResolutionToTimeframe(resolution) {
  return ALPACA_CONFIG.RESOLUTIONS[resolution] || '1Day';
}
