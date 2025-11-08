/**
 * Provider Factory
 * Creates market data providers based on configuration
 */

import { AlpacaProvider } from './alpaca/index.js';

/**
 * Available provider types
 */
export const PROVIDERS = {
  ALPACA: 'alpaca'
};

/**
 * Create a market data provider
 * @param {string} providerName - Provider name ('alpaca', etc.)
 * @param {import('../types/market-data.js').ProviderConfig} config - Provider configuration
 * @returns {import('./base.js').BaseProvider}
 */
export function createProvider(providerName, config) {
  const provider = providerName.toLowerCase();

  switch (provider) {
    case PROVIDERS.ALPACA:
      return new AlpacaProvider(config);

    default:
      throw new Error(`Unknown provider: ${providerName}. Available: ${Object.values(PROVIDERS).join(', ')}`);
  }
}

/**
 * Create provider from environment variables
 * Reads from VITE_* or similar env vars
 * @param {Object} env - Environment object (e.g., import.meta.env)
 * @returns {import('./base.js').BaseProvider}
 */
export function createProviderFromEnv(env) {
  const providerName = env.VITE_MARKET_DATA_PROVIDER || 'alpaca';

  // Alpaca configuration
  if (providerName === 'alpaca') {
    return createProvider('alpaca', {
      apiKeyId: env.VITE_ALPACA_API_KEY_ID,
      secretKey: env.VITE_ALPACA_SECRET_KEY,
      dataFeed: env.VITE_ALPACA_DATA_FEED || 'iex',
      sandbox: env.VITE_ALPACA_SANDBOX === 'true',
      rateLimit: parseInt(env.VITE_ALPACA_RATE_LIMIT) || undefined
    });
  }

  throw new Error(`Provider ${providerName} not configured`);
}

/**
 * Validate provider configuration
 * @param {string} providerName - Provider name
 * @param {import('../types/market-data.js').ProviderConfig} config - Provider configuration
 * @returns {boolean}
 */
export function validateProviderConfig(providerName, config) {
  const provider = providerName.toLowerCase();

  switch (provider) {
    case PROVIDERS.ALPACA:
      return !!(config.apiKeyId && config.secretKey);

    default:
      return false;
  }
}
