/**
 * Data Ingestion Engine for StrategyWatch
 * Orchestrates all data flows, replaces scattered useEffect hooks with unified system
 * Provides intelligent rate limiting, background sync, and instant cache access
 */

import { getProvider } from './marketData';
import {
  fetchDailyCandlesBatch,
  fetchQuoteBatch,
  fetchRecentMinuteCandlesBatch
      } from './marketData';
import {
  storeTicks,
      storeDailyCandles,
  storeIndicators,
    getRecentTicks,
  getCachedIndicators,
  getLatestStrategyResult,
  getTickerData,
  getMetadata,
  setMetadata,
    DATA_QUALITY,
  cleanupOldData,
  buildMinuteCandle
} from './dataLake';
import { getRealTimeCalculationEngine } from './realtimeCalculationEngine';
import { isMarketHours } from '../utils/rvolCalculations';
import { Tick, TickerData, QuoteData, FinnhubCandles, StrategyScore, MovingAverages, RVolResult, PriceData } from '../types/types';

// Engine configuration
const ENGINE_CONFIG: {
  WS_RECONNECT_DELAY: number;
  WS_MAX_RETRIES: number;
  WS_BACKOFF_MULTIPLIER: number;
  API_RATE_LIMIT: number;
  API_RATE_WINDOW: number;
  API_SAFETY_MARGIN: number;
  BACKGROUND_SYNC: {
    HISTORICAL: number;
    INDICATORS: number;
    CLEANUP: number;
  };
  FRESHNESS: {
    REAL_TIME: number;
    INTRADAY: number;
    DAILY: number;
    INDICATORS: number;
  };
} = {
  // WebSocket configuration
  WS_RECONNECT_DELAY: 1000,
  WS_MAX_RETRIES: 5,
  WS_BACKOFF_MULTIPLIER: 1.5,

  // API rate limiting (Alpaca free tier: 200 calls/min)
  API_RATE_LIMIT: 200,
  API_RATE_WINDOW: 60 * 1000, // 1 minute
  API_SAFETY_MARGIN: 0.8, // Use 80% of limit to be safe

  // Background sync intervals
  BACKGROUND_SYNC: {
    HISTORICAL: 24 * 60 * 60 * 1000, // 24 hours
    INDICATORS: 60 * 60 * 1000,      // 1 hour
    CLEANUP: 6 * 60 * 60 * 1000      // 6 hours
  },

  // Data freshness thresholds
  FRESHNESS: {
    REAL_TIME: 5 * 1000,        // 5 seconds for WebSocket data
    INTRADAY: 60 * 1000,        // 1 minute for intraday candles
    DAILY: 4 * 60 * 60 * 1000,  // 4 hours for daily data
    INDICATORS: 2 * 60 * 60 * 1000 // 2 hours for indicators
  }
};

interface DataIngestionEngineState {
  lastStartup: number | null;
  totalApiCalls: number;
  lastCleanup: number | null;
  dataQuality: string;
  marketStatus: string;
}

interface DataIngestionEngineListeners {
  tick: ((tick: Tick) => void)[];
  quote: ((quote: QuoteData) => void)[];
  candles: ((candles: FinnhubCandles) => void)[];
  indicators: ((indicators: any) => void)[];
  strategies: ((strategies: StrategyScore[]) => void)[];
  status: ((status: any) => void)[];
  error: ((error: Error) => void)[];
}

/**
 * Main Data Ingestion Engine
 * Coordinates all data acquisition, caching, and real-time updates
 */
export class DataIngestionEngine {
  symbols: string[];
  provider: any;
  isConnected: boolean;
  isRunning: boolean;
  lastUpdateTime: Record<string, number>;
  websocketConnected: boolean;
  websocketError: Error | null;
  realtimeEngine: any;
  apiCalls: number[];
  apiCallInProgress: boolean;
  backgroundTasks: Map<string, NodeJS.Timeout>;
  listeners: DataIngestionEngineListeners;
  state: DataIngestionEngineState;

