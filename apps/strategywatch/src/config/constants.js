// === DATA MODE ===
// 'rest' = REST-only (polling, more reliable, ~1-5s latency)
// 'hybrid' = WebSocket + REST fallback (real-time, <1s latency)
export const DATA_MODE = 'hybrid'; // Alpaca has much better WebSocket support

// === MOCK DATA MODE ===
// Set to true to use fake data for visual testing (5M ORB, Today's Move, etc.)
export const MOCK_DATA_MODE = true;

// Market Data Provider Configuration (Alpaca Markets)
export const MARKET_DATA_CONFIG = {
  PROVIDER: 'alpaca',
  API_KEY_ID: import.meta.env.VITE_ALPACA_API_KEY_ID,
  SECRET_KEY: import.meta.env.VITE_ALPACA_SECRET_KEY,
  DATA_FEED: import.meta.env.VITE_ALPACA_DATA_FEED || 'iex', // 'iex' (free) or 'sip' (paid)
  SANDBOX: import.meta.env.VITE_ALPACA_SANDBOX === 'true',
  RATE_LIMIT: 200 // Free tier: 200 calls/min (vs Finnhub's 60/min)
};

// Strategy Thresholds
export const ORB_THRESHOLDS = {
  MIN_RANGE_PERCENT: 0.3,          // Minimum 5m candle range as % of price
  MIN_BODY_RATIO: 0.7,             // Candle body must be in top 70% of range
  MIN_VOLUME_MULTIPLIER: 2,        // Volume must be 2x average first 5m
  BREAKOUT_MIN_PERCENT: 0.1,       // Min % above high for green zone
  BREAKOUT_MAX_PERCENT: 0.5,       // Max % above high for green zone
  AMBER_DISTANCE_PERCENT: 0.2,     // Distance tolerance for amber zone
};

export const INMERELO_THRESHOLDS = {
  GREEN_MIN_DISTANCE: 0.1,         // Min % from MA for green zone
  GREEN_MAX_DISTANCE: 0.5,         // Max % from MA for green zone
  AMBER_MAX_DISTANCE: 1.5,         // Max % from MA for amber zone
  VOLUME_LOOKBACK_BARS: 5,         // Number of bars to check volume trend
};

// Color Scheme
export const COLORS = {
  // Background
  BG_PRIMARY: '#0a0e27',
  BG_SECONDARY: '#151934',

  // Text
  TEXT_PRIMARY: '#e1e4f0',
  TEXT_SECONDARY: '#8b92b0',

  // Heatmap
  RED_100: '#ff1744',
  RED_75: '#ff4569',
  RED_50: '#ff7d8f',
  AMBER_75: '#ffb74d',
  AMBER_50: '#ffd54f',
  GREEN_75: '#81c784',
  GREEN_100: '#00e676',

  // Accents
  ACCENT_BLUE: '#2196f3',
  BORDER: '#1e2439',

  // Status
  STATUS_CONNECTED: '#00e676',
  STATUS_DISCONNECTED: '#ff1744',
  STATUS_WARNING: '#ffb74d',
};

// Update Intervals
export const UPDATE_INTERVALS = {
  WEBSOCKET_RECONNECT_MS: 5000,    // Reconnect WebSocket after 5s
  HISTORICAL_REFRESH_MS: 300000,    // Refresh daily candles every 5 min
  PRICE_UPDATE_DEBOUNCE_MS: 0,     // No debounce = instant updates
  FIRST_5M_FETCH_TIME: '09:35',    // ET time to fetch first 5m candle
  // Alpaca has 200 calls/min (vs Finnhub's 60/min), so we can poll more frequently
  REST_QUOTE_POLL_MS: DATA_MODE === 'rest' ? 5000 : 15000, // 5s polling in REST mode, 15s in hybrid
};

// Market Configuration
export const MARKET_CONFIG = {
  TIMEZONE: 'America/New_York',
  MARKET_OPEN_HOUR: 9,
  MARKET_OPEN_MINUTE: 30,
  MARKET_CLOSE_HOUR: 16,
  MARKET_CLOSE_MINUTE: 0,
  ORB_START_HOUR: 9,
  ORB_START_MINUTE: 35,
};

// Historical Data Configuration
export const HISTORICAL_CONFIG = {
  DAILY_LOOKBACK_DAYS: 250,        // Days of historical data to fetch (increased for 200D SMA)
  FIRST_5M_AVG_DAYS: 20,           // Days to average first 5m volume
  EMA_10_PERIOD: 10,
  EMA_21_PERIOD: 21,
  SMA_50_PERIOD: 50,
  SMA_65_PERIOD: 65,
  SMA_100_PERIOD: 100,
  SMA_200_PERIOD: 200,
  ADR_PERIOD: 20,                  // Average Daily Range period (20-Day ADR%)
};

// UI Configuration
export const UI_CONFIG = {
  MIN_WIDTH: 1200,                 // Minimum viewport width
  OPTIMAL_WIDTH: 1440,             // Optimal viewport width
  ROW_HEIGHT: 48,                  // Table row height in px
  DEBOUNCE_RENDER_MS: 16,          // ~60fps
};
