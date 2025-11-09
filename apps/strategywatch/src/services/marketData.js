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
 * Gets the timestamp for today's 9:30 AM ET (market open)
 * @returns {number} Unix timestamp in milliseconds
 */
function getTodayMarketOpenTimestamp() {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const etDate = new Date(etString);

  // Set to 9:30 AM ET
  etDate.setHours(9, 30, 0, 0);

  return etDate.getTime();
}

/**
 * Fetches the first 5-minute candle (9:30-9:35 ET) for today
 * Should be called after 9:35am ET
 * @param {string} symbol - Stock ticker
 * @returns {Promise<object>} First 5m candle or null
 */
export async function fetchFirst5mCandle(symbol) {
  try {
    // Get today's market open timestamp (9:30 AM ET)
    const marketOpenTime = getTodayMarketOpenTimestamp();

    // Fetch 5m candles from 9:00 AM to 11:00 AM ET (2 hours window)
    const from = marketOpenTime - (30 * 60 * 1000); // 30 min before open
    const to = marketOpenTime + (90 * 60 * 1000); // 90 min after open

    const provider = getProvider();
    const candles = await provider.fetchCandles(symbol, '5', from, to);

    if (!candles || !candles.close || candles.close.length === 0) {
      return null;
    }

    // Find the candle that starts at 9:30 AM ET (within 5-minute tolerance)
    const targetTime = marketOpenTime;
    const tolerance = 5 * 60 * 1000; // 5 minutes in milliseconds

    let closestIndex = -1;
    let closestDiff = Infinity;

    for (let i = 0; i < candles.timestamps.length; i++) {
      const candleTime = candles.timestamps[i];
      const diff = Math.abs(candleTime - targetTime);

      if (diff < closestDiff && diff <= tolerance) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    if (closestIndex === -1) {
      console.warn(`No 9:30 AM candle found for ${symbol}`);
      return null;
    }

    return {
      open: candles.open[closestIndex],
      high: candles.high[closestIndex],
      low: candles.low[closestIndex],
      close: candles.close[closestIndex],
      volume: candles.volume[closestIndex],
      timestamp: candles.timestamps[closestIndex]
    };
  } catch (error) {
    console.error(`Error fetching first 5m candle for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetches historical first 5-minute candles (9:30-9:35 ET) for the last N trading days
 * Used for RVOL calculation in the 5m ORB strategy
 * @param {string} symbol - Stock ticker
 * @param {number} days - Number of trading days to fetch (default: 20)
 * @returns {Promise<object[]>} Array of first 5m candles (one per day)
 */
export async function fetchHistoricalFirst5mCandles(symbol, days = 20) {
  try {
    // Fetch last N days of 5m candles
    // We need to fetch more days than requested to account for weekends
    const daysToFetch = days * 2; // Fetch 2x to account for weekends
    const provider = getProvider();
    const to = Date.now();
    const from = to - (daysToFetch * 24 * 60 * 60 * 1000);

    const candles = await provider.fetchCandles(symbol, '5', from, to);

    if (!candles || !candles.close || candles.close.length === 0) {
      return [];
    }

    // Group candles by trading day and extract the first 5m candle of each day
    const dailyFirstCandles = [];
    const seenDates = new Set();

    for (let i = 0; i < candles.timestamps.length; i++) {
      const candleTime = new Date(candles.timestamps[i]);

      // Convert to ET
      const etString = candleTime.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const [datePart, timePart] = etString.split(', ');
      const [month, day, year] = datePart.split('/');
      const dateKey = `${year}-${month}-${day}`;
      const [hour, minute] = timePart.split(':').map(Number);

      // Check if this is the 9:30 AM candle (within tolerance)
      const is930Candle = hour === 9 && minute >= 30 && minute < 35;

      if (is930Candle && !seenDates.has(dateKey)) {
        seenDates.add(dateKey);
        dailyFirstCandles.push({
          open: candles.open[i],
          high: candles.high[i],
          low: candles.low[i],
          close: candles.close[i],
          volume: candles.volume[i],
          timestamp: candles.timestamps[i],
          date: dateKey
        });

        // Stop if we have enough days
        if (dailyFirstCandles.length >= days) {
          break;
        }
      }
    }

    return dailyFirstCandles;
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
 * Fetches all 5-minute candles for the last N trading days (for RVol calculation)
 * Returns candles grouped by date
 * @param {string} symbol - Stock ticker
 * @param {number} days - Number of trading days to fetch (default: 20)
 * @returns {Promise<Array>} Array of { date, candles: [{ timestamp, volume, open, high, low, close }] }
 */
export async function fetchHistorical5mCandlesForRVol(symbol, days = 20) {
  try {
    // Fetch more calendar days to ensure we get enough trading days
    const daysToFetch = days * 2; // Account for weekends and holidays
    const provider = getProvider();
    const to = Date.now();
    const from = to - (daysToFetch * 24 * 60 * 60 * 1000);

    const candles = await provider.fetchCandles(symbol, '5', from, to);

    if (!candles || !candles.close || candles.close.length === 0) {
      return [];
    }

    // Group candles by trading day (ET timezone)
    const candlesByDate = new Map();

    for (let i = 0; i < candles.timestamps.length; i++) {
      const candleTime = new Date(candles.timestamps[i]);

      // Convert to ET timezone
      const etString = candleTime.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const [datePart, timePart] = etString.split(', ');
      const [month, day, year] = datePart.split('/');
      const dateKey = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const [hour, minute] = timePart.split(':').map(Number);

      // Only include market hours (9:30 AM - 4:00 PM ET)
      const isMarketHours =
        (hour > 9 || (hour === 9 && minute >= 30)) &&
        (hour < 16);

      if (isMarketHours) {
        if (!candlesByDate.has(dateKey)) {
          candlesByDate.set(dateKey, []);
        }

        candlesByDate.get(dateKey).push({
          timestamp: candles.timestamps[i],
          volume: candles.volume[i],
          open: candles.open[i],
          high: candles.high[i],
          low: candles.low[i],
          close: candles.close[i]
        });
      }
    }

    // Convert map to array and sort by date (most recent first)
    const result = Array.from(candlesByDate.entries())
      .map(([date, candlesList]) => ({
        date,
        candles: candlesList.sort((a, b) => a.timestamp - b.timestamp) // Sort candles by time
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort dates descending

    // Return only the requested number of trading days
    return result.slice(0, days);
  } catch (error) {
    console.error(`Error fetching historical 5m candles for RVol (${symbol}):`, error);
    return [];
  }
}

/**
 * Fetches today's 5-minute candles (for RVol calculation)
 * @param {string} symbol - Stock ticker
 * @returns {Promise<Array>} Array of { timestamp, volume, open, high, low, close }
 */
export async function fetchTodayIntradayCandles(symbol) {
  try {
    // Get today's market open timestamp (9:30 AM ET)
    const marketOpenTime = getTodayMarketOpenTimestamp();
    const now = Date.now();

    // Fetch from market open to now
    const provider = getProvider();
    const candles = await provider.fetchCandles(symbol, '5', marketOpenTime, now);

    if (!candles || !candles.close || candles.close.length === 0) {
      return [];
    }

    // Transform to simple array format
    const result = [];
    for (let i = 0; i < candles.timestamps.length; i++) {
      result.push({
        timestamp: candles.timestamps[i],
        volume: candles.volume[i],
        open: candles.open[i],
        high: candles.high[i],
        low: candles.low[i],
        close: candles.close[i]
      });
    }

    // Sort by timestamp (should already be sorted, but ensure it)
    return result.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error(`Error fetching today's intraday candles (${symbol}):`, error);
    return [];
  }
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
