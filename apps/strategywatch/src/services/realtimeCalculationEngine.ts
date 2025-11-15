import * as DataLake from './dataLake.ts';
import { calculateVRS5m } from './calculations.ts';
import { isMarketHours } from '../utils/rvolCalculations.ts';
import { isORBActive } from '../utils/marketTime.ts';
import { Tick, Bar, IndicatorData, StrategyResult } from '../types/types';

interface RealTimeWindow {
  ticks: Tick[];
  minuteCandles: Map<number, Bar>;
  lastUpdated: number;
}

class RealTimeWindowManager {
  private windows: Map<string, RealTimeWindow> = new Map();
  private maxTickRetention = 24 * 60 * 60 * 1000;

  addTick(symbol: string, tick: Tick): void {
    if (!this.windows.has(symbol)) {
      this.windows.set(symbol, {
        ticks: [],
        minuteCandles: new Map(),
        lastUpdated: 0
      });
    }

    const window = this.windows.get(symbol)!;
    const validatedTick = this.validateTick(tick);
    if (!validatedTick) return;

    window.ticks.push(validatedTick);
    this.updateMinuteCandles(symbol, validatedTick);
    this.cleanupOldTicks(window);
    window.lastUpdated = Date.now();
  }

  validateTick(tick: Tick): Tick | null {
    if (!tick || typeof tick.price !== 'number' || !isFinite(tick.price)) {
      console.warn('[RealTimeEngine] ❌ Invalid tick price:', tick?.price);
      return null;
    }

    if (tick.price <= 0) {
      console.warn('[RealTimeEngine] ❌ Invalid price (<= 0):', tick.price);
      return null;
    }

    const now = Date.now();
    const tickTime = tick.timestamp || now;

    if (Math.abs(now - tickTime) > 300000) {
      console.warn('[RealTimeEngine] ⚠️ Very old tick, timestamp gap:', Math.abs(now - tickTime), 'ms');
    }

    return {
      ...tick,
      timestamp: tickTime,
      validatedAt: now,
      price: Number(tick.price.toFixed(4))
    };
  }

  updateMinuteCandles(symbol: string, tick: Tick): void {
    const window = this.windows.get(symbol)!;
    const minuteKey = Math.floor(tick.timestamp / 60000) * 60000;

    if (!window.minuteCandles.has(minuteKey)) {
      window.minuteCandles.set(minuteKey, {
        symbol,
        timestamp: minuteKey,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume || 0,
        trades: 1,
        vwap: tick.price,
        firstTickTime: tick.timestamp
      });
    } else {
      const candle = window.minuteCandles.get(minuteKey)!;
      candle.high = Math.max(candle.high, tick.price);
      candle.low = Math.min(candle.low, tick.price);
      candle.close = tick.price;
      candle.volume += (tick.volume || 0);
      candle.trades! += 1;

      const totalValue = candle.vwap! * (candle.trades! - 1) + tick.price * (tick.volume || 1);
      const totalVolume = candle.volume || 1;
      candle.vwap = totalValue / totalVolume;
    }
  }

