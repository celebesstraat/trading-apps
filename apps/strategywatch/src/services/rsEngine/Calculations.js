/**
 * Relative Strength Engine v2.0 - Calculations
 *
 * Pure functions for each timeframe.
 * Eliminates the "one function fits all" problem with timeframe-specific calculations.
 * No mutations, no side effects - just pure mathematical operations.
 */

import { RS_RANGE, PERCENT_CHANGE_PRECISION } from './types.js';

export class RSCalculations {
  constructor() {
    // Cache for expensive calculations
    this.calculationCache = new Map();
    this.maxCacheSize = 1000;
  }

  /**
   * Main entry point for RS calculations
   * Routes to appropriate timeframe-specific calculation
   */
  calculateRelativeStrength(stockData, benchmarkData, timeframe) {
    try {
      // Input validation
      if (!stockData || !benchmarkData) {
        throw new Error('Missing stock or benchmark data');
      }

      if (!this.isValidTimeframe(timeframe)) {
        throw new Error(`Invalid timeframe: ${timeframe}`);
      }

      // Route to timeframe-specific calculation
      switch (timeframe) {
        case '1m':
          return this.calculateRS1Minute(stockData, benchmarkData);
        case '5m':
          return this.calculateRS5Minute(stockData, benchmarkData);
        case '15m':
          return this.calculateRS15Minute(stockData, benchmarkData);
        default:
          throw new Error(`Unsupported timeframe: ${timeframe}`);
      }

    } catch (error) {
      console.error(`[RSCalculations] Error calculating RS for ${timeframe}:`, error);
      return this.createErrorResult(error.message, timeframe);
    }
  }

  /**
   * Calculate Relative Strength for 1-minute timeframe
   * Optimized for high-frequency trading patterns
   */
  calculateRS1Minute(stockData, benchmarkData) {
    const cacheKey = `1m_${this.getCacheKey(stockData, benchmarkData)}`;

    if (this.calculationCache.has(cacheKey)) {
      return this.calculationCache.get(cacheKey);
    }

    try {
      const results = {};

      for (const [symbol, stock] of Object.entries(stockData)) {
        const benchmark = benchmarkData[symbol] || benchmarkData['QQQ']; // Fallback to QQQ

        // Validate data
        if (!this.isValidStockData(stock) || !this.isValidStockData(benchmark)) {
          results[symbol] = this.createInvalidResult(symbol, '1m');
          continue;
        }

        // 1-minute specific calculations
        const calculation = {
          timeframe: '1m',
          symbol,
          timestamp: Date.now(),

          // Price-based RS
          priceRS: this.calculatePriceRelativeStrength(
            stock.currentPrice,
            benchmark.currentPrice,
            stock.previousClose,
            benchmark.previousClose
          ),

          // Momentum RS (short-term)
          momentumRS: this.calculateMomentumRS1m(stock, benchmark),

          // Volume-based RS (intraday)
          volumeRS: this.calculateVolumeRS(stock, benchmark, '1m'),

          // Overall RS score (weighted combination)
          overallRS: null // Will be calculated below
        };

        // Calculate weighted overall RS
        calculation.overallRS = this.calculateOverallRS(calculation, '1m');

        results[symbol] = calculation;
      }

      // Cache results
      this.cacheResult(cacheKey, results);

      return results;

    } catch (error) {
      console.error('[RSCalculations] 1m calculation error:', error);
      return this.createErrorResult(error.message, '1m');
    }
  }

  /**
   * Calculate Relative Strength for 5-minute timeframe
   * Balances short-term momentum with medium-term trends
   */
  calculateRS5Minute(stockData, benchmarkData) {
    const cacheKey = `5m_${this.getCacheKey(stockData, benchmarkData)}`;

    if (this.calculationCache.has(cacheKey)) {
      return this.calculationCache.get(cacheKey);
    }

    try {
      const results = {};

      for (const [symbol, stock] of Object.entries(stockData)) {
        const benchmark = benchmarkData[symbol] || benchmarkData['QQQ'];

        if (!this.isValidStockData(stock) || !this.isValidStockData(benchmark)) {
          results[symbol] = this.createInvalidResult(symbol, '5m');
          continue;
        }

        const calculation = {
          timeframe: '5m',
          symbol,
          timestamp: Date.now(),

          // Price-based RS with trend confirmation
          priceRS: this.calculatePriceRelativeStrength(
            stock.currentPrice,
            benchmark.currentPrice,
            stock.previousClose,
            benchmark.previousClose
          ),

          // Momentum RS (medium-term)
          momentumRS: this.calculateMomentumRS5m(stock, benchmark),

          // Volume-based RS (intraday with ORB influence)
          volumeRS: this.calculateVolumeRS(stock, benchmark, '5m'),

          // ORB-adjusted RS (Opening Range Breakout influence)
          orbAdjustedRS: this.calculateORBAdjustedRS(stock, benchmark),

          // Overall RS score
          overallRS: null
        };

        calculation.overallRS = this.calculateOverallRS(calculation, '5m');

        results[symbol] = calculation;
      }

      this.cacheResult(cacheKey, results);
      return results;

    } catch (error) {
      console.error('[RSCalculations] 5m calculation error:', error);
      return this.createErrorResult(error.message, '5m');
    }
  }

