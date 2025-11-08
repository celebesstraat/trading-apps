import { DataProvider, useData } from './context/DataContext';
import Header from './components/Header';
import Footer from './components/Footer';
import WatchlistTable from './components/WatchlistTable';
import ErrorBoundary from './components/ErrorBoundary';
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
    connected,
    marketOpen,
    currentTime,
    marketStatus,
    loading,
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
        />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading historical data...</p>
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
        {!marketOpen && (
          <div className="market-closed-banner">
            Market is currently closed. Displaying last known prices.
          </div>
        )}

        <WatchlistTable
          tickers={tickers}
          pricesMap={prices}
          movingAveragesMap={movingAverages}
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
