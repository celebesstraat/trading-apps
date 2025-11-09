/**
 * Mock Data Generator for StrategyWatch
 * Generates realistic fake data for visual testing
 */

/**
 * Generates mock price data with varying high/low ranges
 * @param {string} ticker Stock symbol
 * @returns {object} Mock price data
 */
function generateMockPrice(ticker, index) {
  const basePrice = 50 + (index * 10); // Vary base price
  const now = Date.now();

  // Generate varied daily ranges (some tight, some wide, some very wide to exceed 100% ADR)
  // Include factors that will exceed 100% of ADR for visual testing
  const rangeFactor = [0.3, 0.6, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0][index % 8];
  const dailyRange = basePrice * 0.02 * rangeFactor; // 2% base range * factor

  const high = basePrice + (dailyRange * Math.random());
  const low = basePrice - (dailyRange * Math.random());
  const price = low + (high - low) * Math.random();

  return {
    price: Number(price.toFixed(2)),
    timestamp: now,
    open: Number((low + (high - low) * 0.3).toFixed(2)),
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
    previousClose: Number((basePrice * 0.98).toFixed(2)),
    volume: Math.floor(1000000 + Math.random() * 5000000)
  };
}

/**
 * Generates mock moving averages
 * @param {number} price Current price
 * @returns {object} Mock moving averages
 */
function generateMockMovingAverages(price, index) {
  // Create varied distances from MAs
  const ema10 = price * (0.95 + Math.random() * 0.1); // -5% to +5%
  const ema21 = price * (0.93 + Math.random() * 0.14); // -7% to +7%
  const sma50 = price * (0.90 + Math.random() * 0.15); // -10% to +5%
  const sma65 = price * (0.88 + Math.random() * 0.18); // -12% to +6%
  const sma100 = price * (0.85 + Math.random() * 0.20); // -15% to +5%

  // ADR% varies from 1.5% (low volatility) to 8.5% (high volatility)
  // Some low values to ensure we get >100% Today's Move for visual testing
  const adr20 = 1.5 + (index % 8);

  return {
    ema10: Number(ema10.toFixed(2)),
    ema21: Number(ema21.toFixed(2)),
    sma50: Number(sma50.toFixed(2)),
    sma65: Number(sma65.toFixed(2)),
    sma100: Number(sma100.toFixed(2)),
    adr20: Number(adr20.toFixed(2))
  };
}

/**
 * Generates mock 5M ORB data for testing Pine Script traffic light scenarios
 * @param {number} index Ticker index for variation
 * @param {number} price Current price
 * @returns {object} Mock 5M ORB data
 */
