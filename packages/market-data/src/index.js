/**
 * @trading-apps/market-data
 * Main entry point
 */

// Provider factory
export { createProvider, createProviderFromEnv, PROVIDERS } from './providers/factory.js';

// Base provider (for extending)
export { BaseProvider } from './providers/base.js';

// Alpaca provider
export { AlpacaProvider } from './providers/alpaca/index.js';

// Types and constants
export {
  CANDLE_RESOLUTIONS,
  DATA_FEED_TYPES,
  UPDATE_TYPES
} from './types/market-data.js';

// Utilities
export {
  normalizeTimestamp,
  normalizeSymbol,
  normalizePrice,
  calculatePercentChange,
  isStaleData
} from './utils/normalization.js';

export { RateLimiter } from './utils/rate-limit.js';
export { retry, calculateBackoff } from './utils/retry.js';

// React hooks (optional - can be imported separately)
export { useMarketData, useRealtimePrice } from './hooks/index.js';