  constructor(symbols: string[] = []) {
    this.symbols = symbols;
    this.provider = null;
    this.isConnected = false;
    this.isRunning = false;
    this.lastUpdateTime = {};

    // 🚀 WebSocket connection status for UI integration
    this.websocketConnected = false;
    this.websocketError = null;

    // Real-time calculation engine for ACCURATE indicators
    this.realtimeEngine = getRealTimeCalculationEngine();

    // Rate limiting
    this.apiCalls = [];
    this.apiCallInProgress = false;

    // Background tasks
    this.backgroundTasks = new Map();

    // Event listeners
    this.listeners = {
      'tick': [],
      'quote': [],
      'candles': [],
      'indicators': [],
      'strategies': [],
      'status': [],
      'error': []
    };

    // State tracking
    this.state = {
      lastStartup: null,
      totalApiCalls: 0,
      lastCleanup: null,
      dataQuality: DATA_QUALITY.UNKNOWN,
      marketStatus: 'unknown'
    };
  }

  /**
   * Initialize and start the data ingestion engine
   * @param {object} options - Configuration options
   */
  async start(options: Record<string, any> = {}): Promise<void> {
    if (this.isRunning) {
      console.warn('[DataEngine] Already running');
      return;
    }

    try {
      console.log('[DataEngine] 🚀 Starting data ingestion engine...');
      this.isRunning = true;
      this.emit('status', { status: 'starting', message: 'Initializing engine...' });

      // Step 1: Load cached data instantly (provides immediate UI)
      const cachedData = await this.loadCachedData();
      this.emit('status', { status: 'loaded', message: 'Loaded cached data', data: cachedData });

      // Step 2: Initialize WebSocket connection
      await this.initializeWebSocket();
      this.emit('status', { status: 'connecting', message: 'Establishing WebSocket connection...' });

      // Step 3: Pre-populate with recent historical minute candles for IMMEDIATE VRS!
      await this.prePopulateRecentHistoricalCandles();

      // Step 4: Start ACCURATE real-time calculations
      this.realtimeEngine.start();
      console.log('[DataEngine] ⚡ Started REAL-TIME ACCURATE calculations');

      // Step 5: Start background data synchronization
      await this.startBackgroundSync();
      this.emit('status', { status: 'syncing', message: 'Starting background synchronization...' });

      // Step 6: Start background maintenance tasks
      await this.startMaintenanceTasks();

      // Update engine state
      this.state.lastStartup = Date.now();
      await this.saveEngineState();

      this.emit('status', { status: 'running', message: 'Engine running successfully' });
      console.log('[DataEngine] ✅ Data ingestion engine started successfully');

    } catch (error) {
      console.error('[DataEngine] ❌ Failed to start:', error);
      this.isRunning = false;
      this.emit('error', { type: 'startup', error });
      throw error;
    }
  }

  /**
   * Stop the data ingestion engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[DataEngine] 🛑 Stopping data ingestion engine...');
    this.isRunning = false;

    // Stop WebSocket
    if (this.provider) {
      await this.provider.disconnect();
      this.provider = null;
    }

    // Clear background tasks
    for (const [id, timeout] of this.backgroundTasks) {
      clearTimeout(timeout);
    }
    this.backgroundTasks.clear();

    // Save final state
    await this.saveEngineState();

    this.emit('status', { status: 'stopped', message: 'Engine stopped' });
    console.log('[DataEngine] ✅ Data ingestion engine stopped');
  }

  /**
   * Load cached data instantly for immediate UI rendering
   * @returns {Promise<object>} Cached data for all symbols
   */
  async loadCachedData() {
    console.log('[DataEngine] 📂 Loading cached data...');
    const startTime = Date.now();

    const cachedData: { [key: string]: TickerData } = {};
    let totalTicks = 0;
    let totalIndicators = 0;
    let totalStrategies = 0;

    // Load data for each symbol from the new data lake structure
    for (const symbol of this.symbols) {
      try {
        const ticks = await getRecentTicks(symbol, 10);
        const indicators = await getCachedIndicators(symbol, 'movingAverages');
        const rvolResult = await getLatestStrategyResult(symbol, 'rvol');
        const orbResult = await getLatestStrategyResult(symbol, 'orb5m');

        if (ticks.length > 0 || indicators || rvolResult || orbResult) {
          cachedData[symbol] = {
            symbol,
            ticks,
            indicators,
            strategies: {
              rvol: rvolResult,
              orb5m: orbResult
            },
            lastUpdated: Math.max(
              ticks[ticks.length - 1]?.timestamp || 0,
              indicators?.lastUpdated || 0,
              rvolResult?.timestamp || 0,
              orbResult?.timestamp || 0
            )
          };

          totalTicks += ticks.length;
          totalIndicators += indicators ? 1 : 0;
          totalStrategies += (rvolResult || orbResult) ? 1 : 0;

          // Emit data for each symbol
          if (ticks.length > 0) {
            const latestTick = ticks[ticks.length - 1];
            this.emit('quote', {
              symbol,
              data: {
                price: latestTick.price,
                timestamp: latestTick.timestamp,
                volume: latestTick.volume
              },
              source: 'cache'
            });
          }

          if (indicators) {
            this.emit('indicators', { symbol, data: indicators, source: 'cache' });
          }

          if (rvolResult || orbResult) {
            this.emit('strategies', {
              symbol,
              data: { rvol: rvolResult, orb5m: orbResult },
              source: 'cache'
            });
          }
        }
      } catch (error) {
        console.warn(`[DataEngine] Failed to load cached data for ${symbol}:`, error);
      }
    }

    const loadTime = Date.now() - startTime;
    console.log(`[DataEngine] ✅ Loaded ${Object.keys(cachedData).length} symbols from cache in ${loadTime}ms:`, {
      totalTicks,
      totalIndicators,
      totalStrategies
    });

    this.state.dataQuality = this.calculateDataQuality(cachedData);
    return cachedData;
  }