function generateMock5mORB(index, price) {
  // Create different scenarios matching Pine Script criteria exactly
  const scenarios = [
    // Scenario 0: No ORB data (null) - before 9:35 AM
    () => ({
      candle: null,
      avgVolume: null,
      tier: null
    }),

    // Scenario 1: Tier 2 (Dark Green) - Perfect Pine Script criteria
    // Open ≤ 20%, Close ≥ 80%, Body ≥ 55%, Green candle, RVOL ≥ 1.50x
    () => {
      const range = price * 0.004; // 0.4% range for realistic movement
      const orbLow = price - (range * 0.8);
      const orbOpen = orbLow + (range * 0.15); // Open at 15% of range (≤ 20% ✓)
      const orbClose = orbLow + (range * 0.85); // Close at 85% of range (≥ 80% ✓)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(1500000), // 1.5x average volume for Tier 2
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 2
      };
    },

    // Scenario 2: Tier 1 (Light Green) - Meets Tier 1 but not Tier 2
    // Same price criteria but RVOL between 0.25x and 1.50x
    () => {
      const range = price * 0.003;
      const orbLow = price - (range * 0.7);
      const orbOpen = orbLow + (range * 0.10); // Open at 10% of range (≤ 20% ✓)
      const orbClose = orbLow + (range * 0.90); // Close at 90% of range (≥ 80% ✓)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(500000), // 0.5x average volume (Tier 1 range: 0.25x - 1.50x)
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 1
      };
    },

    // Scenario 3: Failed - Open position too high (> 20%)
    () => {
      const range = price * 0.005;
      const orbLow = price - (range * 0.6);
      const orbOpen = orbLow + (range * 0.30); // Open at 30% of range (> 20% ✗)
      const orbClose = orbLow + (range * 0.85); // Close at 85% (≥ 80% ✓)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(1200000), // Good volume
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 0
      };
    },

    // Scenario 4: Tier 2 (Dark Green) - Different price level, also broken out
    () => {
      const range = price * 0.006;
      const orbLow = price * 0.992; // ORB low below current price
      const orbOpen = orbLow + (range * 0.18); // Open at 18% (≤ 20% ✓)
      const orbClose = orbLow + (range * 0.88); // Close at 88% (≥ 80% ✓)
      const orbHigh = orbLow + range; // ORB high below current price (breakout!)

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(2000000), // 2.0x average volume for Tier 2
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 2
      };
    },

    // Scenario 5: Failed - Close position too low (< 80%)
    () => {
      const range = price * 0.004;
      const orbLow = price - (range * 0.5);
      const orbOpen = orbLow + (range * 0.15); // Open at 15% (≤ 20% ✓)
      const orbClose = orbLow + (range * 0.75); // Close at 75% (< 80% ✗)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(1800000), // Good volume
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 0
      };
    },

    // Scenario 6: Failed - Red candle
    () => {
      const range = price * 0.005;
      const orbLow = price - (range * 0.4);
      const orbOpen = orbLow + (range * 0.80); // Open at 80% (close to high)
      const orbClose = orbLow + (range * 0.10); // Close at 10% (red candle ✗)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(2500000), // Excellent volume but red candle
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 0
      };
    },

    // Scenario 7: Tier 1 (Light Green) - Minimal Tier 1 qualification
    // RVOL just above 0.25x threshold
    () => {
      const range = price * 0.0035;
      const orbLow = price * 0.995;
      const orbOpen = orbLow + (range * 0.20); // Open at exactly 20% (≤ 20% ✓)
      const orbClose = orbLow + (range * 0.80); // Close at exactly 80% (≥ 80% ✓)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(260000), // 0.26x average volume (just above 0.25x threshold)
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 1
      };
    },

    // Scenario 8: Tier 2 (Dark Red) - Perfect bearish Pine Script criteria
    // Open ≥ 80%, Close ≤ 20%, Body ≥ 55%, Red candle, RVOL ≥ 1.50x
    () => {
      const range = price * 0.004; // 0.4% range for realistic movement
      const orbLow = price - (range * 0.8);
      const orbOpen = orbLow + (range * 0.85); // Open at 85% of range (≥ 80% ✓)
      const orbClose = orbLow + (range * 0.15); // Close at 15% of range (≤ 20% ✓)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(1500000), // 1.5x average volume for Tier 2
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 2
      };
    },

    // Scenario 9: Tier 1 (Light Red) - Bearish with RVOL between 0.25x and 1.50x
    () => {
      const range = price * 0.003;
      const orbLow = price - (range * 0.7);
      const orbOpen = orbLow + (range * 0.90); // Open at 90% of range (≥ 80% ✓)
      const orbClose = orbLow + (range * 0.10); // Close at 10% of range (≤ 20% ✓)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(500000), // 0.5x average volume (Tier 1 range: 0.25x - 1.50x)
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 1
      };
    },

    // Scenario 10: Tier 2 (Dark Red) - Bearish breakout scenario
    // Price below ORB low (bearish breakout)
    () => {
      const range = price * 0.006;
      const orbLow = price * 1.008; // ORB low above current price (breakout!)
      const orbOpen = orbLow + (range * 0.88); // Open at 88% (≥ 80% ✓)
      const orbClose = orbLow + (range * 0.12); // Close at 12% (≤ 20% ✓)
      const orbHigh = orbLow + range; // ORB high also above current price

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(2000000), // 2.0x average volume for Tier 2
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 2
      };
    },

    // Scenario 11: Failed - Bearish but open position too low (< 80%)
    () => {
      const range = price * 0.005;
      const orbLow = price - (range * 0.6);
      const orbOpen = orbLow + (range * 0.70); // Open at 70% of range (< 80% ✗)
      const orbClose = orbLow + (range * 0.15); // Close at 15% (≤ 20% ✓)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(1200000), // Good volume
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 0
      };
    },

    // Scenario 12: Failed - Bearish but close position too high (> 20%)
    () => {
      const range = price * 0.004;
      const orbLow = price - (range * 0.5);
      const orbOpen = orbLow + (range * 0.85); // Open at 85% (≥ 80% ✓)
      const orbClose = orbLow + (range * 0.30); // Close at 30% (> 20% ✗)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(1800000), // Good volume
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 0
      };
    },

    // Scenario 13: Failed - Green candle when bearish needed
    () => {
      const range = price * 0.005;
      const orbLow = price - (range * 0.4);
      const orbOpen = orbLow + (range * 0.10); // Open at 10% (close to low)
      const orbClose = orbLow + (range * 0.85); // Close at 85% (green candle ✗)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(2500000), // Excellent volume but green candle
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 0
      };
    },

    // Scenario 14: Tier 1 (Light Red) - Minimal bearish Tier 1 qualification
    // RVOL just above 0.25x threshold
    () => {
      const range = price * 0.0035;
      const orbLow = price * 1.005;
      const orbOpen = orbLow + (range * 0.80); // Open at exactly 80% (≥ 80% ✓)
      const orbClose = orbLow + (range * 0.20); // Close at exactly 20% (≤ 20% ✓)
      const orbHigh = orbLow + range;

      return {
        candle: {
          open: Number(orbOpen.toFixed(2)),
          high: Number(orbHigh.toFixed(2)),
          low: Number(orbLow.toFixed(2)),
          close: Number(orbClose.toFixed(2)),
          volume: Math.floor(260000), // 0.26x average volume (just above 0.25x threshold)
          timestamp: Date.now() - (60 * 60 * 1000)
        },
        avgVolume: Math.floor(1000000),
        tier: 1
      };
    }
  ];

  const scenario = scenarios[index % scenarios.length];
  const result = scenario();

  // Add historical candles for all scenarios except null
  if (result.candle) {
    result.historicalCandles = Array.from({ length: 20 }, (_, i) => ({
      open: Number((price * 0.98).toFixed(2)),
      high: Number((price * 1.01).toFixed(2)),
      low: Number((price * 0.97).toFixed(2)),
      close: Number((price * 1.00).toFixed(2)),
      volume: Math.floor(300000 + Math.random() * 1000000),
      timestamp: Date.now() - ((i + 2) * 24 * 60 * 60 * 1000)
    }));
  } else {
    result.historicalCandles = [];
  }

  return result;
}

