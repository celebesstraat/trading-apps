
import React, { createContext, useState, useEffect, useRef, useContext, ReactNode } from 'react';
import { WATCHLIST } from '../config/watchlist';
import { UPDATE_INTERVALS, DATA_MODE, VRS_CONFIG, MOCK_DATA_MODE } from '../config/constants';
import { useMarketHours } from '../hooks/useMarketHours';
import { useMarketAnnouncements } from '../hooks/useMarketAnnouncements';
import { fetchDailyCandlesBatch, fetchQuoteBatch, fetchHistorical5mCandlesForRVol, fetchTodayIntradayCandlesBatch, isAPIConfigured } from '../services/marketData';
import { getMovingAverages, calculateADRPercent, evaluate5mORB, calculateVRS5m, calculateAvgFirst5mVolume } from '../services/calculations';
import { isORBActive } from '../utils/marketTime';
import { calculateRVol, isMarketHours } from '../utils/rvolCalculations';
import * as RVolDB from '../services/rvolDatabase';
import { isMuted } from '../utils/voiceAlerts';
import { loadCache, saveCache } from '../services/startupCache';
import { createDataIngestionEngine } from '../services/dataIngestionEngine.js';
import { TickerData, PriceData, FinnhubCandles, MovingAverages, ORBData, RVolResult, VRSResult, MarketStatus, LoadingProgress, CacheData } from '../types/types';

export interface DataContextType {
  tickers: string[];
  prices: Record<string, PriceData>;
  historicalData: Record<string, FinnhubCandles>;
  movingAverages: Record<string, MovingAverages>;
  orb5mData: Record<string, ORBData>;
  rvolData: Record<string, RVolResult>;
  vrsData: Record<string, VRSResult>;
  realtimeIndicators: Record<string, any>;
  connected: boolean;
  marketOpen: boolean;
  currentTime: string;
  marketStatus: MarketStatus;
  isHoliday: boolean;
  isWeekend: boolean;
  isLoading: boolean;
  loading: boolean;
  loadingProgress: LoadingProgress;
  error: string | null;
  lastUpdate: number | null;
  apiConfigured: boolean;
  isLiveMode: boolean;
  globalMuted: boolean;
  setGlobalMuted: (muted: boolean) => void;
  toggleLiveMode: () => void;
  rsEngineData?: any;
}

