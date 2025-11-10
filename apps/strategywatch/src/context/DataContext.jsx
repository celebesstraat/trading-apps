import { createContext, useContext, useState, useEffect } from 'react';
import { WATCHLIST } from '../config/watchlist';
import { UPDATE_INTERVALS, DATA_MODE, MOCK_DATA_MODE, VRS_CONFIG } from '../config/constants';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import { useMarketHours } from '../hooks/useMarketHours';
import { useMarketAnnouncements } from '../hooks/useMarketAnnouncements';
import { fetchDailyCandlesBatch, fetchQuoteBatch, fetchHistorical5mCandlesForRVol, fetchTodayIntradayCandlesBatch, isAPIConfigured } from '../services/marketData';
import { getMovingAverages, calculateADRPercent, evaluate5mORB, calculateVRS5m, calculateVRSEMA } from '../services/calculations';
import { isORBActive } from '../utils/marketTime';
import { createDynamicMockData } from '../services/mockData';
import { calculateRVol, isMarketHours } from '../utils/rvolCalculations';
import * as RVolDB from '../services/rvolDatabase';
import { isMuted } from '../utils/voiceAlerts';
import { createNewsService } from '../services/newsService';
import { loadCache, saveCache } from '../services/startupCache';

const DataContext = createContext(null);

/**
 * DataProvider Component
 * Manages all application state and data fetching
 */
