/**
 * Relative Strength Engine v2.0 - Core Orchestrator
 *
 * Main orchestrator that coordinates all RS operations.
 * Provides a single source of truth for Relative Strength data.
 * Eliminates race conditions and provides deterministic data flow.
 */

import { RSStateStore } from './StateStore.js';
import { RSCacheManager } from './CacheManager.js';
import { RSDataFetcher } from './DataFetcher.js';
import { RSCalculations } from './Calculations.js';
import { TIMEFRAMES, DATA_TYPES, CACHE_CONFIG } from './types.js';

export class RSEngine {
  constructor() {
    this.stateStore = new RSStateStore();
    this.cacheManager = new RSCacheManager(CACHE_CONFIG);
    this.dataFetcher = new RSDataFetcher();
    this.calculations = new RSCalculations();

    this.isInitialized = false;
    this.updateIntervals = new Map();
    this.errorCount = 0;
    this.maxErrors = 10;

    // Bind methods for consistent context
    this.updateRSData = this.updateRSData.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  /**
   * Initialize the RS Engine with required configuration
   */
  async initialize(options = {}) {
    try {
      const { symbols = ['QQQ'], benchmark = 'QQQ', onUpdate } = options;

      this.benchmark = benchmark;
      this.symbols = symbols;
      this.onUpdate = onUpdate;

      // Initialize data fetcher with configuration
      await this.dataFetcher.initialize({
        symbols,
        benchmark,
        onDataError: this.handleError
      });

      // Pre-warm cache with initial data
      await this.preWarmCache();

      // Start periodic updates
      this.startPeriodicUpdates();

      this.isInitialized = true;
      console.log('[RSEngine] Initialized successfully');

      return true;
    } catch (error) {
      this.handleError(error, 'initialization');
      return false;
    }
  }

  /**
   * Pre-warm cache with essential data to reduce initial load time
   */
  async preWarmCache() {
    const promises = TIMEFRAMES.map(timeframe =>
      this.updateRSData(timeframe, true)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Core method to update RS data for a specific timeframe
   * This is the single point of truth - no more race conditions
   */
  async updateRSData(timeframe, forceRefresh = false) {
    if (!this.isInitialized) {
      console.warn('[RSEngine] Not initialized, skipping update');
      return null;
    }

    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = this.cacheManager.get(timeframe);
        if (cachedData && !this.cacheManager.isExpired(timeframe)) {
          return cachedData;
        }
      }

      // Fetch fresh data
      const { stockData, benchmarkData } = await this.dataFetcher.fetchDataForTimeframe(timeframe);

      if (!stockData || !benchmarkData) {
        throw new Error(`Missing data for timeframe ${timeframe}`);
      }

      // Perform calculations
      const calculatedData = this.calculations.calculateRelativeStrength(
        stockData,
        benchmarkData,
        timeframe
      );

      // Cache the results
      this.cacheManager.set(timeframe, calculatedData);

      // Update state store atomically
      this.stateStore.updateRSData(timeframe, calculatedData);

      // Notify subscribers
      this.notifySubscribers(timeframe, calculatedData);

      return calculatedData;

    } catch (error) {
      this.handleError(error, `updateRSData(${timeframe})`);
      return null;
    }
  }

  /**
   * Start periodic updates for each timeframe
   */
  startPeriodicUpdates() {
    TIMEFRAMES.forEach(timeframe => {
      const interval = setInterval(() => {
        this.updateRSData(timeframe);
      }, CACHE_CONFIG.TTL[timeframe] / 2); // Update at half cache TTL

      this.updateIntervals.set(timeframe, interval);
    });
  }

  /**
   * Stop all periodic updates
   */
  stopPeriodicUpdates() {
    this.updateIntervals.forEach((interval, timeframe) => {
      clearInterval(interval);
      console.log(`[RSEngine] Stopped updates for ${timeframe}`);
    });
    this.updateIntervals.clear();
  }

  /**
   * Get current RS data for all timeframes
   */
  getAllRSData() {
    return this.stateStore.getAllRSData();
  }

  /**
   * Get RS data for a specific timeframe
   */
  getRSData(timeframe) {
    return this.stateStore.getRSData(timeframe);
  }

  /**
   * Get current system status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      errorCount: this.errorCount,
      cacheStats: this.cacheManager.getStats(),
      lastUpdate: this.stateStore.getLastUpdateTime(),
      activeIntervals: this.updateIntervals.size
    };
  }

  /**
   * Notify subscribers of data updates
   */
  notifySubscribers(timeframe, data) {
    if (this.onUpdate) {
      try {
        this.onUpdate({
          timeframe,
          data,
          timestamp: Date.now(),
          status: 'success'
        });
      } catch (error) {
        this.handleError(error, 'subscriber notification');
      }
    }
  }

  /**
   * Centralized error handling with circuit breaker logic
   */
  handleError(error, context) {
    this.errorCount++;

    console.error(`[RSEngine] Error in ${context}:`, error);

    // Circuit breaker: disable updates if too many errors
    if (this.errorCount > this.maxErrors) {
      console.warn('[RSEngine] Error threshold exceeded, stopping updates');
      this.stopPeriodicUpdates();
    }

    if (this.onUpdate) {
      this.onUpdate({
        error: error.message,
        context,
        timestamp: Date.now(),
        status: 'error'
      });
    }
  }

  /**
   * Reset error counter and resume normal operation
   */
  resetErrors() {
    this.errorCount = 0;
    console.log('[RSEngine] Error counter reset');
  }

  /**
   * Cleanup method for graceful shutdown
   */
  destroy() {
    console.log('[RSEngine] Shutting down...');

    this.stopPeriodicUpdates();
    this.cacheManager.clear();
    this.stateStore.clear();

    this.isInitialized = false;

    console.log('[RSEngine] Shutdown complete');
  }
}

// Export singleton instance for easy usage
export const rsEngine = new RSEngine();

export default rsEngine;