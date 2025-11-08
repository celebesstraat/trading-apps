import { useEffect, useRef, useState, useCallback } from 'react';
import { FINNHUB_API_KEY, FINNHUB_WS_URL, UPDATE_INTERVALS } from '../config/constants';

/**
 * Custom hook for Finnhub WebSocket connection
 * Manages real-time price updates for multiple symbols
 *
 * @param {string[]} symbols Array of ticker symbols to subscribe to
 * @returns {object} { prices, connected, error, reconnect }
 */
export function useFinnhubWebSocket(symbols) {
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const symbolsRef = useRef(symbols);

  // Update symbols ref when it changes
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  // Connect function
  const connect = useCallback(() => {
    try {
      // Clear any existing connection
      if (ws.current) {
        ws.current.close();
      }

      // Create WebSocket connection
      const websocket = new WebSocket(`${FINNHUB_WS_URL}?token=${FINNHUB_API_KEY}`);
      ws.current = websocket;

      websocket.onopen = () => {
        setConnected(true);
        setError(null);

        // Subscribe to all symbols
        symbolsRef.current.forEach(symbol => {
          websocket.send(JSON.stringify({
            type: 'subscribe',
            symbol: symbol
          }));
        });
      };

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Finnhub sends trade data with type: 'trade'
          if (message.type === 'trade' && message.data) {
            message.data.forEach(trade => {
              const now = Date.now();
              const tradeAge = now - trade.t;

              setPrices(prevPrices => ({
                ...prevPrices,
                [trade.s]: {
                  price: trade.p,          // Last price
                  volume: trade.v,         // Volume
                  timestamp: trade.t,      // Timestamp (ms)
                  receivedAt: now,         // When we received it
                  delay: tradeAge,         // Delay in ms
                  conditions: trade.c      // Trade conditions
                }
              }));
            });
          }

          // Handle ping messages
          if (message.type === 'ping') {
            websocket.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (err) {
          // Silently ignore parsing errors
        }
      };

      websocket.onerror = (event) => {
        setError('WebSocket connection error');
      };

      websocket.onclose = (event) => {
        setConnected(false);

        // Attempt reconnection after delay
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
        }

        reconnectTimeout.current = setTimeout(() => {
          connect();
        }, UPDATE_INTERVALS.WEBSOCKET_RECONNECT_MS);
      };

    } catch (err) {
      setError('Failed to create WebSocket connection');
      setConnected(false);
    }
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }

      if (ws.current) {
        // Unsubscribe from all symbols
        symbolsRef.current.forEach(symbol => {
          if (ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'unsubscribe',
              symbol: symbol
            }));
          }
        });

        ws.current.close();
      }
    };
  }, [connect]);

  // Handle symbol list changes (subscribe/unsubscribe as needed)
  useEffect(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      return;
    }

    // For simplicity, we don't re-subscribe on symbol changes
    // In production, you'd want to diff and subscribe/unsubscribe accordingly

  }, [symbols]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    connect();
  }, [connect]);

  return {
    prices,        // Map of symbol -> {price, volume, timestamp}
    connected,     // Connection status
    error,         // Error message (if any)
    reconnect      // Manual reconnect function
  };
}

export default useFinnhubWebSocket;
