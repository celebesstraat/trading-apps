import { get, set, del } from 'idb-keyval';
import { FinnhubCandles, MovingAverages, RVolResult, PriceData } from '../types/types';

// Cache key with version to invalidate old caches when structure changes
const CACHE_VERSION = '4'; // Increment this to invalidate old caches (added rvolData)
const CACHE_KEY = `strategywatch-startup-data-v${CACHE_VERSION}`;

interface CacheData {
  historicalData: Record<string, FinnhubCandles>;
  movingAverages: Record<string, MovingAverages>;
  mergedPrices: Record<string, PriceData>;
  rvolData?: Record<string, RVolResult>;
}

interface CacheEntry {
  timestamp: string;
  tradingDate: string;
  data: CacheData;
}

/**
 * Gets the trading date for a given Date object.
 * The trading date is the current date unless it's after market close.
 * After 8 PM ET, we consider it the next trading day for caching purposes.
 * @param {Date} now
 * @returns {string} YYYY-MM-DD
 */
const getTradingDate = (now: Date): string => {
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  // After 8 PM ET, roll over to the next day.
  if (et.getHours() >= 20) {
    et.setDate(et.getDate() + 1);
  }
  return et.toISOString().split('T')[0];
};

/**
 * Saves data to IndexedDB with a timestamp and trading date.
 * @param {object} data The data to cache.
 */
export const saveCache = async (data: CacheData): Promise<void> => {
  const tradingDate = getTradingDate(new Date());
  const cacheEntry = {
    timestamp: new Date().toISOString(),
    tradingDate,
    data,
  };
  try {
    await set(CACHE_KEY, cacheEntry);
  } catch (error) {
    console.error('Failed to save startup cache:', error);
  }
};

/**
 * Loads data from IndexedDB. It's considered stale if the trading date is not the current one.
 * @param {string[]} expectedTickers Optional list of tickers to validate cache completeness
 * @returns {Promise<object|null>} The cached data or null if it's stale or doesn't exist.
 */
export const loadCache = async (expectedTickers: string[] | null = null): Promise<CacheData | null> => {
  try {
    const cacheEntry = await get(CACHE_KEY);
    if (!cacheEntry) return null;

    const currentTradingDate = getTradingDate(new Date());
    if (cacheEntry.tradingDate !== currentTradingDate) {
      console.log('[Cache] Stale cache discarded');
      return null;
    }

    // Validate cache completeness - ensure all expected tickers have VALID data
    if (expectedTickers && expectedTickers.length > 0) {
      const movingAverages = cacheEntry.data?.movingAverages || {};
      const missingTickers = [];
      const invalidTickers = [];

      expectedTickers.forEach(ticker => {
        if (!movingAverages[ticker]) {
          missingTickers.push(ticker);
        } else {
          // Check if the ticker has at least one valid (non-null) moving average
          const ma = movingAverages[ticker];
          const hasValidData = ma.sma5 || ma.ema10 || ma.ema21 || ma.sma50 || ma.adr20;
          if (!hasValidData) {
            invalidTickers.push(ticker);
          }
        }
      });

      if (missingTickers.length > 0 || invalidTickers.length > 0) {
        console.log(`[Cache] Incomplete data, discarding`);
        return null;
      }
    }

    console.log('[Cache] ✅ Loaded from cache');
    return cacheEntry.data;
  } catch (error) {
    console.error('[Cache] Error loading cache:', error);
    return null;
  }
};

/**
 * Clears the cache from IndexedDB
 * Useful for debugging or forcing a fresh data load
 */
export const clearCache = async (): Promise<boolean> => {
  try {
    await del(CACHE_KEY);
    console.log('[Cache] Cleared');
    return true;
  } catch (error) {
    console.error('[Cache] Clear failed:', error);
    return false;
  }
};

// Expose clearCache globally for manual cache management
if (typeof window !== 'undefined') {
  window.clearStrategyWatchCache = clearCache;
}
