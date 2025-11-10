/**
 * Alpaca Markets REST API Client
 */

import { RateLimiter } from '../../utils/rate-limit.js';
import { retry } from '../../utils/retry.js';
import { normalizeTimestamp, toUnixSeconds, normalizePrice } from '../../utils/normalization.js';
import { getRestBaseUrl, getRateLimit, convertResolutionToTimeframe, ALPACA_CONFIG } from './config.js';

export class AlpacaRestClient {
  /**
   * @param {import('../../types/market-data.js').ProviderConfig} config
   */
  constructor(config) {
    this.config = config;
    this.baseUrl = getRestBaseUrl(config.sandbox);

    // Initialize rate limiter
    const rateLimit = config.rateLimit || getRateLimit(config.dataFeed === 'sip');
    this.rateLimiter = new RateLimiter(rateLimit, 60000);
  }

  /**
   * Get authentication headers
   * @returns {Object}
   */
  getHeaders() {
    return {
      'APCA-API-KEY-ID': this.config.apiKeyId,
      'APCA-API-SECRET-KEY': this.config.secretKey
    };
  }

  /**
   * Make authenticated request to Alpaca API
   * @private
   * @param {string} endpoint - API endpoint
   * @param {Object} [params] - Query parameters
   * @returns {Promise<any>}
   */
  async request(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Trim whitespace and newline characters from values
        const cleanValue = typeof value === 'string' ? value.trim() : value;
        url.searchParams.append(key, cleanValue);
      }
    });

    return this.rateLimiter.execute(async () => {
      return retry(
        async () => {
          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: this.getHeaders(),
            signal: AbortSignal.timeout(ALPACA_CONFIG.REQUEST_TIMEOUT_MS)
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Alpaca API error (${response.status}): ${error}`);
          }

          return response.json();
        },
        {
          maxAttempts: 3,
          baseDelay: 1000,
          shouldRetry: (error) => {
            // Retry on network errors and 5xx errors, but not on auth errors
            return !error.message.includes('401') && !error.message.includes('403');
          }
        }
      );
    });
  }

  /**
   * Fetch latest quote for a symbol
   * @param {string} symbol - Stock ticker symbol
   * @returns {Promise<import('../../types/market-data.js').MarketQuote|null>}
   */
  async fetchQuote(symbol) {
    try {
      const endpoint = `/v2/stocks/${symbol}/quotes/latest`;
      const data = await this.request(endpoint, {
        feed: this.config.dataFeed || 'iex'
      });

      if (!data || !data.quote) {
        return null;
      }

      const quote = data.quote;
      const trade = data.trade || {};

      return {
        symbol: data.symbol || symbol,
        price: normalizePrice(trade.p || quote.ap || 0), // Use last trade price first, then ask price
        timestamp: normalizeTimestamp(quote.t || Date.now()),
        volume: trade.s || 0,
        open: null,
        high: null,
        low: null,
        previousClose: null,
        source: 'alpaca',
        metadata: {
          exchange: quote.ax || trade.x || 'IEX',
          bidPrice: normalizePrice(quote.bp),
          bidSize: quote.bs || 0,
          askPrice: normalizePrice(quote.ap),
          askSize: quote.as || 0,
          conditions: quote.c || []
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch latest trade for a symbol (alternative to quote)
   * @param {string} symbol - Stock ticker symbol
   * @returns {Promise<import('../../types/market-data.js').MarketQuote|null>}
   */
  async fetchLatestTrade(symbol) {
    try {
      const endpoint = `/v2/stocks/${symbol}/trades/latest`;
      const data = await this.request(endpoint, {
        feed: this.config.dataFeed || 'iex'
      });

      if (!data || !data.trade) {
        return null;
      }

      const trade = data.trade;

      return {
        symbol: data.symbol || symbol,
        price: normalizePrice(trade.p),
        timestamp: normalizeTimestamp(trade.t),
        volume: trade.s || 0,
        source: 'alpaca',
        metadata: {
          exchange: trade.x || 'IEX',
          conditions: trade.c || []
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch quotes for multiple symbols using turbocharged parallel processing
   * @param {string[]} symbols - Array of stock ticker symbols
   * @returns {Promise<Object.<string, import('../../types/market-data.js').MarketQuote>>}
   */
  async fetchQuoteBatch(symbols) {
    if (!symbols || symbols.length === 0) return {};

    try {
      const endpoint = '/v2/stocks/quotes/latest';
      const data = await this.request(endpoint, {
        symbols: symbols.join(','),
        feed: this.config.dataFeed || 'iex'
      });

      const resultMap = {};
      if (data && data.quotes) {
        Object.entries(data.quotes).forEach(([symbol, quote]) => {
          resultMap[symbol] = {
            symbol: symbol,
            price: normalizePrice(quote.ap || 0),
            timestamp: normalizeTimestamp(quote.t || Date.now()),
            volume: 0, // Not available in this endpoint
            open: null, // Not available in this endpoint
            high: null,
            low: null,
            previousClose: null, // Will fetch this from snapshot/daily bars
            source: 'alpaca',
            metadata: {
              exchange: quote.ax || 'IEX',
              bidPrice: normalizePrice(quote.bp),
              bidSize: quote.bs || 0,
              askPrice: normalizePrice(quote.ap),
              askSize: quote.as || 0,
              conditions: quote.c || []
            }
          };
        });
      }

      const snapshots = await this.fetchSnapshotBatch(symbols);
      Object.entries(snapshots).forEach(([symbol, snapshot]) => {
        if (resultMap[symbol] && snapshot.dailyBar) {
          resultMap[symbol].open = normalizePrice(snapshot.dailyBar.o);
          resultMap[symbol].high = normalizePrice(snapshot.dailyBar.h);
          resultMap[symbol].low = normalizePrice(snapshot.dailyBar.l);

          // FIX: Use latest trade or daily bar close if quote price is 0 (pre-market/after-hours)
          if (resultMap[symbol].price === 0 || !resultMap[symbol].price) {
            resultMap[symbol].price = normalizePrice(
              snapshot.latestTrade?.p ||   // Latest trade price
              snapshot.dailyBar.c ||        // Today's close/current price
              snapshot.prevDailyBar?.c ||   // Previous close as last resort
              0
            );
          }
        }
        if (resultMap[symbol] && snapshot.prevDailyBar) {
            resultMap[symbol].previousClose = normalizePrice(snapshot.prevDailyBar.c);
        }
      });

      return resultMap;

    } catch (error) {
      console.error(`[AlpacaRest] Quote fetch error:`, error.message);
      return {};
    }
  }

  /**
   * Fetch historical bars (candles) for a symbol
   * @param {string} symbol - Stock ticker symbol
   * @param {import('../../types/market-data.js').CandleResolution} resolution - Candle resolution
   * @param {number} from - Start timestamp (Unix seconds or milliseconds)
   * @param {number} to - End timestamp (Unix seconds or milliseconds)
   * @returns {Promise<import('../../types/market-data.js').CandleData|null>}
   */
  async fetchCandlesBatch(symbols, resolution, from, to) {
    if (!symbols || symbols.length === 0) return {};

    const timeframe = convertResolutionToTimeframe(resolution);
    const startDate = new Date(toUnixSeconds(from) * 1000).toISOString();
    const endDate = new Date(toUnixSeconds(to) * 1000).toISOString();

    try {
      const endpoint = '/v2/stocks/bars';
      const data = await this.request(endpoint, {
        symbols: symbols.join(','),
        timeframe,
        start: startDate,
        end: endDate,
        feed: this.config.dataFeed || 'iex',
        limit: 10000 // Max limit
      });

      const resultMap = {};
      if (data && data.bars) {
        Object.entries(data.bars).forEach(([symbol, bars]) => {
          resultMap[symbol] = {
            symbol,
            timestamps: bars.map(bar => normalizeTimestamp(bar.t)),
            open: bars.map(bar => normalizePrice(bar.o)),
            high: bars.map(bar => normalizePrice(bar.h)),
            low: bars.map(bar => normalizePrice(bar.l)),
            close: bars.map(bar => normalizePrice(bar.c)),
            volume: bars.map(bar => bar.v || 0),
            source: 'alpaca'
          };
        });
      }

      return resultMap;

    } catch (error) {
      console.error(`[AlpacaRest] Candles fetch error:`, error.message);
      return {};
    }
  }

  /**
   * Fetch snapshot (latest quote + trade + daily bar) for a symbol
   * @param {string} symbol - Stock ticker symbol
   * @returns {Promise<Object|null>}
   */
  async fetchSnapshotBatch(symbols) {
    if (!symbols || symbols.length === 0) return {};

    try {
      const endpoint = `/v2/stocks/snapshots`;
      const data = await this.request(endpoint, {
        symbols: symbols.join(','),
        feed: this.config.dataFeed || 'iex'
      });

      return data || {};
    } catch (error) {
      console.error(`[AlpacaRest] Snapshot fetch error:`, error.message);
      return {};
    }
  }

  /**
   * Get rate limiter stats
   * @returns {Object}
   */
  getStats() {
    return this.rateLimiter.getStats();
  }
}
