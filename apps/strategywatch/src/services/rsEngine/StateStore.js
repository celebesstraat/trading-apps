/**
 * Relative Strength Engine v2.0 - State Store
 *
 * Immutable state management for RS data.
 * Provides atomic updates, history tracking, and change notifications.
 * Eliminates state mutations and provides predictable data flow.
 */

import { TIMEFRAMES } from './types.js';

export class RSStateStore {
  constructor() {
    // Immutable state - only replaced, never mutated
    this.state = this.createInitialState();

    // History for debugging and rollback capabilities
    this.history = [];
    this.maxHistorySize = 50;

    // Subscribers for state change notifications
    this.subscribers = new Set();

    // Performance metrics
    this.metrics = {
      updates: 0,
      lastUpdateTime: 0,
      averageUpdateDuration: 0
    };

    // Bind methods for consistent context
    this.subscribe = this.subscribe.bind(this);
    this.unsubscribe = this.unsubscribe.bind(this);
    this.notifySubscribers = this.notifySubscribers.bind(this);
  }

  /**
   * Create initial empty state
   */
  createInitialState() {
    const initialState = {
      version: 1,
      timestamp: Date.now(),
      rsData: {},
      metadata: {
        lastUpdate: Date.now(),
        source: 'initial',
        errors: []
      },
      system: {
        isInitialized: false,
        errorCount: 0,
        lastError: null
      }
    };

    // Initialize timeframe data structures
    TIMEFRAMES.forEach(timeframe => {
      initialState.rsData[timeframe] = {
        data: {},
        timestamp: Date.now(),
        isUpdating: false,
        lastError: null,
        metadata: {
          cacheHits: 0,
          calculationTime: 0,
          dataQuality: 'unknown'
        }
      };
    });

    return initialState;
  }

  /**
   * Get current state (immutable copy)
   */
  getState() {
    return this.deepClone(this.state);
  }

  /**
   * Get RS data for all timeframes
   */
  getAllRSData() {
    const result = {};

    for (const timeframe of TIMEFRAMES) {
      result[timeframe] = this.getRSData(timeframe);
    }

    return result;
  }

  /**
   * Get RS data for a specific timeframe
   */
  getRSData(timeframe) {
    if (!this.isValidTimeframe(timeframe)) {
      throw new Error(`Invalid timeframe: ${timeframe}`);
    }

    const timeframeData = this.state.rsData[timeframe];
    return timeframeData ? this.deepClone(timeframeData.data) : {};
  }

  /**
   * Get RS data for a specific symbol and timeframe
   */
  getSymbolRSData(symbol, timeframe) {
    const timeframeData = this.getRSData(timeframe);
    return timeframeData[symbol] || null;
  }

  /**
   * Get metadata for a timeframe
   */
  getTimeframeMetadata(timeframe) {
    if (!this.isValidTimeframe(timeframe)) {
      return null;
    }

    const timeframeData = this.state.rsData[timeframe];
    return timeframeData ? {
      timestamp: timeframeData.timestamp,
      isUpdating: timeframeData.isUpdating,
      lastError: timeframeData.lastError,
      metadata: timeframeData.metadata
    } : null;
  }

  /**
   * Update RS data for a specific timeframe (atomic operation)
   */
  updateRSData(timeframe, data, metadata = {}) {
    if (!this.isValidTimeframe(timeframe)) {
      throw new Error(`Invalid timeframe: ${timeframe}`);
    }

    const startTime = performance.now();

    try {
      // Validate input data
      this.validateRSData(data);

      // Create new state (immutability)
      const newState = this.createStateUpdate(timeframe, data, metadata);

      // Update history before state change
      this.addToHistory(this.state);

      // Atomically replace state
      this.state = newState;

      // Update metrics
      this.updateMetrics(startTime);

      // Notify subscribers
      this.notifySubscribers(timeframe, data, metadata);

      console.log(`[RSStateStore] Updated RS data for ${timeframe}, symbols: ${Object.keys(data).length}`);

      return true;

    } catch (error) {
      console.error(`[RSStateStore] Failed to update RS data for ${timeframe}:`, error);
      this.recordError(error, timeframe);
      return false;
    }
  }