  /**
   * Pre-populate real-time engine with recent historical minute candles
   * This enables IMMEDIATE VRS calculations on startup!
   */
  async prePopulateRecentHistoricalCandles() {
    try {
      console.log('[DataEngine] 🔄 Fetching recent minute candles for immediate VRS calculations...');

      // Fetch last 20 minutes of 1-minute candles for all symbols
      const historicalCandles = await fetchRecentMinuteCandlesBatch(this.symbols);

      // Pre-populate the real-time engine
      this.realtimeEngine.prePopulateHistoricalCandles(historicalCandles);

      console.log('[DataEngine] ✅ Pre-populated real-time engine with historical candles');
    } catch (error) {
      console.error('[DataEngine] ❌ Failed to pre-populate historical candles:', error);
      // Non-fatal error - continue startup
    }
  }

  /**
   * Initialize WebSocket connection for real-time data
   */
  async initializeWebSocket() {
    if (this.isConnected || this.provider) {
      console.warn('[DataEngine] ⚠️ WebSocket already connected or connecting, skipping...');
      return;
    }

    try {
      console.log('[DataEngine] 🌐 Initializing WebSocket connection...');
      this.provider = getProvider();

      // Subscribe to real-time trades
      await this.provider.subscribeLive(this.symbols, (update) => {
        this.handleWebSocketUpdate(update);
      });

      this.isConnected = true;
      this.websocketConnected = true;
      this.websocketError = null;
      this.state.reconnectAttempts = 0; // Reset attempts on successful connection
      console.log('[DataEngine] ✅ WebSocket connected');

      this.emit('status', { status: 'connected', message: 'WebSocket connected' });

    } catch (error) {
      console.error('[DataEngine] ❌ WebSocket connection failed:', error);
      this.isConnected = false;
      this.websocketConnected = false;
      this.websocketError = error;

      // Special handling for connection limit exceeded (406)
      if (error.message?.includes('connection limit exceeded') || error.code === 406) {
        console.warn('[DataEngine] ⚠️ Connection limit exceeded, waiting longer before retry...');
        // Wait 60 seconds before retrying connection limit errors
        setTimeout(() => {
          if (this.isRunning) {
            this.state.reconnectAttempts = 0; // Reset attempts after long wait
            this.scheduleReconnect();
          }
        }, 60000);
        this.emit('error', {
          type: 'connection_limit',
          error,
          message: 'Connection limit exceeded - retrying in 60 seconds'
        });
      } else {
        // Implement normal reconnection logic for other errors
        this.scheduleReconnect();
        this.emit('error', { type: 'websocket', error });
      }
    }
  }

