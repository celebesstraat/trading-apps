// === DATA MODE ===
// 'rest' = REST-only (polling, more reliable, ~1-5s latency)
// 'hybrid' = WebSocket + REST fallback (real-time, <1s latency)
export const DATA_MODE = 'hybrid'; // Alpaca has much better WebSocket support

// === MOCK DATA MODE ===
// Set to true to use fake data for visual testing (5M ORB, Today's Move, etc.)
export const MOCK_DATA_MODE = false;

// Market Data Provider Configuration (Alpaca Markets)
export const MARKET_DATA_CONFIG = {
  PROVIDER: 'alpaca',
  API_KEY_ID: import.meta.env.VITE_ALPACA_API_KEY_ID,
  SECRET_KEY: import.meta.env.VITE_ALPACA_SECRET_KEY,
  DATA_FEED: (import.meta.env.VITE_ALPACA_DATA_FEED || 'iex').trim(), // 'iex' (free) or 'sip' (paid)
  SANDBOX: import.meta.env.VITE_ALPACA_SANDBOX === 'true',
  RATE_LIMIT: 200 // Free tier: 200 calls/min (vs Finnhub's 60/min)
};

// Debug: Log environment variables in production
if (typeof window !== 'undefined') {
  console.log('=== ENV DEBUG ===');
  console.log('API_KEY_ID exists:', !!import.meta.env.VITE_ALPACA_API_KEY_ID);
  console.log('SECRET_KEY exists:', !!import.meta.env.VITE_ALPACA_SECRET_KEY);
  console.log('API_KEY_ID length:', import.meta.env.VITE_ALPACA_API_KEY_ID?.length);
  console.log('SECRET_KEY length:', import.meta.env.VITE_ALPACA_SECRET_KEY?.length);
  console.log('DATA_FEED:', import.meta.env.VITE_ALPACA_DATA_FEED);
  console.log('SANDBOX:', import.meta.env.VITE_ALPACA_SANDBOX);
  console.log('==================');
}


// Finnhub API Configuration (for NBBO-quality historical data)
export const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
export const FINNHUB_REST_URL = 'https://finnhub.io/api/v1';
export const FINNHUB_WS_URL = 'wss://ws.finnhub.io';

// Strategy Thresholds - Classic TradingView PineScript ORB parameters
export const ORB_THRESHOLDS = {
  // Pine Script: No minimum range % (only tick-based minimum)
  MIN_RANGE_PERCENT: 0,            // No minimum range % requirement

  // Pine Script: minBodyFrac = 0.55 (Body ≥ fraction of range)
  MIN_BODY_RATIO: 0.55,            // Candle body must be ≥ 55% of range

  // Pine Script: rvolTier1 = 0.25, rvolTier2 = 1.50
  TIER1_VOLUME_MULTIPLIER: 0.25,   // Tier 1: Volume must be ≥ 0.25x average first 5m
  TIER2_VOLUME_MULTIPLIER: 1.50,   // Tier 2: Volume must be ≥ 1.50x average first 5m

  // Pine Script: lowerQuantile = 0.20, upperQuantile = 0.80
  LOWER_QUANTILE: 0.20,            // Open ≤ 20% of range
  UPPER_QUANTILE: 0.80,            // Close ≥ 80% of range
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
  SMA_5_PERIOD: 5,
  EMA_10_PERIOD: 10,
  EMA_21_PERIOD: 21,
  SMA_50_PERIOD: 50,
  SMA_65_PERIOD: 65,
  SMA_100_PERIOD: 100,
  SMA_200_PERIOD: 200,
  ADR_PERIOD: 20,                  // Average Daily Range period (20-Day ADR%)
};

// VRS (ADR%-Normalized Relative Strength) Configuration
export const VRS_CONFIG = {
  BENCHMARK_SYMBOL: 'QQQ',         // Benchmark index to compare against
  EMA_PERIOD: 12,                  // EMA period for smoothed VRS (12 5m candles)
  EMA_ALPHA: 2 / 13,               // EMA smoothing factor: 2/(N+1) = 2/13 ≈ 0.1538
  ADR_PERIOD: 20,                  // 20-Day ADR% for normalization
  CANDLE_INTERVAL: '5Min',         // 5-minute candle interval for VRS calculation
  MAX_HISTORY_LENGTH: 50,          // Keep last 50 VRS values for EMA calculation
  UPDATE_ON_CANDLE_CLOSE: true,    // Only update VRS when 5m candle closes

  // Display configuration for progress bars
  DISPLAY: {
    MIN_VALUE: -20,                // Minimum VRS % to display (-20%)
    MAX_VALUE: 20,                 // Maximum VRS % to display (+20%)
    CENTER_VALUE: 0,               // Center value for neutral position (0%)
    SCALE_FACTOR: 100,             // Scale VRS by 100 for percentage display
    DECIMAL_PLACES: 1,             // Decimal places for display formatting
  },

  // Color thresholds for progress bars
  THRESHOLDS: {
    VERY_NEGATIVE: -10,            // Deep red: <= -10%
    NEGATIVE: -5,                  // Red: -10% to -5%
    SLIGHTLY_NEGATIVE: -2,         // Amber: -5% to -2%
    NEUTRAL_MAX: 2,                // White/neutral: -2% to +2%
    SLIGHTLY_POSITIVE: 5,          // Light green: +2% to +5%
    POSITIVE: 10,                  // Green: +5% to +10%
    VERY_POSITIVE: 20,             // Deep green: >= +10%
  },
};

// UI Configuration
export const UI_CONFIG = {
  MIN_WIDTH: 1200,                 // Minimum viewport width
  OPTIMAL_WIDTH: 1440,             // Optimal viewport width
  ROW_HEIGHT: 48,                  // Table row height in px
  DEBOUNCE_RENDER_MS: 16,          // ~60fps
};
