/**
 * Base Market Data Provider Interface
 * All providers must implement this interface for consistency
 */
export class BaseProvider {
  /**
   * @param {import('../types/market-data.js').ProviderConfig} config
   */
  constructor(config) {
    this.config = config;
    this.connected = false;
  }

  /**
   * Fetch current quote for a single symbol
   * @param {string} symbol - Stock ticker symbol
   * @returns {Promise<import('../types/market-data.js').MarketQuote|null>}
   */
  async fetchQuote(symbol) {
    throw new Error('fetchQuote() must be implemented by provider');
  }

  /**
   * Fetch quotes for multiple symbols
   * @param {string[]} symbols - Array of stock ticker symbols
   * @returns {Promise<Object.<string, import('../types/market-data.js').MarketQuote>>}
   */
  async fetchQuoteBatch(symbols) {
    throw new Error('fetchQuoteBatch() must be implemented by provider');
  }

  /**
   * Fetch historical candles for a symbol
   * @param {string} symbol - Stock ticker symbol
   * @param {import('../types/market-data.js').CandleResolution} resolution - Candle resolution
   * @param {number} from - Start timestamp (Unix seconds or milliseconds)
   * @param {number} to - End timestamp (Unix seconds or milliseconds)
   * @returns {Promise<import('../types/market-data.js').CandleData|null>}
   */
  async fetchCandles(symbol, resolution, from, to) {
    throw new Error('fetchCandles() must be implemented by provider');
  }

  /**
   * Subscribe to real-time data for symbols
   * @param {string[]} symbols - Array of symbols to subscribe to
   * @param {function(import('../types/market-data.js').LiveDataUpdate): void} callback - Callback for updates
   * @returns {Promise<void>}
   */
  async subscribeLive(symbols, callback) {
    throw new Error('subscribeLive() must be implemented by provider');
  }

  /**
   * Unsubscribe from real-time data
   * @param {string[]} symbols - Array of symbols to unsubscribe from
   * @returns {Promise<void>}
   */
  async unsubscribeLive(symbols) {
    throw new Error('unsubscribeLive() must be implemented by provider');
  }

  /**
   * Disconnect from all services
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by provider');
  }

  /**
   * Get current connection state
   * @returns {import('../types/market-data.js').ConnectionState}
   */
  getConnectionState() {
    return {
      connected: this.connected,
      error: null,
      lastConnected: null,
      reconnectAttempts: 0
    };
  }

  /**
   * Get provider name
   * @returns {string}
   */
  getName() {
    throw new Error('getName() must be implemented by provider');
  }

  /**
   * Get provider capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      realtime: false,
      historical: false,
      websocket: false,
      rest: false
    };
  }
}
