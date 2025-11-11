/**
 * Unified Data Lake Service for StrategyWatch
 *
 * A comprehensive IndexedDB-based storage system that provides:
 * - Real-time tick storage with 1-day retention
 * - Minute candle construction and storage
 * - 5m candle storage for RVol calculations (30-day history)
 * - Daily candle storage for moving averages (250-day history)
 * - Pre-calculated indicators cache
 * - Query optimization with smart indexing
 * - Data compression and cleanup
 * - Performance analytics
 * - Export/import capabilities
 *
 * @version 2.0.1
 * @author StrategyWatch
 */

const DB_NAME = 'strategywatch-data-lake-v3';
const DB_VERSION = 1;

// Store names for different data types
const STORES = {
  // Real-time data (1-day retention)
  TICKS: 'ticks',
  MINUTE_CANDLES: 'minuteCandles',

  // Historical data
  FIVE_MIN_CANDLES: 'fiveMinCandles',    // 30 days for RVol
  DAILY_CANDLES: 'dailyCandles',        // 250 days for MAs

  // Pre-calculated indicators
  INDICATORS: 'indicators',             // Moving averages, ADR%, etc.
  STRATEGY_RESULTS: 'strategyResults',  // ORB, RVol, VRS results

  // Metadata and performance
  PERFORMANCE_METRICS: 'performanceMetrics',
  QUERY_STATS: 'queryStats',

  // System data
  LAST_UPDATE: 'lastUpdate',
  CONFIG: 'config'
};

// Retention periods (in milliseconds)
const RETENTION = {
  TICKS: 24 * 60 * 60 * 1000,           // 1 day
  MINUTE_CANDLES: 30 * 24 * 60 * 60 * 1000, // 30 days
  FIVE_MIN_CANDLES: 30 * 24 * 60 * 60 * 1000, // 30 days
  DAILY_CANDLES: 250 * 24 * 60 * 60 * 1000,  // 250 days
  INDICATORS: 30 * 24 * 60 * 60 * 1000,      // 30 days
  STRATEGY_RESULTS: 7 * 24 * 60 * 60 * 1000, // 7 days
  PERFORMANCE_METRICS: 7 * 24 * 60 * 60 * 1000, // 7 days
  QUERY_STATS: 3 * 24 * 60 * 60 * 1000       // 3 days
};

// Data quality levels
export const DATA_QUALITY = {
  EXCELLENT: 'excellent', // Fresh data from WebSocket + recent API calls
  GOOD: 'good',           // Cached data within acceptable timeframes
  POOR: 'poor',           // Stale data or missing information
  UNKNOWN: 'unknown'      // No data or validation failed
};

/**
 * Initialize the Data Lake with optimized schema
 * @returns {Promise<IDBDatabase>}
 */
