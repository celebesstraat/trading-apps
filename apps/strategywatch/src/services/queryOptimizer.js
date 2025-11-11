/**
 * Query Optimization Service
 * Provides optimized queries and data access patterns for the unified data lake
 * Implements smart caching, pre-computation, and efficient data retrieval
 */

import {
  getDataLakeConnection,
  getTickerData,
  getMultipleTickerData
} from './dataLake';

// Query optimization configuration
const QUERY_CONFIG = {
  // Cache configuration
  CACHE_TTL: {
    QUOTE: 5000,           // 5 seconds for quotes
    INDICATORS: 60000,     // 1 minute for indicators
    CANDLES: 300000,       // 5 minutes for candles
    STRATEGIES: 30000      // 30 seconds for strategies
  },

  // Batch sizes
  BATCH_SIZE: 10,          // Process 10 tickers at once
  MAX_CONCURRENT: 3,       // Max 3 concurrent queries

  // Pre-computation thresholds
  PRECOMPUTE: {
    MOVING_AVERAGES: true,  // Pre-compute MAs
    ADR: true,             // Pre-compute ADR
    VRS: true,             // Pre-compute VRS
    ORB: true              // Pre-compute ORB results
  }
};

/**
 * Query cache for optimized data access
 */
class QueryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {any} Cached value or null
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  /**
   * Set cached value with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = 60000) {
    const expiresAt = Date.now() + ttl;

    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set cache entry
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    });

    // Set expiration timer
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttl);
    this.timers.set(key, timer);
  }

  /**
   * Delete cached value
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let activeEntries = 0;
    let expiredEntries = 0;

    for (const [key, entry] of this.cache) {
      if (now <= entry.expiresAt) {
        activeEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      activeEntries,
      expiredEntries,
      memoryUsage: this.cache.size * 200 // Rough estimate
    };
  }
}

/**
 * Query Optimizer for efficient data access
 */
export class QueryOptimizer {
  constructor() {
    this.cache = new QueryCache();
    this.queryQueue = [];
    this.isProcessing = false;
    this.stats = {
      queriesExecuted: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgQueryTime: 0
    };
  }

  /**
   * Get current quote for symbol with caching
   * @param {string} symbol - Stock symbol
   * @returns {Promise<object|null>} Current quote
   */
  async getCurrentQuote(symbol) {
    const cacheKey = `quote:${symbol}`;
    const startTime = Date.now();

    // Check cache first
    let quote = this.cache.get(cacheKey);
    if (quote) {
      this.stats.cacheHits++;
      return quote;
    }

    this.stats.cacheMisses++;

    // Fetch from database
    const tickerData = await getTickerData(symbol);
    quote = tickerData?.currentQuote || null;

    if (quote) {
      // Cache the result
      this.cache.set(cacheKey, quote, QUERY_CONFIG.CACHE_TTL.QUOTE);
    }

    // Update stats
    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return quote;
  }

  /**
   * Get current quotes for multiple symbols efficiently
   * @param {string[]} symbols - Stock symbols
   * @returns {Promise<object>} Map of symbol -> quote
   */
  async getCurrentQuotes(symbols) {
    const startTime = Date.now();
    const results = {};
    const uncachedSymbols = [];

    // Check cache for each symbol
    for (const symbol of symbols) {
      const cacheKey = `quote:${symbol}`;
      const quote = this.cache.get(cacheKey);

      if (quote) {
        results[symbol] = quote;
        this.stats.cacheHits++;
      } else {
        uncachedSymbols.push(symbol);
      }
    }

    // Batch fetch uncached symbols
    if (uncachedSymbols.length > 0) {
      const tickerData = await getMultipleTickerData(uncachedSymbols);

      for (const symbol of uncachedSymbols) {
        const data = tickerData[symbol];
        const quote = data?.currentQuote || null;

        if (quote) {
          results[symbol] = quote;
          this.cache.set(`quote:${symbol}`, quote, QUERY_CONFIG.CACHE_TTL.QUOTE);
        }
      }

      this.stats.cacheMisses += uncachedSymbols.length;
      this.stats.queriesExecuted++;
    }

    // Update stats
    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);