/**
 * Generates complete mock data for all tickers
 * @param {string[]} tickers Array of ticker symbols
 * @returns {object} Complete mock data structure
 */
export function generateMockData(tickers) {
  const pricesMap = {};
  const movingAveragesMap = {};
  const orb5mDataMap = {};

  tickers.forEach((ticker, index) => {
    const priceData = generateMockPrice(ticker, index);
    pricesMap[ticker] = priceData;
    movingAveragesMap[ticker] = generateMockMovingAverages(priceData.price, index);
    orb5mDataMap[ticker] = generateMock5mORB(index, priceData.price);
  });

  return {
    prices: pricesMap,
    movingAverages: movingAveragesMap,
    orb5mData: orb5mDataMap,
    connected: true,
    marketOpen: true,
    loading: false,
    error: null
  };
}

/**
 * Creates dynamic mock data that changes over time for realistic testing
 * @param {string[]} watchlist Array of ticker symbols
 * @returns {object} Dynamic mock data with update functions
 */
export function createDynamicMockData(watchlist) {
  // Generate initial data
  const initialData = generateMockData(watchlist);

  // Track base values for each ticker
  const baseValues = {};
  watchlist.forEach((ticker, index) => {
    baseValues[ticker] = {
      basePrice: 50 + (index * 10),
      trend: Math.random() > 0.5 ? 1 : -1, // Random trend direction
      volatility: 0.001 + Math.random() * 0.003, // 0.1% - 0.4% volatility
      lastUpdate: Date.now()
    };
  });

  /**
   * Updates mock data with realistic price movements
   * @param {object} currentData Current mock data
   * @returns {object} Updated mock data
   */
  function updateMockData(currentData) {
    const now = Date.now();
    const updatedData = {
      ...currentData,
      prices: { ...currentData.prices }
    };

    // Update prices for each ticker
    Object.keys(baseValues).forEach(ticker => {
      const base = baseValues[ticker];
      const currentPrice = currentData.prices[ticker].price;

      // Random walk with trend
      const randomMovement = (Math.random() - 0.5) * 2; // -1 to 1
      const trendInfluence = base.trend * 0.3; // 30% trend influence
      const priceChange = (randomMovement + trendInfluence) * base.volatility * currentPrice;

      const newPrice = Math.max(1, currentPrice + priceChange); // Prevent negative prices

      // Update price data
      updatedData.prices[ticker] = {
        ...currentData.prices[ticker],
        price: Number(newPrice.toFixed(2)),
        timestamp: now,
        high: Math.max(currentData.prices[ticker].high, newPrice),
        low: Math.min(currentData.prices[ticker].low, newPrice),
        volume: currentData.prices[ticker].volume + Math.floor(Math.random() * 10000),
        receivedAt: now,
        delay: Math.floor(Math.random() * 100)
      };

      // Occasionally change trend (10% chance)
      if (Math.random() < 0.1) {
        base.trend *= -1;
      }

      base.lastUpdate = now;
    });

    return updatedData;
  }

  /**
   * Updates ORB data to simulate real-time ORB status changes
   * @param {object} currentOrbData Current ORB data
   * @returns {object} Updated ORB data
   */
  function updateOrbData(currentOrbData) {
    const updatedOrbData = { ...currentOrbData };

    // Randomly change ORB status for some tickers (5% chance each update)
    Object.keys(updatedOrbData).forEach(ticker => {
      if (Math.random() < 0.05) { // 5% chance of change
        const index = watchlist.indexOf(ticker);
        const currentPrice = initialData.prices[ticker].price;

        // Generate new ORB data with different scenario
        updatedOrbData[ticker] = generateMock5mORB(index, currentPrice);
      }
    });

    return updatedOrbData;
  }

  return {
    initialData,
    updateMockData,
    updateOrbData
  };
}
