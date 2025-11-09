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
  // Initialize all hooks first (before any conditional logic)
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  const providerRef = useRef(null);
  const symbolsRef = useRef(symbols);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const symbolChangeTimeoutRef = useRef(null);

  // Check for empty symbols (but don't return early - hooks must be called in consistent order)
  const hasSymbols = symbols && symbols.length > 0;

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
      // Handle specific rate limit errors with longer backoff
      if (err.message?.includes('connection limit exceeded') || err.code === 406) {
        console.warn('Rate limit hit. Using extended backoff...');
        reconnectAttemptsRef.current += 3; // Jump to longer backoff
        setError('Rate limit exceeded. Waiting before reconnect...');
      } else {
        setError(err.message);
      }
      setConnected(false);
      // The reconnection will be handled by the useEffect below
    }
  }, [handlePriceUpdate]);

  // Handle reconnection when disconnected due to error
  useEffect(() => {
    if (!connected && error && !reconnectTimeoutRef.current) {
      // Exponential backoff: 5s, 10s, 20s, 30s, 60s max
      const backoffDelay = Math.min(5000 * Math.pow(2, reconnectAttemptsRef.current), 60000);

      reconnectTimeoutRef.current = setTimeout(async () => {
        try {
          reconnectAttemptsRef.current += 1;
          console.log(`Attempting to reconnect (attempt ${reconnectAttemptsRef.current}) after ${backoffDelay}ms delay...`);
          await connect();

          // Reset attempts on successful connection
          if (connected) {
            reconnectAttemptsRef.current = 0;
          }
        } catch (reconnectError) {
          console.error('Reconnection failed:', reconnectError);
          setError(reconnectError.message);
          reconnectTimeoutRef.current = null;

          // Stop reconnecting after 10 failed attempts
          if (reconnectAttemptsRef.current >= 10) {
            console.error('Max reconnection attempts reached. Stopping reconnection attempts.');
            setError('Max reconnection attempts reached. Please refresh the page.');
            return;
          }
        }
      }, backoffDelay);
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
    // Only connect if we have symbols
    if (!hasSymbols) return;

    setTimeout(connect, 0);

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (symbolChangeTimeoutRef.current) {
        clearTimeout(symbolChangeTimeoutRef.current);
      }

      if (providerRef.current && symbolsRef.current.length > 0) {
        providerRef.current.unsubscribeLive(symbolsRef.current).catch(() => {
          // Silently ignore unsubscribe errors
        });
      }
    };
  }, [connect, hasSymbols]);

  // Handle symbol list changes with debounce
  const symbolList = symbols ? symbols.join(',') : '';

  useEffect(() => {
    if (!hasSymbols || !connected || !providerRef.current) {
      return;
    }

    // Debounce symbol changes to avoid rapid reconnections
    if (symbolChangeTimeoutRef.current) {
      clearTimeout(symbolChangeTimeoutRef.current);
    }

    symbolChangeTimeoutRef.current = setTimeout(() => {
      console.log('Symbol list changed, reconnecting...');
      reconnect();
    }, 1000); // 1 second debounce

    return () => {
      if (symbolChangeTimeoutRef.current) {
        clearTimeout(symbolChangeTimeoutRef.current);
      }
    };
  }, [symbolList, connected, reconnect, hasSymbols]); // Dependencies

  // Return early for empty symbols (after all hooks have been called)
  if (!hasSymbols) {
    return {
      prices: {},
      connected: false,
      error: null,
      reconnect: () => {}
    };
  }

  return {
    prices,
    connected,
    error,
    reconnect
  };
}

export default useRealtimePrice;