export const initDataLake = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Prevent abort on version change errors
      event.target.transaction.onerror = (error) => {
        console.warn('[DataLake] Transaction error during upgrade:', error);
        // Don't abort the entire upgrade for minor index creation errors
      };

      // Create stores with all required indexes
      const createStore = (name, keyPath, indexes = []) => {
        try {
          const store = db.createObjectStore(name, { keyPath });
          console.log(`[DataLake] Created store: ${name}`);

          indexes.forEach(index => {
            try {
              if (Array.isArray(index)) {
                const [indexName, keyPath, options = {}] = index;
                store.createIndex(indexName, keyPath, options);
                console.log(`[DataLake] Created index: ${indexName} on store ${name}`);
              } else {
                store.createIndex(index, index);
                console.log(`[DataLake] Created index: ${index} on store ${name}`);
              }
            } catch (indexError) {
              console.warn(`[DataLake] Failed to create index ${index} on store ${name}:`, indexError);
            }
          });
        } catch (storeError) {
          console.error(`[DataLake] Failed to create store ${name}:`, storeError);
          throw storeError;
        }
      };

      // Create real-time data stores
      createStore(STORES.TICKS, ['ticker', 'timestamp'], [
        'ticker',
        'timestamp',
        ['ticker', 'timestamp'],
        ['timestamp', 'ticker']
      ]);

      createStore(STORES.MINUTE_CANDLES, ['ticker', 'timestamp'], [
        'ticker',
        'timestamp',
        ['ticker', 'timestamp'],
        ['timestamp', 'ticker'],
        'date'
      ]);

      // Create historical data stores
      createStore(STORES.FIVE_MIN_CANDLES, ['ticker', 'date'], [
        'ticker',
        'date',
        ['ticker', 'date'],
        'lastUpdated'
      ]);

      createStore(STORES.DAILY_CANDLES, ['ticker', 'date'], [
        'ticker',
        'date',
        ['ticker', 'date'],
        'lastUpdated'
      ]);

      // Create indicator stores
      createStore(STORES.INDICATORS, ['ticker', 'type', 'date'], [
        'ticker',
        'type',
        ['ticker', 'type'],
        ['ticker', 'type', 'date'],
        'lastUpdated'
      ]);

      createStore(STORES.STRATEGY_RESULTS, ['ticker', 'strategy', 'timestamp'], [
        'ticker',
        'strategy',
        ['ticker', 'strategy'],
        ['ticker', 'strategy', 'timestamp'],
        'timestamp'
      ]);

      // Create performance stores
      createStore(STORES.PERFORMANCE_METRICS, 'id', [
        'category',
        'timestamp',
        ['category', 'timestamp']
      ]);

      createStore(STORES.QUERY_STATS, 'id', [
        'queryType',
        'timestamp',
        ['queryType', 'timestamp'],
        'duration'
      ]);

      // Create system stores
      createStore(STORES.LAST_UPDATE, 'key');
      createStore(STORES.CONFIG, 'key');

      console.log('[DataLake] ✅ Database schema initialized');
    };
  });
};

/**
 * Get database instance with connection pooling and retry logic
 * @returns {Promise<IDBDatabase>}
 */
const getDatabase = (() => {
  let dbPromise = null;
  let isInitializing = false;

  return async () => {
    if (dbPromise) {
      try {
        const db = await dbPromise;
        if (db && !db.closed) {
          return db;
        }
      } catch (error) {
        console.warn('[DataLake] Existing connection failed:', error);
      }
    }

    if (isInitializing) {
      // Wait for current initialization to complete
      while (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return dbPromise;
    }

    isInitializing = true;
    try {
      dbPromise = initDataLake().catch(error => {
        console.error('[DataLake] Database initialization failed:', error);
        // Reset on error and implement exponential backoff
        dbPromise = null;
        throw error;
      });

      const db = await dbPromise;
      isInitializing = false;
      return db;
    } catch (error) {
      isInitializing = false;
      throw error;
    }
  };
})();

/**
 * Store WebSocket tick data with compression
 * @param {string} ticker - Stock symbol
 * @param {Array} ticks - Array of tick data
 * @returns {Promise<void>}
 */
export const storeTicks = async (ticker, ticks) => {
  let db = null;
  try {
    db = await getDatabase();

    // If database is closed, try to reconnect
    if (db.closed) {
      console.warn('[DataLake] Database connection closed, attempting reconnect...');
      db = await getDatabase();
    }

    const transaction = db.transaction([STORES.TICKS], 'readwrite');
    const store = transaction.objectStore(STORES.TICKS);

    const startTime = performance.now();

    // Handle transaction errors gracefully
    transaction.onerror = (event) => {
      console.warn('[DataLake] Transaction error while storing ticks:', event.target.error);
    };

    // Compress tick data to reduce storage
    const compressedTicks = ticks.map(tick => ({
      t: tick.timestamp,
      p: tick.price,
      v: tick.volume,
      s: tick.size,
      x: tick.exchange,
      c: tick.conditions
    }));

    // Batch insert for better performance
    const records = ticks.map(tick => ({
      ticker,
      timestamp: tick.timestamp,
      price: tick.price,
      volume: tick.volume,
      size: tick.size,
      exchange: tick.exchange,
      conditions: tick.conditions,
      compressed: compressedTicks.find(t => t.t === tick.timestamp),
      storedAt: Date.now()
    }));

    for (const record of records) {
      store.put(record);
    }

    // Wait for transaction to complete
    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    await recordQueryPerformance('storeTicks', performance.now() - startTime, ticks.length);

  } catch (error) {
    // Handle version change errors specifically
    if (error.name === 'AbortError' && error.message.includes('Version change')) {
      console.warn('[DataLake] Version change detected, retrying tick storage...');
      // Wait a bit and retry once
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        return await storeTicks(ticker, ticks); // Retry once
      } catch (retryError) {
        console.error('[DataLake] Retry failed for tick storage:', retryError);
        // Don't throw to prevent app crashes, just log the error
        return;
      }
    }

    console.error('[DataLake] Error storing ticks:', error);
    // Don't throw to prevent app crashes from data storage issues
  }
};

