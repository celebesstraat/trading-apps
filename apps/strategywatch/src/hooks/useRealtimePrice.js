/**
 * Custom hook for real-time market data
 * Uses the shared market-data package
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getProvider } from '../services/marketData';

/**
 * Custom hook for real-time price updates
 * Manages WebSocket connection to market data provider
 *
 * @param {string[]} symbols - Array of ticker symbols to subscribe to
 * @returns {object} { prices, connected, error, reconnect }
 */
export function useRealtimePrice(symbols) {
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  const providerRef = useRef(null);
  const symbolsRef = useRef(symbols);
  const reconnectTimeoutRef = useRef(null);

  // Update symbols ref when it changes
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
        volume: update.volume || update.size || 0,
        timestamp: update.timestamp,
        receivedAt: Date.now(),
        delay: Date.now() - update.timestamp,
        type: update.type,
        exchange: update.exchange,
        conditions: update.conditions || [],
        vwap: update.vwap || null, // Volume-weighted average price
        tradeCount: update.tradeCount || null // Number of trades
      }
    }));
  }, []);

  /**
   * Connect to provider
   */
  const connect = useCallback(async () => {
    try {
      if (!providerRef.current) {
        providerRef.current = getProvider();
      }

      setError(null);

      // Subscribe to symbols
      await providerRef.current.subscribeLive(symbolsRef.current, handlePriceUpdate);

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
      }, 5000);
    }
  }, [handlePriceUpdate]);

  /**
   * Manual reconnect function
   */
  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Disconnect and reconnect
    if (providerRef.current) {
      providerRef.current.unsubscribeLive(symbolsRef.current).then(() => {
        setConnected(false);
        connect();
      });
    } else {
      connect();
    }
  }, [connect]);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (providerRef.current && symbolsRef.current.length > 0) {
        providerRef.current.unsubscribeLive(symbolsRef.current).catch(err => {
          // Silently ignore unsubscribe errors
        });
      }
    };
  }, [connect]);

  // Handle symbol list changes
  useEffect(() => {
    if (!connected || !providerRef.current) {
      return;
    }

    // Resubscribe with new symbol list
    reconnect();

  }, [symbols.join(',')]); // Dependency on symbol array content

  return {
    prices,
    connected,
    error,
    reconnect
  };
}

export default useRealtimePrice;