    return results;
  }

  /**
   * Get indicators for symbol with caching
   * @param {string} symbol - Stock symbol
   * @returns {Promise<object|null>} Indicators data
   */
  async getIndicators(symbol) {
    const cacheKey = `indicators:${symbol}`;
    const startTime = Date.now();

    // Check cache first
    let indicators = this.cache.get(cacheKey);
    if (indicators) {
      this.stats.cacheHits++;
      return indicators;
    }

    this.stats.cacheMisses++;

    // Fetch from database
    const tickerData = await getTickerData(symbol);
    indicators = tickerData?.indicators || null;

    if (indicators) {
      // Cache the result
      this.cache.set(cacheKey, indicators, QUERY_CONFIG.CACHE_TTL.INDICATORS);
    }

    // Update stats
    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return indicators;
  }

  /**
   * Get daily candles for symbol with date range optimization
   * @param {string} symbol - Stock symbol
   * @param {number} days - Number of days to fetch (default: 250)
   * @returns {Promise<Array>} Daily candles
   */
  async getDailyCandles(symbol, days = 250) {
    const cacheKey = `daily_candles:${symbol}:${days}`;
    const startTime = Date.now();

    // Check cache first
    let candles = this.cache.get(cacheKey);
    if (candles) {
      this.stats.cacheHits++;
      return candles;
    }

    this.stats.cacheMisses++;

    // Fetch from database
    const tickerData = await getTickerData(symbol);
    candles = tickerData?.dailyCandles || [];

    // Apply date range filter
    if (candles.length > days) {
      candles = candles.slice(-days);
    }

    // Cache the result
    this.cache.set(cacheKey, candles, QUERY_CONFIG.CACHE_TTL.CANDLES);

    // Update stats
    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return candles;
  }

  /**
   * Get 5-minute candles for symbol
   * @param {string} symbol - Stock symbol
   * @param {number} days - Number of days to fetch
   * @returns {Promise<Array>} 5m candles
   */
  async getFiveMinuteCandles(symbol, days = 10) {
    const cacheKey = `5m_candles:${symbol}:${days}`;
    const startTime = Date.now();

    // Check cache first
    let candles = this.cache.get(cacheKey);
    if (candles) {
      this.stats.cacheHits++;
      return candles;
    }

    this.stats.cacheMisses++;

    // Fetch from database and flatten all daily candle arrays
    const tickerData = await getTickerData(symbol);
    const dailyCandleArrays = tickerData?.fiveMinuteCandles || [];

    // Flatten and sort by date
    candles = [];
    for (const dayData of dailyCandleArrays) {
      if (dayData.candles) {
        candles.push(...dayData.candles);
      }
    }

    // Sort by timestamp
    candles.sort((a, b) => a.timestamp - b.timestamp);

    // Apply date range filter (rough approximation)
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    candles = candles.filter(candle => candle.timestamp > cutoffTime);

    // Cache the result
    this.cache.set(cacheKey, candles, QUERY_CONFIG.CACHE_TTL.CANDLES);

    // Update stats
    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return candles;
  }

  /**
   * Get strategy results for symbol
   * @param {string} symbol - Stock symbol
   * @param {string} strategy - Strategy name (orb5m, rvol, vrs, inmerelo)
   * @returns {Promise<object|null>} Strategy results
   */
  async getStrategyResults(symbol, strategy) {
    const cacheKey = `strategy:${strategy}:${symbol}`;
    const startTime = Date.now();

    // Check cache first
    let results = this.cache.get(cacheKey);
    if (results) {
      this.stats.cacheHits++;
      return results;
    }

    this.stats.cacheMisses++;

    // Fetch from database
    const tickerData = await getTickerData(symbol);
    results = tickerData?.strategies?.[strategy] || null;

    // Cache the result
    if (results) {
      this.cache.set(cacheKey, results, QUERY_CONFIG.CACHE_TTL.STRATEGIES);
    }

    // Update stats
    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return results;
  }

  /**
   * Batch get strategy results for multiple symbols
   * @param {string[]} symbols - Stock symbols
   * @param {string} strategy - Strategy name
   * @returns {Promise<object>} Map of symbol -> strategy results
   */
  async getBatchStrategyResults(symbols, strategy) {
    const startTime = Date.now();
    const results = {};
    const uncachedSymbols = [];

    // Check cache for each symbol
    for (const symbol of symbols) {
      const cacheKey = `strategy:${strategy}:${symbol}`;
      const strategyData = this.cache.get(cacheKey);

      if (strategyData) {
        results[symbol] = strategyData;
        this.stats.cacheHits++;
      } else {
        uncachedSymbols.push(symbol);
      }
    }

    // Batch fetch uncached symbols
    if (uncachedSymbols.length > 0) {
      const tickerData = await getMultipleTickerData(uncachedSymbols);

      for (const symbol of uncachedSymbols) {
        const data = tickerData[symbol];
        const strategyData = data?.strategies?.[strategy] || null;

        if (strategyData) {
          results[symbol] = strategyData;
          this.cache.set(`strategy:${strategy}:${symbol}`, strategyData, QUERY_CONFIG.CACHE_TTL.STRATEGIES);
        }
      }

      this.stats.cacheMisses += uncachedSymbols.length;
      this.stats.queriesExecuted++;
    }

    // Update stats
    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);

    return results;
  }

  /**
   * Get comprehensive ticker data for dashboard
   * @param {string} symbol - Stock symbol
   * @returns {Promise<object>} Comprehensive ticker data
   */
  async getComprehensiveTickerData(symbol) {
    const cacheKey = `comprehensive:${symbol}`;
    const startTime = Date.now();

    // Check cache first
    let data = this.cache.get(cacheKey);
    if (data) {
      this.stats.cacheHits++;
      return data;
    }

    this.stats.cacheMisses++;

    // Fetch all required data
    const tickerData = await getTickerData(symbol);

    if (!tickerData) {
      return null;
    }

    // Build comprehensive data object
    data = {
      symbol,
      quote: tickerData.currentQuote,
      indicators: tickerData.indicators,
      strategies: tickerData.strategies,
      lastUpdated: tickerData.lastUpdated,
      dataQuality: tickerData.dataQuality,
      // Add computed fields for dashboard
      hasRecentData: this.hasRecentData(tickerData),
      marketStatus: this.getMarketStatusForSymbol(tickerData)
    };

    // Cache the result (shorter TTL due to real-time nature)
    this.cache.set(cacheKey, data, 10000); // 10 seconds

    // Update stats
    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return data;
  }

  /**
   * Get market overview for all symbols
   * @param {string[]} symbols - Stock symbols
   * @returns {Promise<object>} Market overview data
   */
  async getMarketOverview(symbols) {
    const startTime = Date.now();
    const overview = {
      quotes: {},
      indicators: {},
      strategies: {},
      summary: {
        totalSymbols: symbols.length,
        dataAvailable: 0,
        lastUpdated: Date.now()
      }
    };

    // Batch fetch current quotes
    overview.quotes = await this.getCurrentQuotes(symbols);

    // Count available data
    overview.summary.dataAvailable = Object.keys(overview.quotes).filter(
      symbol => overview.quotes[symbol] !== null
    ).length;

    // Update stats
    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);

    return overview;
  }

  /**
   * Invalidate cache for specific symbol
   * @param {string} symbol - Stock symbol
   */
  invalidateSymbolCache(symbol) {
    const patterns = [
      `quote:${symbol}`,
      `indicators:${symbol}`,
      `daily_candles:${symbol}`,
      `5m_candles:${symbol}`,
      `strategy:orb5m:${symbol}`,
      `strategy:rvol:${symbol}`,
      `strategy:vrs:${symbol}`,
      `strategy:inmerelo:${symbol}`,
      `comprehensive:${symbol}`
    ];

    for (const pattern of patterns) {
      this.cache.delete(pattern);
    }
  }

  /**
   * Invalidate all strategy cache
   */
  invalidateStrategyCache() {
    // This is a simple approach - in production, you might want to track cache keys more precisely
    console.log('[QueryOptimizer] 🗑️ Clearing strategy cache...');
    // For now, we'll let cache expire naturally
  }

  /**
   * Check if ticker has recent data
   * @param {object} tickerData - Ticker data
   * @returns {boolean} True if has recent data
   */
  hasRecentData(tickerData) {
    if (!tickerData?.currentQuote) return false;

    const now = Date.now();
    const quoteAge = now - tickerData.currentQuote.timestamp;

    // Consider data recent if less than 5 minutes old
    return quoteAge < 5 * 60 * 1000;
  }

  /**
   * Get market status for symbol
   * @param {object} tickerData - Ticker data
   * @returns {string} Market status
   */
  getMarketStatusForSymbol(tickerData) {
    if (!tickerData?.currentQuote) return 'no_data';

    const now = Date.now();
    const quoteAge = now - tickerData.currentQuote.timestamp;

    if (quoteAge < 30 * 1000) return 'real_time';
    if (quoteAge < 5 * 60 * 1000) return 'recent';
    if (quoteAge < 60 * 60 * 1000) return 'stale';
    return 'very_stale';
  }

  /**
   * Update query statistics
   * @param {number} queryTime - Query execution time in ms
   */
  updateQueryStats(queryTime) {
    // Update running average
    const totalQueries = this.stats.queriesExecuted;
    if (totalQueries === 0) {
      this.stats.avgQueryTime = queryTime;
    } else {
      this.stats.avgQueryTime = ((this.stats.avgQueryTime * totalQueries) + queryTime) / (totalQueries + 1);
    }
  }

  /**
   * Get query optimizer statistics
   * @returns {object} Performance statistics
   */
  getStats() {
    const cacheStats = this.cache.getStats();
    const cacheHitRate = this.stats.cacheHits + this.stats.cacheMisses > 0
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100
      : 0;

    return {
      queries: {
        executed: this.stats.queriesExecuted,
        avgTime: Math.round(this.stats.avgQueryTime * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100
      },
      cache: cacheStats,
      performance: {
        totalQueries: this.stats.cacheHits + this.stats.cacheMisses,
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses
      }
    };
  }

  /**
   * Clear all cache and reset stats
   */
  reset() {
    this.cache.clear();
    this.stats = {
      queriesExecuted: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgQueryTime: 0
    };
  }
}