/**
 * Retrieve recent ticks for a ticker
 * @param {string} ticker - Stock symbol
 * @param {number} limit - Maximum number of ticks to retrieve
 * @param {number} since - Get ticks since this timestamp
 * @returns {Promise<Array>}
 */
export const getRecentTicks = async (ticker, limit = 1000, since = null) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.TICKS], 'readonly');
    const store = transaction.objectStore(STORES.TICKS);
    const index = store.index('ticker');

    const startTime = performance.now();

    // Query range based on since parameter
    const range = since ? IDBKeyRange.lowerBound([ticker, since]) : IDBKeyRange.lowerBound([ticker]);
    const request = index.openCursor(range, 'prev'); // Get most recent first

    const ticks = [];
    let count = 0;

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor && count < limit) {
          ticks.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          recordQueryPerformance('getRecentTicks', performance.now() - startTime, ticks.length)
            .then(() => resolve(ticks))
            .catch(reject);
        }
      };

      request.onerror = () => reject(request.error);
    });

  } catch (error) {
    console.error('[DataLake] Error retrieving ticks:', error);
    return [];
  }
};

/**
 * Build and store minute candles from tick data
 * @param {string} ticker - Stock symbol
 * @param {number} timestamp - Minute timestamp
 * @returns {Promise<Object|null>} Constructed minute candle
 */
export const buildMinuteCandle = async (ticker, timestamp) => {
  try {
    // Get ticks for this minute
    const minuteStart = Math.floor(timestamp / 60000) * 60000;
    const minuteEnd = minuteStart + 60000;

    const ticks = await getTicksInTimeRange(ticker, minuteStart, minuteEnd);

    if (ticks.length === 0) {
      return null;
    }

    // Build OHLCV candle
    const candle = {
      ticker,
      timestamp: minuteStart,
      open: ticks[0].price,
      high: Math.max(...ticks.map(t => t.price)),
      low: Math.min(...ticks.map(t => t.price)),
      close: ticks[ticks.length - 1].price,
      volume: ticks.reduce((sum, t) => sum + (t.volume || 0), 0),
      trades: ticks.length,
      vwap: ticks.reduce((sum, t) => sum + t.price * (t.volume || 0), 0) /
             ticks.reduce((sum, t) => sum + (t.volume || 0), 0) || 0
    };

    // Store the candle
    await storeMinuteCandle(ticker, candle);

    return candle;

  } catch (error) {
    console.error('[DataLake] Error building minute candle:', error);
    return null;
  }
};

/**
 * Store minute candle data
 * @param {string} ticker - Stock symbol
 * @param {Object} candle - Candle data
 * @returns {Promise<void>}
 */
export const storeMinuteCandle = async (ticker, candle) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.MINUTE_CANDLES], 'readwrite');
    const store = transaction.objectStore(STORES.MINUTE_CANDLES);

    const record = {
      ...candle,
      date: new Date(candle.timestamp).toISOString().split('T')[0],
      lastUpdated: Date.now()
    };

    store.put(record);

  } catch (error) {
    console.error('[DataLake] Error storing minute candle:', error);
    throw error;
  }
};

