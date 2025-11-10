import { DataProvider, useData } from './context/DataContext';
import Header from './components/Header';
import Footer from './components/Footer';
import WatchlistTable from './components/WatchlistTable';
import ErrorBoundary from './components/ErrorBoundary';
import { MARKET_DATA_CONFIG } from './config/constants';
import './styles/global.css';
import './App.css';

/**
 * Main App Content Component
 * Displays the dashboard with header, table, and footer
 */
function AppContent() {
  const {
    tickers,
    prices,
    movingAverages,
    orb5mData,
    rvolData,
    vrsData,
    connected,
    marketOpen,
    currentTime,
    marketStatus,
    isHoliday,
    isWeekend,
    isLoading,
    loading,
    loadingProgress,
    error,
    lastUpdate,
    apiConfigured
  } = useData();

  // Show error state
  if (error) {
    return (
      <div className="app">
        <Header
          connected={connected}
          currentTime={currentTime}
          marketOpen={marketOpen}
          marketStatus={marketStatus}
          apiConfigured={apiConfigured}
          isHoliday={isHoliday}
          isWeekend={isWeekend}
          isLoading={isLoading}
        />
        <div className="error-container">
          <div className="error-message">
            <h2>Error</h2>
            <p>{error}</p>
            {!apiConfigured && (
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
          </div>
        </div>
        <Footer
          lastUpdate={lastUpdate}
          tickerCount={tickers.length}
        />
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="app">
        <Header
          connected={connected}
          currentTime={currentTime}
          marketOpen={marketOpen}
          marketStatus={marketStatus}
          apiConfigured={apiConfigured}
          isHoliday={isHoliday}
          isWeekend={isWeekend}
          isLoading={isLoading}
        />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>
            {loadingProgress.stage && loadingProgress.total > 0
              ? `${loadingProgress.stage} (${loadingProgress.completed}/${loadingProgress.total})`
              : 'Loading historical data...'
            }
          </p>
          {loadingProgress.stage && loadingProgress.total > 0 && (
            <div className="loading-progress-bar">
              <div
                className="loading-progress-fill"
                style={{ width: `${(loadingProgress.completed / loadingProgress.total) * 100}%` }}
              />
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

  // Main dashboard view
  return (
    <div className="app">
      <Header
        connected={connected}
        currentTime={currentTime}
        marketOpen={marketOpen}
        marketStatus={marketStatus}
        apiConfigured={apiConfigured}
      />

      <main className="main-content">

        {/* WebSocket Debug Panel */}
        <div style={{
          background: '#1a1a1a',
          color: '#fff',
          padding: '15px',
          margin: '10px 0',
          fontSize: '11px',
          fontFamily: 'monospace',
          border: '2px solid #333',
          borderRadius: '5px'
        }}>
          <strong style={{color: '#ffa500'}}>🔌 WEBSOCKET DEBUG PANEL</strong><br/>
          <div style={{marginTop: '8px'}}>
            <strong>Connection Status:</strong> {connected ? '✅ Connected' : '❌ Disconnected'}<br/>
            <strong>Authentication:</strong> {error ? '❌ Failed' : (connected ? '✅ Success' : '⏳ Pending')}<br/>
            <strong>Error:</strong> {error || 'None'}<br/>
            <strong>Data Mode:</strong> {import.meta.env.VITE_DATA_MODE || 'hybrid'}<br/>
            <strong>Environment:</strong> {window.location.origin}<br/>
            <strong>Timestamp:</strong> {new Date().toLocaleTimeString()}
          </div>
          <div style={{marginTop: '8px', fontSize: '10px', color: '#888'}}>
            Open browser console for detailed WebSocket logs (🔌 [WebSocket])
          </div>
        </div>

        {!marketOpen && (
          <div className="market-closed-banner">
            Market is currently closed. Displaying last known prices.
          </div>
        )}

        <WatchlistTable
          tickers={tickers}
          pricesMap={prices}
          movingAveragesMap={movingAverages}
          orb5mDataMap={orb5mData}
          rvolDataMap={rvolData}
          vrsDataMap={vrsData}
        />
      </main>

      <Footer
        lastUpdate={lastUpdate}
        apiConfigured={apiConfigured}
        tickerCount={tickers.length}
      />
    </div>
  );
}

/**
 * Main App Component
 * Wraps content with DataProvider
 */
function App() {
  return (
    <ErrorBoundary>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </ErrorBoundary>
  );
}

export default App;
