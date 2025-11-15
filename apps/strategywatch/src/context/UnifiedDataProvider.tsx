
import React, { createContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { WATCHLIST } from '../config/watchlist';
import { createDataIngestionEngine } from '../services/dataIngestionEngine';
import { getQueryOptimizer, executeOptimizedQuery } from '../services/queryOptimizer';
import { executeMigration } from '../services/dataMigration';
import { getMetadata, setMetadata, clearDataLake } from '../services/dataLake';
import { isMarketHours } from '../utils/rvolCalculations';
import { isMuted } from '../utils/voiceAlerts';
import { TickerData, MarketStatus, QuoteData, StrategyScore } from '../types/types';

interface UnifiedDataContextType {
  tickers: string[];
  data: Record<string, TickerData>;
  newsItems: any[]; // You should define a proper type for news items
  isConnected: boolean;
  newsConnected: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  engineStatus: string;
  marketOpen: boolean;
  marketStatus: MarketStatus | 'unknown';
  lastUpdate: number | null;
  error: string | null;
  migrationStatus: string | null;
  refreshSymbols: (symbols?: string[]) => Promise<void>;
  resetAllData: () => Promise<void>;
  getSymbolData: (symbol: string) => TickerData | null;
  getQuotes: (symbols: string[]) => Promise<Record<string, QuoteData>>;
  getIndicators: (symbol: string) => Promise<any>; // Define a proper type for indicators
  getStrategyResults: (symbol: string, strategy: string) => Promise<StrategyScore | null>;
  globalMuted: boolean;
  setGlobalMuted: (muted: boolean) => void;
  toggleGlobalMuted: () => void;
  getPerformanceStats: () => any; // Define a proper type for performance stats
}

export const UnifiedDataContext = createContext<UnifiedDataContextType | null>(null);

interface UnifiedDataProviderProps {
  children: ReactNode;
}

export function UnifiedDataProvider({ children }: UnifiedDataProviderProps) {
  const [engine] = useState(() => createDataIngestionEngine(WATCHLIST));
  const [optimizer] = useState(() => getQueryOptimizer());

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [engineStatus, setEngineStatus] = useState('stopped');

  const [data, setData] = useState<Record<string, TickerData>>({});

  const [marketOpen, setMarketOpen] = useState(false);
  const [marketStatus, setMarketStatus] = useState<any>('unknown');

  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [newsConnected, setNewsConnected] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [globalMuted, setGlobalMuted] = useState(() => isMuted());

  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  const checkMigrationNeeded = async () => {
    try {
      const migrationMetadata = await getMetadata('unified_provider_migration');
      if (migrationMetadata?.completed) {
        return false;
      }

      const stats = await getMetadata('migration_results');
      const hasOldData = stats && stats.status === 'completed';

      return hasOldData;
    } catch (error) {
      console.error('[UnifiedProvider] Error checking migration status:', error);
      return false;
    }
  };


  const initializeDataEngine = async () => {
    console.log('[UnifiedProvider] 🔄 Initializing data engine...');

    engine.on('status', (statusData: any) => {
      console.log('[UnifiedProvider] Engine status:', statusData);
      setEngineStatus(statusData.status);
      setIsConnected(statusData.status === 'running' || statusData.status === 'connected');

      if (statusData.status === 'loaded') {
        setData(statusData.data || {});
      }
    });

    engine.on('ticks', (tickData: any) => {
      setData(prevData => ({
        ...prevData,
        [tickData.symbol]: {
          ...prevData[tickData.symbol],
          ticks: [...(prevData[tickData.symbol]?.ticks || []), tickData.data],
          lastUpdated: Date.now()
        } as TickerData
      }));
      setLastUpdate(Date.now());
    });

    engine.on('quotes', (quoteData: any) => {
      setData(prevData => ({
        ...prevData,
        [quoteData.symbol]: {
          ...prevData[quoteData.symbol],
          currentQuote: quoteData.data,
          lastUpdated: Date.now()
        } as TickerData
      }));
      setLastUpdate(Date.now());
    });

    engine.on('indicators', (indicatorData: any) => {
      setData(prevData => ({
        ...prevData,
        [indicatorData.symbol]: {
          ...prevData[indicatorData.symbol],
          indicators: indicatorData.data,
          lastUpdated: Date.now()
        } as TickerData
      }));
    });

    engine.on('strategies', (strategyData: any) => {
      setData(prevData => ({
        ...prevData,
        [strategyData.symbol]: {
          ...prevData[strategyData.symbol],
          strategies: {
            ...prevData[strategyData.symbol]?.strategies,
            ...strategyData.data
          },
          lastUpdated: Date.now()
        } as TickerData
      }));
    });

    engine.on('error', (errorData: any) => {
      console.error('[UnifiedProvider] Engine error:', errorData);
      setError(`${errorData.type}: ${errorData.error.message}`);
    });

    await engine.start({});
  };

  const updateMarketStatus = () => {
    const now = new Date();
    const isOpen = isMarketHours(now);

    setMarketOpen(isOpen);
    setMarketStatus('unknown');
  };

  const initialize = useCallback(async () => {
    try {
      console.log('[UnifiedProvider] 🚀 Initializing unified data provider...');
      setIsLoading(true);
      setError(null);

      const needsMigration = await checkMigrationNeeded();
      if (needsMigration) {
        console.log('[UnifiedProvider] 📦 Migration required, executing...');
        setMigrationStatus('in_progress');

        try {
          const migrationResult = await executeMigration(WATCHLIST, {
            cleanupOld: false
          });
          console.log('[UnifiedProvider] ✅ Migration completed:', migrationResult);
          setMigrationStatus('completed');

          await setMetadata('unified_provider_migration', {
            completed: true,
            timestamp: Date.now(),
            result: migrationResult
          });

        } catch (migrationError: any) {
          console.error('[UnifiedProvider] ❌ Migration failed:', migrationError);
          setMigrationStatus('failed');
          setError('Data migration failed. Please refresh the page.');
          return;
        }
      } else {
        setMigrationStatus('not_needed');
      }

      await initializeDataEngine();

      updateMarketStatus();

      setIsInitialized(true);
      setIsLoading(false);
      console.log('[UnifiedProvider] ✅ Unified data provider initialized');

    } catch (initError: any) {
      console.error('[UnifiedProvider] ❌ Initialization failed:', initError);
      setError(`Initialization failed: ${initError.message}`);
      setIsLoading(false);
    }
  }, [engine]);

  const getComprehensiveData = async (symbol: string) => {
    try {
      return await executeOptimizedQuery('comprehensive', symbol);
    } catch (error) {
      console.error(`[UnifiedProvider] Error getting data for ${symbol}:`, error);
      return null;
    }
  };

  const getSymbolData = (symbol: string) => {
    return data[symbol] || null;
  };

  const getQuotes = async (symbols: string[]) => {
    try {
      return await executeOptimizedQuery('quotes', symbols);
    } catch (error) {
      console.error('[UnifiedProvider] Error getting quotes:', error);
      return {};
    }
  };

  const getIndicators = async (symbol: string) => {
    try {
      return await executeOptimizedQuery('indicators', symbol);
    } catch (error) {
      console.error(`[UnifiedProvider] Error getting indicators for ${symbol}:`, error);
      return null;
    }
  };

  const getStrategyResults = async (symbol: string, strategy: string) => {
    try {
      return await executeOptimizedQuery('strategy', symbol, strategy);
    } catch (error) {
      console.error(`[UnifiedProvider] Error getting strategy results for ${symbol}:`, error);
      return null;
    }
  };

  const refreshSymbols = useCallback(async (symbols = WATCHLIST) => {
    try {
      console.log(`[UnifiedProvider] 🔄 Refreshing data for ${symbols.length} symbols...`);

      for (const symbol of symbols) {
        optimizer.invalidateSymbolCache(symbol);
      }

      for (const symbol of symbols) {
        await engine.syncSymbol(symbol);
      }

      console.log('[UnifiedProvider] ✅ Refresh completed');

    } catch (error: any) {
      console.error('[UnifiedProvider] Refresh error:', error);
      setError(`Refresh failed: ${error.message}`);
    }
  }, [engine, optimizer]);

  const resetAllData = useCallback(async () => {
    try {
      console.log('[UnifiedProvider] 🗑️ Resetting all data...');

      await engine.stop();

      await clearDataLake();

      optimizer.reset();

      setData({});
      setError(null);
      setIsInitialized(false);
      setIsLoading(true);

      await initialize();

    } catch (error: any) {
      console.error('[UnifiedProvider] Reset error:', error);
      setError(`Reset failed: ${error.message}`);
    }
  }, [engine, optimizer, initialize]);


  const toggleGlobalMuted = () => {
    const newMuted = !globalMuted;
    setGlobalMuted(newMuted);
  };

  const setGlobalMutedState = (muted: boolean) => {
    setGlobalMuted(muted);
  };

  const getPerformanceStats = () => {
    return {
      engine: engine.getStatus(),
      optimizer: optimizer.getStats(),
      cache: optimizer.cache.getStats()
    };
  };

  useEffect(() => {
    initialize();

    const marketStatusInterval = setInterval(updateMarketStatus, 60000);

    return () => {
      clearInterval(marketStatusInterval);

      if (engine) {
        engine.stop();
      }

          };
  }, [initialize, engine]);

  const contextValue: UnifiedDataContextType = {
    tickers: WATCHLIST,
    data,
    newsItems,
    isConnected,
    newsConnected,
    isLoading,
    isInitialized,
    engineStatus,
    marketOpen,
    marketStatus,
    lastUpdate,
    error,
    migrationStatus,
    refreshSymbols,
    resetAllData,
    getSymbolData,
    getQuotes,
    getIndicators,
    getStrategyResults,
    globalMuted,
    setGlobalMuted: setGlobalMutedState,
    toggleGlobalMuted,
    getPerformanceStats
  };

  if (isLoading && !isInitialized) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#0a0e27',
        color: '#e1e4f0',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h2>StrategyWatch</h2>
        <div>Initializing unified data system...</div>
        {migrationStatus === 'in_progress' && <div>Migrating data to new architecture...</div>}
        {engineStatus && <div>Engine: {engineStatus}</div>}
      </div>
    );
  }

  if (error && !isInitialized) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#0a0e27',
        color: '#ff1744',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2>Initialization Error</h2>
        <div>{error}</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <UnifiedDataContext.Provider value={contextValue}>
      {children}
    </UnifiedDataContext.Provider>
  );
}

export function useUnifiedData() {
  const context = React.useContext(UnifiedDataContext);
  if (!context) {
    throw new Error('useUnifiedData must be used within a UnifiedDataProvider');
  }
  return context;
}

export default UnifiedDataProvider;
