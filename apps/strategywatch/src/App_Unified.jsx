import { UnifiedDataProvider } from './context/UnifiedDataProvider';
import { useUnifiedData } from './context/UnifiedDataProvider';
import Header from './components/Header';
import Footer from './components/Footer';
import WatchlistTable from './components/WatchlistTable';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/global.css';
import './App.css';

/**
 * Main App Content Component (Unified Architecture)
 * Displays the dashboard with header, table, and footer using the new data system
 */
function AppContent() {
  const {
    tickers,
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
    getPerformanceStats
  } = useUnifiedData();

  // Get performance stats for debugging (only in development)
  const performanceStats = import.meta.env.DEV ? getPerformanceStats() : null;

  // Show migration status during migration
  if (migrationStatus === 'in_progress') {
    return (
      <div className="app">
        <div className="migration-container">
          <div className="migration-spinner"></div>
          <h2>Upgrading to Unified Data Architecture</h2>
          <p>Migrating your existing data to the new high-performance system...</p>
          <p>This may take a few moments.</p>
          <div className="migration-details">
            <p>Status: {engineStatus}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show migration error
  if (migrationStatus === 'failed') {
    return (
      <div className="app">
        <div className="error-container">
          <div className="error-message">
            <h2>Migration Error</h2>
            <p>{error}</p>
            <div className="error-help">
              <p>The system encountered an error while migrating to the new architecture.</p>
              <p>Please refresh the page to retry, or contact support if the issue persists.</p>
              <button
                onClick={() => window.location.reload()}
                className="retry-button"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !isInitialized) {
    return (
      <div className="app">
        <Header
          connected={isConnected}
          marketOpen={marketOpen}
          marketStatus={marketStatus}
          isLoading={isLoading}
        />
        <div className="error-container">
          <div className="error-message">
            <h2>Initialization Error</h2>
            <p>{error}</p>
            {error.includes('API') && (
              <div className="error-help">
                <p>To fix this:</p>
                <ol>
                  <li>Get free API keys from <a href="https://alpaca.markets/docs/market-data/getting-started/" target="_blank" rel="noopener noreferrer">Alpaca Markets</a></li>
                  <li>Create a <code>.env</code> file in the apps/strategywatch directory</li>
                  <li>Add your credentials:
                    <pre>
VITE_ALPACA_API_KEY_ID=your_key_id_here
VITE_ALPACA_SECRET_KEY=your_secret_key_here
VITE_ALPACA_DATA_FEED=iex
                    </pre>
                  </li>
                  <li>Restart the development server</li>
                </ol>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="retry-button"
            >
              Retry Initialization
            </button>
          </div>
        </div>
        <Footer
          lastUpdate={lastUpdate}
          tickerCount={tickers.length}
        />
      </div>
    );
  }

  // Show loading state during initialization
  if (isLoading && !isInitialized) {
    return (
      <div className="app">
        <Header
          connected={isConnected}
          marketOpen={marketOpen}
          marketStatus={marketStatus}
          isLoading={isLoading}
        />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>
            {engineStatus === 'starting' && 'Initializing data engine...'}
            {engineStatus === 'loading' && 'Loading cached data...'}
            {engineStatus === 'connecting' && 'Establishing connection...'}
            {engineStatus === 'syncing' && 'Synchronizing data...'}
            {engineStatus === 'running' && 'Finalizing...'}
            {!engineStatus && 'Loading...'}
          </p>

          {/* Development: Show performance stats */}
          {import.meta.env.DEV && performanceStats && (
            <div className="loading-stats">
              <p>Engine: {performanceStats.engine.status}</p>
              <p>Cache hit rate: {performanceStats.optimizer.performance.cacheHitRate.toFixed(1)}%</p>
              <p>Queries: {performanceStats.optimizer.performance.totalQueries}</p>
            </div>
          )}
        </div>
        <Footer
          lastUpdate={lastUpdate}
          tickerCount={tickers.length}
        />
      </div>
    );
  }

  // Transform data for existing components (backward compatibility)
  const transformedData = {
    pricesMap: {},
    movingAveragesMap: {},
    orb5mDataMap: {},
    rvolDataMap: {},
    vrsDataMap: {}
  };

  // Transform unified data to legacy format for existing components
  Object.entries(data).forEach(([symbol, symbolData]) => {
    if (symbolData.quote) {
      transformedData.pricesMap[symbol] = symbolData.quote;
    }
    if (symbolData.indicators?.movingAverages) {
      transformedData.movingAveragesMap[symbol] = symbolData.indicators.movingAverages;
    }
    if (symbolData.strategies?.orb5m) {
      transformedData.orb5mDataMap[symbol] = symbolData.strategies.orb5m;
    }
    if (symbolData.strategies?.rvol) {
      transformedData.rvolDataMap[symbol] = symbolData.strategies.rvol;
    }
    if (symbolData.strategies?.vrs) {
      transformedData.vrsDataMap[symbol] = symbolData.strategies.vrs;
    }
  });

  // Main dashboard view
  return (
    <div className="app">
      <Header
        connected={isConnected}
        marketOpen={marketOpen}
        marketStatus={marketStatus}
        newsCount={newsItems.filter(item => item.isRelevant && !item.isRead).length}
      />

      <main className="main-content">
        {/* Development: Show performance banner */}
        {import.meta.env.DEV && performanceStats && (
          <div className="performance-banner" style={{
            background: '#1a237e',
            color: 'white',
            padding: '8px 16px',
            fontSize: '12px',
            display: 'flex',
            gap: '20px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <span>Engine: {performanceStats.engine.status}</span>
            <span>Connected: {isConnected ? '✅' : '❌'}</span>
            <span>Cache: {performanceStats.optimizer.performance.cacheHitRate.toFixed(1)}%</span>
            <span>Queries: {performanceStats.optimizer.performance.totalQueries}</span>
            <span>Data Quality: {performanceStats.engine.dataQuality}</span>
          </div>
        )}

        {!marketOpen && (
          <div className="market-closed-banner">
            Market is currently closed. Displaying last known prices.
          </div>
        )}

        <WatchlistTable
          tickers={tickers}
          pricesMap={transformedData.pricesMap}
          movingAveragesMap={transformedData.movingAveragesMap}
          orb5mDataMap={transformedData.orb5mDataMap}
          rvolDataMap={transformedData.rvolDataMap}
          vrsDataMap={transformedData.vrsDataMap}
        />
      </main>

      <Footer
        lastUpdate={lastUpdate}
        tickerCount={tickers.length}
        performanceStats={import.meta.env.DEV ? performanceStats : null}
      />
    </div>
  );
}

/**
 * Main App Component (Unified Architecture)
 * Wraps content with UnifiedDataProvider
 */
function App() {
  return (
    <ErrorBoundary>
      <UnifiedDataProvider>
        <AppContent />
      </UnifiedDataProvider>
    </ErrorBoundary>
  );
}

export default App;