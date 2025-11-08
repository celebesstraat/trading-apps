/**
 * Market Data Service for StrategyWatch
 * Provides unified interface to market data using the shared package
 */

import { createProvider } from '@trading-apps/market-data';
import { MARKET_DATA_CONFIG } from '../config/constants';
import { getUnixTimestamp } from '../utils/marketTime';

// Singleton provider instance
let providerInstance = null;

/**
 * Get or create market data provider
 * @returns {import('@trading-apps/market-data').BaseProvider}
 */
export function getProvider() {
  if (!providerInstance) {
    providerInstance = createProvider('alpaca', {
      apiKeyId: MARKET_DATA_CONFIG.API_KEY_ID,
      secretKey: MARKET_DATA_CONFIG.SECRET_KEY,
      dataFeed: MARKET_DATA_CONFIG.DATA_FEED,
      sandbox: MARKET_DATA_CONFIG.SANDBOX,
      rateLimit: MARKET_DATA_CONFIG.RATE_LIMIT
    });
  }

  return providerInstance;
}

/**
 * Fetches current quote (real-time price) for a symbol
 * @param {string} symbol - Stock ticker
 * @returns {Promise<object>} Quote data
 */
export async function fetchQuote(symbol) {
  const provider = getProvider();
  const quote = await provider.fetchQuote(symbol);

  if (!quote) {
    return null;
  }

  // Return in format expected by existing app
  return {
    price: quote.price,
    timestamp: quote.timestamp,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    previousClose: quote.previousClose,
    volume: quote.volume
  };
}

/**
 * Fetches quotes for multiple symbols
 * @param {string[]} symbols - Array of ticker symbols
 * @returns {Promise<object>} Map of symbol -> quote data
 */
export async function fetchQuoteBatch(symbols) {
  const provider = getProvider();
  const quotes = await provider.fetchQuoteBatch(symbols);

  // Transform to expected format
  const results = {};
  for (const [symbol, quote] of Object.entries(quotes)) {
    results[symbol] = {
      price: quote.price,
      timestamp: quote.timestamp,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      previousClose: quote.previousClose,
      volume: quote.volume
    };
  }

  return results;
}

/**
 * Fetches daily candles for a symbol
 * @param {string} symbol - Stock ticker
 * @param {number} days - Number of days of historical data
 * @returns {Promise<object>} Candle data
 */
export async function fetchDailyCandles(symbol, days = 250) {
  const provider = getProvider();
  const to = getUnixTimestamp(0); // Now
  const from = getUnixTimestamp(days); // X days ago

  const candles = await provider.fetchCandles(symbol, 'D', from, to);

  if (!candles) {
    return null;
  }

  // Transform to Finnhub-compatible format (arrays)
  return {
    c: candles.close,
    h: candles.high,
    l: candles.low,
    o: candles.open,
    v: candles.volume,
    t: candles.timestamps.map(ts => Math.floor(ts / 1000)), // Convert to Unix seconds
    s: 'ok'
  };
}

/**
 * Fetches intraday candles (5-minute resolution)
 * @param {string} symbol - Stock ticker
 * @param {number} resolution - Candle resolution in minutes (default: 5)
 * @param {number} hoursBack - Number of hours to look back (default: 1)
 * @returns {Promise<object>} Candle data
 */
export async function fetchIntradayCandles(symbol, resolution = 5, hoursBack = 1) {
  const provider = getProvider();
  const to = Date.now();
  const from = to - (hoursBack * 60 * 60 * 1000);

  const resolutionStr = resolution.toString();
  const candles = await provider.fetchCandles(symbol, resolutionStr, from, to);

  if (!candles) {
    return null;
  }

  // Transform to Finnhub-compatible format
  return {
    c: candles.close,
    h: candles.high,
    l: candles.low,
    o: candles.open,
    v: candles.volume,
    t: candles.timestamps.map(ts => Math.floor(ts / 1000)), // Convert to Unix seconds
    s: 'ok'
  };
}

/**
 * Fetches the first 5-minute candle (9:30-9:35 ET)
 * Should be called after 9:35am ET
 * @param {string} symbol - Stock ticker
 * @returns {Promise<object>} First 5m candle
 */