  getTicksInWindow(symbol: string, windowMs: number): Tick[] {
    const window = this.windows.get(symbol);
    if (!window) return [];

    const cutoffTime = Date.now() - windowMs;
    return window.ticks
      .filter(tick => tick.timestamp >= cutoffTime)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getMinuteCandlesInWindow(symbol: string, windowMs: number): Bar[] {
    const window = this.windows.get(symbol);
    if (!window) return [];

    // Get all candles sorted by timestamp
    const allCandles = Array.from(window.minuteCandles.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    // Calculate how many candles we need based on the window size (in minutes)
    const windowMinutes = Math.ceil(windowMs / 60000);

    // Return the most recent N candles (not filtered by absolute time)
    // This ensures we get historical candles even if they're from hours ago
    return allCandles.slice(-windowMinutes);
  }

  getLatestPrice(symbol: string): number | null {
    const window = this.windows.get(symbol);
    if (!window || window.ticks.length === 0) return null;
    return window.ticks[window.ticks.length - 1].price;
  }

  getPriceAtTime(symbol: string, timestamp: number): number | null {
    const window = this.windows.get(symbol);
    if (!window) return null;

    const closestTick = window.ticks.reduce((closest: Tick | null, tick: Tick) => {
      if (!closest) return tick;
      const currentDiff = Math.abs(tick.timestamp - timestamp);
      const closestDiff = Math.abs(closest.timestamp - timestamp);
      return currentDiff < closestDiff ? tick : closest;
    }, null);

    return closestTick ? closestTick.price : null;
  }

  cleanupOldTicks(window: RealTimeWindow): void {
    const cutoffTime = Date.now() - this.maxTickRetention;
    window.ticks = window.ticks.filter(tick => tick.timestamp >= cutoffTime);

    const candleCutoff = Date.now() - (4 * 60 * 60 * 1000);
    for (const [timestamp] of window.minuteCandles) {
      if (timestamp < candleCutoff) {
        window.minuteCandles.delete(timestamp);
      }
    }
  }

  getWindowStats(symbol: string): any | null {
    const window = this.windows.get(symbol);
    if (!window) return null;

    return {
      tickCount: window.ticks.length,
      minuteCandleCount: window.minuteCandles.size,
      oldestTick: window.ticks[0]?.timestamp || 0,
      newestTick: window.ticks[window.ticks.length - 1]?.timestamp || 0,
      lastUpdated: window.lastUpdated,
      timeSpan: window.ticks.length > 1 ?
        window.ticks[window.ticks.length - 1].timestamp - window.ticks[0].timestamp : 0
    };
  }
}

export class RealTimeCalculationEngine {
  private windowManager: RealTimeWindowManager = new RealTimeWindowManager();
  private indicators: Map<string, IndicatorData> = new Map();
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private isRunning = false;
  private lastCalculationTime = 0;
  private config = {
    maxAgeMs: 1000,
    minTickWindow: 60 * 1000,
    vrsWindow: 15 * 60 * 1000,
    orbWindow: 5 * 60 * 1000,
    calculationInterval: 100
  };

  start(): void {
    if (this.isRunning) {
      console.warn('[RealTimeEngine] Already running');
      return;
    }
    console.log('[RealTimeEngine] 🚀 Starting ACCURATE real-time calculations...');
    this.isRunning = true;
    this.startCalculationLoop();
  }

  stop(): void {
    console.log('[RealTimeEngine] 🛑 Stopping real-time calculations...');
    this.isRunning = false;
  }

  processTick(symbol: string, tick: Tick): void {
    this.windowManager.addTick(symbol, tick);
    this.calculateIndicators(symbol);
    this.notifySubscribers(symbol, 'tick', tick);
  }

  startCalculationLoop(): void {
    const calculate = () => {
      if (!this.isRunning) return;
      const symbols = Array.from(this.windowManager.getWindowStats.keys());
      for (const symbol of symbols) {
        this.calculateIndicators(symbol);
      }
      this.lastCalculationTime = Date.now();
      setTimeout(calculate, this.config.calculationInterval);
    };
    calculate();
  }

  calculateIndicators(symbol: string): void {
    try {
      const latestPrice = this.windowManager.getLatestPrice(symbol);
      if (!latestPrice) {
        return;
      }

      const indicators: IndicatorData = {
        symbol,
        timestamp: Date.now(),
        latestPrice,
        calculations: {}
      };

      // Calculate VRS 1m (NEW!)
      const vrs1m = this.calculateVRS1mRealtime(symbol);
      if (vrs1m !== null) {
        (indicators.calculations as any).vrs1m = vrs1m;
      }

      // Calculate VRS 5m
      const vrs5m = this.calculateVRS5mRealtime(symbol);
      if (vrs5m !== null) {
        (indicators.calculations as any).vrs5m = vrs5m;
      }

      // Calculate VRS 15m
      const vrs15m = this.calculateVRS15mRealtime(symbol);
      if (vrs15m !== null) {
        (indicators.calculations as any).vrs15m = vrs15m;
      }

      if (isORBActive()) {
        const orb = this.calculateORBRealtime(symbol);
        if (orb !== null) {
          (indicators.calculations as any).orb5m = orb;
        }
      }

      const priceChanges = this.calculatePriceChangesRealtime(symbol);
      if (priceChanges) {
        (indicators.calculations as any).priceChanges = priceChanges;
      }

      this.indicators.set(symbol, indicators);
      this.storeIndicators(symbol, indicators);
      this.notifySubscribers(symbol, 'indicators', indicators);
    } catch (error) {
      console.error(`[RealTimeEngine] ❌ Calculation error for ${symbol}:`, error);
    }
  }

  calculateVRS1mRealtime(symbol: string): any | null {
    try {
      const windowMs = 2 * 60 * 1000; // Get 2 minutes of data to compare
      const candles = this.windowManager.getMinuteCandlesInWindow(symbol, windowMs);

      // Need at least 2 candles that are 1 minute apart
      if (candles.length < 2) {
        return null;
      }

      // Compare the last 2 candles (1 minute apart)
      const latestCandle = candles[candles.length - 1];
      const previousCandle = candles[candles.length - 2];

      // Get QQQ benchmark (avoid recursion for QQQ itself)
      const qqqVRS = symbol === 'QQQ'
        ? { value: 50, changePercent: 0 } // Neutral VRS for QQQ itself
        : this.calculateVRS1mRealtime('QQQ');

      const benchmarkChange = qqqVRS?.changePercent || 0;
      const vrsValue = this.calculateVRSValue(latestCandle, previousCandle, qqqVRS || { value: 50, changePercent: 0 });

      return {
        value: vrsValue !== null ? vrsValue : 50,
        currentClose: latestCandle.close,
        previousClose: previousCandle.close,
        change: latestCandle.close - previousCandle.close,
        changePercent: ((latestCandle.close - previousCandle.close) / previousCandle.close) * 100,
        benchmarkChange,
        windowSize: 1 * 60 * 1000,
        dataPoints: candles.length,
        calculatedAt: Date.now(),
        source: 'realtime_window'
      };
    } catch (error) {
      console.error(`[RealTimeEngine] VRS 1m calculation error for ${symbol}:`, error);
      return null;
    }
  }

  calculateVRS5mRealtime(symbol: string): any | null {
    try {
      const windowMs = 6 * 60 * 1000; // Get 6 minutes of data to ensure we have candles 5min apart
      const candles = this.windowManager.getMinuteCandlesInWindow(symbol, windowMs);

      // Need at least 6 candles to have 5 minutes between them
      if (candles.length < 6) {
        return null;
      }

      // Compare latest candle to candle from 5 minutes ago (5 candles back)
      const latestCandle = candles[candles.length - 1];
      const candle5mAgo = candles[candles.length - 6]; // 6th from last = 5 minutes ago

      // Get QQQ benchmark (avoid recursion for QQQ itself)
      const qqqVRS = symbol === 'QQQ'
        ? { value: 50, changePercent: 0 } // Neutral VRS for QQQ itself
        : this.calculateVRS5mRealtime('QQQ');

      const benchmarkChange = qqqVRS?.changePercent || 0;
      const vrsValue = this.calculateVRSValue(latestCandle, candle5mAgo, qqqVRS || { value: 50, changePercent: 0 });

      return {
        value: vrsValue !== null ? vrsValue : 50,
        currentClose: latestCandle.close,
        previousClose: candle5mAgo.close,
        change: latestCandle.close - candle5mAgo.close,
        changePercent: ((latestCandle.close - candle5mAgo.close) / candle5mAgo.close) * 100,
        benchmarkChange,
        windowSize: 5 * 60 * 1000,
        dataPoints: candles.length,
        calculatedAt: Date.now(),
        source: 'realtime_window'
      };
    } catch (error) {
      console.error(`[RealTimeEngine] VRS 5m calculation error for ${symbol}:`, error);
      return null;
    }
  }

  calculateVRS15mRealtime(symbol: string): any | null {
    try {
      const windowMs = 16 * 60 * 1000; // Get 16 minutes of data to ensure we have candles 15min apart
      const candles = this.windowManager.getMinuteCandlesInWindow(symbol, windowMs);

      // Need at least 16 candles to have 15 minutes between them
      if (candles.length < 16) {
        return null;
      }

      // Compare latest candle to candle from 15 minutes ago (15 candles back)
      const latestCandle = candles[candles.length - 1];
      const candle15mAgo = candles[candles.length - 16]; // 16th from last = 15 minutes ago

      // Get QQQ benchmark (avoid recursion for QQQ itself)
      const qqqVRS = symbol === 'QQQ'
        ? { value: 50, changePercent: 0 } // Neutral VRS for QQQ itself
        : this.calculateVRS15mRealtime('QQQ');

      const benchmarkChange = qqqVRS?.changePercent || 0;
      const vrsValue = this.calculateVRSValue(latestCandle, candle15mAgo, qqqVRS || { value: 50, changePercent: 0 });

      return {
        value: vrsValue !== null ? vrsValue : 50,
        currentClose: latestCandle.close,
        previousClose: candle15mAgo.close,
        change: latestCandle.close - candle15mAgo.close,
        changePercent: ((latestCandle.close - candle15mAgo.close) / candle15mAgo.close) * 100,
        benchmarkChange,
        windowSize: 15 * 60 * 1000,
        dataPoints: candles.length,
        calculatedAt: Date.now(),
        source: 'realtime_window'
      };
    } catch (error) {
      console.error(`[RealTimeEngine] VRS 15m calculation error for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Pre-populate window manager with historical minute candles
   * Enables IMMEDIATE VRS calculations on app startup!
   * @param {Record<string, Bar[]>} historicalCandles - Map of symbol -> array of minute candles
   */
  prePopulateHistoricalCandles(historicalCandles: Record<string, any[]>): void {
    console.log('[RealTimeEngine] 🚀 Pre-populating with historical minute candles...');

    let totalCandles = 0;
    for (const [symbol, candles] of Object.entries(historicalCandles)) {
      if (!candles || candles.length === 0) continue;

      for (const candle of candles) {
        // Add as minute candle directly to window manager
        if (!this.windowManager['windows']) {
          this.windowManager['windows'] = new Map();
        }

        if (!this.windowManager['windows'].has(symbol)) {
          this.windowManager['windows'].set(symbol, {
            ticks: [],
            minuteCandles: new Map(),
            lastUpdated: 0
          });
        }

        const window = this.windowManager['windows'].get(symbol);
        const minuteKey = Math.floor(candle.timestamp / 60000) * 60000;

        window.minuteCandles.set(minuteKey, {
          symbol,
          timestamp: minuteKey,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          trades: candle.trades || 1,
          vwap: candle.vwap || candle.close
        });

        totalCandles++;
      }

      // Trigger immediate calculation for this symbol
      this.calculateIndicators(symbol);
    }

    console.log(`[RealTimeEngine] ✅ Pre-populated ${totalCandles} candles, calculated VRS for ${Object.keys(historicalCandles).length} symbols`);
  }

  calculateVRSValue(currentCandle: Bar, previousCandle: Bar, benchmarkVRS: any): number | null {
    try {
      if (!currentCandle || !previousCandle || !benchmarkVRS) {
        return null;
      }
      const stockChange = ((currentCandle.close - previousCandle.close) / previousCandle.close) * 100;
      const relativeChange = stockChange - (benchmarkVRS.changePercent || 0);
      const vrsValue = Math.max(0, Math.min(100, 50 + relativeChange * 10));
      return Number(vrsValue.toFixed(2));
    } catch (error) {
      console.error('[RealTimeEngine] VRS value calculation error:', error);
      return null;
    }
  }

  calculateORBRealtime(symbol: string): any | null {
    try {
      const windowMs = 5 * 60 * 1000;
      const ticks = this.windowManager.getTicksInWindow(symbol, windowMs);
      if (ticks.length < 10) {
        return null;
      }
      const firstTick = ticks[0];
      const latestTick = ticks[ticks.length - 1];
      const high = Math.max(...ticks.map(t => t.price));
      const low = Math.min(...ticks.map(t => t.price));
      const range = high - low;
      const rangePercent = (range / firstTick.price) * 100;
      return {
        open: firstTick.price,
        high,
        low,
        close: latestTick.price,
        range,
        rangePercent,
        change: latestTick.price - firstTick.price,
        changePercent: ((latestTick.price - firstTick.price) / firstTick.price) * 100,
        volume: ticks.reduce((sum, t) => sum + (t.volume || 0), 0),
        trades: ticks.length,
        windowSize: windowMs,
        calculatedAt: Date.now(),
        source: 'realtime_window'
      };
    } catch (error) {
      console.error(`[RealTimeEngine] ORB calculation error for ${symbol}:`, error);
      return null;
    }
  }

  calculatePriceChangesRealtime(symbol: string): any | null {
    try {
      const latestPrice = this.windowManager.getLatestPrice(symbol);
      if (!latestPrice) return null;

      const changes: any = {
        current: latestPrice,
        calculatedAt: Date.now()
      };

      const price1mAgo = this.windowManager.getPriceAtTime(symbol, Date.now() - (60 * 1000));
      if (price1mAgo) {
        changes.change1m = latestPrice - price1mAgo;
        changes.changePercent1m = ((latestPrice - price1mAgo) / price1mAgo) * 100;
      }

      const price5mAgo = this.windowManager.getPriceAtTime(symbol, Date.now() - (5 * 60 * 1000));
      if (price5mAgo) {
        changes.change5m = latestPrice - price5mAgo;
        changes.changePercent5m = ((latestPrice - price5mAgo) / price5mAgo) * 100;
      }

      const price15mAgo = this.windowManager.getPriceAtTime(symbol, Date.now() - (15 * 60 * 1000));
      if (price15mAgo) {
        changes.change15m = latestPrice - price15mAgo;
        changes.changePercent15m = ((latestPrice - price15mAgo) / price15mAgo) * 100;
      }

      return changes;
    } catch (error) {
      console.error(`[RealTimeEngine] Price changes calculation error for ${symbol}:`, error);
      return null;
    }
  }

  async storeIndicators(symbol: string, indicators: IndicatorData): Promise<void> {
    try {
      const vrsData: any = {};
      for (const [type, calculation] of Object.entries(indicators.calculations)) {
        if (type.startsWith('vrs')) {
          vrsData[type] = calculation;
        } else {
          await DataLake.storeStrategyResult(symbol, type, calculation as StrategyResult);
        }
      }
      if (Object.keys(vrsData).length > 0) {
        await DataLake.storeStrategyResult(symbol, 'vrs', vrsData as StrategyResult);
      }
      if (indicators.latestPrice) {
        await DataLake.storeTicks(symbol, [{
          timestamp: indicators.timestamp,
          price: indicators.latestPrice,
          volume: 0,
          size: 100,
          exchange: 'CALCULATION',
          conditions: ['REALTIME_INDICATOR']
        }]);
      }
    } catch (error) {
      console.error(`[RealTimeEngine] Failed to store indicators for ${symbol}:`, error);
    }
  }

  subscribe(symbol: string, callback: (data: any) => void): void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(callback);
    const currentIndicators = this.indicators.get(symbol);
    if (currentIndicators) {
      callback(currentIndicators);
    }
  }

  unsubscribe(symbol: string, callback: (data: any) => void): void {
    if (this.subscribers.has(symbol)) {
      this.subscribers.get(symbol)!.delete(callback);
    }
  }

  notifySubscribers(symbol: string, type: string, data: any): void {
    const callbacks = this.subscribers.get(symbol);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback({ symbol, type, data, timestamp: Date.now() });
        } catch (error) {
          console.error(`[RealTimeEngine] Callback error for ${symbol}:`, error);
        }
      });
    }
  }

  getLatestIndicators(symbol: string): IndicatorData | null {
    return this.indicators.get(symbol) || null;
  }

  getStats(): any {
    const symbolStats: any = {};
    for (const [symbol] of (this.windowManager as any).windows) {
      symbolStats[symbol] = this.windowManager.getWindowStats(symbol);
    }
    return {
      isRunning: this.isRunning,
      subscribedSymbols: Array.from(this.subscribers.keys()),
      windowStats: symbolStats,
      lastCalculationTime: this.lastCalculationTime,
      calculationInterval: this.config.calculationInterval
    };
  }
}

let globalEngine: RealTimeCalculationEngine | null = null;

export const getRealTimeCalculationEngine = (): RealTimeCalculationEngine => {
  if (!globalEngine) {
    globalEngine = new RealTimeCalculationEngine();
  }
  return globalEngine;
};

export const startRealTimeCalculations = (): RealTimeCalculationEngine => {
  const engine = getRealTimeCalculationEngine();
  engine.start();
  return engine;
};

console.log('[RealTimeEngine] 🚀 Real-Time ACCURATE Calculation Engine loaded');
