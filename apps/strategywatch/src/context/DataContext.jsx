import { createContext, useState, useEffect, useRef, useContext } from 'react';
import { WATCHLIST } from '../config/watchlist';
import { UPDATE_INTERVALS, DATA_MODE, MOCK_DATA_MODE, VRS_CONFIG } from '../config/constants';
// import { useRealtimePrice } from '../hooks/useRealtimePrice'; // DISABLED: Replaced by unified data engine
import { useMarketHours } from '../hooks/useMarketHours';
import { useMarketAnnouncements } from '../hooks/useMarketAnnouncements';
import { fetchDailyCandlesBatch, fetchQuoteBatch, fetchHistorical5mCandlesForRVol, fetchTodayIntradayCandlesBatch, isAPIConfigured } from '../services/marketData';
import { getMovingAverages, calculateADRPercent, evaluate5mORB, calculateVRS5m, calculateAvgFirst5mVolume } from '../services/calculations';
import { isORBActive } from '../utils/marketTime';
import { createDynamicMockData } from '../services/mockData';
import { calculateRVol, isMarketHours } from '../utils/rvolCalculations';
import * as RVolDB from '../services/rvolDatabase';
import { isMuted } from '../utils/voiceAlerts';
// import { createNewsService } from '../services/newsService'; // REMOVED: News functionality disabled
import { loadCache, saveCache } from '../services/startupCache';
import { createDataIngestionEngine } from '../services/dataIngestionEngine.js';

export const DataContext = createContext(null);

/**
 * DataProvider Component
 * Manages all application state and data fetching
 */