  /**
   * Create new state with updated timeframe data
   */
  createStateUpdate(timeframe, data, metadata) {
    const newState = this.deepClone(this.state);

    // Update timeframe data
    newState.rsData[timeframe] = {
      data: this.deepClone(data),
      timestamp: Date.now(),
      isUpdating: false,
      lastError: null,
      metadata: {
        cacheHits: metadata.cacheHits || 0,
        calculationTime: metadata.calculationTime || 0,
        dataQuality: metadata.dataQuality || 'good'
      }
    };

    // Update global metadata
    newState.metadata.lastUpdate = Date.now();
    newState.metadata.source = metadata.source || 'calculation';
    newState.metadata.lastTimeframeUpdate = timeframe;

    // Update system status
    newState.system.lastError = null;

    return newState;
  }

  /**
   * Mark timeframe as updating (for loading states)
   */
  setInProgress(timeframe, inProgress = true) {
    if (!this.isValidTimeframe(timeframe)) {
      return false;
    }

    const newState = this.deepClone(this.state);
    newState.rsData[timeframe].isUpdating = inProgress;
    newState.rsData[timeframe].timestamp = Date.now();

    this.state = newState;

    if (inProgress) {
      console.log(`[RSStateStore] Marked ${timeframe} as updating`);
    } else {
      console.log(`[RSStateStore] Marked ${timeframe} as complete`);
    }

    return true;
  }

  /**
   * Record error for a timeframe
   */
  recordError(error, timeframe) {
    const errorInfo = {
      message: error.message,
      timestamp: Date.now(),
      timeframe,
      stack: error.stack
    };

    const newState = this.deepClone(this.state);

    if (timeframe && this.isValidTimeframe(timeframe)) {
      newState.rsData[timeframe].lastError = errorInfo;
    }

    newState.system.lastError = errorInfo;
    newState.system.errorCount += 1;
    newState.metadata.errors.push(errorInfo);

    // Keep only recent errors
    if (newState.metadata.errors.length > 100) {
      newState.metadata.errors = newState.metadata.errors.slice(-100);
    }

    this.state = newState;

    // Notify subscribers of error
    this.notifyErrorSubscribers(error, timeframe);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => this.unsubscribe(callback);
  }