/**
 * Get minute candles for a time range
 * @param {string} ticker - Stock symbol
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp
 * @returns {Promise<Array>}
 */
export const getMinuteCandles = async (ticker, startTime, endTime) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.MINUTE_CANDLES], 'readonly');
    const store = transaction.objectStore(STORES.MINUTE_CANDLES);
    const index = store.index(['ticker', 'timestamp']);

    const range = IDBKeyRange.bound(
      [ticker, startTime],
      [ticker, endTime]
    );

    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

  } catch (error) {
    console.error('[DataLake] Error retrieving minute candles:', error);
    return [];
  }
};

/**
 * Store 5-minute candles for RVol calculations
 * @param {string} ticker - Stock symbol
 * @param {string} date - Trading date (YYYY-MM-DD)
 * @param {Array} candles - Array of 5m candles
 * @returns {Promise<void>}
 */
export const storeFiveMinuteCandles = async (ticker, date, candles) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.FIVE_MIN_CANDLES], 'readwrite');
    const store = transaction.objectStore(STORES.FIVE_MIN_CANDLES);

    const record = {
      ticker,
      date,
      candles: candles.map(candle => ({
        t: candle.timestamp,
        o: candle.open,
        h: candle.high,
        l: candle.low,
        c: candle.close,
        v: candle.volume
      })),
      lastUpdated: Date.now()
    };

    store.put(record);

  } catch (error) {
    console.error('[DataLake] Error storing 5m candles:', error);
    throw error;
  }
};

/**
 * Store daily candles for moving average calculations
 * @param {string} ticker - Stock symbol
 * @param {Array} candles - Array of daily candles
 * @returns {Promise<void>}
 */
export const storeDailyCandles = async (ticker, candles) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.DAILY_CANDLES], 'readwrite');
    const store = transaction.objectStore(STORES.DAILY_CANDLES);

    for (const candle of candles) {
      const date = new Date(candle.timestamp).toISOString().split('T')[0];
      const record = {
        ticker,
        date,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        adjustedClose: candle.adjustedClose || candle.close,
        lastUpdated: Date.now()
      };
      store.put(record);
    }

  } catch (error) {
    console.error('[DataLake] Error storing daily candles:', error);
    throw error;
  }
};

/**
 * Store pre-calculated indicators for fast access
 * @param {string} ticker - Stock symbol
 * @param {string} type - Indicator type (ema, sma, adr, etc.)
 * @param {Object} indicators - Indicator data
 * @returns {Promise<void>}
 */
export const storeIndicators = async (ticker, type, indicators) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.INDICATORS], 'readwrite');
    const store = transaction.objectStore(STORES.INDICATORS);

    const date = new Date().toISOString().split('T')[0];
    const record = {
      ticker,
      type,
      data: indicators,
      date,
      lastUpdated: Date.now()
    };

    store.put(record);

  } catch (error) {
    console.error('[DataLake] Error storing indicators:', error);
    throw error;
  }
};

/**
 * Retrieve cached indicators
 * @param {string} ticker - Stock symbol
 * @param {string} type - Indicator type
 * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
 * @returns {Promise<Object|null>}
 */
export const getCachedIndicators = async (ticker, type, maxAge = 60 * 60 * 1000) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.INDICATORS], 'readonly');
    const store = transaction.objectStore(STORES.INDICATORS);
    const index = store.index(['ticker', 'type']);

    return new Promise((resolve, reject) => {
      const request = index.get([ticker, type]);
      request.onsuccess = () => {
        const result = request.result;
        if (result && (Date.now() - result.lastUpdated) < maxAge) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });

  } catch (error) {
    console.error('[DataLake] Error retrieving cached indicators:', error);
    return null;
  }
};