export function DataProvider({ children }) {
  // Market hours tracking
  const { marketOpen, currentTime, marketStatus, isHoliday, isWeekend, isLoading: isCalendarLoading } = useMarketHours();

  // Initialize real-time data ingestion engine
  const [dataEngine, setDataEngine] = useState(null);

  // 🚀 DISABLED: Legacy WebSocket connection (replaced by unified data engine)
  // const { prices: wsPrices, connected, error: wsError } = useRealtimePrice(
  //   MOCK_DATA_MODE ? [] : WATCHLIST
  // );

  // Unified data engine provides real-time prices
  const wsPrices = {}; // Empty placeholder - data engine handles real-time updates
  const connected = dataEngine?.websocketConnected || false;
  const wsError = dataEngine?.websocketError || null;

  // State
  const [historicalData, setHistoricalData] = useState({}); // Map of ticker -> daily candles
  const [movingAverages, setMovingAverages] = useState({}); // Map of ticker -> {ema10, ema21, sma50, sma65, sma100, sma200}
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ stage: '', completed: 0, total: 0 });
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Merged prices (WebSocket + REST API)
  const [mergedPrices, setMergedPrices] = useState({});

  // 5m ORB data (Map of ticker -> {candle, historicalCandles, tier})
  const [orb5mData, setOrb5mData] = useState({});

  // RVol data (Map of ticker -> {rvol, currentCumulative, avgCumulative, error})
  const [rvolData, setRVolData] = useState({});

  // VRS data (Map of ticker -> {vrs1m, vrs5m, vrs15m, timestamp})
  const [vrsData, setVrsData] = useState({});

  // Real-time accurate indicators from new engine
  const [realtimeIndicators, setRealtimeIndicators] = useState({});

  // QQQ benchmark data for VRS calculations
  const [qqqData, setQqqData] = useState({
    historicalCandles: null,
    adr20: null,
    current1mClose: null,
    previous1mClose: null,
    current5mClose: null,
    previous5mClose: null,
    current15mClose: null,
    previous15mClose: null
  });

  // Dynamic mock data system
  const [dynamicMockData, setDynamicMockData] = useState(null);

  // Global mute state (synced with voiceAlerts)
  const [globalMuted, setGlobalMuted] = useState(() => isMuted());

  // Refs to prevent infinite loops in WebSocket merge
  const lastWsPricesRef = useRef({});
  const updateTimeoutRef = useRef(null);

  // Market open/close voice announcements (now that globalMuted is initialized)
  useMarketAnnouncements(globalMuted);

  // Live/Test mode state
  const [isLiveMode, setIsLiveMode] = useState(() => {
    // Default to true (live mode) unless explicitly set to test mode
    return !MOCK_DATA_MODE;
  });

  // 🚀 Initialize real-time data engine and subscribe to ACCURATE calculations
  useEffect(() => {
    if (!isLiveMode || MOCK_DATA_MODE) return;

    const initializeRealTimeEngine = async () => {
      try {
        console.log('[DataContext] 🚀 Initializing REAL-TIME ACCURATE data engine...');

        // Create and start the data ingestion engine
        const engine = createDataIngestionEngine(WATCHLIST);
        await engine.start();

        setDataEngine(engine);
        console.log('[DataContext] ✅ Data engine started successfully');

        // Subscribe to REAL-TIME calculations for ALL tickers
        WATCHLIST.forEach(symbol => {
          engine.subscribeToRealTimeCalculations(symbol, (update) => {
            if (update.type === 'indicators') {
              // 🎯 UPDATE UI with ACCURATE calculations (every 100ms!)
              setRealtimeIndicators(prev => ({
                ...prev,
                [symbol]: update.data
              }));

              // Also update vrsData state for backward compatibility
              if (update.data.calculations.vrs1m || update.data.calculations.vrs5m || update.data.calculations.vrs15m) {
                setVrsData(prev => ({
                  ...prev,
                  [symbol]: {
                    vrs1m: update.data.calculations.vrs1m,
                    vrs5m: update.data.calculations.vrs5m,
                    vrs15m: update.data.calculations.vrs15m,
                    timestamp: update.data.timestamp
                  }
                }));
              }
            }
          });
        });

        console.log('[DataContext] 🔥 Subscribed to REAL-TIME calculations for all tickers');

      } catch (error) {
        console.error('[DataContext] ❌ Failed to initialize real-time engine:', error);
      }
    };

    initializeRealTimeEngine();

  }, [isLiveMode]);

  // Fetch historical data on mount and when isLiveMode changes
  useEffect(() => {
    let isActive = true; // Prevent duplicate fetches in React StrictMode

    const fetchHistoricalData = async () => {
      if (!isActive) return; // Guard against double execution

      // TEMPORARILY DISABLED: Force fresh data fetch during market hours
      // Prevent fetching if we already have data
      /*
      if (Object.keys(historicalData).length > 0 &&
          Object.keys(movingAverages).length > 0 &&
          Object.keys(mergedPrices).length > 0 &&
          !loading) {
        console.log('[DataContext] ✅ Data already loaded, skipping fetch');
        return;
      }
      */
      console.log('[DataContext] 🔄 FORCING FRESH DATA FETCH (Market Hours Debug)');

      try {
        setLoading(true);
        setError(null);

        console.log(`[DEBUG] Market Status Check: isLiveMode=${isLiveMode}, MOCK_DATA_MODE=${MOCK_DATA_MODE}`);
        if (!isLiveMode || MOCK_DATA_MODE) {
          const mode = MOCK_DATA_MODE ? 'MOCK DATA MODE' : 'TEST MODE';
          console.log(`🎭 Using DYNAMIC MOCK DATA for ${mode}`);
          const dynamicData = createDynamicMockData(WATCHLIST);
          setDynamicMockData(dynamicData);
          setMergedPrices(dynamicData.initialData.prices);
          setMovingAverages(dynamicData.initialData.movingAverages);
          setOrb5mData(dynamicData.initialData.orb5mData);
          setVrsData(dynamicData.initialData.vrsData);
          setLoading(false);
          return;
        } else {
          console.log(`[DEBUG] Proceeding with LIVE DATA - Market is open and live mode is active`);
        }

        const cachedData = await loadCache(WATCHLIST);

        if (cachedData) {
          setHistoricalData(cachedData.historicalData || {});
          setMovingAverages(cachedData.movingAverages || {});
          setMergedPrices(cachedData.mergedPrices || {});
          setRVolData(cachedData.rvolData || {}); // Restore cached RVol data
          setLoading(false); // Render the UI immediately with cached data
        } else {
          setLoading(true); // Show loading screen if no cache
        }

        console.log('[DataContext] Fetching latest data...');
        setLoadingProgress({ stage: 'Fetching market data', completed: 0, total: WATCHLIST.length });

        // Fetch WATCHLIST + QQQ for VRS benchmark (avoid duplication if QQQ is already in WATCHLIST)
        const tickersWithBenchmark = WATCHLIST.includes(VRS_CONFIG.BENCHMARK_SYMBOL)
          ? WATCHLIST
          : [...WATCHLIST, VRS_CONFIG.BENCHMARK_SYMBOL];
        const [candlesData, quotesData] = await Promise.all([
          fetchDailyCandlesBatch(tickersWithBenchmark),
          fetchQuoteBatch(tickersWithBenchmark)
        ]);

        if (!isActive) return; // Stop if component unmounted

        // Warn if any tickers failed to load
        const missingCandles = WATCHLIST.filter(t => !candlesData[t]);
        const missingQuotes = WATCHLIST.filter(t => !quotesData[t]);

        if (missingCandles.length > 0) {
          console.warn(`[DataContext] ⚠️ Missing candles: ${missingCandles.join(', ')}`);
        }
        if (missingQuotes.length > 0) {
          console.warn(`[DataContext] ⚠️ Missing quotes: ${missingQuotes.join(', ')}`);
        }

        if (!isActive) return; // Stop if component unmounted

        // Calculate moving averages and ADR% with progress tracking
        setLoadingProgress({ stage: 'Calculating indicators', completed: 0, total: Object.keys(candlesData).length });
        const mas = {};
        let processedCount = 0;

        // Extract and store QQQ data for VRS benchmark
        const qqqCandles = candlesData[VRS_CONFIG.BENCHMARK_SYMBOL];
        if (qqqCandles && qqqCandles.c) {
          const qqqAdr = calculateADRPercent(qqqCandles, VRS_CONFIG.ADR_PERIOD);
          setQqqData(prev => ({
            ...prev,
            historicalCandles: qqqCandles,
            adr20: qqqAdr ? qqqAdr / 100 : null // Convert to decimal (e.g., 2.0% -> 0.02)
          }));
          console.log(`[DataContext] QQQ ADR%: ${qqqAdr?.toFixed(2)}%`);
        }

        Object.entries(candlesData).forEach(([ticker, candles]) => {
          if (candles && candles.c) {
            const adr = calculateADRPercent(candles, 20);
            mas[ticker] = {
              ...getMovingAverages(candles),
              adr20: adr,
              adr20Decimal: adr ? adr / 100 : null // Store decimal version for VRS calculations
            };
          }
          processedCount++;
          setLoadingProgress({
            stage: 'Calculating indicators',
            completed: processedCount,
            total: Object.keys(candlesData).length
          });
        });

        // Extract price and previous close from quote data
        const freshQuotes = {};
        Object.entries(quotesData).forEach(([ticker, quote]) => {
          freshQuotes[ticker] = {
            price: quote.price,
            previousClose: quote.previousClose,
            open: quote.open,
            high: quote.high,
            low: quote.low,
            timestamp: quote.timestamp || Date.now()
          };
        });

        if (!isActive) return; // Stop if component unmounted

        // Merge fresh data with existing cached data
        const newHistoricalData = { ...historicalData, ...candlesData };
        const newMovingAverages = { ...movingAverages, ...mas };
        const newMergedPrices = { ...mergedPrices, ...freshQuotes };

        
        setHistoricalData(newHistoricalData);
        setMovingAverages(newMovingAverages);
        setMergedPrices(newMergedPrices);

        setLoadingProgress({ stage: 'Complete', completed: WATCHLIST.length, total: WATCHLIST.length });
        console.log(`[DataContext] ✅ Data loaded: ${Object.keys(mas).length} MAs, ${Object.keys(quotesData).length} quotes`);

        // After all processing, save the new fresh data to the cache
        const dataToCache = {
          historicalData: newHistoricalData,
          movingAverages: newMovingAverages,
          mergedPrices: newMergedPrices,
          // Note: rvolData is cached separately in the unified market data fetcher
        };
        await saveCache(dataToCache);

      } catch (err) {
        console.error('Error fetching historical data:', err);
        setError('Failed to load historical data: ' + err.message);
        setLoadingProgress({ stage: 'Error', completed: 0, total: 0 });
      } finally {
        setLoading(false);
      }
    };

    if (MOCK_DATA_MODE || (!isLiveMode) || isAPIConfigured()) {
      fetchHistoricalData();
    } else {
      setError('API keys not configured. Please set VITE_ALPACA_API_KEY_ID and VITE_ALPACA_SECRET_KEY in .env file');
      setLoading(false);
    }

    // Cleanup function to prevent state updates after unmount
    return () => {
      isActive = false;
    };
  }, [isLiveMode]);

  // Dynamic mock data updates (only in test mode or mock mode)
  useEffect(() => {
    // Don't run updates in LIVE mode unless MOCK_DATA_MODE is globally enabled
    if (isLiveMode && !MOCK_DATA_MODE) return;
    // Don't run if no mock data exists
    if (!dynamicMockData) return;

    const interval = setInterval(() => {
      // Update prices
      setMergedPrices(prev => {
        const updated = dynamicMockData.updateMockData({ prices: prev });
        return updated.prices;
      });

      // Update ORB data occasionally
      if (Math.random() < 0.1) { // 10% chance per interval
        setOrb5mData(prev => {
          const updated = dynamicMockData.updateOrbData(prev);
          return updated;
        });
      }

      // Update RVol data occasionally (simulate gradual volume accumulation)
      if (Math.random() < 0.15) { // 15% chance per interval
        setRVolData(prev => {
          const updated = {};
          WATCHLIST.forEach(ticker => {
            const prevData = prev[ticker] || {};
            // Slightly vary RVol to simulate market changes
            const variation = (Math.random() - 0.5) * 0.2; // ±0.1
            const newRVol = Math.max(0.1, (prevData.rvol || 1.0) + variation);

            updated[ticker] = {
              ...prevData,
              rvol: newRVol,
              currentCumulative: Math.floor((prevData.currentCumulative || 0) + Math.random() * 100000),
              avgCumulative: prevData.avgCumulative || Math.floor(Math.random() * 8000000),
              minutesSinceOpen: Math.floor((Date.now() - new Date().setHours(9, 30, 0, 0)) / 60000),
              dataPoints: 20,
              error: null
            };
          });
          return updated;
        });
      }

      setLastUpdate(Date.now());
    }, 2000); // Update every 2 seconds for realistic movement

    return () => clearInterval(interval);
  }, [isLiveMode, dynamicMockData]);

  // Merge WebSocket prices into state (skip in test mode or mock mode)
  useEffect(() => {
    if (!isLiveMode || MOCK_DATA_MODE) return;
    if (!wsPrices || Object.keys(wsPrices).length === 0) return;

    // Filter out invalid WebSocket data (undefined/null prices)
    const validWsPrices = {};
    let hasValidData = false;

    Object.entries(wsPrices).forEach(([ticker, data]) => {
      if (data && typeof data.price === 'number' && !isNaN(data.price)) {
        validWsPrices[ticker] = data;
        hasValidData = true;
      }
    });

    // If no valid prices, skip
    if (!hasValidData) {
      return;
    }

    // Check if data has actually changed
    let hasNewData = false;
    const tickers = Object.keys(validWsPrices);

    for (const ticker of tickers) {
      const newData = validWsPrices[ticker];
      const lastData = lastWsPricesRef.current[ticker];

      if (!lastData ||
          lastData.price !== newData.price ||
          lastData.timestamp !== newData.timestamp) {
        hasNewData = true;
        break;
      }
    }

    // If no new data, skip
    if (!hasNewData) {
      return;
    }

    // Clear any pending timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce: batch rapid WebSocket updates
    updateTimeoutRef.current = setTimeout(() => {
      // Update ref with valid prices only
      Object.entries(validWsPrices).forEach(([ticker, data]) => {
        lastWsPricesRef.current[ticker] = data;
      });

      // Update state
      setMergedPrices(prev => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.entries(validWsPrices).forEach(([ticker, newData]) => {
          const currentData = prev[ticker];

          // Only update if price has changed or is missing
          if (!currentData || currentData.price !== newData.price) {
            // CRITICAL FIX: Only update price and timestamp from WebSocket
            // Preserve previousClose, open, high, low from REST API (daily bar data)
            // WebSocket bar data contains minute bar values which should NOT overwrite daily values
            updated[ticker] = {
              ...currentData,
              price: newData.price,
              timestamp: newData.timestamp,
              // Preserve these WebSocket-specific fields
              ...(newData.volume !== undefined && { volume: newData.volume }),
              ...(newData.receivedAt !== undefined && { receivedAt: newData.receivedAt }),
              ...(newData.delay !== undefined && { delay: newData.delay }),
              ...(newData.type !== undefined && { type: newData.type }),
              ...(newData.exchange !== undefined && { exchange: newData.exchange }),
              ...(newData.conditions !== undefined && { conditions: newData.conditions }),
              ...(newData.vwap !== undefined && { vwap: newData.vwap }),
              ...(newData.tradeCount !== undefined && { tradeCount: newData.tradeCount }),
            };
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 100); // 100ms debounce

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [wsPrices, isLiveMode]);

  // Supplement WebSocket with REST API polling (always fetch, regardless of market hours)
  useEffect(() => {
    if (!isLiveMode || MOCK_DATA_MODE) return; // Skip in test mode or mock mode
    if (!isAPIConfigured()) {
      return;
    }

    // Check if WebSocket fallback is enabled
    const isWebSocketFallback = typeof window !== 'undefined' && window.websocketFallback;

    // Adaptive polling interval based on connection status
    const getPollingInterval = () => {
      if (isWebSocketFallback) {
        return 5000; // 5 seconds when WebSocket failed
      }
      return 30000; // 30 seconds when WebSocket is working
    };

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

            // Always use REST data in REST-only mode, or if stale/missing in hybrid mode
            // Also update if WebSocket is disconnected (provide faster fallback)
            const shouldUpdate =
              DATA_MODE === 'rest' ||
              existingAge > 10000 ||
              !existingData || // Missing data
              !connected; // WebSocket disconnected

            if (shouldUpdate) {
              // CRITICAL FIX: Merge REST API data carefully
              // If WebSocket is active and has fresher price data, preserve it
              const shouldPreserveWSPrice = connected && existingData?.receivedAt &&
                (Date.now() - existingData.receivedAt) < 5000; // WebSocket data less than 5s old

              updated[ticker] = {
                ...quoteData, // Start with REST API data (includes previousClose, open, high, low)
                // Preserve WebSocket price if it's fresher
                ...(shouldPreserveWSPrice && existingData?.price !== undefined && {
                  price: existingData.price,
                  timestamp: existingData.timestamp,
                  receivedAt: existingData.receivedAt,
                  delay: existingData.delay,
                  type: existingData.type,
                }),
              };
              hasChanges = true;
            }
          });

          // Only update state if there are actual changes
          return hasChanges ? updated : prev;
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

      // Schedule next poll with adaptive intervals
      if (isActive) {
        let pollingInterval = getPollingInterval();

        // Further slow down when market is closed
        if (!marketOpen) {
          pollingInterval *= 4; // 4x slower when market closed
        }

        timeoutId = setTimeout(pollQuotes, pollingInterval);
      }
    };

    // Start polling after a short delay (avoid immediate double-call in StrictMode)
    // If WebSocket is already disconnected or in fallback mode, start immediately for faster UX
    const initialDelay = (connected && !isWebSocketFallback) ? 2000 : 500;
    timeoutId = setTimeout(pollQuotes, initialDelay);

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [marketOpen, isLiveMode, connected]);

  // Fetch 5m candles and calculate VRS (every 5 minutes during market hours)
  useEffect(() => {
    if (!isLiveMode || MOCK_DATA_MODE || !marketOpen) {
      return;
    }
    if (!isAPIConfigured()) {
      return;
    }

    let isActive = true;
    let intervalId = null;

    const fetch5mCandlesAndCalculateVRS = async () => {
      if (!isActive) return;

      try {
        // Fetch today's 5m candles for all tickers + QQQ (avoid duplication if QQQ is already in WATCHLIST)
        const tickersWithBenchmark = WATCHLIST.includes(VRS_CONFIG.BENCHMARK_SYMBOL)
          ? WATCHLIST
          : [...WATCHLIST, VRS_CONFIG.BENCHMARK_SYMBOL];
        const candles5m = await fetchTodayIntradayCandlesBatch(tickersWithBenchmark, '5Min');

        if (!isActive || !candles5m) return;

        // Get QQQ's current and previous 5m close
        const qqqCandles = candles5m[VRS_CONFIG.BENCHMARK_SYMBOL];
        if (!qqqCandles || !Array.isArray(qqqCandles) || qqqCandles.length < 2) {
          return;
        }

        const qqqCurrentClose = qqqCandles[qqqCandles.length - 1].close;
        const qqqPreviousClose = qqqCandles[qqqCandles.length - 2].close;

        // Update QQQ 5m closes
        setQqqData(prev => ({
          ...prev,
          current5mClose: qqqCurrentClose,
          previous5mClose: qqqPreviousClose
        }));

        // Calculate VRS for each ticker
        const newVrsData = {};

        WATCHLIST.forEach(ticker => {
          const tickerCandles = candles5m[ticker];
          if (!tickerCandles || !Array.isArray(tickerCandles) || tickerCandles.length < 2) {
            return; // Skip if insufficient data
          }

          const stockCurrentClose = tickerCandles[tickerCandles.length - 1].close;
          const stockPreviousClose = tickerCandles[tickerCandles.length - 2].close;

          // Get ADR% in decimal form
          const stockADR = movingAverages[ticker]?.adr20Decimal;
          const qqqADR = qqqData.adr20;

          if (!stockADR || !qqqADR) {
            return; // Skip if ADR% not available
          }

          // Calculate VRS
          const vrs = calculateVRS5m({
            stockCurrentClose,
            stockPreviousClose,
            stockADRPercent: stockADR,
            benchmarkCurrentClose: qqqCurrentClose,
            benchmarkPreviousClose: qqqPreviousClose,
            benchmarkADRPercent: qqqADR
          });

          if (vrs === null) {
            return; // Skip if VRS calculation failed
          }

          // Store VRS (5m) for display only (no EMA calculation - moved to VRS 1m)
          newVrsData[ticker] = {
            vrs5m: vrs,
            timestamp: Date.now()
          };
        });

        // Update VRS data state
        setVrsData(newVrsData);

      } catch (error) {
        console.error('[VRS] Error fetching 5m candles:', error);
      }

      // Schedule next fetch (5 minutes)
      if (isActive) {
        intervalId = setTimeout(fetch5mCandlesAndCalculateVRS, 5 * 60 * 1000);
      }
    };

    // Initial fetch after 10 seconds (let other data load first)
    intervalId = setTimeout(fetch5mCandlesAndCalculateVRS, 10000);

    return () => {
      isActive = false;
      if (intervalId) clearTimeout(intervalId);
    };
  }, [marketOpen, isLiveMode, qqqData.adr20]);

  // Fetch 1m candles and calculate VRS (every 1 minute during market hours)
  useEffect(() => {
    if (!isLiveMode || MOCK_DATA_MODE || !marketOpen) {
      return;
    }
    if (!isAPIConfigured()) {
      return;
    }

    let isActive = true;
    let intervalId = null;

    const fetch1mCandlesAndCalculateVRS = async () => {
      if (!isActive) return;

      try {
        // Fetch today's 1m candles for all tickers + QQQ (avoid duplication if QQQ is already in WATCHLIST)
        const tickersWithBenchmark = WATCHLIST.includes(VRS_CONFIG.BENCHMARK_SYMBOL)
          ? WATCHLIST
          : [...WATCHLIST, VRS_CONFIG.BENCHMARK_SYMBOL];
        const candles1m = await fetchTodayIntradayCandlesBatch(tickersWithBenchmark, '1Min');

        if (!isActive || !candles1m) return;

        // Get QQQ's current and previous 1m close
        const qqqCandles = candles1m[VRS_CONFIG.BENCHMARK_SYMBOL];
        if (!qqqCandles || !Array.isArray(qqqCandles) || qqqCandles.length < 2) {
          return;
        }

        const qqqCurrentClose = qqqCandles[qqqCandles.length - 1].close;
        const qqqPreviousClose = qqqCandles[qqqCandles.length - 2].close;

        // Update QQQ 1m closes
        setQqqData(prev => ({
          ...prev,
          current1mClose: qqqCurrentClose,
          previous1mClose: qqqPreviousClose
        }));

        // Calculate VRS 1m for each ticker and merge with existing VRS data
        setVrsData(prevVrsData => {
          const updatedVrsData = { ...prevVrsData };

          WATCHLIST.forEach(ticker => {
            const tickerCandles = candles1m[ticker];
            if (!tickerCandles || !Array.isArray(tickerCandles) || tickerCandles.length < 2) {
              return; // Skip if insufficient data
            }

            const stockCurrentClose = tickerCandles[tickerCandles.length - 1].close;
            const stockPreviousClose = tickerCandles[tickerCandles.length - 2].close;

            // Get ADR% in decimal form
            const stockADR = movingAverages[ticker]?.adr20Decimal;
            const qqqADR = qqqData.adr20;

            if (!stockADR || !qqqADR) {
              return; // Skip if ADR% not available
            }

            // Calculate VRS using 1m data (simple, no EMA)
            const vrs1m = calculateVRS5m({
              stockCurrentClose,
              stockPreviousClose,
              stockADRPercent: stockADR,
              benchmarkCurrentClose: qqqCurrentClose,
              benchmarkPreviousClose: qqqPreviousClose,
              benchmarkADRPercent: qqqADR
            });

            if (vrs1m === null) {
              return; // Skip if VRS calculation failed
            }

            // Merge with existing VRS data (preserve vrs5m and vrs15m)
            updatedVrsData[ticker] = {
              ...updatedVrsData[ticker],
              vrs1m,
              timestamp: Date.now()
            };
          });

          return updatedVrsData;
        });

      } catch (error) {
        console.error('[VRS 1m] Error fetching 1m candles:', error);
      }

      // Schedule next fetch (1 minute)
      if (isActive) {
        intervalId = setTimeout(fetch1mCandlesAndCalculateVRS, 1 * 60 * 1000);
      }
    };

    // Initial fetch after 15 seconds (let 5m VRS load first)
    intervalId = setTimeout(fetch1mCandlesAndCalculateVRS, 15000);

    return () => {
      isActive = false;
      if (intervalId) clearTimeout(intervalId);
    };
  }, [marketOpen, isLiveMode, qqqData.adr20]);

  // Fetch 15m candles and calculate VRS (every 15 minutes during market hours)
  useEffect(() => {
    if (!isLiveMode || MOCK_DATA_MODE || !marketOpen) {
      return;
    }
    if (!isAPIConfigured()) {
      return;
    }

    let isActive = true;
    let intervalId = null;

    const fetch15mCandlesAndCalculateVRS = async () => {
      if (!isActive) return;

      try {
        // Fetch today's 15m candles for all tickers + QQQ (avoid duplication if QQQ is already in WATCHLIST)
        const tickersWithBenchmark = WATCHLIST.includes(VRS_CONFIG.BENCHMARK_SYMBOL)
          ? WATCHLIST
          : [...WATCHLIST, VRS_CONFIG.BENCHMARK_SYMBOL];
        const candles15m = await fetchTodayIntradayCandlesBatch(tickersWithBenchmark, '15Min');

        if (!isActive || !candles15m) return;

        // Get QQQ's current and previous 15m close
        const qqqCandles = candles15m[VRS_CONFIG.BENCHMARK_SYMBOL];
        if (!qqqCandles || !Array.isArray(qqqCandles) || qqqCandles.length < 2) {
          return;
        }

        const qqqCurrentClose = qqqCandles[qqqCandles.length - 1].close;
        const qqqPreviousClose = qqqCandles[qqqCandles.length - 2].close;

        // Update QQQ 15m closes
        setQqqData(prev => ({
          ...prev,
          current15mClose: qqqCurrentClose,
          previous15mClose: qqqPreviousClose
        }));

        // Calculate VRS 15m for each ticker and merge with existing VRS data
        setVrsData(prevVrsData => {
          const updatedVrsData = { ...prevVrsData };

          WATCHLIST.forEach(ticker => {
            const tickerCandles = candles15m[ticker];
            if (!tickerCandles || !Array.isArray(tickerCandles) || tickerCandles.length < 2) {
              return; // Skip if insufficient data
            }

            const stockCurrentClose = tickerCandles[tickerCandles.length - 1].close;
            const stockPreviousClose = tickerCandles[tickerCandles.length - 2].close;

            // Get ADR% in decimal form
            const stockADR = movingAverages[ticker]?.adr20Decimal;
            const qqqADR = qqqData.adr20;

            if (!stockADR || !qqqADR) {
              return; // Skip if ADR% not available
            }

            // Calculate VRS using 15m data
            const vrs15m = calculateVRS5m({
              stockCurrentClose,
              stockPreviousClose,
              stockADRPercent: stockADR,
              benchmarkCurrentClose: qqqCurrentClose,
              benchmarkPreviousClose: qqqPreviousClose,
              benchmarkADRPercent: qqqADR
            });

            if (vrs15m === null) {
              return; // Skip if VRS calculation failed
            }

            // Merge with existing VRS data (preserve vrs1m and vrs5m)
            updatedVrsData[ticker] = {
              ...updatedVrsData[ticker],
              vrs15m,
              timestamp: Date.now()
            };
          });

          return updatedVrsData;
        });

      } catch (error) {
        console.error('[VRS 15m] Error fetching 15m candles:', error);
      }

      // Schedule next fetch (15 minutes)
      if (isActive) {
        intervalId = setTimeout(fetch15mCandlesAndCalculateVRS, 15 * 60 * 1000);
      }
    };

    // Initial fetch after 20 seconds (let 5m and 1m VRS load first)
    intervalId = setTimeout(fetch15mCandlesAndCalculateVRS, 20000);

    return () => {
      isActive = false;
      if (intervalId) clearTimeout(intervalId);
    };
  }, [marketOpen, isLiveMode, qqqData.adr20]);

  // Update lastUpdate when prices change
  useEffect(() => {
    if (mergedPrices && Object.keys(mergedPrices).length > 0) {
      setLastUpdate(Date.now());
    }
  }, [mergedPrices]);

  // Unified market data fetching: Fetch 5m intraday data and calculate both RVol and ORB
  useEffect(() => {
    if (!isLiveMode || MOCK_DATA_MODE) return; // Skip in test mode or mock mode
    if (!isAPIConfigured()) {
      return;
    }

    let isActive = true;
    let timeoutId = null;

    const fetchUnifiedMarketData = async () => {
      if (!isActive) return;

      const shouldFetchORB = isORBActive();
      const shouldFetchRVol = isMarketHours();

      // Still run if we have no RVol data yet (to populate on first load)
      const shouldLoadCachedRVol = Object.keys(rvolData).length === 0;

      if (!shouldFetchORB && !shouldFetchRVol && !shouldLoadCachedRVol) {
        timeoutId = setTimeout(fetchUnifiedMarketData, 60000);
        return;
      }

      try {
        // Step 1: Fetch all data in parallel using batching
        const [todayCandlesBatch] = await Promise.all([
          fetchTodayIntradayCandlesBatch(WATCHLIST),
        ]);

        const rvolResults = {};
        const orbData = {};

        // Step 2: Process results for each ticker
        for (const ticker of WATCHLIST) {
          const todayCandles = todayCandlesBatch[ticker] || [];
          let historicalData = await RVolDB.getRecentCandles(ticker, 20);

          if (historicalData.length < 10) {
            const fetchedHistorical = await fetchHistorical5mCandlesForRVol(ticker, 20);
            for (const dayData of fetchedHistorical) {
              await RVolDB.storeCandles(ticker, dayData.date, dayData.candles);
            }
            historicalData = fetchedHistorical;
          }

          if (shouldFetchRVol || shouldLoadCachedRVol) {
            rvolResults[ticker] = calculateRVol(todayCandles, historicalData);
          }

          if (shouldFetchORB) {
            // Find the candle that starts at 9:30 AM ET (not just the first candle)
            const first5mCandle = todayCandles.find(candle => {
              const candleTime = new Date(candle.timestamp);
              const etHour = parseInt(candleTime.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }));
              const etMinute = parseInt(candleTime.toLocaleString('en-US', { timeZone: 'America/New_York', minute: '2-digit' }));

              // Match 9:30 AM ET (with 5-minute tolerance for API variations)
              return etHour === 9 && etMinute >= 30 && etMinute < 35;
            }) || null;
            const historicalFirst5mCandles = await RVolDB.getFirst5mCandles(ticker, 20);
            const tier = evaluate5mORB({ first5mCandle, historicalFirst5mCandles });
            const avgVolume = calculateAvgFirst5mVolume(historicalFirst5mCandles);

            orbData[ticker] = {
              candle: first5mCandle,
              historicalCandles: historicalFirst5mCandles,
              tier,
              avgVolume,
              source: 'alpaca',
              timestamp: Date.now(),
            };
          }
        }

        // Step 3: Update state
        if (isActive) {
          if (shouldFetchRVol || shouldLoadCachedRVol) {
            setRVolData(rvolResults);
            // Only save to cache if we actually have valid RVol data (during market hours)
            if (shouldFetchRVol && Object.keys(rvolResults).length > 0) {
              try {
                const existingCache = await loadCache(WATCHLIST);
                const updatedCache = {
                  ...existingCache,
                  rvolData: rvolResults
                };
                await saveCache(updatedCache);
                console.log('[DataContext] ✅ RVol data cached for', Object.keys(rvolResults).length, 'tickers');
              } catch (cacheError) {
                console.warn('[DataContext] ⚠️ Failed to cache RVol data:', cacheError);
              }
            }
          }
          if (shouldFetchORB) {
            setOrb5mData(orbData);
          }
        }

        await RVolDB.cleanupAllTickers(WATCHLIST);
      } catch (error) {
        console.error('Error fetching unified market data:', error);
      }

      if (isActive) {
        timeoutId = setTimeout(fetchUnifiedMarketData, 5 * 60 * 1000);
      }
    };

    // Start fetching after a delay (after other data loads)
    timeoutId = setTimeout(fetchUnifiedMarketData, 4000);

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [marketOpen, isLiveMode]);

  // Toggle live mode function
  const toggleLiveMode = () => {
    setIsLiveMode(prev => !prev);
  };

  // Context value
  const value = {
    // Data
    tickers: WATCHLIST,
    prices: mergedPrices,
    historicalData,
    movingAverages,
    orb5mData,
    rvolData,
    vrsData,

    // 🚀 NEW: REAL-TIME ACCURATE indicators (updated every 100ms!)
    realtimeIndicators,

    // Status
    connected: isLiveMode && !MOCK_DATA_MODE ? connected : true,
    marketOpen,
    currentTime,
    marketStatus,
    isHoliday,
    isWeekend,
    isLoading: loading || isCalendarLoading, // Show loading if either data or calendar is loading
    loading,
    loadingProgress, // New detailed progress tracking
    error: (isLiveMode && !MOCK_DATA_MODE) ? (error || wsError) : null,
    lastUpdate,
    apiConfigured: isAPIConfigured(),
    isLiveMode,

    // Voice control
    globalMuted,
    setGlobalMuted,

    // Mode control
    toggleLiveMode
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