  /**
   * Handle WebSocket updates
   * @param {object} update - WebSocket update
   */
  async handleWebSocketUpdate(update) {
    if (!update.symbol || !this.symbols.includes(update.symbol)) return;

    try {
      // Process trade messages (real-time price updates)
      if (update.type === 'trade' && typeof update.price === 'number') {
        const tickData = {
          timestamp: update.timestamp,
          price: update.price,
          volume: update.volume || update.size || 0,
          size: update.size || 100,
          exchange: update.exchange || 'UNKNOWN',
          conditions: update.conditions || []
        };

        // Store tick data in the new data lake
        await storeTicks(update.symbol, [tickData]);

        // 🔥 CRITICAL: Process through REAL-TIME calculation engine for ACCURACY
        this.realtimeEngine.processTick(update.symbol, tickData);

        // Emit real-time update
        this.emit('tick', { symbol: update.symbol, data: tickData });
        this.emit('quote', {
          symbol: update.symbol,
          data: {
            price: tickData.price,
            timestamp: tickData.timestamp,
            volume: tickData.volume,
            receivedAt: Date.now()
          },
          source: 'websocket'
        });

        this.lastUpdateTime[update.symbol] = Date.now();

        // Build minute candle if needed (backup calculation)
        await this.buildMinuteCandleIfNeeded(update.symbol, tickData.timestamp);
      }

    } catch (error) {
      console.error(`[DataEngine] ❌ Failed to handle WebSocket update for ${update.symbol}:`, error);
      this.emit('error', { type: 'websocket_update', symbol: update.symbol, error });
    }
  }

  /**
   * Build minute candle if enough ticks accumulated
   * @param {string} symbol - Stock symbol
   * @param {number} timestamp - Tick timestamp
   */
  async buildMinuteCandleIfNeeded(symbol, timestamp) {
    
    try {
      const candle = await buildMinuteCandle(symbol, timestamp);
      if (candle) {
        this.emit('candles', {
          symbol,
          data: candle,
          source: 'generated'
        });
      }
    } catch (error) {
      // Not critical if candle building fails
      console.warn(`[DataEngine] Minute candle building failed for ${symbol}:`, error);
    }
  }

  /**
   * Schedule WebSocket reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (!this.isRunning) return;

    const attempt = (this.state.reconnectAttempts || 0) + 1;
    this.state.reconnectAttempts = attempt;

    if (attempt > ENGINE_CONFIG.WS_MAX_RETRIES) {
      console.error('[DataEngine] ❌ Max reconnection attempts reached');
      this.emit('error', {
        type: 'reconnect_failed',
        attempts: attempt,
        message: 'Max reconnection attempts reached'
      });
      return;
    }

    const delay = ENGINE_CONFIG.WS_RECONNECT_DELAY * Math.pow(ENGINE_CONFIG.WS_BACKOFF_MULTIPLIER, attempt - 1);
    console.log(`[DataEngine] 🔄 Scheduling reconnection attempt ${attempt} in ${delay}ms`);

    setTimeout(async () => {
      if (this.isRunning) {
        await this.initializeWebSocket();
      }
    }, delay);
  }

  /**
   * Start background data synchronization
   */
  async startBackgroundSync() {
    console.log('[DataEngine] 🔄 Starting background synchronization...');

    // Initial sync for all symbols
    await this.syncAllSymbols();

    // Schedule periodic syncs
    this.schedulePeriodicSync();
  }

  /**
   * Synchronize data for all symbols
   */
  async syncAllSymbols() {
    console.log('[DataEngine] 🔄 Synchronizing all symbols...');

    for (const symbol of this.symbols) {
      await this.syncSymbol(symbol);
    }
  }

  /**
   * Synchronize data for a single symbol
   * @param {string} symbol - Stock symbol
   */
  async syncSymbol(symbol) {
    try {
      // Check rate limit
      if (!await this.checkRateLimit()) {
        console.warn(`[DataEngine] ⚠️ Rate limit reached, deferring sync for ${symbol}`);
        return;
      }

      const existingData = await getTickerData(symbol);
      const syncPlan = this.createSyncPlan(symbol, existingData);

      // Execute sync plan
      await this.executeSyncPlan(symbol, syncPlan);

    } catch (error) {
      console.error(`[DataEngine] ❌ Failed to sync ${symbol}:`, error);
      this.emit('error', { type: 'sync', symbol, error });
    }
  }