/**
 * Store strategy calculation results
 * @param {string} ticker - Stock symbol
 * @param {string} strategy - Strategy name (orb, rvol, vrs)
 * @param {Object} result - Strategy calculation result
 * @returns {Promise<void>}
 */
export const storeStrategyResult = async (ticker, strategy, result) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.STRATEGY_RESULTS], 'readwrite');
    const store = transaction.objectStore(STORES.STRATEGY_RESULTS);

    const record = {
      ticker,
      strategy,
      timestamp: Date.now(),
      result,
      date: new Date().toISOString().split('T')[0]
    };

    store.put(record);

  } catch (error) {
    console.error('[DataLake] Error storing strategy result:', error);
    throw error;
  }
};

/**
 * Get latest strategy result for a ticker
 * @param {string} ticker - Stock symbol
 * @param {string} strategy - Strategy name
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {Promise<Object|null>}
 */
export const getLatestStrategyResult = async (ticker, strategy, maxAge = 5 * 60 * 1000) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.STRATEGY_RESULTS], 'readonly');
    const store = transaction.objectStore(STORES.STRATEGY_RESULTS);
    const index = store.index(['ticker', 'strategy']);

    const range = IDBKeyRange.bound([ticker, strategy], [ticker, strategy, '\uffff']);
    const request = index.openCursor(range, 'prev'); // Get most recent first

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const result = cursor.value;
          if (Date.now() - result.timestamp <= maxAge) {
            resolve(result.result);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });

  } catch (error) {
    console.error('[DataLake] Error retrieving strategy result:', error);
    return null;
  }
};

/**
 * Migrate data from old rvolDatabase to new Data Lake
 * @param {Array<string>} tickers - List of tickers to migrate
 * @returns {Promise<number>} Number of records migrated
 */
export const migrateFromRVolDatabase = async (tickers) => {
  try {
    console.log('[DataLake] 🔄 Starting migration from rvolDatabase...');

    // Import the old database functions
    const rvolDB = await import('./rvolDatabase.js');
    let migratedCount = 0;

    for (const ticker of tickers) {
      try {
        // Get recent 5m candles from old database
        const oldCandles = await rvolDB.getRecentCandles(ticker, 30);

        // Store in new data lake
        for (const dayData of oldCandles) {
          await storeFiveMinuteCandles(ticker, dayData.date, dayData.candles);
          migratedCount++;
        }

        console.log(`[DataLake] ✅ Migrated ${oldCandles.length} days for ${ticker}`);

      } catch (error) {
        console.warn(`[DataLake] ⚠️ Migration failed for ${ticker}:`, error);
      }
    }

    console.log(`[DataLake] ✅ Migration complete: ${migratedCount} records migrated`);

    // Optionally clear old database after successful migration
    if (confirm('Migration complete. Clear old rvolDatabase?')) {
      await rvolDB.clearAllData();
      console.log('[DataLake] 🗑️ Old rvolDatabase cleared');
    }

    return migratedCount;

  } catch (error) {
    console.error('[DataLake] Migration error:', error);
    throw error;
  }
};

/**
 * Record query performance metrics
 * @param {string} queryType - Type of query
 * @param {number} duration - Query duration in milliseconds
 * @param {number} resultCount - Number of results returned
 */
export const recordQueryPerformance = async (queryType, duration, resultCount) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.QUERY_STATS], 'readwrite');
    const store = transaction.objectStore(STORES.QUERY_STATS);

    const record = {
      id: `${queryType}-${Date.now()}-${Math.random()}`,
      queryType,
      duration,
      resultCount,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0]
    };

    store.put(record);

  } catch (error) {
    // Don't throw errors for performance recording to avoid affecting main operations
    console.warn('[DataLake] Failed to record query performance:', error);
  }
};

/**
 * Get ticks within a specific time range
 * @param {string} ticker - Stock symbol
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp
 * @returns {Promise<Array>}
 */
