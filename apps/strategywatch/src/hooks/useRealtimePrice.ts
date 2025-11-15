
import { useEffect, useState, useCallback, useRef } from 'react';
import { getProvider } from '../services/marketData';
import { Tick } from '../types/types';

interface PriceUpdate extends Tick {
  receivedAt: number;
  delay: number;
  type: string;
  exchange: string;
  conditions: string[];
  vwap: number | null;
  tradeCount: number | null;
}

interface UseRealtimePrice {
  prices: Record<string, PriceUpdate>;
  connected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useRealtimePrice(symbols: string[]): UseRealtimePrice {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerRef = useRef<any>(null);
  const symbolsRef = useRef(symbols);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const symbolChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hasSymbols = symbols && symbols.length > 0;

  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  const handlePriceUpdate = useCallback((update: any) => {
    if (update.type !== 'trade' || typeof update.price !== 'number' || isNaN(update.price)) {
      return;
    }

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
        vwap: update.vwap || null,
        tradeCount: update.tradeCount || null,
        ticker: update.symbol
      }
    }));
  }, []);

  const connect = useCallback(async () => {
    try {
      if (!providerRef.current) {
        providerRef.current = getProvider();
      }

      setError(null);

      await providerRef.current.subscribeLive(symbolsRef.current, handlePriceUpdate);

      setConnected(true);

    } catch (err: any) {
      if (err.message?.includes('connection limit exceeded') || err.code === 406) {
        console.warn('Rate limit hit. Using moderate backoff...');
        reconnectAttemptsRef.current += 1;
        setError('Rate limit exceeded. Will retry...');
      } else if (err.message?.includes('401') || err.message?.includes('402') || err.message?.includes('Not authenticated')) {
        console.error('Authentication error. Check API credentials. Falling back to REST API.');
        setError('WebSocket authentication failed. Using REST API fallback.');
        reconnectAttemptsRef.current = 10;

        if (typeof window !== 'undefined') {
          (window as any).websocketFallback = true;
        }
      } else {
        console.error('WebSocket connection error:', err);
        setError(`WebSocket failed: ${err.message}. Using REST API fallback.`);

        if (reconnectAttemptsRef.current >= 3) {
          if (typeof window !== 'undefined') {
            (window as any).websocketFallback = true;
          }
        }
      }
      setConnected(false);
    }
  }, [handlePriceUpdate]);

  useEffect(() => {
    if (!connected && error && !reconnectTimeoutRef.current) {
      let backoffDelay;
      if (reconnectAttemptsRef.current === 0) {
        backoffDelay = 1000;
      } else if (reconnectAttemptsRef.current < 3) {
        backoffDelay = 2000 * Math.pow(2, reconnectAttemptsRef.current - 1);
      } else {
        backoffDelay = Math.min(8000 * Math.pow(1.5, reconnectAttemptsRef.current - 3), 15000);
      }

      reconnectTimeoutRef.current = setTimeout(async () => {
        try {
          reconnectAttemptsRef.current += 1;
          console.log(`🔄 WebSocket reconnect attempt ${reconnectAttemptsRef.current} after ${backoffDelay}ms...`);
          await connect();

          if (connected) {
            reconnectAttemptsRef.current = 0;
            setError(null);
            console.log('✅ WebSocket reconnected successfully');
          }
        } catch (reconnectError: any) {
          console.error('❌ WebSocket reconnection failed:', reconnectError);
          setError(reconnectError.message);
          reconnectTimeoutRef.current = null;

          if (reconnectAttemptsRef.current >= 4) {
            console.log('⚠️ Max WebSocket reconnection attempts reached. Switching to REST API fallback.');
            setError('WebSocket unavailable. Using REST API for updates.');
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

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (providerRef.current) {
      providerRef.current.unsubscribeLive(symbolsRef.current).then(() => {
        setConnected(false);
        connect();
      });
    } else {
      connect();
    }
  }, [connect]);

  useEffect(() => {
    if (!hasSymbols) return;

    setTimeout(connect, 0);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (symbolChangeTimeoutRef.current) {
        clearTimeout(symbolChangeTimeoutRef.current);
      }

      if (providerRef.current && symbolsRef.current.length > 0) {
        providerRef.current.unsubscribeLive(symbolsRef.current).catch(() => {});
      }
    };
  }, [connect, hasSymbols]);

  const symbolList = symbols ? symbols.join(',') : '';

  useEffect(() => {
    if (!hasSymbols || !connected || !providerRef.current) {
      return;
    }

    if (symbolChangeTimeoutRef.current) {
      clearTimeout(symbolChangeTimeoutRef.current);
    }

    symbolChangeTimeoutRef.current = setTimeout(() => {
      reconnect();
    }, 1000);

    return () => {
      if (symbolChangeTimeoutRef.current) {
        clearTimeout(symbolChangeTimeoutRef.current);
      }
    };
  }, [symbolList, connected, reconnect, hasSymbols]);

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
