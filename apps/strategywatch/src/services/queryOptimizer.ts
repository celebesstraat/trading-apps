import { getTickerData, getMultipleTickerData } from './dataLake.ts';
import { TickerData, Quote, IndicatorData, Bar, StrategyResult } from '../types/types';

const QUERY_CONFIG = {
  CACHE_TTL: {
    QUOTE: 5000,
    INDICATORS: 60000,
    CANDLES: 300000,
    STRATEGIES: 300000
  },
  BATCH_SIZE: 10,
  MAX_CONCURRENT: 3,
  PRECOMPUTE: {
    MOVING_AVERAGES: true,
    ADR: true,
    VRS: true,
    ORB: true
  }
};

class QueryCache {
  private cache: Map<string, any> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key)!);
        this.timers.delete(key);
      }
      return null;
    }

    entry.lastAccessed = Date.now();
    return entry.value;
  }

  set(key: string, value: any, ttl = 60000): void {
    const expiresAt = Date.now() + ttl;
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    });

    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttl);
    this.timers.set(key, timer);
  }

  delete(key: string): void {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  getStats(): any {
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
      memoryUsage: this.cache.size * 200
    };
  }
}

export class QueryOptimizer {
  public cache: QueryCache = new QueryCache();
  private queryQueue: any[] = [];
  private isProcessing = false;
  private stats = {
    queriesExecuted: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgQueryTime: 0
  };

  async getCurrentQuote(symbol: string): Promise<Quote | null> {
    const cacheKey = `quote:${symbol}`;
    const startTime = Date.now();

    let quote = this.cache.get(cacheKey);
    if (quote) {
      this.stats.cacheHits++;
      return quote;
    }

    this.stats.cacheMisses++;

    const tickerData = await getTickerData(symbol);
    quote = tickerData?.currentQuote || null;

    if (quote) {
      this.cache.set(cacheKey, quote, QUERY_CONFIG.CACHE_TTL.QUOTE);
    }

    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return quote;
  }