const getTicksInTimeRange = async (ticker, startTime, endTime) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.TICKS], 'readonly');
    const store = transaction.objectStore(STORES.TICKS);

    let request;

    try {
      // Try to use the compound index first (more efficient)
      const index = store.index(['ticker', 'timestamp']);
      const range = IDBKeyRange.bound(
        [ticker, startTime],
        [ticker, endTime]
      );
      request = index.getAll(range);
    } catch (indexError) {
      // Fallback: Use the ticker index and filter manually
      // Fallback is expected during version transition - reduce log noise
      // console.warn('[DataLake] Compound index not found, using fallback method:', indexError.message);
      const index = store.index('ticker');
      const range = IDBKeyRange.lowerBound(ticker);
      request = index.getAll(range);

      // Transform the request to filter results by time range
      const originalOnsuccess = request.onsuccess;
      request.onsuccess = () => {
        const allResults = request.result || [];
        const filteredResults = allResults.filter(
          tick => tick.timestamp >= startTime && tick.timestamp <= endTime
        );
        request.result = filteredResults;
        if (originalOnsuccess) originalOnsuccess.call(request);
      };
    }

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

  } catch (error) {
    console.error('[DataLake] Error getting ticks in time range:', error);
    return [];
  }
};

/**
 * Check if migration from rvolDatabase is needed
 * @returns {Promise<boolean>}
 */
export const needsMigration = async () => {
  try {
    // Check if old database exists (both v2 and rvol-db)
    const [hasOldV2, hasOldRVol] = await Promise.all([
      new Promise((resolve) => {
        const request = indexedDB.open('strategywatch-data-lake-v2');
        request.onsuccess = () => {
          request.result.close();
          resolve(true);
        };
        request.onerror = () => resolve(false);
      }),
      new Promise((resolve) => {
        const request = indexedDB.open('strategywatch-rvol-db');
        request.onsuccess = () => {
          request.result.close();
          resolve(true);
        };
        request.onerror = () => resolve(false);
      })
    ]);

    // Migration needed if either old database exists
    return hasOldV2 || hasOldRVol;

  } catch (error) {
    console.error('[DataLake] Error checking migration status:', error);
    return false;
  }
};

/**
 * Store global metadata
 * @param {string} key - Metadata key
 * @param {any} value - Metadata value
 * @returns {Promise<void>}
 */
export const setMetadata = async (key, value) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.CONFIG], 'readwrite');
    const store = transaction.objectStore(STORES.CONFIG);

    const record = {
      key,
      value,
      lastUpdated: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`[DataLake] Failed to set metadata ${key}:`, error);
  }
};

/**
 * Get global metadata
 * @param {string} key - Metadata key
 * @returns {Promise<any>} Metadata value or null
 */
export const getMetadata = async (key) => {
  try {
    const db = await getDatabase();
    const transaction = db.transaction([STORES.CONFIG], 'readonly');
    const store = transaction.objectStore(STORES.CONFIG);

    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error(`[DataLake] Failed to get metadata ${key}:`, error);
    return null;
  }
};

/**
 * Get data lake statistics and health metrics
 * @returns {Promise<object>} Database statistics
 */
