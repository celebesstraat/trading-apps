/**
 * Unified Data Provider
 * Replaces the complex DataContext with a clean, efficient data management system
 * Uses the new data ingestion engine and query optimizer for optimal performance
 */

import React, { createContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { WATCHLIST } from '../config/watchlist';
import { createDataIngestionEngine } from '../services/dataIngestionEngine';
import { getQueryOptimizer, executeOptimizedQuery } from '../services/queryOptimizer';
import { executeMigration } from '../services/dataMigration';
import { getMetadata, setMetadata, clearDataLake } from '../services/dataLake';
import { isMarketHours, getMarketStatus } from '../utils/marketTime';
import { isMuted } from '../utils/voiceAlerts';
import { createNewsService } from '../services/newsService';

// Create context
export const UnifiedDataContext = createContext(null);

/**
 * Unified Data Provider Component
 * Manages all application state and data using the new architecture
 */
export function UnifiedDataProvider({ children }) {
  // Core engine and optimizer instances
  const [engine] = useState(() => createDataIngestionEngine(WATCHLIST));
  const [optimizer] = useState(() => getQueryOptimizer());

  // Connection and status state
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [engineStatus, setEngineStatus] = useState('stopped');

  // Data state (managed by query optimizer)
  const [data, setData] = useState({});
  const [newsItems, setNewsItems] = useState([]);
  const [newsConnected, setNewsConnected] = useState(false);

  // Market state
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketStatus, setMarketStatus] = useState('unknown');

  // Error state
  const [error, setError] = useState(null);

  // Voice control
  const [globalMuted, setGlobalMuted] = useState(() => isMuted());

  // News service instance
  const newsServiceRef = useRef(null);

  // Migration state
  const [migrationStatus, setMigrationStatus] = useState(null);

  /**
   * Check if migration is needed
   */
  const checkMigrationNeeded = async () => {
    try {
      const migrationMetadata = await getMetadata('unified_provider_migration');
      if (migrationMetadata?.completed) {
        return false; // Already migrated
      }

      // Check if we have old data that needs migration
      const stats = await getMetadata('migration_results');
      const hasOldData = stats && stats.status === 'completed';

      return hasOldData;
    } catch (error) {
      console.error('[UnifiedProvider] Error checking migration status:', error);
      return false;
    }
  };

  /**
   * Initialize data ingestion engine
   */
  const initializeDataEngine = async () => {
    console.log('[UnifiedProvider] 🔄 Initializing data engine...');

    // Set up engine event listeners
    engine.on('status', (statusData) => {
      console.log('[UnifiedProvider] Engine status:', statusData);
      setEngineStatus(statusData.status);
      setIsConnected(statusData.status === 'running' || statusData.status === 'connected');

      if (statusData.status === 'loaded') {
        // Load cached data into state
        setData(statusData.data || {});
      }
    });

    engine.on('ticks', (tickData) => {
      // Update data for tick updates
      setData(prevData => ({
        ...prevData,
        [tickData.symbol]: {
          ...prevData[tickData.symbol],
          ticks: [...(prevData[tickData.symbol]?.ticks || []), tickData.data],
          lastUpdated: Date.now()
        }
      }));
      setLastUpdate(Date.now());
    });

    engine.on('quotes', (quoteData) => {
      // Update data for quote updates
      setData(prevData => ({
        ...prevData,
        [quoteData.symbol]: {
          ...prevData[quoteData.symbol],
          currentQuote: quoteData.data,
          lastUpdated: Date.now()
        }
      }));
      setLastUpdate(Date.now());
    });

    engine.on('indicators', (indicatorData) => {
      // Update data for indicator updates
      setData(prevData => ({
        ...prevData,
        [indicatorData.symbol]: {
          ...prevData[indicatorData.symbol],
          indicators: indicatorData.data,
          lastUpdated: Date.now()
        }
      }));
    });

    engine.on('strategies', (strategyData) => {
      // Update data for strategy updates
      setData(prevData => ({
        ...prevData,
        [strategyData.symbol]: {
          ...prevData[strategyData.symbol],
          strategies: {
            ...prevData[strategyData.symbol]?.strategies,
            ...strategyData.data
          },
          lastUpdated: Date.now()
        }
      }));
    });

    engine.on('error', (errorData) => {
      console.error('[UnifiedProvider] Engine error:', errorData);
      setError(`${errorData.type}: ${errorData.error.message}`);
    });

    // Start the engine
    await engine.start();
  };

  /**
   * Initialize the data provider
   */
  const initialize = useCallback(async () => {
    try {
      console.log('[UnifiedProvider] 🚀 Initializing unified data provider...');
      setIsLoading(true);
      setError(null);

      // Check if migration is needed
      const needsMigration = await checkMigrationNeeded();
      if (needsMigration) {
        console.log('[UnifiedProvider] 📦 Migration required, executing...');
        setMigrationStatus('in_progress');

        try {
          const migrationResult = await executeMigration(WATCHLIST, {
            cleanupOld: false // Preserve old data for safety
          });
          console.log('[UnifiedProvider] ✅ Migration completed:', migrationResult);
          setMigrationStatus('completed');

          // Store migration completion
          await setMetadata('unified_provider_migration', {
            completed: true,
            timestamp: Date.now(),
            result: migrationResult
          });

        } catch (migrationError) {
          console.error('[UnifiedProvider] ❌ Migration failed:', migrationError);
          setMigrationStatus('failed');
          setError('Data migration failed. Please refresh the page.');
          return;
        }
      } else {
        setMigrationStatus('not_needed');
      }

      // Initialize data ingestion engine
      await initializeDataEngine();

      // Initialize news service
      await initializeNewsService();

      // Update market status
      updateMarketStatus();

      setIsInitialized(true);
      setIsLoading(false);
      console.log('[UnifiedProvider] ✅ Unified data provider initialized');

    } catch (initError) {
      console.error('[UnifiedProvider] ❌ Initialization failed:', initError);
      setError(`Initialization failed: ${initError.message}`);
      setIsLoading(false);
    }
  }, []);

  /**
   * Initialize news service
   */
  const initializeNewsService = async () => {
    try {
      console.log('[UnifiedProvider] 📰 Initializing news service...');

      // Clear previous news
      setNewsItems([]);
      setNewsConnected(false);

      // Create news service
      const apiKey = import.meta.env.VITE_ALPACA_API_KEY_ID;
      const secretKey = import.meta.env.VITE_ALPACA_SECRET_KEY;

      if (!apiKey || !secretKey) {
        console.warn('[UnifiedProvider] No API keys for news service');
        return;
      }

      newsServiceRef.current = createNewsService(
        apiKey,
        secretKey,
        (newsItem) => {
          const filteredNews = newsServiceRef.current.filterNewsForWatchlist(newsItem, WATCHLIST);

          if (filteredNews) {
            setNewsItems(prev => {
              const updated = [filteredNews, ...prev.slice(0, 49)];
              return updated;
            });
          }
        }
      );

      // Connect to news WebSocket
      newsServiceRef.current.connect();

      // Check connection status
      const checkConnection = setInterval(() => {
        const status = newsServiceRef.current.getConnectionStatus();
        if (status.isConnected && !newsConnected) {
          setNewsConnected(true);
          clearInterval(checkConnection);
        }
      }, 1000);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkConnection);
        if (!newsConnected) {
          console.warn('[UnifiedProvider] News connection timeout');
        }
      }, 30000);

    } catch (newsError) {
      console.error('[UnifiedProvider] News service error:', newsError);
    }
  };

  /**
   * Update market status
   */
  const updateMarketStatus = () => {
    const now = new Date();
    const isOpen = isMarketHours(now);
    const status = getMarketStatus(now);

    setMarketOpen(isOpen);
    setMarketStatus(status);
  };

  /**
   * Get comprehensive data for a symbol
   */
  const getSymbolData = useCallback(async (symbol) => {
    try {
      return await executeOptimizedQuery('comprehensive', symbol);
    } catch (error) {
      console.error(`[UnifiedProvider] Error getting data for ${symbol}:`, error);
      return null;
    }
  }, []);

  /**
   * Get current quotes for multiple symbols
   */
  const getQuotes = useCallback(async (symbols) => {
    try {
      return await executeOptimizedQuery('quotes', symbols);
    } catch (error) {
      console.error('[UnifiedProvider] Error getting quotes:', error);
      return {};
    }
  }, []);

  /**
   * Get indicators for a symbol
   */
  const getIndicators = useCallback(async (symbol) => {
    try {
      return await executeOptimizedQuery('indicators', symbol);
    } catch (error) {
      console.error(`[UnifiedProvider] Error getting indicators for ${symbol}:`, error);
      return null;
    }
  }, []);

  /**
   * Get strategy results for a symbol
   */
  const getStrategyResults = useCallback(async (symbol, strategy) => {
    try {
      return await executeOptimizedQuery('strategy', symbol, strategy);
    } catch (error) {
      console.error(`[UnifiedProvider] Error getting strategy results for ${symbol}:`, error);
      return null;
    }
  }, []);

  /**
   * Refresh data for specific symbols
   */
  const refreshSymbols = useCallback(async (symbols = WATCHLIST) => {
    try {
      console.log(`[UnifiedProvider] 🔄 Refreshing data for ${symbols.length} symbols...`);

      // Invalidate cache for these symbols
      for (const symbol of symbols) {
        optimizer.invalidateSymbolCache(symbol);
      }

      // Trigger engine sync
      for (const symbol of symbols) {
        await engine.syncSymbol(symbol);
      }

      console.log('[UnifiedProvider] ✅ Refresh completed');

    } catch (error) {
      console.error('[UnifiedProvider] Refresh error:', error);
      setError(`Refresh failed: ${error.message}`);
    }
  }, [engine, optimizer]);

  /**
   * Clear all data and restart
   */
  const resetAllData = useCallback(async () => {
    try {
      console.log('[UnifiedProvider] 🗑️ Resetting all data...');

      // Stop engine
      await engine.stop();

      // Clear data lake
      await clearDataLake();

      // Clear optimizer cache
      optimizer.reset();

      // Reset state
      setData({});
      setNewsItems([]);
      setError(null);
      setIsInitialized(false);
      setIsLoading(true);

      // Reinitialize
      await initialize();

    } catch (error) {
      console.error('[UnifiedProvider] Reset error:', error);
      setError(`Reset failed: ${error.message}`);
    }
  }, [engine, optimizer, initialize]);

  /**
   * News management functions
   */
  const dismissNewsItem = useCallback((newsId) => {
    setNewsItems(prev => prev.map(item =>
      item.id === newsId ? { ...item, isRead: true } : item
    ));
  }, []);

  const markNewsAsRead = useCallback((newsId) => {
    setNewsItems(prev => prev.map(item =>
      item.id === newsId ? { ...item, isRead: true } : item
    ));
  }, []);

  const clearAllNews = useCallback(() => {
    setNewsItems(prev => prev.map(item => ({ ...item, isRead: true })));
  }, []);

  const getUnreadNewsCount = useCallback(() => {
    return newsItems.filter(item => item.isRelevant && !item.isRead).length;
  }, [newsItems]);

  const getUnreadNewsCountForTicker = useCallback((ticker) => {
    return newsItems.filter(item =>
      item.isRelevant &&
      !item.isRead &&
      item.mentionedSymbols &&
      item.mentionedSymbols.includes(ticker)
    ).length;
  }, [newsItems]);

  /**
   * Toggle global mute
   */
  const toggleGlobalMuted = useCallback(() => {
    const newMuted = !globalMuted;
    setGlobalMuted(newMuted);
  }, [globalMuted]);

  /**
   * Get provider performance statistics
   */
  const getPerformanceStats = useCallback(() => {
    return {
      engine: engine.getStatus(),
      optimizer: optimizer.getStats(),
      cache: optimizer.cache.getStats()
    };
  }, [engine, optimizer]);

  // Initialize on mount
  useEffect(() => {
    initialize();

    // Set up market status updates
    const marketStatusInterval = setInterval(updateMarketStatus, 60000); // Update every minute

    return () => {
      clearInterval(marketStatusInterval);

      // Cleanup engine and news service
      if (engine) {
        engine.stop();
      }

      if (newsServiceRef.current) {
        newsServiceRef.current.disconnect();
      }
    };
  }, [initialize]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    // Data
    tickers: WATCHLIST,
    data,
    newsItems,

    // Status
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

    // Engine controls
    refreshSymbols,
    resetAllData,

    // Data access methods
    getSymbolData,
    getQuotes,
    getIndicators,
    getStrategyResults,

    // News functions
    dismissNewsItem,
    markNewsAsRead,
    clearAllNews,
    getUnreadNewsCount,
    getUnreadNewsCountForTicker,

    // Voice control
    globalMuted,
    setGlobalMuted,
    toggleGlobalMuted,

    // Performance monitoring
    getPerformanceStats
  }), [
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
    dismissNewsItem,
    markNewsAsRead,
    clearAllNews,
    getUnreadNewsCount,
    getUnreadNewsCountForTicker,
    globalMuted,
    toggleGlobalMuted,
    getPerformanceStats
  ]);

  // Show loading state during initialization
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

  // Show error state
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

/**
 * Custom hook to use the unified data context
 */
export function useUnifiedData() {
  const context = React.useContext(UnifiedDataContext);
  if (!context) {
    throw new Error('useUnifiedData must be used within a UnifiedDataProvider');
  }
  return context;
}

export default UnifiedDataProvider;