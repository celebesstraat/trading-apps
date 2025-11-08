/**
 * React hook for market data provider
 * Provides access to market data API
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Hook to manage market data provider instance
 * @param {import('../providers/base.js').BaseProvider} provider - Market data provider
 * @returns {Object}
 */
export function useMarketData(provider) {
  const [connectionState, setConnectionState] = useState({
    connected: false,
    error: null
  });

  const providerRef = useRef(provider);

  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  /**
   * Fetch quote for a symbol
   * @param {string} symbol - Stock ticker symbol
   * @returns {Promise<import('../types/market-data.js').MarketQuote|null>}
   */
  const fetchQuote = async (symbol) => {
    return providerRef.current.fetchQuote(symbol);
  };

  /**
   * Fetch quotes for multiple symbols
   * @param {string[]} symbols - Array of symbols
   * @returns {Promise<Object.<string, import('../types/market-data.js').MarketQuote>>}
   */
  const fetchQuoteBatch = async (symbols) => {
    return providerRef.current.fetchQuoteBatch(symbols);
  };

  /**
   * Fetch historical candles
   * @param {string} symbol - Stock ticker symbol
   * @param {import('../types/market-data.js').CandleResolution} resolution - Candle resolution
   * @param {number} from - Start timestamp
   * @param {number} to - End timestamp
   * @returns {Promise<import('../types/market-data.js').CandleData|null>}
   */
  const fetchCandles = async (symbol, resolution, from, to) => {
    return providerRef.current.fetchCandles(symbol, resolution, from, to);
  };

  /**
   * Update connection state from provider
   */
  const updateConnectionState = () => {
    if (providerRef.current) {
      setConnectionState(providerRef.current.getConnectionState());
    }
  };

  return {
    provider: providerRef.current,
    connectionState,
    updateConnectionState,
    fetchQuote,
    fetchQuoteBatch,
    fetchCandles
  };
}
