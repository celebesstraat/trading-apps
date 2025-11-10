/**
 * Alpaca Markets Provider
 * Combines REST and WebSocket clients into unified interface
 */

import { BaseProvider } from '../base.js';
import { AlpacaRestClient } from './rest.js';
import { AlpacaWebSocketClient } from './websocket.js';

export class AlpacaProvider extends BaseProvider {
  /**
   * @param {import('../../types/market-data.js').ProviderConfig} config
   */
  constructor(config) {
    super(config);

    // Validate configuration
    if (!config.apiKeyId || !config.secretKey) {
      throw new Error('Alpaca provider requires apiKeyId and secretKey');
    }

    // Initialize clients
    this.restClient = new AlpacaRestClient(config);
    this.wsClient = new AlpacaWebSocketClient(config);
  }

  /**
   * Fetch current quote for a single symbol
   * @param {string} symbol - Stock ticker symbol
   * @returns {Promise<import('../../types/market-data.js').MarketQuote|null>}
   */
  async fetchQuote(symbol) {
    return this.restClient.fetchLatestTrade(symbol);
  }

  /**
   * Fetch quotes for multiple symbols
   * @param {string[]} symbols - Array of stock ticker symbols
   * @returns {Promise<Object.<string, import('../../types/market-data.js').MarketQuote>>}
   */
  async fetchQuoteBatch(symbols) {
    return this.restClient.fetchQuoteBatch(symbols);
  }

  /**
   * Fetch historical candles for a symbol
   * @param {string} symbol - Stock ticker symbol
   * @param {import('../../types/market-data.js').CandleResolution} resolution - Candle resolution
   * @param {number} from - Start timestamp (Unix seconds or milliseconds)
   * @param {number} to - End timestamp (Unix seconds or milliseconds)
   * @returns {Promise<import('../../types/market-data.js').CandleData|null>}
   */
  async fetchCandles(symbol, resolution, from, to) {
    const results = await this.restClient.fetchCandlesBatch([symbol], resolution, from, to);
    return results[symbol] || null;
  }

  async fetchCandlesBatch(symbols, resolution, from, to) {
    return this.restClient.fetchCandlesBatch(symbols, resolution, from, to);
  }

  /**
   * Fetch snapshot (comprehensive data) for a symbol
   * @param {string} symbol - Stock ticker symbol
   * @returns {Promise<Object|null>}
   */
  async fetchSnapshot(symbol) {
    return this.restClient.fetchSnapshot(symbol);
  }

  /**
   * Subscribe to real-time data for symbols
   * @param {string[]} symbols - Array of symbols to subscribe to
   * @param {function(import('../../types/market-data.js').LiveDataUpdate): void} callback - Callback for updates
   * @returns {Promise<void>}
   */
  async subscribeLive(symbols, callback) {
    await this.wsClient.subscribe(symbols, callback);
    this.connected = this.wsClient.connected && this.wsClient.authenticated;
  }

  /**
   * Unsubscribe from real-time data
   * @param {string[]} symbols - Array of symbols to unsubscribe from
   * @returns {Promise<void>}
   */
  async unsubscribeLive(symbols) {
    this.wsClient.unsubscribe(symbols);
  }

  /**
   * Disconnect from all services
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.wsClient.disconnect();
    this.connected = false;
  }

  /**
   * Get current connection state
   * @returns {import('../../types/market-data.js').ConnectionState}
   */
  getConnectionState() {
    return this.wsClient.getConnectionState();
  }

  /**
   * Get provider name
   * @returns {string}
   */
  getName() {
    return 'alpaca';
  }

  /**
   * Get provider capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      realtime: true,
      historical: true,
      websocket: true,
      rest: true,
      dataFeed: this.config.dataFeed || 'iex'
    };
  }

  /**
   * Get REST client stats (rate limiting info)
   * @returns {Object}
   */
  getRestStats() {
    return this.restClient.getStats();
  }
}

export default AlpacaProvider;