  /**
   * Calculate Relative Strength for 15-minute timeframe
   * Focuses on established trends and sustainability
   */
  calculateRS15Minute(stockData, benchmarkData) {
    const cacheKey = `15m_${this.getCacheKey(stockData, benchmarkData)}`;

    if (this.calculationCache.has(cacheKey)) {
      return this.calculationCache.get(cacheKey);
    }

    try {
      const results = {};

      for (const [symbol, stock] of Object.entries(stockData)) {
        const benchmark = benchmarkData[symbol] || benchmarkData['QQQ'];

        if (!this.isValidStockData(stock) || !this.isValidStockData(benchmark)) {
          results[symbol] = this.createInvalidResult(symbol, '15m');
          continue;
        }

        const calculation = {
          timeframe: '15m',
          symbol,
          timestamp: Date.now(),

          // Price-based RS with trend sustainability check
          priceRS: this.calculatePriceRelativeStrength(
            stock.currentPrice,
            benchmark.currentPrice,
            stock.previousClose,
            benchmark.previousClose
          ),

          // Momentum RS (medium-term trend strength)
          momentumRS: this.calculateMomentumRS15m(stock, benchmark),

          // Volume-based RS (volume sustainability)
          volumeRS: this.calculateVolumeRS(stock, benchmark, '15m'),

          // Trend sustainability RS
          trendRS: this.calculateTrendSustainabilityRS(stock, benchmark),

          // Overall RS score
          overallRS: null
        };

        calculation.overallRS = this.calculateOverallRS(calculation, '15m');

        results[symbol] = calculation;
      }

      this.cacheResult(cacheKey, results);
      return results;

    } catch (error) {
      console.error('[RSCalculations] 15m calculation error:', error);
      return this.createErrorResult(error.message, '15m');
    }
  }

  /**
   * Calculate price-based relative strength
   * Compares performance relative to benchmark
   */
  calculatePriceRelativeStrength(stockPrice, benchmarkPrice, stockPrevClose, benchmarkPrevClose) {
    try {
      // Calculate percent changes
      const stockChange = ((stockPrice - stockPrevClose) / stockPrevClose) * 100;
      const benchmarkChange = ((benchmarkPrice - benchmarkPrevClose) / benchmarkPrevClose) * 100;

      // Calculate relative performance
      const relativePerformance = stockChange - benchmarkChange;

      // Normalize to 0-100 range
      const normalizedRS = this.normalizeToRange(
        relativePerformance,
        RS_RANGE.MIN,
        RS_RANGE.MAX
      );

      return {
        value: Math.round(normalizedRS * 100) / 100,
        stockChange: Math.round(stockChange * 100) / 100,
        benchmarkChange: Math.round(benchmarkChange * 100) / 100,
        relativePerformance: Math.round(relativePerformance * 100) / 100,
        isValid: true
      };

    } catch (error) {
      console.error('[RSCalculations] Price RS calculation error:', error);
      return { value: 50, isValid: false, error: error.message };
    }
  }

  /**
   * Calculate momentum-based RS for 1-minute timeframe
   * High-frequency momentum detection
   */
  calculateMomentumRS1m(stock, benchmark) {
    try {
      // Use recent price action for short-term momentum
      const stockMomentum = this.calculateShortTermMomentum(stock.priceHistory || []);
      const benchmarkMomentum = this.calculateShortTermMomentum(benchmark.priceHistory || []);

      const relativeMomentum = stockMomentum - benchmarkMomentum;

      const normalizedRS = this.normalizeToRange(
        relativeMomentum,
        RS_RANGE.MIN,
        RS_RANGE.MAX
      );

      return {
        value: Math.round(normalizedRS * 100) / 100,
        stockMomentum: Math.round(stockMomentum * 100) / 100,
        benchmarkMomentum: Math.round(benchmarkMomentum * 100) / 100,
        isValid: true
      };

    } catch (error) {
      console.error('[RSCalculations] 1m momentum calculation error:', error);
      return { value: 50, isValid: false, error: error.message };
    }
  }

