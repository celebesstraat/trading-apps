import { createContext, useContext, useState, useEffect } from 'react';
import { WATCHLIST } from '../config/watchlist';
import { UPDATE_INTERVALS, DATA_MODE, MOCK_DATA_MODE } from '../config/constants';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import { useMarketHours } from '../hooks/useMarketHours';
import { fetchDailyCandlesBatch, fetchQuoteBatch, fetchFirst5mCandle, fetchHistoricalFirst5mCandles, isAPIConfigured } from '../services/marketData';
import { getMovingAverages, calculateADRPercent, evaluate5mORB } from '../services/calculations';
import { isORBActive } from '../utils/marketTime';
import { generateMockData } from '../services/mockData';

const DataContext = createContext(null);

/**
 * DataProvider Component
 * Manages all application state and data fetching
 */
export function DataProvider({ children }) {
  // Market hours tracking
  const { marketOpen, currentTime, marketStatus } = useMarketHours();

  // WebSocket connection for real-time prices (always call hook, but conditionally use)
  const { prices: wsPrices, connected, error: wsError } = useRealtimePrice(WATCHLIST);

  // State
  const [historicalData, setHistoricalData] = useState({}); // Map of ticker -> daily candles
  const [movingAverages, setMovingAverages] = useState({}); // Map of ticker -> {ema10, ema21, sma50, sma65, sma100, sma200}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Merged prices (WebSocket + REST API)
  const [mergedPrices, setMergedPrices] = useState({});

  // 5m ORB data (Map of ticker -> {candle, historicalCandles, tier})
  const [orb5mData, setOrb5mData] = useState({});

  // Fetch historical data on mount (or use mock data)
  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use mock data if enabled
        if (MOCK_DATA_MODE) {
          console.log('🎭 Using MOCK DATA for visual testing');
          const mockData = generateMockData(WATCHLIST);
          setMergedPrices(mockData.prices);
          setMovingAverages(mockData.movingAverages);
          setOrb5mData(mockData.orb5mData);
          setLoading(false);
          return;
        }

        // Fetch daily candles for all tickers
        const candlesData = await fetchDailyCandlesBatch(WATCHLIST);

        // Calculate moving averages and ADR%
        const mas = {};
        Object.entries(candlesData).forEach(([ticker, candles]) => {
          if (candles && candles.c) {
            mas[ticker] = {
              ...getMovingAverages(candles),
              adr20: calculateADRPercent(candles, 20)
            };
          }
        });

        setHistoricalData(candlesData);
        setMovingAverages(mas);
      } catch (err) {
        console.error('Error fetching historical data:', err);
        setError('Failed to load historical data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    if (MOCK_DATA_MODE || isAPIConfigured()) {
      fetchHistoricalData();
    } else {
      setError('API keys not configured. Please set VITE_ALPACA_API_KEY_ID and VITE_ALPACA_SECRET_KEY in .env file');
      setLoading(false);
    }
  }, []);

  // Merge WebSocket prices into state (skip in mock mode)
  useEffect(() => {
    if (MOCK_DATA_MODE) return; // Don't override mock data

    if (wsPrices && Object.keys(wsPrices).length > 0) {
      setMergedPrices(prev => ({
        ...prev,
        ...wsPrices
      }));
    }
  }, [wsPrices]);

  // Supplement WebSocket with REST API polling (always fetch, regardless of market hours)
  useEffect(() => {
    if (MOCK_DATA_MODE) return; // Skip in mock mode
    if (!isAPIConfigured()) {
      return;
    }

    let isActive = true; // Prevent double-polling in StrictMode
    let timeoutId = null;

    const pollQuotes = async () => {
      if (!isActive) return;

      try {
        const quotes = await fetchQuoteBatch(WATCHLIST);

        if (!isActive) return; // Check again after async operation

        // Merge with existing prices
        setMergedPrices(prev => {
          const updated = { ...prev };
          let hasChanges = false;

          Object.entries(quotes).forEach(([ticker, quoteData]) => {
            const existingData = prev[ticker];
            const existingAge = existingData?.timestamp ? Date.now() - existingData.timestamp : Infinity;

            // Always use REST data in REST-only mode, or if stale in hybrid mode
            if (DATA_MODE === 'rest' || existingAge > 10000) {
              const priceChanged = existingData?.price !== quoteData.price;
              if (priceChanged || !existingData) {
                hasChanges = true;
              }
              updated[ticker] = quoteData;
            }
          });

          return updated;
        });

        setLastUpdate(Date.now());
      } catch (error) {
        if (error.message.includes('429')) {
          // Wait longer before next poll if rate limited
          if (isActive) {
            timeoutId = setTimeout(pollQuotes, 60000);
          }
          return;
        }
        console.error('REST polling error:', error);
      }

      // Schedule next poll with different intervals based on market hours
      if (isActive) {
        const pollingInterval = marketOpen
          ? UPDATE_INTERVALS.REST_QUOTE_POLL_MS
          : UPDATE_INTERVALS.REST_QUOTE_POLL_MS * 4; // 4x slower when market closed
        timeoutId = setTimeout(pollQuotes, pollingInterval);
      }
    };

    // Start polling after a short delay (avoid immediate double-call in StrictMode)
    timeoutId = setTimeout(pollQuotes, 2000);

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [marketOpen]);

  // Update lastUpdate when prices change
  useEffect(() => {
    if (mergedPrices && Object.keys(mergedPrices).length > 0) {
      setLastUpdate(Date.now());
    }
  }, [mergedPrices]);

  // Fetch 5m ORB data (after 9:35 AM ET)
  useEffect(() => {
    if (MOCK_DATA_MODE) return; // Skip in mock mode
    if (!isAPIConfigured()) {
      return;
    }

    let isActive = true;
    let timeoutId = null;

    const fetch5mORBData = async () => {
      if (!isActive) return;

      // Only fetch if ORB is active (after 9:35 AM ET on a trading day)
      if (!isORBActive()) {
        // Check again in 1 minute
        timeoutId = setTimeout(fetch5mORBData, 60000);
        return;
      }

      try {
        const orbData = {};

        // Fetch for all tickers
        for (const ticker of WATCHLIST) {
          try {
            // Fetch today's first 5m candle
            const first5mCandle = await fetchFirst5mCandle(ticker);

            // Fetch historical first 5m candles (last 20 days)
            const historicalCandles = await fetchHistoricalFirst5mCandles(ticker, 20);

            // Calculate tier
            const tier = evaluate5mORB({
              first5mCandle,
              historicalFirst5mCandles: historicalCandles
            });

            orbData[ticker] = {
              candle: first5mCandle,
              historicalCandles,
              tier
            };
          } catch (err) {
            console.error(`Error fetching 5m ORB data for ${ticker}:`, err);
            orbData[ticker] = {
              candle: null,
              historicalCandles: [],
              tier: null
            };
          }
        }

        if (isActive) {
          setOrb5mData(orbData);
        }
      } catch (error) {
        console.error('Error fetching 5m ORB data:', error);
      }

      // Refresh every 5 minutes during market hours
      if (isActive) {
        timeoutId = setTimeout(fetch5mORBData, 5 * 60 * 1000);
      }
    };

    // Start fetching after a delay
    timeoutId = setTimeout(fetch5mORBData, 3000);

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [marketOpen]);

  // Context value
  const value = {
    // Data
    tickers: WATCHLIST,
    prices: mergedPrices,
    historicalData,
    movingAverages,
    orb5mData,

    // Status
    connected,
    marketOpen,
    currentTime,
    marketStatus,
    loading,
    error: error || wsError,
    lastUpdate,
    apiConfigured: isAPIConfigured()
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/**
 * Custom hook to use the data context
 */
export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

export default DataContext;
