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
      // The reconnection will be handled by the useEffect below
    }
  }, [handlePriceUpdate]);

  // Handle reconnection when disconnected due to error
  useEffect(() => {
    if (!connected && error && !reconnectTimeoutRef.current) {
      reconnectTimeoutRef.current = setTimeout(async () => {
        try {
          await connect();
        } catch (reconnectError) {
          console.error('Reconnection failed:', reconnectError);
          setError(reconnectError.message);
          reconnectTimeoutRef.current = null;
        }
      }, 5000);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connected, error, connect]);

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
    setTimeout(connect, 0);

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
  const symbolList = symbols.join(',');
  useEffect(() => {
    if (!connected || !providerRef.current) {
      return;
    }

    // Resubscribe with new symbol list
    setTimeout(reconnect, 0);

  }, [symbolList, connected, reconnect]); // Dependencies

  return {
    prices,
    connected,
    error,
    reconnect
  };
}

export default useRealtimePrice;