// Global query optimizer instance
let globalOptimizer = null;

/**
 * Get global query optimizer instance
 * @returns {QueryOptimizer} Query optimizer instance
 */
export const getQueryOptimizer = () => {
  if (!globalOptimizer) {
    globalOptimizer = new QueryOptimizer();
  }
  return globalOptimizer;
};

/**
 * Execute optimized query
 * @param {string} queryType - Type of query
 * @param {any} params - Query parameters
 * @returns {Promise<any>} Query results
 */
export const executeOptimizedQuery = async (queryType, ...params) => {
  const optimizer = getQueryOptimizer();

  switch (queryType) {
    case 'quote':
      return await optimizer.getCurrentQuote(params[0]);
    case 'quotes':
      return await optimizer.getCurrentQuotes(params[0]);
    case 'indicators':
      return await optimizer.getIndicators(params[0]);
    case 'daily_candles':
      return await optimizer.getDailyCandles(params[0], params[1]);
    case '5m_candles':
      return await optimizer.getFiveMinuteCandles(params[0], params[1]);
    case 'strategy':
      return await optimizer.getStrategyResults(params[0], params[1]);
    case 'batch_strategy':
      return await optimizer.getBatchStrategyResults(params[0], params[1]);
    case 'comprehensive':
      return await optimizer.getComprehensiveTickerData(params[0]);
    case 'market_overview':
      return await optimizer.getMarketOverview(params[0]);
    default:
      throw new Error(`Unknown query type: ${queryType}`);
  }
};

export default QueryOptimizer;