export function DataProvider({ children }) {
  // Market hours tracking
  const { marketOpen, currentTime, marketStatus, isHoliday, isWeekend, isLoading: isCalendarLoading } = useMarketHours();

  // WebSocket connection for real-time prices (only when not in mock mode)
  const { prices: wsPrices, connected, error: wsError } = useRealtimePrice(
    MOCK_DATA_MODE ? [] : WATCHLIST
  );

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

  // VRS data (Map of ticker -> {vrs5m, vrsEma12, timestamp})
  const [vrsData, setVrsData] = useState({});

  // QQQ benchmark data for VRS calculations
  const [qqqData, setQqqData] = useState({
    historicalCandles: null,
    adr20: null,
    current5mClose: null,
    previous5mClose: null
  });

  // Track previous 5m closes for all tickers (for VRS calculation)
  
  // Track VRS history for EMA calculation (Map of ticker -> array of VRS values)
  const [vrsHistory, setVrsHistory] = useState({});

  // Dynamic mock data system
  const [dynamicMockData, setDynamicMockData] = useState(null);

  // Global mute state (synced with voiceAlerts)
  const [globalMuted, setGlobalMuted] = useState(() => isMuted());

  // Market open/close voice announcements (now that globalMuted is initialized)
  useMarketAnnouncements(globalMuted);

  // Live/Test mode state
  const [isLiveMode, setIsLiveMode] = useState(() => {
    // Default to true (live mode) unless explicitly set to test mode
    return !MOCK_DATA_MODE;
  });

  // News state
  const [newsItems, setNewsItems] = useState([]);
  const [newsConnected, setNewsConnected] = useState(false);

  // Fetch historical data on mount (or use mock data) with cache-first strategy
  useEffect(() => {
    let isActive = true; // Prevent duplicate fetches in React StrictMode

    const fetchHistoricalData = async () => {
      if (!isActive) return; // Guard against double execution

      try {
        setLoading(true);
        setError(null);

        if (!isLiveMode || MOCK_DATA_MODE) {
          const mode = MOCK_DATA_MODE ? 'MOCK DATA MODE' : 'TEST MODE';
          console.log(`🎭 Using DYNAMIC MOCK DATA for ${mode}`);
          const dynamicData = createDynamicMockData(WATCHLIST);
          setDynamicMockData(dynamicData);
          setMergedPrices(dynamicData.initialData.prices);
          setMovingAverages(dynamicData.initialData.movingAverages);
          setOrb5mData(dynamicData.initialData.orb5mData);
          setVrsData(dynamicData.initialData.vrsData);
          // ... (rest of mock data generation)
          setLoading(false);
          return;
        }

        const cachedData = await loadCache(WATCHLIST);

        if (cachedData) {
          setHistoricalData(cachedData.historicalData || {});
          setMovingAverages(cachedData.movingAverages || {});
          setMergedPrices(cachedData.mergedPrices || {});
          setLoading(false); // Render the UI immediately with cached data
        } else {
          setLoading(true); // Show loading screen if no cache
        }

        console.log('[DataContext] Fetching latest data...');
        setLoadingProgress({ stage: 'Fetching market data', completed: 0, total: WATCHLIST.length });

        // Fetch WATCHLIST + QQQ for VRS benchmark
        const tickersWithBenchmark = [...WATCHLIST, VRS_CONFIG.BENCHMARK_SYMBOL];
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

  // Initialize news service and WebSocket connection
  useEffect(() => {
    // Clear previous news when switching modes
    setNewsItems([]);

    // Helper function to create real news service
    const createRealNewsService = () => {
      if (!isAPIConfigured()) {
        console.warn('API keys not configured. Using mock news service.');
        return createMockNewsService();
      }

      const apiKey = import.meta.env.VITE_ALPACA_API_KEY_ID;
      const secretKey = import.meta.env.VITE_ALPACA_SECRET_KEY;

      if (!apiKey || !secretKey) {
        console.warn('Alpaca API keys not found. Using mock news service.');
        return createMockNewsService();
      }

      console.log('📰 Creating real Alpaca news service');
      setNewsConnected(false);

      return createNewsService(
        apiKey,
        secretKey,
        (newsItem) => {
          const newsService = createNewsService(apiKey, secretKey);
          const filteredNews = newsService.filterNewsForWatchlist(newsItem, WATCHLIST);

          if (filteredNews) {
            setNewsItems(prev => {
              const updated = [filteredNews, ...prev.slice(0, 49)];
              return updated;
            });
          }
        }
      );
    };

    // Helper function to create mock news service
    const createMockNewsService = () => {
      console.log('🧪 Creating mock news service');
      setNewsConnected(true);

      // Simulate receiving mock news after 3 seconds
      const mockNewsTimeout = setTimeout(() => {
        const mockNews = [
          {
            id: 'mock-1',
            headline: 'AAPL Announces New iPhone Features',
            summary: 'Apple reveals groundbreaking new features for upcoming iPhone lineup, expected to boost sales significantly.',
            author: 'Tech Reporter',
            source: 'Reuters',
            url: 'https://example.com/news/aapl-iphone',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            symbols: ['AAPL'],
            mentionedSymbols: ['AAPL'],
            isRelevant: true,
            isRead: false,
            createdAt: Date.now()
          },
          {
            id: 'mock-2',
            headline: 'Federal Reserve Signals Rate Changes',
            summary: 'Fed officials indicate potential adjustments to monetary policy in response to current economic indicators.',
            author: 'Financial Analyst',
            source: 'Bloomberg',
            url: 'https://example.com/news/fed-rates',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            symbols: ['SPY', 'QQQ'],
            mentionedSymbols: ['SPY', 'QQQ'],
            isRelevant: true,
            isRead: false,
            createdAt: Date.now()
          },
          {
            id: 'mock-3',
            headline: 'Tech Earnings Beat Expectations',
            summary: 'Major technology companies report quarterly earnings exceeding analyst estimates, driving market optimism.',
            author: 'Market Correspondent',
            source: 'CNBC',
            url: 'https://example.com/news/tech-earnings',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            symbols: ['MSFT', 'GOOGL', 'META', 'AMZN'],
            mentionedSymbols: ['MSFT', 'GOOGL', 'META', 'AMZN'],
            isRelevant: true,
            isRead: false,
            createdAt: Date.now()
          }
        ];

        setNewsItems(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newNews = mockNews.filter(item => !existingIds.has(item.id));
          return [...newNews, ...prev];
        });
      }, 3000);

      return {
        disconnect: () => {
          clearTimeout(mockNewsTimeout);
        }
      };
    };

    const newsServiceInstance = isLiveMode
      ? createRealNewsService()
      : createMockNewsService();

    return () => {
      if (newsServiceInstance) {
        newsServiceInstance.disconnect();
      }
      setNewsConnected(false);
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
    if (!isLiveMode || MOCK_DATA_MODE) return; // Don't override mock data

    if (wsPrices && Object.keys(wsPrices).length > 0) {
      setMergedPrices(prev => ({
        ...prev,
        ...wsPrices
      }));
    }
  }, [wsPrices, isLiveMode]);

  // Supplement WebSocket with REST API polling (always fetch, regardless of market hours)
  useEffect(() => {
    if (!isLiveMode || MOCK_DATA_MODE) return; // Skip in test mode or mock mode
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
    // If WebSocket is already disconnected, start immediately for faster UX
    const initialDelay = connected ? 2000 : 500;
    timeoutId = setTimeout(pollQuotes, initialDelay);

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [marketOpen, isLiveMode, connected]);

  // Fetch 5m candles and calculate VRS (every 5 minutes during market hours)
  useEffect(() => {
    if (!isLiveMode || MOCK_DATA_MODE || !marketOpen) return;
    if (!isAPIConfigured()) return;

    let isActive = true;
    let intervalId = null;

    const fetch5mCandlesAndCalculateVRS = async () => {
      if (!isActive) return;

      try {
        console.log('[VRS] Fetching 5m candles for VRS calculation...');

        // Fetch today's 5m candles for all tickers + QQQ
        const tickersWithBenchmark = [...WATCHLIST, VRS_CONFIG.BENCHMARK_SYMBOL];
        const candles5m = await fetchTodayIntradayCandlesBatch(tickersWithBenchmark, '5Min');

        if (!isActive || !candles5m) return;

        // Get QQQ's current and previous 5m close
        const qqqCandles = candles5m[VRS_CONFIG.BENCHMARK_SYMBOL];
        if (!qqqCandles || !qqqCandles.c || qqqCandles.c.length < 2) {
          console.log('[VRS] Insufficient QQQ 5m candle data');
          return;
        }

        const qqqCurrentClose = qqqCandles.c[qqqCandles.c.length - 1];
        const qqqPreviousClose = qqqCandles.c[qqqCandles.c.length - 2];

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
          if (!tickerCandles || !tickerCandles.c || tickerCandles.c.length < 2) {
            return; // Skip if insufficient data
          }

          const stockCurrentClose = tickerCandles.c[tickerCandles.c.length - 1];
          const stockPreviousClose = tickerCandles.c[tickerCandles.c.length - 2];

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

          // Update VRS history
          setVrsHistory(prev => {
            const history = prev[ticker] || [];
            const newHistory = [...history, vrs].slice(-VRS_CONFIG.MAX_HISTORY_LENGTH);
            return { ...prev, [ticker]: newHistory };
          });

          // Calculate EMA (use updated history)
          const currentHistory = vrsHistory[ticker] || [];
          const updatedHistory = [...currentHistory, vrs].slice(-VRS_CONFIG.MAX_HISTORY_LENGTH);
          const vrsEma = calculateVRSEMA(updatedHistory, VRS_CONFIG.EMA_PERIOD);

          newVrsData[ticker] = {
            vrs5m: vrs,
            vrsEma12: vrsEma,
            timestamp: Date.now()
          };
        });

        // Update VRS data state
        setVrsData(newVrsData);
        console.log(`[VRS] Updated VRS for ${Object.keys(newVrsData).length} tickers`);

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
  }, [marketOpen, isLiveMode, qqqData.adr20, movingAverages, vrsHistory]);

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

      if (!shouldFetchORB && !shouldFetchRVol) {
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

          if (shouldFetchRVol) {
            rvolResults[ticker] = calculateRVol(todayCandles, historicalData);
          }

          if (shouldFetchORB) {
            const first5mCandle = todayCandles.length > 0 ? todayCandles[0] : null;
            const historicalFirst5mCandles = await RVolDB.getFirst5mCandles(ticker, 20);
            const tier = evaluate5mORB({ first5mCandle, historicalFirst5mCandles });

            orbData[ticker] = {
              candle: first5mCandle,
              historicalCandles: historicalFirst5mCandles,
              tier,
              source: 'alpaca',
              timestamp: Date.now(),
            };
          }
        }

        // Step 3: Update state
        if (isActive) {
          if (shouldFetchRVol) {
            setRVolData(rvolResults);
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

  // News functions
  const dismissNewsItem = (newsId) => {
    setNewsItems(prev => prev.map(item =>
      item.id === newsId ? { ...item, isRead: true } : item
    ));
  };

  const markNewsAsRead = (newsId) => {
    setNewsItems(prev => prev.map(item =>
      item.id === newsId ? { ...item, isRead: true } : item
    ));
  };

  const clearAllNews = () => {
    setNewsItems(prev => prev.map(item => ({ ...item, isRead: true })));
  };

  const getUnreadNewsCount = () => {
    return newsItems.filter(item => item.isRelevant && !item.isRead).length;
  };

  const getUnreadNewsCountForTicker = (ticker) => {
    return newsItems.filter(item =>
      item.isRelevant &&
      !item.isRead &&
      item.mentionedSymbols &&
      item.mentionedSymbols.includes(ticker)
    ).length;
  };

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
    newsItems,

    // Status
    connected: isLiveMode && !MOCK_DATA_MODE ? connected : true,
    newsConnected,
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
    toggleLiveMode,

    // News functions
    dismissNewsItem,
    markNewsAsRead,
    clearAllNews,
    getUnreadNewsCount,
    getUnreadNewsCountForTicker
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