  async getCurrentQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const startTime = Date.now();
    const results: Record<string, Quote> = {};
    const uncachedSymbols: string[] = [];

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

    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);

    return results;
  }

  async getIndicators(symbol: string): Promise<IndicatorData | null> {
    const cacheKey = `indicators:${symbol}`;
    const startTime = Date.now();

    let indicators = this.cache.get(cacheKey);
    if (indicators) {
      this.stats.cacheHits++;
      return indicators;
    }

    this.stats.cacheMisses++;

    const tickerData = await getTickerData(symbol);
    indicators = tickerData?.indicators || null;

    if (indicators) {
      this.cache.set(cacheKey, indicators, QUERY_CONFIG.CACHE_TTL.INDICATORS);
    }

    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return indicators;
  }

  async getDailyCandles(symbol: string, days = 250): Promise<Bar[]> {
    const cacheKey = `daily_candles:${symbol}:${days}`;
    const startTime = Date.now();

    let candles = this.cache.get(cacheKey);
    if (candles) {
      this.stats.cacheHits++;
      return candles;
    }

    this.stats.cacheMisses++;

    const tickerData = await getTickerData(symbol);
    candles = tickerData?.dailyCandles || [];

    if (candles.length > days) {
      candles = candles.slice(-days);
    }

    this.cache.set(cacheKey, candles, QUERY_CONFIG.CACHE_TTL.CANDLES);

    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return candles;
  }

  async getFiveMinuteCandles(symbol: string, days = 10): Promise<Bar[]> {
    const cacheKey = `5m_candles:${symbol}:${days}`;
    const startTime = Date.now();

    let candles = this.cache.get(cacheKey);
    if (candles) {
      this.stats.cacheHits++;
      return candles;
    }

    this.stats.cacheMisses++;

    const tickerData = await getTickerData(symbol);
    const dailyCandleArrays = (tickerData as any)?.fiveMinuteCandles || [];

    candles = [];
    for (const dayData of dailyCandleArrays) {
      if (dayData.candles) {
        candles.push(...dayData.candles);
      }
    }

    candles.sort((a: Bar, b: Bar) => a.timestamp - b.timestamp);

    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    candles = candles.filter((candle: Bar) => candle.timestamp > cutoffTime);

    this.cache.set(cacheKey, candles, QUERY_CONFIG.CACHE_TTL.CANDLES);

    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return candles;
  }

  async getStrategyResults(symbol: string, strategy: string): Promise<StrategyResult | null> {
    const cacheKey = `strategy:${strategy}:${symbol}`;
    const startTime = Date.now();

    let results = this.cache.get(cacheKey);
    if (results) {
      this.stats.cacheHits++;
      return results;
    }

    this.stats.cacheMisses++;

    const tickerData = await getTickerData(symbol);
    results = tickerData?.strategies?.[strategy] || null;

    if (results) {
      this.cache.set(cacheKey, results, QUERY_CONFIG.CACHE_TTL.STRATEGIES);
    }

    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return results;
  }

  async getBatchStrategyResults(symbols: string[], strategy: string): Promise<Record<string, StrategyResult>> {
    const startTime = Date.now();
    const results: Record<string, StrategyResult> = {};
    const uncachedSymbols: string[] = [];

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

    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);

    return results;
  }

  async getComprehensiveTickerData(symbol: string): Promise<any | null> {
    const cacheKey = `comprehensive:${symbol}`;
    const startTime = Date.now();

    let data = this.cache.get(cacheKey);
    if (data) {
      this.stats.cacheHits++;
      return data;
    }

    this.stats.cacheMisses++;

    const tickerData = await getTickerData(symbol);

    if (!tickerData) {
      return null;
    }

    data = {
      symbol,
      quote: tickerData.currentQuote,
      indicators: tickerData.indicators,
      strategies: tickerData.strategies,
      lastUpdated: tickerData.lastUpdated,
      dataQuality: (tickerData as any).dataQuality,
      hasRecentData: this.hasRecentData(tickerData),
      marketStatus: this.getMarketStatusForSymbol(tickerData)
    };

    this.cache.set(cacheKey, data, 60000);

    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);
    this.stats.queriesExecuted++;

    return data;
  }

  async getMarketOverview(symbols: string[]): Promise<any> {
    const startTime = Date.now();
    const overview = {
      quotes: {} as Record<string, Quote>,
      indicators: {} as Record<string, IndicatorData>,
      strategies: {} as Record<string, Record<string, StrategyResult>>,
      summary: {
        totalSymbols: symbols.length,
        dataAvailable: 0,
        lastUpdated: Date.now()
      }
    };

    overview.quotes = await this.getCurrentQuotes(symbols);

    overview.summary.dataAvailable = Object.keys(overview.quotes).filter(
      symbol => overview.quotes[symbol] !== null
    ).length;

    const queryTime = Date.now() - startTime;
    this.updateQueryStats(queryTime);

    return overview;
  }

  invalidateSymbolCache(symbol: string): void {
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

  invalidateStrategyCache(): void {
    console.log('[QueryOptimizer] 🗑️ Clearing strategy cache...');
  }

  hasRecentData(tickerData: TickerData): boolean {
    if (!tickerData?.currentQuote) return false;
    const now = Date.now();
    const quoteAge = now - tickerData.currentQuote.timestamp;
    return quoteAge < 5 * 60 * 1000;
  }

  getMarketStatusForSymbol(tickerData: TickerData): string {
    if (!tickerData?.currentQuote) return 'no_data';
    const now = Date.now();
    const quoteAge = now - tickerData.currentQuote.timestamp;
    if (quoteAge < 30 * 1000) return 'real_time';
    if (quoteAge < 5 * 60 * 1000) return 'recent';
    if (quoteAge < 60 * 60 * 1000) return 'stale';
    return 'very_stale';
  }

  updateQueryStats(queryTime: number): void {
    const totalQueries = this.stats.queriesExecuted;
    if (totalQueries === 0) {
      this.stats.avgQueryTime = queryTime;
    } else {
      this.stats.avgQueryTime = ((this.stats.avgQueryTime * totalQueries) + queryTime) / (totalQueries + 1);
    }
  }

  getStats(): any {
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

  reset(): void {
    this.cache.clear();
    this.stats = {
      queriesExecuted: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgQueryTime: 0
    };
  }
}

let globalOptimizer: QueryOptimizer | null = null;

export const getQueryOptimizer = (): QueryOptimizer => {
  if (!globalOptimizer) {
    globalOptimizer = new QueryOptimizer();
  }
  return globalOptimizer;
};

export const executeOptimizedQuery = async (queryType: string, ...params: any[]): Promise<any> => {
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