  /**
   * Create synchronization plan for a symbol
   * @param {string} symbol - Stock symbol
   * @param {object} existingData - Existing cached data
   * @returns {object} Sync plan
   */
  createSyncPlan(symbol, existingData) {
    const now = Date.now();
    const plan = {
      symbol,
      actions: [],
      priority: 'normal'
    };

    // Check if we need fresh data
    const needsQuote = !existingData?.currentQuote ||
                      (now - existingData.currentQuote.timestamp) > ENGINE_CONFIG.FRESHNESS.REAL_TIME;

    const needsDailyData = !existingData?.dailyCandles ||
                         existingData.dailyCandles.length === 0 ||
                         (now - new Date(existingData.dailyCandles[existingData.dailyCandles.length - 1]?.date).getTime()) > ENGINE_CONFIG.FRESHNESS.DAILY;

    const needsIndicators = !existingData?.indicators ||
                           !existingData.indicators.movingAverages ||
                           (now - existingData.indicators.lastUpdated) > ENGINE_CONFIG.FRESHNESS.INDICATORS;

    // Add actions based on what's needed
    if (needsQuote) {
      plan.actions.push({ type: 'quote', priority: 'high' });
    }

    if (needsDailyData) {
      plan.actions.push({ type: 'daily_candles', priority: 'medium' });
    }

    if (needsIndicators && existingData?.dailyCandles?.length > 0) {
      plan.actions.push({ type: 'indicators', priority: 'low' });
    }

    // Set overall priority based on actions
    if (plan.actions.some(a => a.priority === 'high')) {
      plan.priority = 'high';
    }

    return plan;
  }

  /**
   * Execute synchronization plan
   * @param {string} symbol - Stock symbol
   * @param {object} plan - Sync plan
   */
  async executeSyncPlan(symbol, plan) {
    console.log(`[DataEngine] 🔄 Executing sync plan for ${symbol}:`, plan.actions.map(a => a.type));

    for (const action of plan.actions) {
      try {
        switch (action.type) {
          case 'quote':
            await this.fetchQuote(symbol);
            break;
          case 'daily_candles':
            await this.fetchDailyCandles(symbol);
            break;
          case 'indicators':
            await this.calculateIndicators(symbol);
            break;
        }
      } catch (error) {
        console.error(`[DataEngine] ❌ Failed to execute ${action.type} for ${symbol}:`, error);
        // Continue with other actions even if one fails
      }
    }
  }

