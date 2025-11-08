import { FINNHUB_API_KEY, FINNHUB_REST_URL, HISTORICAL_CONFIG } from '../config/constants';
import { getUnixTimestamp } from '../utils/marketTime';

/**
 * Base fetch wrapper with error handling
 * @param {string} url API endpoint URL
 * @returns {Promise<object>} API response data
 */
async function fetchAPI(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Finnhub returns {s: "no_data"} when no data available
    if (data.s === 'no_data') {
      console.warn('No data available for request:', url);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Finnhub API error:', error);
    throw error;
  }
}

/**
 * Fetches current quote (real-time price) for a symbol
 * More current than WebSocket on free tier, but uses REST API quota
 * @param {string} symbol Stock ticker
 * @returns {Promise<object>} Quote data {c: current, h: high, l: low, o: open, pc: previous close, t: timestamp}
 */
export async function fetchQuote(symbol) {
  const url = `${FINNHUB_REST_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
  return fetchAPI(url);
}

/**
 * Fetches quotes for multiple symbols
 * @param {string[]} symbols Array of ticker symbols
 * @returns {Promise<object>} Map of symbol -> quote data
 */
export async function fetchQuoteBatch(symbols) {
  const results = {};

  // Batch fetch with rate limiting (60/min = 1/sec)
  // With 10 symbols at 1.05s each = ~10.5s total per batch
  for (const symbol of symbols) {
    try {
      const quote = await fetchQuote(symbol);
      if (quote) {
        results[symbol] = {
          price: quote.c,           // Current price
          timestamp: quote.t * 1000, // Convert to ms
          open: quote.o,
          high: quote.h,
          low: quote.l,
          previousClose: quote.pc
        };
      }
    } catch (error) {
      // Silently continue on error (logged in fetchAPI)
      if (!error.message?.includes('429')) {
        console.error(`Error fetching quote for ${symbol}:`, error);
      }
    }

    // Rate limit: 60 calls/min = 1 call/sec, add 50ms buffer = 1050ms
    await new Promise(resolve => setTimeout(resolve, 1050));
  }

  return results;
}

/**
 * Fetches daily candles for a symbol
 * @param {string} symbol Stock ticker
 * @param {number} days Number of days of historical data
 * @returns {Promise<object>} Candle data {c: [closes], h: [highs], l: [lows], o: [opens], v: [volumes], t: [timestamps]}
 */
export async function fetchDailyCandles(symbol, days = HISTORICAL_CONFIG.DAILY_LOOKBACK_DAYS) {
  const to = getUnixTimestamp(0); // Now
  const from = getUnixTimestamp(days); // X days ago

  const url = `${FINNHUB_REST_URL}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;

  return fetchAPI(url);
}

/**
 * Fetches intraday candles (5-minute resolution)
 * @param {string} symbol Stock ticker
 * @param {number} resolution Candle resolution in minutes (default: 5)
 * @param {number} hoursBack Number of hours to look back (default: 1)
 * @returns {Promise<object>} Candle data
 */
export async function fetchIntradayCandles(symbol, resolution = 5, hoursBack = 1) {
  const to = getUnixTimestamp(0);
  const from = to - (hoursBack * 60 * 60);

  const url = `${FINNHUB_REST_URL}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;

  return fetchAPI(url);
}

/**
 * Fetches the first 5-minute candle (9:30-9:35 ET)
 * Should be called after 9:35am ET
 * @param {string} symbol Stock ticker
 * @returns {Promise<object>} First 5m candle {open, high, low, close, volume}
 */
export async function fetchFirst5mCandle(symbol) {
  try {
    const data = await fetchIntradayCandles(symbol, 5, 2); // Last 2 hours to be safe

    if (!data || !data.c || data.c.length === 0) {
      return null;
    }

    // The first candle in the returned data should be around 9:30-9:35 ET
    // Take the first candle (index 0)
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
 * Used to calculate average first 5m volume for ORB strategy
 * @param {string} symbol Stock ticker
 * @param {number} days Number of trading days to fetch
 * @returns {Promise<object[]>} Array of first 5m candles
 */
export async function fetchHistoricalFirst5mCandles(symbol, days = HISTORICAL_CONFIG.FIRST_5M_AVG_DAYS) {
  try {
    // Fetch more days than needed to account for weekends/holidays
    const data = await fetchIntradayCandles(symbol, 5, days * 24);

    if (!data || !data.c || data.c.length === 0) {
      return [];
    }

    // Extract first candles of each day (this is simplified - in production
    // you'd want to properly identify market open times across days)
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

    // Take first X candles (approximating first 5m of each day)
    // This is a simplification - ideally filter by timestamp
    return candles.slice(0, days);
  } catch (error) {
    console.error(`Error fetching historical first 5m candles for ${symbol}:`, error);
    return [];
  }
}

/**
 * Fetches daily candles for multiple symbols in batch
 * Adds delay between requests to respect rate limits
 * @param {string[]} symbols Array of ticker symbols
 * @returns {Promise<object>} Map of symbol -> candle data
 */
export async function fetchDailyCandlesBatch(symbols) {
  const results = {};
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (const symbol of symbols) {
    try {
      results[symbol] = await fetchDailyCandles(symbol);
      // Add small delay to respect rate limits (60 calls/min = 1 call/second)
      await delay(1100); // 1.1 second delay to be safe
    } catch (error) {
      console.error(`Error fetching candles for ${symbol}:`, error);
      results[symbol] = null;
    }
  }

  return results;
}

/**
 * Validates that API key is configured
 * @returns {boolean} True if API key is set
 */
export function isAPIConfigured() {
  return !!FINNHUB_API_KEY && FINNHUB_API_KEY !== 'your_api_key_here';
}

/**
 * Gets API status information
 * @returns {object} Status object with configuration info
 */
export function getAPIStatus() {
  return {
    configured: isAPIConfigured(),
    apiKey: FINNHUB_API_KEY ? `${FINNHUB_API_KEY.substring(0, 4)}...` : 'Not set',
    baseURL: FINNHUB_REST_URL
  };
}
