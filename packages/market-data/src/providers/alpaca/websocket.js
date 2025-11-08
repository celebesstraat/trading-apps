/**
 * Alpaca Markets WebSocket Client
 * Handles real-time market data streaming with auto-reconnection
 */

import { calculateBackoff, sleep } from '../../utils/retry.js';
import { normalizeTimestamp, normalizePrice } from '../../utils/normalization.js';
import { getWebSocketUrl, ALPACA_CONFIG } from './config.js';

export class AlpacaWebSocketClient {
  /**
   * @param {import('../../types/market-data.js').ProviderConfig} config
   */
  constructor(config) {
    this.config = config;
    this.ws = null;
    this.connected = false;
    this.authenticated = false;
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.subscriptions = new Set();
    this.callbacks = new Map();
    this.url = getWebSocketUrl(config.dataFeed || 'iex', config.sandbox);
    this.manualDisconnect = false;
    this.authTimeout = null;
    this.lastMessageTime = null;
    this.heartbeatInterval = null;
  }

  /**
   * Connect to Alpaca WebSocket
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.manualDisconnect = false;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        // Set up event handlers
        this.ws.onopen = () => this.handleOpen(resolve, reject);
        this.ws.onmessage = (event) => this.handleMessage(event);
        this.ws.onerror = (error) => this.handleError(error, reject);
        this.ws.onclose = (event) => this.handleClose(event);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle WebSocket open event
   * @private
   */
  handleOpen(resolve, reject) {
    this.connected = true;

    // Send authentication within 10 seconds
    this.authenticate()
      .then(() => {
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        resolve();
      })
      .catch((error) => {
        this.disconnect();
        reject(error);
      });
  }

