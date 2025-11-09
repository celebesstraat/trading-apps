/**
 * IndexedDB wrapper for storing historical 5-minute candle data for RVol calculations
 * Stores 20 days of 5m candles per ticker for efficient local access
 */

const DB_NAME = 'strategywatch-rvol-db';
const DB_VERSION = 1;
const STORE_NAME = 'candles';
const MAX_DAYS = 20; // Keep last 20 trading days

/**
 * Initialize IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export const initDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: ['ticker', 'date'] });

        // Create indexes for efficient querying
        objectStore.createIndex('ticker', 'ticker', { unique: false });
        objectStore.createIndex('date', 'date', { unique: false });
        objectStore.createIndex('ticker_date', ['ticker', 'date'], { unique: true });
      }
    };
  });
};

/**
 * Store 5m candles for a specific ticker and date
 * @param {string} ticker - Stock symbol
 * @param {string} date - Trading date (YYYY-MM-DD)
 * @param {Array} candles - Array of 5m candles { timestamp, volume, open, high, low, close }
 * @returns {Promise<void>}
 */
export const storeCandles = async (ticker, date, candles) => {
  try {
    const db = await initDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    const record = {
      ticker,
      date,
      candles,
      lastUpdated: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = objectStore.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error storing candles:', error);
    throw error;
  }
};

/**
 * Retrieve 5m candles for a specific ticker and date
 * @param {string} ticker - Stock symbol
 * @param {string} date - Trading date (YYYY-MM-DD)
 * @returns {Promise<Array|null>} Array of candles or null if not found
 */
export const getCandles = async (ticker, date) => {
  try {
    const db = await initDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = objectStore.get([ticker, date]);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.candles : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error retrieving candles:', error);
    return null;
  }
};

/**
 * Retrieve all 5m candles for a ticker across all stored dates
 * @param {string} ticker - Stock symbol
 * @returns {Promise<Array>} Array of { date, candles } objects
 */
export const getAllCandlesForTicker = async (ticker) => {
  try {
    const db = await initDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index('ticker');

    return new Promise((resolve, reject) => {
      const request = index.getAll(ticker);
      request.onsuccess = () => {
        const results = request.result || [];
        // Sort by date descending (most recent first)
        results.sort((a, b) => new Date(b.date) - new Date(a.date));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error retrieving all candles for ticker:', error);
    return [];
  }
};

/**
 * Get the last N days of candles for a ticker
 * @param {string} ticker - Stock symbol
 * @param {number} days - Number of trading days to retrieve (default: 20)
 * @returns {Promise<Array>} Array of { date, candles } objects
 */
export const getRecentCandles = async (ticker, days = MAX_DAYS) => {
  try {
    const allCandles = await getAllCandlesForTicker(ticker);
    return allCandles.slice(0, days); // Already sorted by date descending
  } catch (error) {
    console.error('Error retrieving recent candles:', error);
    return [];
  }
};

/**
 * Delete candles for a specific ticker and date
 * @param {string} ticker - Stock symbol
 * @param {string} date - Trading date (YYYY-MM-DD)
 * @returns {Promise<void>}
 */
export const deleteCandles = async (ticker, date) => {
  try {
    const db = await initDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = objectStore.delete([ticker, date]);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error deleting candles:', error);
    throw error;
  }
};

/**
 * Clean up old candles beyond MAX_DAYS for a ticker
 * @param {string} ticker - Stock symbol
 * @returns {Promise<number>} Number of records deleted
 */
export const cleanupOldCandles = async (ticker) => {
  try {
    const allCandles = await getAllCandlesForTicker(ticker);

    if (allCandles.length <= MAX_DAYS) {
      return 0; // Nothing to clean up
    }

    // Delete candles beyond MAX_DAYS
    const toDelete = allCandles.slice(MAX_DAYS);
    let deletedCount = 0;

    for (const record of toDelete) {
      await deleteCandles(ticker, record.date);
      deletedCount++;
    }

    console.log(`Cleaned up ${deletedCount} old candle records for ${ticker}`);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old candles:', error);
    return 0;
  }
};

/**
 * Clean up old candles for all tickers
 * @param {Array<string>} tickers - Array of ticker symbols
 * @returns {Promise<number>} Total number of records deleted
 */
export const cleanupAllTickers = async (tickers) => {
  let totalDeleted = 0;
  for (const ticker of tickers) {
    const deleted = await cleanupOldCandles(ticker);
    totalDeleted += deleted;
  }
  return totalDeleted;
};

/**
 * Check if we have sufficient historical data for a ticker
 * @param {string} ticker - Stock symbol
 * @param {number} minDays - Minimum number of days required (default: 10)
 * @returns {Promise<boolean>}
 */
export const hasSufficientData = async (ticker, minDays = 10) => {
  try {
    const candles = await getRecentCandles(ticker, MAX_DAYS);
    return candles.length >= minDays;
  } catch (error) {
    console.error('Error checking data sufficiency:', error);
    return false;
  }
};

/**
 * Clear all data from the database (useful for testing/reset)
 * @returns {Promise<void>}
 */
export const clearAllData = async () => {
  try {
    const db = await initDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = objectStore.clear();
      request.onsuccess = () => {
        console.log('All RVol data cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};

/**
 * Extract first 5m candle from each day's historical data
 * Used by ORB calculations to get historical first 5m candles efficiently
 * @param {string} ticker - Stock symbol
 * @param {number} days - Number of trading days to retrieve (default: 20)
 * @returns {Promise<Array>} Array of first 5m candles from each day
 */
export const getFirst5mCandles = async (ticker, days = MAX_DAYS) => {
  try {
    const recentData = await getRecentCandles(ticker, days);

    // Extract first candle from each day
    const first5mCandles = recentData
      .map(dayData => {
        if (!dayData.candles || dayData.candles.length === 0) {
          return null;
        }
        // Return the first candle (should be 9:30-9:35 AM ET)
        return {
          date: dayData.date,
          ...dayData.candles[0]
        };
      })
      .filter(candle => candle !== null);

    return first5mCandles;
  } catch (error) {
    console.error('Error extracting first 5m candles:', error);
    return [];
  }
};

/**
 * Get today's intraday candles from IndexedDB if available
 * @param {string} ticker - Stock symbol
 * @param {string} today - Today's date (YYYY-MM-DD)
 * @returns {Promise<Array|null>} Array of today's candles or null if not found
 */
export const getTodayCandles = async (ticker, today) => {
  try {
    return await getCandles(ticker, today);
  } catch (error) {
    console.error('Error retrieving today\'s candles:', error);
    return null;
  }
};

/**
 * Get database statistics
 * @returns {Promise<Object>} Database stats
 */
export const getDatabaseStats = async () => {
  try {
    const db = await initDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = objectStore.count();
      request.onsuccess = () => {
        resolve({
          totalRecords: request.result,
          maxDays: MAX_DAYS,
          dbName: DB_NAME,
          version: DB_VERSION
        });
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting database stats:', error);
    return { totalRecords: 0, maxDays: MAX_DAYS, dbName: DB_NAME, version: DB_VERSION };
  }
};
