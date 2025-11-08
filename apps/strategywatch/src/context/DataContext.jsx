import { createContext, useContext, useState, useEffect } from 'react';
import { WATCHLIST } from '../config/watchlist';
import { UPDATE_INTERVALS, DATA_MODE } from '../config/constants';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import { useMarketHours } from '../hooks/useMarketHours';
import { fetchDailyCandlesBatch, fetchQuoteBatch, isAPIConfigured } from '../services/marketData';
import { getMovingAverages } from '../services/calculations';

const DataContext = createContext(null);

/**
 * DataProvider Component
 * Manages all application state and data fetching
 */
export function DataProvider({ children }) {
  // WebSocket connection for real-time prices (only in hybrid mode)
  const wsEnabled = DATA_MODE === 'hybrid';
  const { prices: wsPrices, connected, error: wsError } = wsEnabled
    ? useRealtimePrice(WATCHLIST)
    : { prices: {}, connected: false, error: null };

  // Market hours tracking
  const { marketOpen, orbActive, currentTime, marketStatus } = useMarketHours();

  // State
  const [historicalData, setHistoricalData] = useState({}); // Map of ticker -> daily candles
  const [movingAverages, setMovingAverages] = useState({}); // Map of ticker -> {ema10, ema21, sma50, sma65, sma100, sma200}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Merged prices (WebSocket + REST API)
  const [mergedPrices, setMergedPrices] = useState({});

  // Fetch historical data on mount
  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch daily candles for all tickers
        const candlesData = await fetchDailyCandlesBatch(WATCHLIST);

        // Calculate moving averages
        const mas = {};
        Object.entries(candlesData).forEach(([ticker, candles]) => {
          if (candles && candles.c) {
            mas[ticker] = getMovingAverages(candles);
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

    if (isAPIConfigured()) {
      fetchHistoricalData();
    } else {
      setError('API keys not configured. Please set VITE_ALPACA_API_KEY_ID and VITE_ALPACA_SECRET_KEY in .env file');
      setLoading(false);
    }
  }, []);

  // Merge WebSocket prices into state
  useEffect(() => {
    if (wsPrices && Object.keys(wsPrices).length > 0) {
      setMergedPrices(prev => ({
        ...prev,
        ...wsPrices
      }));
    }
  }, [wsPrices]);

  // Supplement WebSocket with REST API polling (always fetch, regardless of market hours)
  useEffect(() => {
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

  // Context value
  const value = {
    // Data
    tickers: WATCHLIST,
    prices: mergedPrices,
    historicalData,
    movingAverages,

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