  /**
   * Calculate momentum-based RS for 5-minute timeframe
   * Medium-term momentum with trend confirmation
   */
  calculateMomentumRS5m(stock, benchmark) {
    try {
      // Combine short-term momentum with medium-term trend
      const stockMomentum = this.calculateMediumTermMomentum(
        stock.priceHistory || [],
        stock.technicalIndicators || {}
      );
      const benchmarkMomentum = this.calculateMediumTermMomentum(
        benchmark.priceHistory || [],
        benchmark.technicalIndicators || {}
      );

      const relativeMomentum = stockMomentum - benchmarkMomentum;

      const normalizedRS = this.normalizeToRange(
        relativeMomentum,
        RS_RANGE.MIN,
        RS_RANGE.MAX
      );

      return {
        value: Math.round(normalizedRS * 100) / 100,
        stockMomentum: Math.round(stockMomentum * 100) / 100,
        benchmarkMomentum: Math.round(benchmarkMomentum * 100) / 100,
        isValid: true
      };

    } catch (error) {
      console.error('[RSCalculations] 5m momentum calculation error:', error);
      return { value: 50, isValid: false, error: error.message };
    }
  }

  /**
   * Calculate momentum-based RS for 15-minute timeframe
   * Medium-term trend strength assessment
   */
  calculateMomentumRS15m(stock, benchmark) {
    try {
      // Focus on established trend strength
      const stockMomentum = this.calculateTrendStrength(
        stock.priceHistory || [],
        stock.technicalIndicators || {}
      );
      const benchmarkMomentum = this.calculateTrendStrength(
        benchmark.priceHistory || [],
        benchmark.technicalIndicators || {}
      );

      const relativeMomentum = stockMomentum - benchmarkMomentum;

      const normalizedRS = this.normalizeToRange(
        relativeMomentum,
        RS_RANGE.MIN,
        RS_RANGE.MAX
      );

      return {
        value: Math.round(normalizedRS * 100) / 100,
        stockMomentum: Math.round(stockMomentum * 100) / 100,
        benchmarkMomentum: Math.round(benchmarkMomentum * 100) / 100,
        isValid: true
      };

    } catch (error) {
      console.error('[RSCalculations] 15m momentum calculation error:', error);
      return { value: 50, isValid: false, error: error.message };
    }
  }

  /**
   * Calculate volume-based relative strength
   * Compares volume patterns against benchmark
   */
  calculateVolumeRS(stock, benchmark, timeframe) {
    try {
      const stockVolume = stock.currentVolume || 0;
      const benchmarkVolume = benchmark.currentVolume || 0;
      const stockAvgVolume = stock.averageVolume || 1;
      const benchmarkAvgVolume = benchmark.averageVolume || 1;

      // Calculate volume ratios
      const stockVolumeRatio = stockVolume / stockAvgVolume;
      const benchmarkVolumeRatio = benchmarkVolume / benchmarkAvgVolume;

      // Relative volume strength
      const relativeVolumeStrength = stockVolumeRatio - benchmarkVolumeRatio;

      const normalizedRS = this.normalizeToRange(
        relativeVolumeStrength,
        RS_RANGE.MIN,
        RS_RANGE.MAX
      );

      return {
        value: Math.round(normalizedRS * 100) / 100,
        stockVolumeRatio: Math.round(stockVolumeRatio * 100) / 100,
        benchmarkVolumeRatio: Math.round(benchmarkVolumeRatio * 100) / 100,
        isValid: true
      };

    } catch (error) {
      console.error('[RSCalculations] Volume RS calculation error:', error);
      return { value: 50, isValid: false, error: error.message };
    }
  }

