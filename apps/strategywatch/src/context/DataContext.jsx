import { createContext, useContext, useState, useEffect } from 'react';
import { WATCHLIST } from '../config/watchlist';
import { UPDATE_INTERVALS, DATA_MODE, MOCK_DATA_MODE } from '../config/constants';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import { useMarketHours } from '../hooks/useMarketHours';
import { useMarketAnnouncements } from '../hooks/useMarketAnnouncements';
import { fetchDailyCandlesBatch, fetchQuoteBatch, fetchHistorical5mCandlesForRVol, fetchTodayIntradayCandles, isAPIConfigured } from '../services/marketData';
import { getMovingAverages, calculateADRPercent, evaluate5mORB } from '../services/calculations';
import { isORBActive } from '../utils/marketTime';
import { generateMockData, createDynamicMockData } from '../services/mockData';
import { calculateRVol, isMarketHours } from '../utils/rvolCalculations';
import * as RVolDB from '../services/rvolDatabase';
import { isMuted } from '../utils/voiceAlerts';
import { createNewsService } from '../services/newsService';

const DataContext = createContext(null);

/**
 * DataProvider Component
 * Manages all application state and data fetching
 */
export function DataProvider({ children }) {
  // Market hours tracking
  const { marketOpen, currentTime, marketStatus } = useMarketHours();

  // WebSocket connection for real-time prices (only when not in mock mode)
  const { prices: wsPrices, connected, error: wsError } = useRealtimePrice(
    MOCK_DATA_MODE ? [] : WATCHLIST
  );

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

  // RVol data (Map of ticker -> {rvol, currentCumulative, avgCumulative, error})
  const [rvolData, setRVolData] = useState({});

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
  const [newsService, setNewsService] = useState(null);
  const [newsConnected, setNewsConnected] = useState(false);

  // Fetch historical data on mount (or use mock data)
  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use mock data if in test mode or mock mode enabled
        if (!isLiveMode || MOCK_DATA_MODE) {
          const mode = MOCK_DATA_MODE ? 'MOCK DATA MODE' : 'TEST MODE';
          console.log(`🎭 Using DYNAMIC MOCK DATA for ${mode}`);
          const dynamicData = createDynamicMockData(WATCHLIST);
          setDynamicMockData(dynamicData);
          setMergedPrices(dynamicData.initialData.prices);
          setMovingAverages(dynamicData.initialData.movingAverages);
          setOrb5mData(dynamicData.initialData.orb5mData);

          // Generate mock RVol data
          const mockRVolData = {};
          WATCHLIST.forEach(ticker => {
            const mockRVol = 0.5 + Math.random() * 3; // Random RVol between 0.5x and 3.5x
            mockRVolData[ticker] = {
              rvol: mockRVol,
              currentCumulative: Math.floor(Math.random() * 10000000), // Mock volume
              avgCumulative: Math.floor(Math.random() * 8000000),
              minutesSinceOpen: 60,
              dataPoints: 20,
              error: null
            };
          });
          setRVolData(mockRVolData);

          setLoading(false);
          return;
        }

        // Clear mock data when switching to LIVE mode
        console.log('🔄 Clearing mock data and fetching real data for LIVE mode');
        setDynamicMockData(null);
        // Clear mock data from state to prevent interference
        setMergedPrices({});
        setRVolData({});
        setOrb5mData({});

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

    if (MOCK_DATA_MODE || (!isLiveMode) || isAPIConfigured()) {
      fetchHistoricalData();
    } else {
      setError('API keys not configured. Please set VITE_ALPACA_API_KEY_ID and VITE_ALPACA_SECRET_KEY in .env file');
      setLoading(false);
    }
  }, [isLiveMode]);

  // Initialize news service and WebSocket connection
  useEffect(() => {
    // Clear previous news when switching modes
    setNewsItems([]);

    const newsServiceInstance = isLiveMode
      ? createRealNewsService()
      : createMockNewsService();

    setNewsService(newsServiceInstance);

    return () => {
      if (newsServiceInstance) {
        newsServiceInstance.disconnect();
      }
      setNewsService(null);
      setNewsConnected(false);
    };
  }, [isLiveMode]);

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
          symbols: ['AAPL']
        },
        {
          id: 'mock-2',
          headline: 'TSLA Expands Gigafactory Operations',
          summary: 'Tesla announces expansion plans for Texas gigafactory, increasing production capacity by 50%.',
          author: 'Auto Analyst',
          source: 'Bloomberg',
          url: 'https://example.com/news/tsla-gigafactory',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          symbols: ['TSLA']
        },
        {
          id: 'mock-3',
          headline: 'NVDA Reports Strong Q3 Earnings',
          summary: 'NVIDIA exceeds expectations with record quarterly revenue driven by AI chip demand.',
          author: 'Market Watch',
          source: 'CNBC',
          url: 'https://example.com/news/nvda-earnings',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          symbols: ['NVDA']
        }
      ];

      mockNews.forEach((newsItem, index) => {
        setTimeout(() => {
          console.log('🧪 Simulating news item:', newsItem.headline);

          const mentionedSymbols = newsItem.symbols.filter(symbol =>
            WATCHLIST.includes(symbol)
          );

          if (mentionedSymbols.length > 0) {
            const filteredNews = {
              ...newsItem,
              relevanceScore: 1,
              mentionedSymbols,
              isRelevant: true
            };

            setNewsItems(prev => {
              const updated = [filteredNews, ...prev.slice(0, 49)];
              return updated;
            });
          }
        }, index * 2000); // Send each news item 2 seconds apart
      });
    }, 3000); // Start after 3 seconds

    return {
      disconnect: () => {
        clearTimeout(mockNewsTimeout);
        console.log('🧪 Mock news service disconnected');
      },
      getConnectionStatus: () => ({ isConnected: true, reconnectAttempts: 0 }),
      filterNewsForWatchlist: (newsItem, watchlistSymbols) => {
        const mentionedSymbols = newsItem.symbols.filter(symbol =>
          watchlistSymbols.includes(symbol)
        );

        if (mentionedSymbols.length === 0) {
          return null;
        }

        return {
          ...newsItem,
          relevanceScore: 1,
          mentionedSymbols,
          isRelevant: true
        };
      }
    };
  };

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
  }, [MOCK_DATA_MODE, isLiveMode, dynamicMockData]);

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
  }, [marketOpen, isLiveMode]);

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

      // Only fetch during market hours or when ORB is active
      const shouldFetchORB = isORBActive();
      const shouldFetchRVol = isMarketHours();

      if (!shouldFetchORB && !shouldFetchRVol) {
        // Check again in 1 minute
        timeoutId = setTimeout(fetchUnifiedMarketData, 60000);
        return;
      }

      try {
        const rvolResults = {};
        const orbData = {};

        // Process all tickers in a single unified loop
        for (const ticker of WATCHLIST) {
          try {
            // === STEP 1: Get historical data from IndexedDB ===
            let historicalData = await RVolDB.getRecentCandles(ticker, 20);

            // If insufficient data in DB, fetch from API and store
            if (historicalData.length < 10) {
              console.log(`Fetching historical 5m candles for ${ticker} from API...`);
              const fetchedHistorical = await fetchHistorical5mCandlesForRVol(ticker, 20);

              // Store in IndexedDB for future use
              for (const dayData of fetchedHistorical) {
                await RVolDB.storeCandles(ticker, dayData.date, dayData.candles);
              }

              historicalData = fetchedHistorical;
              console.log(`Stored ${fetchedHistorical.length} days of data for ${ticker}`);
            }

            // === STEP 2: Fetch today's intraday candles (shared by both RVol and ORB) ===
            const todayCandles = await fetchTodayIntradayCandles(ticker);

            // === STEP 3: Calculate RVol (if market hours) ===
            if (shouldFetchRVol) {
              const rvolResult = calculateRVol(todayCandles, historicalData);
              rvolResults[ticker] = rvolResult;
            }

            // === STEP 4: Calculate ORB (if ORB is active) ===
            if (shouldFetchORB) {
              // Extract first 5m candle from today's data
              const first5mCandle = todayCandles && todayCandles.length > 0 ? todayCandles[0] : null;

              // Extract first 5m candles from historical data using our new helper
              const historicalFirst5mCandles = await RVolDB.getFirst5mCandles(ticker, 20);

              // Calculate tier
              const tier = evaluate5mORB({
                first5mCandle,
                historicalFirst5mCandles: historicalFirst5mCandles
              });

              orbData[ticker] = {
                candle: first5mCandle,
                historicalCandles: historicalFirst5mCandles,
                tier
              };
            }
          } catch (err) {
            console.error(`Error processing market data for ${ticker}:`, err);

            // Set error states
            if (shouldFetchRVol) {
              rvolResults[ticker] = {
                rvol: null,
                currentCumulative: 0,
                avgCumulative: 0,
                minutesSinceOpen: 0,
                dataPoints: 0,
                error: err.message
              };
            }

            if (shouldFetchORB) {
              orbData[ticker] = {
                candle: null,
                historicalCandles: [],
                tier: null
              };
            }
          }
        }

        // Update state
        if (isActive) {
          if (shouldFetchRVol && Object.keys(rvolResults).length > 0) {
            setRVolData(rvolResults);
            console.log('RVol data updated for all tickers');
          }

          if (shouldFetchORB && Object.keys(orbData).length > 0) {
            setOrb5mData(orbData);
            console.log('ORB data updated for all tickers');
          }
        }

        // Cleanup old data (remove candles older than 20 days)
        await RVolDB.cleanupAllTickers(WATCHLIST);
      } catch (error) {
        console.error('Error fetching unified market data:', error);
      }

      // Refresh every 5 minutes during market hours
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
    newsItems,

    // Status
    connected: isLiveMode && !MOCK_DATA_MODE ? connected : true,
    newsConnected,
    marketOpen,
    currentTime,
    marketStatus,
    loading,
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

export default DataContext;