export async function fetchFirst5mCandle(symbol) {
  try {
    const data = await fetchIntradayCandles(symbol, 5, 2); // Last 2 hours to be safe

    if (!data || !data.c || data.c.length === 0) {
      return null;
    }

    // The first candle in the returned data should be around 9:30-9:35 ET
    const index = 0;

    return {
      open: data.o[index],
      high: data.h[index],
      low: data.l[index],
      close: data.c[index],
      volume: data.v[index],
      timestamp: data.t[index]
    };
  } catch (error) {
    console.error(`Error fetching first 5m candle for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetches historical first 5-minute candles for multiple days
 * @param {string} symbol - Stock ticker
 * @param {number} days - Number of trading days to fetch
 * @returns {Promise<object[]>} Array of first 5m candles
 */
export async function fetchHistoricalFirst5mCandles(symbol, days = 20) {
  try {
    const data = await fetchIntradayCandles(symbol, 5, days * 24);

    if (!data || !data.c || data.c.length === 0) {
      return [];
    }

    // Extract candles
    const candles = [];
    for (let i = 0; i < data.c.length; i++) {
      candles.push({
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v[i],
        timestamp: data.t[i]
      });
    }

    // Take first X candles
    return candles.slice(0, days);
  } catch (error) {
    console.error(`Error fetching historical first 5m candles for ${symbol}:`, error);
    return [];
  }
}

/**
 * Fetches latest minute bar with VWAP for a symbol
 * @param {string} symbol - Stock ticker
 * @returns {Promise<object>} Latest bar with VWAP
 */
export async function fetchLatestBarWithVWAP(symbol) {
  try {
    const provider = getProvider();
    const to = Date.now();
    const from = to - (60 * 60 * 1000); // Last hour

    const candles = await provider.fetchCandles(symbol, '1', from, to);

    if (!candles || !candles.close || candles.close.length === 0) {
      return null;
    }

    // Get the most recent candle
    const lastIndex = candles.close.length - 1;

    return {
      price: candles.close[lastIndex],
      vwap: candles.vwap ? candles.vwap[lastIndex] : null,
      volume: candles.volume[lastIndex],
      timestamp: candles.timestamps[lastIndex]
    };
  } catch (error) {
    console.error(`Error fetching latest bar for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetches latest minute bars with VWAP for multiple symbols
 * @param {string[]} symbols - Array of ticker symbols
 * @returns {Promise<object>} Map of symbol -> bar data with VWAP
 */
export async function fetchLatestBarsWithVWAP(symbols) {
  const results = {};

  for (const symbol of symbols) {
    try {
      results[symbol] = await fetchLatestBarWithVWAP(symbol);
    } catch (error) {
      console.error(`Error fetching bar for ${symbol}:`, error);
      results[symbol] = null;
    }
  }

  return results;
}

/**
 * Fetches daily candles for multiple symbols in batch
 * @param {string[]} symbols - Array of ticker symbols
 * @returns {Promise<object>} Map of symbol -> candle data
 */
export async function fetchDailyCandlesBatch(symbols) {
  const results = {};

  for (const symbol of symbols) {
    try {
      results[symbol] = await fetchDailyCandles(symbol);
    } catch (error) {
      console.error(`Error fetching candles for ${symbol}:`, error);
      results[symbol] = null;
    }
  }

  return results;
}

/**
 * Validates that API is configured
 * @returns {boolean} True if API is configured
 */
export function isAPIConfigured() {
  return !!(
    MARKET_DATA_CONFIG.API_KEY_ID &&
    MARKET_DATA_CONFIG.SECRET_KEY &&
    MARKET_DATA_CONFIG.API_KEY_ID !== 'your_api_key_id_here'
  );
}

/**
 * Gets API status information
 * @returns {object} Status object with configuration info
 */
export function getAPIStatus() {
  const provider = getProvider();

  return {
    configured: isAPIConfigured(),
    provider: provider.getName(),
    capabilities: provider.getCapabilities(),
    apiKeyId: MARKET_DATA_CONFIG.API_KEY_ID
      ? `${MARKET_DATA_CONFIG.API_KEY_ID.substring(0, 4)}...`
      : 'Not set'
  };
}

/**
 * Get provider connection state
 * @returns {object} Connection state
 */
export function getConnectionState() {
  const provider = getProvider();
  return provider.getConnectionState();
}

/**
 * Disconnect provider
 * @returns {Promise<void>}
 */
export async function disconnect() {
  if (providerInstance) {
    await providerInstance.disconnect();
    providerInstance = null;
  }
}