  /**
   * Fetch current quote for symbol
   * @param {string} symbol - Stock symbol
   */
  async fetchQuote(symbol) {
    if (!await this.checkRateLimit()) {
      console.warn(`[DataEngine] ⚠️ Rate limit reached, deferring quote fetch for ${symbol}`);
      return;
    }

    try {
      const quotes = await fetchQuoteBatch([symbol]);
      const quote = quotes[symbol];

      if (quote) {
        // Store as tick data in the new data lake
        await storeTicks(symbol, [{
          timestamp: quote.timestamp || Date.now(),
          price: quote.price,
          volume: quote.volume || 0,
          size: 100,
          exchange: 'IEX',
          conditions: ['REST_API']
        }]);

        this.emit('quote', {
          symbol,
          data: {
            price: quote.price,
            timestamp: quote.timestamp,
            volume: quote.volume,
            open: quote.open,
            high: quote.high,
            low: quote.low,
            previousClose: quote.previousClose
          },
          source: 'api'
        });

        this.incrementApiCallCount();
      }
    } catch (error) {
      console.error(`[DataEngine] ❌ Failed to fetch quote for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Fetch daily candles for symbol
   * @param {string} symbol - Stock symbol
   */
  async fetchDailyCandles(symbol) {
    if (!await this.checkRateLimit()) {
      console.warn(`[DataEngine] ⚠️ Rate limit reached, deferring daily candles fetch for ${symbol}`);
      return;
    }

    try {
      const candlesData = await fetchDailyCandlesBatch([symbol]);
      const candles = candlesData[symbol];

      if (candles && candles.c && candles.c.length > 0) {
        const dailyCandles = candles.c.map((close, i) => ({
          timestamp: candles.t[i] * 1000,
          open: candles.o?.[i] || close,
          high: candles.h?.[i] || close,
          low: candles.l?.[i] || close,
          close: close,
          volume: candles.v?.[i] || 0
        }));

        // Store in the new data lake
        await storeDailyCandles(symbol, dailyCandles);
        this.incrementApiCallCount();

        // Trigger indicator calculation
        await this.calculateIndicators(symbol);
      }
    } catch (error) {
      console.error(`[DataEngine] ❌ Failed to fetch daily candles for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Calculate and store indicators for symbol
   * @param {string} symbol - Stock symbol
   */
  async calculateIndicators(symbol) {
    try {
      // Get daily candles from data lake for calculation
      // This would need a method to retrieve daily candles for calculation
      // For now, we'll implement a simplified version

      const movingAverages = {}; // This would be calculated from stored daily candles
      const adr20 = null; // This would be calculated from stored daily candles

      const indicators = {
        movingAverages,
        adr20,
        adr20Decimal: adr20 ? adr20 / 100 : null,
        lastUpdated: Date.now()
      };

      // Store indicators in the new data lake
      await storeIndicators(symbol, 'movingAverages', indicators);
      this.emit('indicators', { symbol, data: indicators, source: 'calculated' });

    } catch (error) {
      console.error(`[DataEngine] ❌ Failed to calculate indicators for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Schedule periodic background tasks
   */
  schedulePeriodicSync() {
    // Periodic full sync (every 5 minutes during market hours)
    const periodicSync = () => {
      if (this.isRunning && isMarketHours()) {
        this.syncAllSymbols();
      }
      this.backgroundTasks.set('periodicSync', setTimeout(periodicSync, 5 * 60 * 1000));
    };
    this.backgroundTasks.set('periodicSync', setTimeout(periodicSync, 5 * 60 * 1000));

    // Historical data refresh (daily)
    const historicalRefresh = () => {
      if (this.isRunning) {
        this.refreshHistoricalData();
      }
      this.backgroundTasks.set('historicalRefresh',
        setTimeout(historicalRefresh, ENGINE_CONFIG.BACKGROUND_SYNC.HISTORICAL));
    };
    this.backgroundTasks.set('historicalRefresh',
      setTimeout(historicalRefresh, ENGINE_CONFIG.BACKGROUND_SYNC.HISTORICAL));
  }

  /**
   * Start maintenance tasks
   */
  async startMaintenanceTasks() {
    // Data cleanup
    const cleanupTask = async () => {
      if (this.isRunning) {
        try {
          const result = await cleanupOldData(this.symbols);
          console.log('[DataEngine] 🧹 Cleanup completed:', result);
          this.state.lastCleanup = Date.now();
          await this.saveEngineState();
        } catch (error) {
          console.error('[DataEngine] ❌ Cleanup failed:', error);
        }
      }
      this.backgroundTasks.set('cleanup',
        setTimeout(cleanupTask, ENGINE_CONFIG.BACKGROUND_SYNC.CLEANUP));
    };
    this.backgroundTasks.set('cleanup',
      setTimeout(cleanupTask, ENGINE_CONFIG.BACKGROUND_SYNC.CLEANUP));
  }

  /**
   * Refresh historical data for all symbols
   */
  async refreshHistoricalData() {
    console.log('[DataEngine] 🔄 Refreshing historical data...');

    for (const symbol of this.symbols) {
      await this.fetchDailyCandles(symbol);
    }
  }

  /**
   * Check API rate limit
   * @returns {Promise<boolean>} True if within rate limit
   */
  async checkRateLimit() {
    const now = Date.now();
    const windowStart = now - ENGINE_CONFIG.API_RATE_WINDOW;

    // Clean old API calls from tracking
    this.apiCalls = this.apiCalls.filter(time => time > windowStart);

    const currentCalls = this.apiCalls.length;
    const maxCalls = ENGINE_CONFIG.API_RATE_LIMIT * ENGINE_CONFIG.API_SAFETY_MARGIN;

    return currentCalls < maxCalls;
  }

  /**
   * Increment API call counter
   */
  incrementApiCallCount() {
    this.apiCalls.push(Date.now());
    this.state.totalApiCalls++;
  }

  /**
   * Calculate overall data quality
   * @param {object} cachedData - Cached data for all symbols
   * @returns {string} Data quality level
   */
  calculateDataQuality(cachedData) {
    if (!cachedData || Object.keys(cachedData).length === 0) {
      return DATA_QUALITY.UNKNOWN;
    }

    const now = Date.now();
    let totalScore = 0;
    let symbolCount = 0;

    for (const [symbol, data] of Object.entries(cachedData)) {
      let symbolScore = 0;

      // Check quote freshness (max 40 points)
      if (data.currentQuote) {
        const quoteAge = now - data.currentQuote.timestamp;
        if (quoteAge < ENGINE_CONFIG.FRESHNESS.REAL_TIME) symbolScore += 40;
        else if (quoteAge < ENGINE_CONFIG.FRESHNESS.INTRADAY) symbolScore += 20;
        else if (quoteAge < ENGINE_CONFIG.FRESHNESS.DAILY) symbolScore += 10;
      }

      // Check indicators (max 40 points)
      if (data.indicators?.movingAverages) {
        const indicatorAge = now - (data.indicators.lastUpdated || 0);
        if (indicatorAge < ENGINE_CONFIG.FRESHNESS.INDICATORS) symbolScore += 40;
        else if (indicatorAge < ENGINE_CONFIG.FRESHNESS.DAILY) symbolScore += 20;
      }

      // Check data completeness (max 20 points)
      if (data.dailyCandles && data.dailyCandles.length > 200) symbolScore += 20;
      else if (data.dailyCandles && data.dailyCandles.length > 50) symbolScore += 10;

      totalScore += symbolScore;
      symbolCount++;
    }

    const averageScore = symbolCount > 0 ? totalScore / symbolCount : 0;

    if (averageScore >= 80) return DATA_QUALITY.EXCELLENT;
    if (averageScore >= 60) return DATA_QUALITY.GOOD;
    if (averageScore >= 30) return DATA_QUALITY.POOR;
    return DATA_QUALITY.UNKNOWN;
  }

  /**
   * Save engine state to metadata
   */
  async saveEngineState() {
    await setMetadata('engineState', this.state);
  }

  /**
   * Load engine state from metadata
   */
  async loadEngineState() {
    const saved = await getMetadata('engineState');
    if (saved) {
      this.state = { ...this.state, ...saved };
    }
  }

  /**
   * Add event listener
   * @param {string} event - Event type
   * @param {function} callback - Event callback
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * Remove event listener
   * @param {string} event - Event type
   * @param {function} callback - Event callback
   */
  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event type
   * @param {any} data - Event data
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[DataEngine] ❌ Event listener error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Subscribe to ACCURATE real-time calculations for a symbol
   * @param {string} symbol - Trading symbol
   * @param {function} callback - Callback function
   */
  subscribeToRealTimeCalculations(symbol, callback) {
    this.realtimeEngine.subscribe(symbol, callback);
    console.log(`[DataEngine] 🔥 Subscribed to ACCURATE real-time calculations for ${symbol}`);
  }

  /**
   * Unsubscribe from real-time calculations
   * @param {string} symbol - Trading symbol
   * @param {function} callback - Callback function
   */
  unsubscribeFromRealTimeCalculations(symbol, callback) {
    this.realtimeEngine.unsubscribe(symbol, callback);
    console.log(`[DataEngine] 🛑 Unsubscribed from real-time calculations for ${symbol}`);
  }

  /**
   * Get latest ACCURATE indicators for symbol
   * @param {string} symbol - Trading symbol
   * @returns {object|null} Latest accurate indicators
   */
  getLatestAccurateIndicators(symbol) {
    return this.realtimeEngine.getLatestIndicators(symbol);
  }

  /**
   * Get current engine status
   * @returns {object} Engine status
   */
  getStatus() {
    const realtimeStats = this.realtimeEngine.getStats();

    return {
      isRunning: this.isRunning,
      isConnected: this.isConnected,
      symbols: this.symbols.length,
      totalApiCalls: this.state.totalApiCalls,
      lastStartup: this.state.lastStartup,
      dataQuality: this.state.dataQuality,
      apiCallsInWindow: this.apiCalls.length,
      backgroundTasks: this.backgroundTasks.size,
      realtimeEngine: realtimeStats
    };
  }
}

/**
 * Create and configure data ingestion engine instance
 * @param {string[]} symbols - Symbols to track
 * @returns {DataIngestionEngine} Engine instance
 */
export const createDataIngestionEngine = (symbols) => {
  return new DataIngestionEngine(symbols);
};

export default DataIngestionEngine;