  /**
   * Unsubscribe from state changes
   */
  unsubscribe(callback) {
    this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of state changes
   */
  notifySubscribers(timeframe, data, metadata) {
    const notification = {
      type: 'dataUpdate',
      timeframe,
      data,
      metadata,
      timestamp: Date.now(),
      state: this.getState()
    };

    this.subscribers.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('[RSStateStore] Subscriber notification error:', error);
      }
    });
  }

  /**
   * Notify subscribers of errors
   */
  notifyErrorSubscribers(error, timeframe) {
    const notification = {
      type: 'error',
      error: error.message,
      timeframe,
      timestamp: Date.now(),
      state: this.getState()
    };

    this.subscribers.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('[RSStateStore] Error notification error:', error);
      }
    });
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      historySize: this.history.length,
      subscriberCount: this.subscribers.size,
      stateSize: JSON.stringify(this.state).length,
      lastUpdateTime: this.state.metadata.lastUpdate,
      errorCount: this.state.system.errorCount
    };
  }

  /**
   * Get last update timestamp
   */
  getLastUpdateTime() {
    return this.state.metadata.lastUpdate;
  }

  /**
   * Check if state is healthy (no recent errors)
   */
  isHealthy() {
    const recentErrorThreshold = 5 * 60 * 1000; // 5 minutes
    const lastError = this.state.system.lastError;

    if (!lastError) return true;

    return (Date.now() - lastError.timestamp) > recentErrorThreshold;
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    return {
      isHealthy: this.isHealthy(),
      errorCount: this.state.system.errorCount,
      lastError: this.state.system.lastError,
      lastUpdate: this.state.metadata.lastUpdate,
      uptime: Date.now() - this.state.timestamp,
      version: this.state.version
    };
  }

  /**
   * Get data quality assessment
   */
  getDataQuality() {
    const quality = {};

    for (const timeframe of TIMEFRAMES) {
      const timeframeData = this.state.rsData[timeframe];
      const data = timeframeData.data;

      quality[timeframe] = {
        symbolCount: Object.keys(data).length,
        hasErrors: !!timeframeData.lastError,
        lastUpdate: timeframeData.timestamp,
        age: Date.now() - timeframeData.timestamp,
        metadata: timeframeData.metadata
      };
    }

    return quality;
  }

  /**
   * Rollback to a previous state
   */
  rollback(index = 1) {
    if (this.history.length < index) {
      throw new Error(`Cannot rollback ${index} steps, only ${this.history.length} steps available`);
    }

    const targetState = this.history[this.history.length - index];
    if (!targetState) {
      throw new Error('Target state not found in history');
    }

    this.addToHistory(this.state);
    this.state = this.deepClone(targetState);

    console.log(`[RSStateStore] Rolled back ${index} steps`);
    this.notifySubscribers('rollback', {}, { type: 'rollback', steps: index });

    return true;
  }

  /**
   * Get state history
   */
  getHistory(count = 10) {
    return this.history.slice(-count).map((state, index) => ({
      index: this.history.length - count + index,
      timestamp: state.metadata.lastUpdate,
      version: state.version,
      errorCount: state.system.errorCount,
      metadata: state.metadata
    }));
  }

  /**
   * Clear state history
   */
  clearHistory() {
    this.history = [];
    console.log('[RSStateStore] History cleared');
  }

  /**
   * Reset state to initial state
   */
  reset() {
    this.addToHistory(this.state);
    this.state = this.createInitialState();
    console.log('[RSStateStore] State reset to initial');
    this.notifySubscribers('reset', {}, { type: 'reset' });
  }

  /**
   * Export state for persistence
   */
  export() {
    return {
      state: this.state,
      history: this.history,
      metrics: this.metrics,
      timestamp: Date.now()
    };
  }

  /**
   * Import state from persistence
   */
  import(exportedData) {
    try {
      if (!exportedData || !exportedData.state) {
        throw new Error('Invalid exported data');
      }

      this.addToHistory(this.state);
      this.state = this.deepClone(exportedData.state);
      this.history = exportedData.history || [];
      this.metrics = exportedData.metrics || {};

      console.log('[RSStateStore] State imported successfully');
      this.notifySubscribers('import', {}, { type: 'import' });

      return true;

    } catch (error) {
      console.error('[RSStateStore] Import failed:', error);
      return false;
    }
  }

  // Private Helper Methods

  /**
   * Validate RS data structure
   */
  validateRSData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('RS data must be an object');
    }

    for (const [symbol, symbolData] of Object.entries(data)) {
      if (!symbolData || typeof symbolData !== 'object') {
        throw new Error(`Invalid data for symbol ${symbol}`);
      }

      if (!Object.prototype.hasOwnProperty.call(symbolData, 'value') && !Object.prototype.hasOwnProperty.call(symbolData, 'overallRS')) {
        throw new Error(`Missing required RS value for symbol ${symbol}`);
      }
    }

    return true;
  }

  /**
   * Validate timeframe
   */
  isValidTimeframe(timeframe) {
    return TIMEFRAMES.includes(timeframe);
  }

  /**
   * Deep clone an object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Add state to history
   */
  addToHistory(state) {
    this.history.push(this.deepClone(state));

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Update performance metrics
   */
  updateMetrics(startTime) {
    const duration = performance.now() - startTime;
    this.metrics.updates += 1;
    this.metrics.lastUpdateTime = Date.now();

    // Calculate moving average of update duration
    if (this.metrics.averageUpdateDuration === 0) {
      this.metrics.averageUpdateDuration = duration;
    } else {
      this.metrics.averageUpdateDuration =
        (this.metrics.averageUpdateDuration * 0.9) + (duration * 0.1);
    }
  }

  /**
   * Clear all data
   */
  clear() {
    console.log('[RSStateStore] Clearing all data...');

    this.addToHistory(this.state);
    this.state = this.createInitialState();
    this.history = [];
    this.metrics = {
      updates: 0,
      lastUpdateTime: 0,
      averageUpdateDuration: 0
    };

    console.log('[RSStateStore] All data cleared');
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      state: this.state,
      metrics: this.getMetrics(),
      system: this.getSystemStatus(),
      dataQuality: this.getDataQuality(),
      history: this.getHistory(),
      subscribers: this.subscribers.size
    };
  }
}