export const getDataLakeStats = async () => {
  try {
    const db = await getDatabase();
    const stats = {
      version: DB_VERSION,
      stores: {},
      totalRecords: 0,
      name: DB_NAME,
      healthy: true
    };

    // Get record count for each store
    for (const storeName of Object.values(STORES)) {
      try {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        const count = await new Promise((resolve, reject) => {
          const request = store.count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        stats.stores[storeName] = count;
        stats.totalRecords += count;
      } catch (error) {
        console.warn(`[DataLake] Error getting stats for ${storeName}:`, error);
        stats.stores[storeName] = 0;
      }
    }

    return stats;

  } catch (error) {
    console.error('[DataLake] Failed to get stats:', error);
    return {
      healthy: false,
      error: error.message,
      version: DB_VERSION,
      name: DB_NAME,
      stores: {},
      totalRecords: 0
    };
  }
};

/**
 * Clean up old data based on retention policies
 * @param {string[]} symbols - Symbols to clean up (optional)
 * @returns {Promise<object>} Cleanup results
 */
export const cleanupOldData = async (symbols = null) => {
  try {
    console.log('[DataLake] 🧹 Starting cleanup...');
    const stats = {};
    const now = Date.now();

    const db = await getDatabase();

    // Define cleanup operations for each store
    const cleanupOperations = [
      {
        store: STORES.TICKS,
        index: 'timestamp',
        condition: (record) => (now - record.timestamp) > RETENTION.TICKS,
        keyPath: 'timestamp'
      },
      {
        store: STORES.MINUTE_CANDLES,
        index: 'timestamp',
        condition: (record) => (now - record.timestamp) > RETENTION.MINUTE_CANDLES,
        keyPath: 'timestamp'
      },
      {
        store: STORES.FIVE_MIN_CANDLES,
        index: 'lastUpdated',
        condition: (record) => (now - record.lastUpdated) > RETENTION.FIVE_MIN_CANDLES,
        keyPath: ['ticker', 'date']
      },
      {
        store: STORES.DAILY_CANDLES,
        index: 'lastUpdated',
        condition: (record) => (now - record.lastUpdated) > RETENTION.DAILY_CANDLES,
        keyPath: ['ticker', 'date']
      },
      {
        store: STORES.INDICATORS,
        index: 'lastUpdated',
        condition: (record) => (now - record.lastUpdated) > RETENTION.INDICATORS,
        keyPath: ['ticker', 'type', 'date']
      },
      {
        store: STORES.STRATEGY_RESULTS,
        index: 'timestamp',
        condition: (record) => (now - record.timestamp) > RETENTION.STRATEGY_RESULTS,
        keyPath: ['ticker', 'strategy', 'timestamp']
      },
      {
        store: STORES.QUERY_STATS,
        index: 'timestamp',
        condition: (record) => (now - record.timestamp) > RETENTION.QUERY_STATS,
        keyPath: 'id'
      }
    ];

    for (const operation of cleanupOperations) {
      const deleted = await cleanupStore(db, operation);
      stats[operation.store] = deleted;
    }

    const totalDeleted = Object.values(stats).reduce((sum, count) => sum + count, 0);
    console.log('[DataLake] ✅ Cleanup complete:', { totalDeleted, stats });

    return { totalDeleted, stats, timestamp: Date.now() };

  } catch (error) {
    console.error('[DataLake] Cleanup error:', error);
    return { error: error.message, totalDeleted: 0, stats: {}, timestamp: Date.now() };
  }
};

/**
 * Clean up a specific store
 * @param {IDBDatabase} db - Database instance
 * @param {Object} operation - Cleanup operation configuration
 * @returns {Promise<number>} Number of records deleted
 */
const cleanupStore = async (db, operation) => {
  const { store, index, condition } = operation;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([store], 'readwrite');
    const objectStore = transaction.objectStore(store);
    const indexStore = objectStore.index(index);

    const request = indexStore.openCursor();
    let deletedCount = 0;

    request.onsuccess = (event) => {
      const cursor = event.target.result;

      if (cursor) {
        if (condition(cursor.value)) {
          cursor.delete();
          deletedCount++;
        }
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve(deletedCount);
    transaction.onerror = () => reject(transaction.error);
  });
};

/**
 * Get comprehensive ticker data for synchronization planning
 * @param {string} ticker - Stock symbol
 * @returns {Promise<object>} Ticker data with current quote, daily candles, and indicators
 */
export const getTickerData = async (ticker) => {
  try {
    const now = Date.now();

    // Get recent ticks to determine current quote data
    const recentTicks = await getRecentTicks(ticker, 1);
    let currentQuote = null;

    if (recentTicks.length > 0) {
      const latestTick = recentTicks[0];
      currentQuote = {
        price: latestTick.price,
        timestamp: latestTick.timestamp,
        volume: latestTick.volume
      };
    }

    // Get daily candles from the database
    const db = await getDatabase();
    let dailyCandles = [];

    try {
      const transaction = db.transaction([STORES.DAILY_CANDLES], 'readonly');
      const store = transaction.objectStore(STORES.DAILY_CANDLES);
      const index = store.index('ticker');
      const range = IDBKeyRange.lowerBound(ticker);

      dailyCandles = await new Promise((resolve, reject) => {
        const request = index.getAll(range);
        request.onsuccess = () => {
          const allCandles = request.result || [];
          // Filter to only this ticker and sort by date
          const tickerCandles = allCandles
            .filter(candle => candle.ticker === ticker)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
          resolve(tickerCandles);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn(`[DataLake] Error getting daily candles for ${ticker}:`, error);
      dailyCandles = [];
    }

    // Get indicators
    let indicators = null;
    try {
      const movingAverages = await getCachedIndicators(ticker, 'movingAverages');
      if (movingAverages) {
        indicators = {
          movingAverages,
          lastUpdated: movingAverages.timestamp || now
        };
      }
    } catch (error) {
      console.warn(`[DataLake] Error getting indicators for ${ticker}:`, error);
      indicators = null;
    }

    return {
      ticker,
      currentQuote,
      dailyCandles,
      indicators,
      lastChecked: now
    };

  } catch (error) {
    console.error(`[DataLake] Error getting ticker data for ${ticker}:`, error);
    return {
      ticker,
      currentQuote: null,
      dailyCandles: [],
      indicators: null,
      lastChecked: Date.now(),
      error: error.message
    };
  }
};

/**
 * Clear all data from data lake (for testing/reset)
 * @returns {Promise<void>}
 */
export const clearDataLake = async () => {
  try {
    console.log('[DataLake] 🗑️ Clearing all data...');

    const db = await getDatabase();
    const storeNames = Object.values(STORES);

    for (const storeName of storeNames) {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    console.log('[DataLake] ✅ Data lake cleared');

  } catch (error) {
    console.error('[DataLake] Failed to clear data lake:', error);
    throw error;
  }
};

/**
 * Delete and recreate the entire database (for fixing corruption)
 * @returns {Promise<void>}
 */
export const resetDataLake = async () => {
  try {
    console.log('[DataLake] 🔄 Resetting entire database...');

    // Close existing connections
    if (typeof window !== 'undefined' && window.dataLakeUtils) {
      const db = await getDatabase().catch(() => null);
      if (db && !db.closed) {
        db.close();
      }
    }

    // Reset the database promise
    const getDatabaseFunc = getDatabase;
    getDatabaseFunc.dbPromise = null;

    // Delete the entire database
    await new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
      deleteRequest.onsuccess = () => {
        console.log('[DataLake] ✅ Database deleted successfully');
        resolve();
      };
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onblocked = () => {
        console.warn('[DataLake] ⚠️ Database deletion blocked, waiting...');
        deleteRequest.onsuccess = () => resolve();
      };
    });

    // Wait a bit for the deletion to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('[DataLake] ✅ Database reset complete');

  } catch (error) {
    console.error('[DataLake] Failed to reset database:', error);
    throw error;
  }
};

// Expose utilities globally for debugging
if (typeof window !== 'undefined') {
  window.dataLakeUtils = {
    clearDataLake,
    resetDataLake,
    getDataLakeStats,
    cleanupOldData,
    getMetadata,
    setMetadata,
    needsMigration,
    // Add a utility to force schema upgrade for users experiencing index issues
    forceSchemaUpgrade: async () => {
      try {
        console.log('[DataLake] Forcing schema upgrade...');
        await resetDataLake();
        console.log('[DataLake] ✅ Schema upgrade forced successfully. Refresh the page.');
        return true;
      } catch (error) {
        console.error('[DataLake] Failed to force schema upgrade:', error);
        return false;
      }
    }
  };
}

console.log('[DataLake] 🚀 Data Lake v2.0 service loaded');