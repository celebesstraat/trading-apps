/**
 * React hook for real-time price updates
 * Manages WebSocket subscriptions and state
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook for real-time price data
 * @param {import('../providers/base.js').BaseProvider} provider - Market data provider
 * @param {string[]} symbols - Array of symbols to track
 * @param {Object} [options] - Hook options
 * @param {boolean} [options.autoConnect=true] - Auto-connect on mount
 * @param {number} [options.reconnectDelay=5000] - Reconnection delay in ms
 * @returns {Object}
 */
export function useRealtimePrice(provider, symbols, options = {}) {
  const {
    autoConnect = true,
    reconnectDelay = 5000
  } = options;

  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  const providerRef = useRef(provider);
  const symbolsRef = useRef(symbols);
  const reconnectTimeoutRef = useRef(null);
  const subscriptionCallbackRef = useRef(null);

  // Update refs when props change
  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  /**
   * Handle price updates from WebSocket
   */
  const handlePriceUpdate = useCallback((update) => {
    setPrices(prev => ({
      ...prev,
      [update.symbol]: {
        price: update.price,
        volume: update.volume || update.size,
        timestamp: update.timestamp,
        type: update.type,
        exchange: update.exchange,
        metadata: {
          bidPrice: update.bidPrice,
          bidSize: update.bidSize,
          askPrice: update.askPrice,
          askSize: update.askSize,
          conditions: update.conditions
        }
      }
    }));
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async () => {
    if (!providerRef.current || symbolsRef.current.length === 0) {
      return;
    }

    try {
      setError(null);

      // Subscribe to symbols
      await providerRef.current.subscribeLive(symbolsRef.current, handlePriceUpdate);

      // Store callback ref for cleanup
      subscriptionCallbackRef.current = handlePriceUpdate;

      setConnected(true);

    } catch (err) {
      setError(err.message);
      setConnected(false);

      // Schedule reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, reconnectDelay);
    }
  }, [handlePriceUpdate, reconnectDelay]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(async () => {
    if (!providerRef.current) {
      return;
    }

    try {
      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Unsubscribe from symbols
      if (symbolsRef.current.length > 0) {
        await providerRef.current.unsubscribeLive(symbolsRef.current);
      }

      setConnected(false);

    } catch (err) {
      // Silently ignore disconnect errors
    }
  }, []);

  /**
   * Reconnect manually
   */
  const reconnect = useCallback(() => {
    disconnect().then(() => connect());
  }, [connect, disconnect]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && symbols.length > 0) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect]); // Only run on mount/unmount

  // Handle symbol list changes
  useEffect(() => {
    if (!connected || symbols.length === 0) {
      return;
    }

    // For simplicity, reconnect with new symbol list
    // In production, you'd diff and subscribe/unsubscribe accordingly
    reconnect();

  }, [symbols.join(',')]); // Dependency on symbols array content

  return {
    prices,
    connected,
    error,
    connect,
    disconnect,
    reconnect
  };
}