  /**
   * Calculate ORB-adjusted relative strength for 5-minute timeframe
   * Incorporates Opening Range Breakout performance
   */
  calculateORBAdjustedRS(stock, benchmark) {
    try {
      const stockORB = stock.orbPerformance || 0;
      const benchmarkORB = benchmark.orbPerformance || 0;

      const relativeORB = stockORB - benchmarkORB;

      const normalizedRS = this.normalizeToRange(
        relativeORB,
        RS_RANGE.MIN,
        RS_RANGE.MAX
      );

      return {
        value: Math.round(normalizedRS * 100) / 100,
        stockORB: Math.round(stockORB * 100) / 100,
        benchmarkORB: Math.round(benchmarkORB * 100) / 100,
        isValid: true
      };

    } catch (error) {
      console.error('[RSCalculations] ORB RS calculation error:', error);
      return { value: 50, isValid: false, error: error.message };
    }
  }

  /**
   * Calculate trend sustainability relative strength
   * Assesses trend persistence and sustainability
   */
  calculateTrendSustainabilityRS(stock, benchmark) {
    try {
      const stockTrend = this.calculateTrendSustainability(stock);
      const benchmarkTrend = this.calculateTrendSustainability(benchmark);

      const relativeTrend = stockTrend - benchmarkTrend;

      const normalizedRS = this.normalizeToRange(
        relativeTrend,
        RS_RANGE.MIN,
        RS_RANGE.MAX
      );

      return {
        value: Math.round(normalizedRS * 100) / 100,
        stockTrend: Math.round(stockTrend * 100) / 100,
        benchmarkTrend: Math.round(benchmarkTrend * 100) / 100,
        isValid: true
      };

    } catch (error) {
      console.error('[RSCalculations] Trend sustainability calculation error:', error);
      return { value: 50, isValid: false, error: error.message };
    }
  }

  /**
   * Calculate overall RS score using timeframe-specific weights
   */
  calculateOverallRS(calculation, timeframe) {
    try {
      const weights = this.getTimeframeWeights(timeframe);

      let weightedSum = 0;
      let totalWeight = 0;

      for (const [component, weight] of Object.entries(weights)) {
        if (calculation[component] && calculation[component].isValid) {
          weightedSum += calculation[component].value * weight;
          totalWeight += weight;
        }
      }

      // Normalize by total weight
      const overallRS = totalWeight > 0 ? weightedSum / totalWeight : 50;

      return {
        value: Math.round(overallRS * 100) / 100,
        weights,
        isValid: true
      };

    } catch (error) {
      console.error('[RSCalculations] Overall RS calculation error:', error);
      return { value: 50, isValid: false, error: error.message };
    }
  }

  /**
   * Helper method to normalize values to 0-100 range
   */
  normalizeToRange(value, min, max) {
    // Clamp value to range
    const clampedValue = Math.max(min, Math.min(max, value));

    // Normalize to 0-100
    return ((clampedValue - min) / (max - min)) * 100;
  }

  /**
   * Calculate short-term momentum from price history
   */
  calculateShortTermMomentum(priceHistory) {
    if (!priceHistory || priceHistory.length < 2) return 0;

    // Simple momentum: recent price change
    const recent = priceHistory.slice(-3); // Last 3 data points
    if (recent.length < 2) return 0;

    const startPrice = recent[0];
    const endPrice = recent[recent.length - 1];

    return ((endPrice - startPrice) / startPrice) * 100;
  }

  /**
   * Calculate medium-term momentum
   */
  calculateMediumTermMomentum(priceHistory, technicalIndicators) {
    if (!priceHistory || priceHistory.length < 5) return 0;

    // Use moving averages if available
    if (technicalIndicators.sma && technicalIndicators.ema) {
      return ((technicalIndicators.ema - technicalIndicators.sma) / technicalIndicators.sma) * 100;
    }

    // Fallback to price momentum
    const startPrice = priceHistory[0];
    const endPrice = priceHistory[priceHistory.length - 1];

    return ((endPrice - startPrice) / startPrice) * 100;
  }

  /**
   * Calculate trend strength
   */
  calculateTrendStrength(priceHistory, technicalIndicators) {
    if (!priceHistory || priceHistory.length < 10) return 0;

    // Use technical indicators if available
    if (technicalIndicators.rsi && technicalIndicators.macd) {
      // Combine RSI and MACD signals
      const rsiScore = (technicalIndicators.rsi - 50) / 50; // Normalize to -1 to 1
      const macdScore = Math.sign(technicalIndicators.macd);
      return (rsiScore + macdScore) * 50;
    }

    // Fallback to linear regression slope
    return this.calculateLinearRegressionSlope(priceHistory);
  }