export const DataContext = createContext<DataContextType | null>(null);

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const { marketOpen, currentTime, marketStatus, isHoliday, isWeekend, isLoading: isCalendarLoading } = useMarketHours();

  const [dataEngine, setDataEngine] = useState<any>(null);

  const wsPrices = {};
  const connected = dataEngine?.websocketConnected || false;
  const wsError = dataEngine?.websocketError || null;

  const [historicalData, setHistoricalData] = useState<Record<string, any>>({});
  const [movingAverages, setMovingAverages] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({ stage: '', completed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const [mergedPrices, setMergedPrices] = useState<Record<string, any>>({});

  const [orb5mData, setOrb5mData] = useState<Record<string, any>>({});

  const [rvolData, setRVolData] = useState<Record<string, any>>({});

  const [vrsData, setVrsData] = useState<Record<string, any>>({});

  const [realtimeIndicators, setRealtimeIndicators] = useState<Record<string, any>>({});

  const [qqqData, setQqqData] = useState<any>({
    historicalCandles: null,
    adr20: null,
    current1mClose: null,
    previous1mClose: null,
    current5mClose: null,
    previous5mClose: null,
    current15mClose: null,
    previous15mClose: null
  });

  const [globalMuted, setGlobalMuted] = useState(() => isMuted());

  const lastWsPricesRef = useRef<Record<string, any>>({});
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useMarketAnnouncements(globalMuted);

  const [isLiveMode, setIsLiveMode] = useState(() => {
    return true;
  });

  useEffect(() => {
    if (!isLiveMode || MOCK_DATA_MODE) return;

    const initializeRealTimeEngine = async () => {
      try {
        console.log('[DataContext] 🚀 Initializing REAL-TIME ACCURATE data engine...');

        const engine = createDataIngestionEngine(WATCHLIST);
        await engine.start();

        setDataEngine(engine);
        console.log('[DataContext] ✅ Data engine started successfully');

        WATCHLIST.forEach(symbol => {
          engine.subscribeToRealTimeCalculations(symbol, (update: any) => {
            if (update.type === 'indicators') {
              setRealtimeIndicators((prev: Record<string, any>) => ({
                ...prev,
                [symbol]: update.data
              }));

              // 🔥 FIX: Only update VRS timeframes that have new data, preserve existing values
              if (update.data.calculations.vrs1m || update.data.calculations.vrs5m || update.data.calculations.vrs15m) {
                setVrsData((prev: Record<string, any>) => {
                  const existing = prev[symbol] || {};
                  return {
                    ...prev,
                    [symbol]: {
                      // Preserve existing values, only update if new value provided
                      vrs1m: update.data.calculations.vrs1m !== undefined
                        ? update.data.calculations.vrs1m
                        : existing.vrs1m,
                      vrs5m: update.data.calculations.vrs5m !== undefined
                        ? update.data.calculations.vrs5m
                        : existing.vrs5m,
                      vrs15m: update.data.calculations.vrs15m !== undefined
                        ? update.data.calculations.vrs15m
                        : existing.vrs15m,
                      timestamp: update.data.timestamp
                    }
                  };
                });
              }
            }
          });
        });

        console.log('[DataContext] 🔥 Subscribed to REAL-TIME calculations for all tickers');

      } catch (error: any) {
        console.error('[DataContext] ❌ Failed to initialize real-time engine:', error);
      }
    };

    initializeRealTimeEngine();

  }, [isLiveMode]);

  useEffect(() => {
    let isActive = true;

    const fetchHistoricalData = async () => {
      if (!isActive) return;

      console.log('[DataContext] 🔄 FORCING FRESH DATA FETCH (Market Hours Debug)');

      try {
        setLoading(true);
        setError(null);

        console.log(`[DEBUG] Market Status Check: isLiveMode=${isLiveMode}, MOCK_DATA_MODE=${MOCK_DATA_MODE}`);
        if (!isLiveMode) {
          console.log(`[DEBUG] Not in live mode - skipping data fetch`);
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
          setRVolData(cachedData.rvolData || {});
          setLoading(false);
        } else {
          setLoading(true);
        }

        console.log('[DataContext] Fetching latest data...');
        setLoadingProgress({ stage: 'Fetching market data', completed: 0, total: WATCHLIST.length });

        const tickersWithBenchmark = WATCHLIST.includes(VRS_CONFIG.BENCHMARK_SYMBOL)
          ? WATCHLIST
          : [...WATCHLIST, VRS_CONFIG.BENCHMARK_SYMBOL];
        const [candlesData, quotesData] = await Promise.all([
          fetchDailyCandlesBatch(tickersWithBenchmark),
          fetchQuoteBatch(tickersWithBenchmark)
        ]);

        if (!isActive) return;

        const missingCandles = WATCHLIST.filter(t => !candlesData[t]);
        const missingQuotes = WATCHLIST.filter(t => !quotesData[t]);

        if (missingCandles.length > 0) {
          console.warn(`[DataContext] ⚠️ Missing candles: ${missingCandles.join(', ')}`);
        }
        if (missingQuotes.length > 0) {
          console.warn(`[DataContext] ⚠️ Missing quotes: ${missingQuotes.join(', ')}`);
        }

        if (!isActive) return;

        setLoadingProgress({ stage: 'Calculating indicators', completed: 0, total: Object.keys(candlesData).length });
        const mas: Record<string, any> = {};
        let processedCount = 0;

        const qqqCandles = candlesData[VRS_CONFIG.BENCHMARK_SYMBOL];
        if (qqqCandles && qqqCandles.c) {
          const qqqAdr = calculateADRPercent(qqqCandles, VRS_CONFIG.ADR_PERIOD);
          setQqqData((prev: any) => ({
            ...prev,
            historicalCandles: qqqCandles,
            adr20: qqqAdr ? qqqAdr / 100 : null
          }));
          console.log(`[DataContext] QQQ ADR%: ${qqqAdr?.toFixed(2)}%`);
        }

        Object.entries(candlesData).forEach(([ticker, candles]) => {
          if (candles && (candles as any).c) {
            const adr = calculateADRPercent(candles as any, 20);
            mas[ticker] = {
              ...getMovingAverages(candles as any),
              adr20: adr,
              adr20Decimal: adr ? adr / 100 : null
            };
          }
          processedCount++;
          setLoadingProgress({
            stage: 'Calculating indicators',
            completed: processedCount,
            total: Object.keys(candlesData).length
          });
        });

        const freshQuotes: Record<string, any> = {};
        Object.entries(quotesData).forEach(([ticker, quote]) => {
          freshQuotes[ticker] = {
            price: (quote as any).price,
            previousClose: (quote as any).previousClose,
            open: (quote as any).open,
            high: (quote as any).high,
            low: (quote as any).low,
            timestamp: (quote as any).timestamp || Date.now()
          };
        });

        if (!isActive) return;

        const newHistoricalData = { ...historicalData, ...candlesData };
        const newMovingAverages = { ...movingAverages, ...mas };
        const newMergedPrices = { ...mergedPrices, ...freshQuotes };


        setHistoricalData(newHistoricalData);
        setMovingAverages(newMovingAverages);
        setMergedPrices(newMergedPrices);

        setLoadingProgress({ stage: 'Complete', completed: WATCHLIST.length, total: WATCHLIST.length });
        console.log(`[DataContext] ✅ Data loaded: ${Object.keys(mas).length} MAs, ${Object.keys(quotesData).length} quotes`);

        const dataToCache: CacheData = {
          historicalData: newHistoricalData,
          movingAverages: newMovingAverages,
          mergedPrices: newMergedPrices,
        };
        await saveCache(dataToCache);

      } catch (err: any) {
        console.error('Error fetching historical data:', err);
        setError('Failed to load historical data: ' + err.message);
        setLoadingProgress({ stage: 'Error', completed: 0, total: 0 });
      } finally {
        setLoading(false);
      }
    };

    if ((!isLiveMode) || isAPIConfigured()) {
      fetchHistoricalData();
    } else {
      setError('API keys not configured. Please set VITE_ALPACA_API_KEY_ID and VITE_ALPACA_SECRET_KEY in .env file');
      setLoading(false);
    }

    return () => {
      isActive = false;
    };
  }, [isLiveMode]);


  useEffect(() => {
    if (!isLiveMode) return;
    if (!wsPrices || Object.keys(wsPrices).length === 0) return;

    const validWsPrices: Record<string, any> = {};
    let hasValidData = false;

    Object.entries(wsPrices).forEach(([ticker, data]) => {
      if (data && typeof (data as any).price === 'number' && !isNaN((data as any).price)) {
        validWsPrices[ticker] = data;
        hasValidData = true;
      }
    });

    if (!hasValidData) {
      return;
    }

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

    if (!hasNewData) {
      return;
    }

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      Object.entries(validWsPrices).forEach(([ticker, data]) => {
        lastWsPricesRef.current[ticker] = data;
      });

      setMergedPrices(prev => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.entries(validWsPrices).forEach(([ticker, newData]) => {
          const currentData = prev[ticker];

          if (!currentData || currentData.price !== (newData as any).price) {
            updated[ticker] = {
              ...currentData,
              price: (newData as any).price,
              timestamp: (newData as any).timestamp,
              ...((newData as any).volume !== undefined && { volume: (newData as any).volume }),
              ...((newData as any).receivedAt !== undefined && { receivedAt: (newData as any).receivedAt }),
              ...((newData as any).delay !== undefined && { delay: (newData as any).delay }),
              ...((newData as any).type !== undefined && { type: (newData as any).type }),
              ...((newData as any).exchange !== undefined && { exchange: (newData as any).exchange }),
              ...((newData as any).conditions !== undefined && { conditions: (newData as any).conditions }),
              ...((newData as any).vwap !== undefined && { vwap: (newData as any).vwap }),
              ...((newData as any).tradeCount !== undefined && { tradeCount: (newData as any).tradeCount }),
            };
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 100);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [wsPrices, isLiveMode]);

  useEffect(() => {
    if (!isLiveMode) return;
    if (!isAPIConfigured()) {
      return;
    }

    const isWebSocketFallback = typeof window !== 'undefined' && (window as any).websocketFallback;

    const getPollingInterval = () => {
      if (isWebSocketFallback) {
        return 5000;
      }
      return 30000;
    };

    let isActive = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const pollQuotes = async () => {
      if (!isActive) return;

      try {
        const quotes = await fetchQuoteBatch(WATCHLIST);

        if (!isActive) return;


        setMergedPrices(prev => {
          const updated = { ...prev };
          let hasChanges = false;

          Object.entries(quotes).forEach(([ticker, quoteData]) => {
            const existingData = prev[ticker];
            const existingAge = existingData?.timestamp ? Date.now() - existingData.timestamp : Infinity;

            const shouldUpdate =
              DATA_MODE === 'rest' ||
              existingAge > 10000 ||
              !existingData ||
              !connected;

            if (shouldUpdate) {
              const shouldPreserveWSPrice = connected && existingData?.receivedAt &&
                (Date.now() - existingData.receivedAt) < 5000;

              updated[ticker] = {
                ...(quoteData as any),
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

          return hasChanges ? updated : prev;
        });

        setLastUpdate(Date.now());
      } catch (error: any) {
        if (error.message.includes('429')) {
          if (isActive) {
            timeoutId = setTimeout(pollQuotes, 60000);
          }
          return;
        }
        console.error('REST polling error:', error);
      }

      if (isActive) {
        let pollingInterval = getPollingInterval();

        if (!marketOpen) {
          pollingInterval *= 4;
        }

        timeoutId = setTimeout(pollQuotes, pollingInterval);
      }
    };

    const initialDelay = (connected && !isWebSocketFallback) ? 2000 : 500;
    timeoutId = setTimeout(pollQuotes, initialDelay);

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [marketOpen, isLiveMode, connected]);

  useEffect(() => {
    if (!isLiveMode || !marketOpen) {
      return;
    }
    if (!isAPIConfigured()) {
      return;
    }

    let isActive = true;
    let intervalId: NodeJS.Timeout | null = null;

    const fetch5mCandlesAndCalculateVRS = async () => {
      if (!isActive) return;

      try {
        const tickersWithBenchmark = WATCHLIST.includes(VRS_CONFIG.BENCHMARK_SYMBOL)
          ? WATCHLIST
          : [...WATCHLIST, VRS_CONFIG.BENCHMARK_SYMBOL];
        const candles5m = await fetchTodayIntradayCandlesBatch(tickersWithBenchmark, '5Min');

        if (!isActive || !candles5m) return;

        const qqqCandles = candles5m[VRS_CONFIG.BENCHMARK_SYMBOL];
        if (!qqqCandles || !Array.isArray(qqqCandles) || qqqCandles.length < 2) {
          return;
        }

        const qqqCurrentClose = (qqqCandles[qqqCandles.length - 1] as any).close;
        const qqqPreviousClose = (qqqCandles[qqqCandles.length - 2] as any).close;

        setQqqData((prev: any) => ({
          ...prev,
          current5mClose: qqqCurrentClose,
          previous5mClose: qqqPreviousClose
        }));

        const newVrsData: Record<string, any> = {};

        WATCHLIST.forEach(ticker => {
          const tickerCandles = candles5m[ticker];
          if (!tickerCandles || !Array.isArray(tickerCandles) || tickerCandles.length < 2) {
            return;
          }

          const stockCurrentClose = (tickerCandles[tickerCandles.length - 1] as any).close;
          const stockPreviousClose = (tickerCandles[tickerCandles.length - 2] as any).close;

          const stockADR = movingAverages[ticker]?.adr20Decimal;
          const qqqADR = qqqData.adr20;

          if (!stockADR || !qqqADR) {
            return;
          }

          const vrs = calculateVRS5m({
            stockCurrentClose,
            stockPreviousClose,
            stockADRPercent: stockADR,
            benchmarkCurrentClose: qqqCurrentClose,
            benchmarkPreviousClose: qqqPreviousClose,
            benchmarkADRPercent: qqqADR
          });

          if (vrs === null) {
            return;
          }

          newVrsData[ticker] = {
            vrs5m: vrs,
            timestamp: Date.now()
          };
        });

        setVrsData(newVrsData);

      } catch (error) {
        console.error('[VRS] Error fetching 5m candles:', error);
      }

      if (isActive) {
        intervalId = setTimeout(fetch5mCandlesAndCalculateVRS, 5 * 60 * 1000);
      }
    };

    intervalId = setTimeout(fetch5mCandlesAndCalculateVRS, 10000);

    return () => {
      isActive = false;
      if (intervalId) clearTimeout(intervalId);
    };
  }, [marketOpen, isLiveMode, qqqData.adr20, movingAverages]);

  useEffect(() => {
    if (!isLiveMode || !marketOpen) {
      return;
    }
    if (!isAPIConfigured()) {
      return;
    }

    let isActive = true;
    let intervalId: NodeJS.Timeout | null = null;

    const fetch1mCandlesAndCalculateVRS = async () => {
      if (!isActive) return;

      try {
        const tickersWithBenchmark = WATCHLIST.includes(VRS_CONFIG.BENCHMARK_SYMBOL)
          ? WATCHLIST
          : [...WATCHLIST, VRS_CONFIG.BENCHMARK_SYMBOL];
        const candles1m = await fetchTodayIntradayCandlesBatch(tickersWithBenchmark, '1Min');

        if (!isActive || !candles1m) return;

        const qqqCandles = candles1m[VRS_CONFIG.BENCHMARK_SYMBOL];
        if (!qqqCandles || !Array.isArray(qqqCandles) || qqqCandles.length < 2) {
          return;
        }

        const qqqCurrentClose = (qqqCandles[qqqCandles.length - 1] as any).close;
        const qqqPreviousClose = (qqqCandles[qqqCandles.length - 2] as any).close;

        setQqqData((prev: any) => ({
          ...prev,
          current1mClose: qqqCurrentClose,
          previous1mClose: qqqPreviousClose
        }));

        setVrsData(prevVrsData => {
          const updatedVrsData = { ...prevVrsData };

          WATCHLIST.forEach(ticker => {
            const tickerCandles = candles1m[ticker];
            if (!tickerCandles || !Array.isArray(tickerCandles) || tickerCandles.length < 2) {
              return;
            }

            const stockCurrentClose = (tickerCandles[tickerCandles.length - 1] as any).close;
            const stockPreviousClose = (tickerCandles[tickerCandles.length - 2] as any).close;

            const stockADR = movingAverages[ticker]?.adr20Decimal;
            const qqqADR = qqqData.adr20;

            if (!stockADR || !qqqADR) {
              return;
            }

            const vrs1m = calculateVRS5m({
              stockCurrentClose,
              stockPreviousClose,
              stockADRPercent: stockADR,
              benchmarkCurrentClose: qqqCurrentClose,
              benchmarkPreviousClose: qqqPreviousClose,
              benchmarkADRPercent: qqqADR
            });

            if (vrs1m === null) {
              return;
            }

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

      if (isActive) {
        intervalId = setTimeout(fetch1mCandlesAndCalculateVRS, 1 * 60 * 1000);
      }
    };

    intervalId = setTimeout(fetch1mCandlesAndCalculateVRS, 15000);

    return () => {
      isActive = false;
      if (intervalId) clearTimeout(intervalId);
    };
  }, [marketOpen, isLiveMode, qqqData.adr20, movingAverages]);

  useEffect(() => {
    if (!isLiveMode || !marketOpen) {
      return;
    }
    if (!isAPIConfigured()) {
      return;
    }

    let isActive = true;
    let intervalId: NodeJS.Timeout | null = null;

    const fetch15mCandlesAndCalculateVRS = async () => {
      if (!isActive) return;

      try {
        const tickersWithBenchmark = WATCHLIST.includes(VRS_CONFIG.BENCHMARK_SYMBOL)
          ? WATCHLIST
          : [...WATCHLIST, VRS_CONFIG.BENCHMARK_SYMBOL];
        const candles15m = await fetchTodayIntradayCandlesBatch(tickersWithBenchmark, '15Min');

        if (!isActive || !candles15m) return;

        const qqqCandles = candles15m[VRS_CONFIG.BENCHMARK_SYMBOL];
        if (!qqqCandles || !Array.isArray(qqqCandles) || qqqCandles.length < 2) {
          return;
        }

        const qqqCurrentClose = (qqqCandles[qqqCandles.length - 1] as any).close;
        const qqqPreviousClose = (qqqCandles[qqqCandles.length - 2] as any).close;

        setQqqData((prev: any) => ({
          ...prev,
          current15mClose: qqqCurrentClose,
          previous15mClose: qqqPreviousClose
        }));

        setVrsData(prevVrsData => {
          const updatedVrsData = { ...prevVrsData };

          WATCHLIST.forEach(ticker => {
            const tickerCandles = candles15m[ticker];
            if (!tickerCandles || !Array.isArray(tickerCandles) || tickerCandles.length < 2) {
              return;
            }

            const stockCurrentClose = (tickerCandles[tickerCandles.length - 1] as any).close;
            const stockPreviousClose = (tickerCandles[tickerCandles.length - 2] as any).close;

            const stockADR = movingAverages[ticker]?.adr20Decimal;
            const qqqADR = qqqData.adr20;

            if (!stockADR || !qqqADR) {
              return;
            }

            const vrs15m = calculateVRS5m({
              stockCurrentClose,
              stockPreviousClose,
              stockADRPercent: stockADR,
              benchmarkCurrentClose: qqqCurrentClose,
              benchmarkPreviousClose: qqqPreviousClose,
              benchmarkADRPercent: qqqADR
            });

            if (vrs15m === null) {
              return;
            }

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

      if (isActive) {
        intervalId = setTimeout(fetch15mCandlesAndCalculateVRS, 15 * 60 * 1000);
      }
    };

    intervalId = setTimeout(fetch15mCandlesAndCalculateVRS, 20000);

    return () => {
      isActive = false;
      if (intervalId) clearTimeout(intervalId);
    };
  }, [marketOpen, isLiveMode, qqqData.adr20, movingAverages]);

  useEffect(() => {
    if (mergedPrices && Object.keys(mergedPrices).length > 0) {
      setLastUpdate(Date.now());
    }
  }, [mergedPrices]);

  useEffect(() => {
    if (!isLiveMode) return;
    if (!isAPIConfigured()) {
      return;
    }

    let isActive = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const fetchUnifiedMarketData = async () => {
      if (!isActive) return;

      const shouldFetchORB = await isORBActive();
      const shouldFetchRVol = isMarketHours();

      const shouldLoadCachedRVol = Object.keys(rvolData).length === 0;

      if (!shouldFetchORB && !shouldFetchRVol && !shouldLoadCachedRVol) {
        timeoutId = setTimeout(fetchUnifiedMarketData, 60000);
        return;
      }

      try {
        const [todayCandlesBatch] = await Promise.all([
          fetchTodayIntradayCandlesBatch(WATCHLIST),
        ]);

        const rvolResults: Record<string, any> = {};
        const orbData: Record<string, any> = {};

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
            const first5mCandle = todayCandles.find((candle: any) => {
              const candleTime = new Date(candle.timestamp);
              const etHour = parseInt(candleTime.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }));
              const etMinute = parseInt(candleTime.toLocaleString('en-US', { timeZone: 'America/New_York', minute: '2-digit' }));

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

        if (isActive) {
          if (shouldFetchRVol || shouldLoadCachedRVol) {
            setRVolData(rvolResults);
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

    timeoutId = setTimeout(fetchUnifiedMarketData, 4000);

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [marketOpen, isLiveMode]);

  const toggleLiveMode = () => {
    setIsLiveMode(prev => !prev);
  };

  const value: DataContextType = {
    tickers: WATCHLIST,
    prices: mergedPrices,
    historicalData,
    movingAverages,
    orb5mData,
    rvolData,
    vrsData,
    realtimeIndicators,
    connected: isLiveMode ? connected : true,
    marketOpen,
    currentTime,
    marketStatus,
    isHoliday,
    isWeekend,
    isLoading: loading || isCalendarLoading,
    loading,
    loadingProgress,
    error: isLiveMode ? (error || wsError) : null,
    lastUpdate,
    apiConfigured: isAPIConfigured(),
    isLiveMode,
    globalMuted,
    setGlobalMuted,
    toggleLiveMode
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