  /**
   * Authenticate with Alpaca
   * @private
   * @returns {Promise<void>}
   */
  async authenticate() {
    return new Promise((resolve, reject) => {
      // Set authentication timeout
      this.authTimeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, ALPACA_CONFIG.AUTH_TIMEOUT_MS);

      // Listen for auth response
      const authHandler = (message) => {
        if (message.T === 'success' && message.msg === 'authenticated') {
          clearTimeout(this.authTimeout);
          this.authenticated = true;

          // Resubscribe to previous symbols if any
          if (this.subscriptions.size > 0) {
            this.resubscribe();
          }

          resolve();
        } else if (message.T === 'error') {
          clearTimeout(this.authTimeout);
          reject(new Error(`Auth error: ${message.msg} (code: ${message.code})`));
        }
      };

      // Store handler temporarily
      this.tempAuthHandler = authHandler;

      // Send auth message
      const authMsg = {
        action: 'auth',
        key: this.config.apiKeyId,
        secret: this.config.secretKey
      };

      this.send(authMsg);
    });
  }

  /**
   * Handle incoming WebSocket messages
   * @private
   */
  handleMessage(event) {
    try {
      this.lastMessageTime = Date.now();
      const messages = JSON.parse(event.data);

      // Handle array of messages
      if (!Array.isArray(messages)) {
        return;
      }

      messages.forEach(message => {
        // Handle auth messages
        if (this.tempAuthHandler && (message.T === 'success' || message.T === 'error')) {
          this.tempAuthHandler(message);
          return;
        }

        // Handle subscription confirmations
        if (message.T === 'subscription') {
          return;
        }

        // Handle errors
        if (message.T === 'error') {
          this.handleErrorMessage(message);
          return;
        }

        // Handle data messages
        this.handleDataMessage(message);
      });

    } catch (error) {
      // Silently ignore parsing errors
    }
  }

  /**
   * Handle error messages from Alpaca
   * @private
   */
  handleErrorMessage(message) {
    const errorCode = message.code;
    const errorMsg = message.msg;

    // Error codes:
    // 400: Invalid syntax
    // 401: Not authenticated
    // 402: Authentication failed
    // 403: Already authenticated
    // 404: Invalid action
    // 405: Symbol limit exceeded
    // 406: Connection limit exceeded
    // 407: Slow client (processing too slow)
    // 409: Insufficient subscription

    if (errorCode === 401 || errorCode === 402) {
      this.disconnect();
    }
  }

  /**
   * Handle data messages (trades, quotes, bars)
   * @private
   */
  handleDataMessage(message) {
    const type = message.T;

    // Trade message: { T: 't', S: symbol, p: price, s: size, t: timestamp, x: exchange, c: conditions }
    if (type === 't') {
      const update = {
        type: 'trade',
        symbol: message.S,
        price: normalizePrice(message.p),
        size: message.s,
        timestamp: normalizeTimestamp(message.t),
        exchange: message.x,
        conditions: message.c || [],
        source: 'alpaca'
      };

      this.notifyCallbacks(message.S, update);
    }

    // Quote message: { T: 'q', S: symbol, bp: bid_price, bs: bid_size, ap: ask_price, as: ask_size, t: timestamp }
    else if (type === 'q') {
      const update = {
        type: 'quote',
        symbol: message.S,
        bidPrice: normalizePrice(message.bp),
        bidSize: message.bs,
        askPrice: normalizePrice(message.ap),
        askSize: message.as,
        price: normalizePrice(message.ap || message.bp), // Use ask as primary price
        timestamp: normalizeTimestamp(message.t),
        source: 'alpaca'
      };

      this.notifyCallbacks(message.S, update);
    }

    // Bar message: { T: 'b', S: symbol, o: open, h: high, l: low, c: close, v: volume, t: timestamp }
    else if (type === 'b') {
      const update = {
        type: 'bar',
        symbol: message.S,
        open: normalizePrice(message.o),
        high: normalizePrice(message.h),
        low: normalizePrice(message.l),
        price: normalizePrice(message.c), // Use close as price
        volume: message.v,
        vwap: normalizePrice(message.vw), // Volume-weighted average price
        tradeCount: message.n, // Number of trades
        timestamp: normalizeTimestamp(message.t),
        source: 'alpaca'
      };

      this.notifyCallbacks(message.S, update);
    }
  }

  /**
   * Notify all callbacks for a symbol
   * @private
   */
  notifyCallbacks(symbol, update) {
    // Call symbol-specific callbacks
    const symbolCallbacks = this.callbacks.get(symbol) || new Set();
    symbolCallbacks.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        // Silently ignore callback errors
      }
    });

    // Call wildcard callbacks
    const wildcardCallbacks = this.callbacks.get('*') || new Set();
    wildcardCallbacks.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        // Silently ignore callback errors
      }
    });
  }

  /**
   * Handle WebSocket error
   * @private
   */
  handleError(error, reject) {
    if (reject) {
      reject(error);
    }
  }

  /**
   * Handle WebSocket close
   * @private
   */
  handleClose(event) {
    this.connected = false;
    this.authenticated = false;
    this.stopHeartbeat();

    // Auto-reconnect unless manually disconnected
    if (!this.manualDisconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   * @private
   */
  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= ALPACA_CONFIG.RECONNECT_MAX_ATTEMPTS) {
      return;
    }

    const delay = calculateBackoff(
      this.reconnectAttempts,
      ALPACA_CONFIG.RECONNECT_DELAY_MS,
      ALPACA_CONFIG.RECONNECT_MAX_DELAY_MS
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(error => {
        // Silently ignore reconnection errors
      });
    }, delay);
  }

  /**
   * Subscribe to symbols
   * @param {string[]} symbols - Array of symbols to subscribe to
   * @param {function} callback - Callback for data updates
   * @returns {Promise<void>}
   */
  async subscribe(symbols, callback) {
    // Ensure connected
    if (!this.connected) {
      await this.connect();
    }

    // Wait for authentication
    if (!this.authenticated) {
      await sleep(1000);
      if (!this.authenticated) {
        throw new Error('Not authenticated');
      }
    }

    // Add symbols to subscriptions set
    symbols.forEach(symbol => {
      this.subscriptions.add(symbol);

      // Add callback
      if (!this.callbacks.has(symbol)) {
        this.callbacks.set(symbol, new Set());
      }
      this.callbacks.get(symbol).add(callback);
    });

    // Send subscription message
    // Subscribe to trades, quotes, and bars
    const subscribeMsg = {
      action: 'subscribe',
      trades: symbols,
      quotes: symbols,
      bars: symbols
    };

    this.send(subscribeMsg);
  }

  /**
   * Unsubscribe from symbols
   * @param {string[]} symbols - Array of symbols to unsubscribe from
   */
  unsubscribe(symbols) {
    if (!this.connected || !this.authenticated) {
      return;
    }

    // Remove from subscriptions
    symbols.forEach(symbol => {
      this.subscriptions.delete(symbol);
      this.callbacks.delete(symbol);
    });

    // Send unsubscribe message
    const unsubscribeMsg = {
      action: 'unsubscribe',
      trades: symbols,
      quotes: symbols,
      bars: symbols
    };

    this.send(unsubscribeMsg);
  }

  /**
   * Resubscribe to all current subscriptions
   * @private
   */
  resubscribe() {
    if (this.subscriptions.size === 0) {
      return;
    }

    const symbols = Array.from(this.subscriptions);
    const subscribeMsg = {
      action: 'subscribe',
      trades: symbols,
      quotes: symbols,
      bars: symbols
    };

    this.send(subscribeMsg);
  }

  /**
   * Send message to WebSocket
   * @private
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Start heartbeat monitoring
   * @private
   */
  startHeartbeat() {
    this.stopHeartbeat();

    // Check for stale connection every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.lastMessageTime && Date.now() - this.lastMessageTime > 60000) {
        this.ws?.close();
      }
    }, 30000);
  }

  /**
   * Stop heartbeat monitoring
   * @private
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.manualDisconnect = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.authenticated = false;
  }

  /**
   * Get connection state
   * @returns {import('../../types/market-data.js').ConnectionState}
   */
  getConnectionState() {
    return {
      connected: this.connected && this.authenticated,
      error: null,
      lastConnected: this.lastMessageTime,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}