  /**
   * Calculate trend sustainability
   */
  calculateTrendSustainability(stock) {
    // Combine multiple factors for trend sustainability
    const factors = {
      volumeConfirmation: this.calculateVolumeConfirmation(stock),
      priceConsistency: this.calculatePriceConsistency(stock),
      technicalAlignment: this.calculateTechnicalAlignment(stock)
    };

    // Weighted average of factors
    const weights = { volumeConfirmation: 0.3, priceConsistency: 0.4, technicalAlignment: 0.3 };

    let score = 0;
    for (const [factor, weight] of Object.entries(weights)) {
      score += (factors[factor] || 0) * weight;
    }

    return score;
  }

  /**
   * Helper methods for trend sustainability
   */
  calculateVolumeConfirmation(stock) {
    if (!stock.currentVolume || !stock.averageVolume) return 0.5;
    return Math.min(stock.currentVolume / stock.averageVolume / 2, 1);
  }

  calculatePriceConsistency(stock) {
    // Simple consistency check based on price volatility
    if (!stock.priceHistory || stock.priceHistory.length < 5) return 0.5;

    const prices = stock.priceHistory;
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const cv = Math.sqrt(variance) / mean; // Coefficient of variation

    return Math.max(0, 1 - cv); // Lower volatility = higher consistency
  }

  calculateTechnicalAlignment(stock) {
    if (!stock.technicalIndicators) return 0.5;

    const { rsi, macd, sma } = stock.technicalIndicators;
    let score = 0.5;

    if (rsi > 50) score += 0.2;
    if (macd > 0) score += 0.2;
    if (stock.currentPrice > sma) score += 0.1;

    return Math.min(score, 1);
  }

  /**
   * Calculate linear regression slope from price data
   */
  calculateLinearRegressionSlope(priceHistory) {
    if (!priceHistory || priceHistory.length < 2) return 0;

    const n = priceHistory.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = priceHistory;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgY = sumY / n;

    return (slope / avgY) * 100; // Return as percentage
  }

  /**
   * Get timeframe-specific weights for overall calculation
   */
  getTimeframeWeights(timeframe) {
    switch (timeframe) {
      case '1m':
        return {
          priceRS: 0.5,
          momentumRS: 0.4,
          volumeRS: 0.1
        };
      case '5m':
        return {
          priceRS: 0.3,
          momentumRS: 0.3,
          volumeRS: 0.2,
          orbAdjustedRS: 0.2
        };
      case '15m':
        return {
          priceRS: 0.3,
          momentumRS: 0.3,
          volumeRS: 0.2,
          trendRS: 0.2
        };
      default:
        return {
          priceRS: 1.0
        };
    }
  }

  /**
   * Generate cache key for calculation results
   */
  getCacheKey(stockData, benchmarkData) {
    try {
      const stockHash = this.hashObject(stockData);
      const benchmarkHash = this.hashObject(benchmarkData);
      return `${stockHash}_${benchmarkHash}`;
    } catch (error) {
      return 'fallback_key';
    }
  }

  /**
   * Simple hash function for objects
   */
  hashObject(obj) {
    return JSON.stringify(obj).split('').reduce((hash, char) => {
      return ((hash << 5) - hash) + char.charCodeAt(0);
    }, 0).toString(36);
  }

  /**
   * Cache calculation results
   */
  cacheResult(key, result) {
    if (this.calculationCache.size >= this.maxCacheSize) {
      const firstKey = this.calculationCache.keys().next().value;
      this.calculationCache.delete(firstKey);
    }
    this.calculationCache.set(key, result);
  }

  /**
   * Create error result object
   */
  createErrorResult(message, timeframe) {
    return {
      error: message,
      timeframe,
      timestamp: Date.now(),
      isValid: false
    };
  }

  /**
   * Create invalid result for missing/invalid data
   */
  createInvalidResult(symbol, timeframe) {
    return {
      symbol,
      timeframe,
      timestamp: Date.now(),
      isValid: false,
      error: 'Invalid data',
      value: 50 // Default neutral value
    };
  }

  /**
   * Validate timeframe
   */
  isValidTimeframe(timeframe) {
    return ['1m', '5m', '15m'].includes(timeframe);
  }

  /**
   * Validate stock data structure
   */
  isValidStockData(data) {
    return data &&
           typeof data.currentPrice === 'number' &&
           typeof data.previousClose === 'number' &&
           !isNaN(data.currentPrice) &&
           !isNaN(data.previousClose) &&
           data.currentPrice > 0 &&
           data.previousClose > 0;
  }

  /**
   * Clear calculation cache
   */
  clearCache() {
    this.calculationCache.clear();
  }
}