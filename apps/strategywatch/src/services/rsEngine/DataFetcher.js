/**
 * Relative Strength Engine v2.0 - Data Fetcher
 *
 * Unified data fetching from Alpaca Markets API.
 * Combines WebSocket real-time data with REST API historical data.
 * Handles rate limiting, error recovery, and data validation.
 */

export class RSDataFetcher {
  constructor() {
    this.symbols = [];
    this.benchmark = 'QQQ';
    this.apiBase = 'https://data.alpaca.markets/v2';
    this.wsUrl = 'wss://data.alpaca.markets/v2/iex';

    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;

    // Data storage
    this.realtimeData = new Map();
    this.historicalData = new Map();
    this.lastFetchTimestamp = new Map();

    // Rate limiting
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.requestsPerMinute = 200; // Alpaca free tier limit

    // Event callbacks
    this.onDataError = null;
    this.onDataUpdate = null;

    // Bind methods
    this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
    this.handleWebSocketOpen = this.handleWebSocketOpen.bind(this);
    this.handleWebSocketError = this.handleWebSocketError.bind(this);
    this.handleWebSocketClose = this.handleWebSocketClose.bind(this);
  }

  /**
   * Initialize the data fetcher with symbols and configuration
   */
  async initialize(options = {}) {
    try {
      const { symbols, benchmark, onDataError, onDataUpdate } = options;

      this.symbols = symbols || [];
      this.benchmark = benchmark || 'QQQ';
      this.onDataError = onDataError;
      this.onDataUpdate = onDataUpdate;

      // Validate API credentials
      if (!this.validateApiCredentials()) {
        throw new Error('Missing API credentials. Check VITE_ALPACA_API_KEY_ID and VITE_ALPACA_SECRET_KEY');
      }

      // Initialize historical data cache
      await this.initializeHistoricalData();

      // Initialize WebSocket connection
      await this.initializeWebSocket();

      console.log('[RSDataFetcher] Initialized successfully');
      return true;

    } catch (error) {
      console.error('[RSDataFetcher] Initialization failed:', error);
      if (this.onDataError) {
        this.onDataError(error, 'initialization');
      }
      return false;
    }
  }

  /**
   * Validate that required API credentials are available
   */
  validateApiCredentials() {
    const apiKeyId = import.meta.env.VITE_ALPACA_API_KEY_ID;
    const secretKey = import.meta.env.VITE_ALPACA_SECRET_KEY;

    return apiKeyId && secretKey && apiKeyId !== 'your_alpaca_api_key_id';
  }

  /**
   * Initialize WebSocket connection for real-time data
   */
  async initializeWebSocket() {
    try {
      const apiKeyId = import.meta.env.VITE_ALPACA_API_KEY_ID;
      const secretKey = import.meta.env.VITE_ALPACA_SECRET_KEY;
      const dataFeed = import.meta.env.VITE_ALPACA_DATA_FEED || 'iex';

      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = this.handleWebSocketOpen;
      this.ws.onmessage = this.handleWebSocketMessage;
      this.ws.onerror = this.handleWebSocketError;
      this.ws.onclose = this.handleWebSocketClose;

      // Wait for connection
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.ws.onopen = (event) => {
          clearTimeout(timeout);
          this.handleWebSocketOpen(event);
          resolve();
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          this.handleWebSocketError(error);
          reject(error);
        };
      });

    } catch (error) {
      console.error('[RSDataFetcher] WebSocket initialization failed:', error);
      throw error;
    }
  }

  /**
   * Handle WebSocket connection open
   */
  handleWebSocketOpen(event) {
    console.log('[RSDataFetcher] WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;

    // Authenticate and subscribe to data
    this.authenticateAndSubscribe();
  }

  /**
   * Authenticate with WebSocket and subscribe to symbols
   */
  authenticateAndSubscribe() {
    try {
      const apiKeyId = import.meta.env.VITE_ALPACA_API_KEY_ID;
      const secretKey = import.meta.env.VITE_ALPACA_SECRET_KEY;
      const dataFeed = import.meta.env.VITE_ALPACA_DATA_FEED || 'iex';

      // Authentication message
      const authMessage = {
        action: 'auth',
        key: apiKeyId,
        secret: secretKey
      };

      this.ws.send(JSON.stringify(authMessage));

      // Subscribe to quotes for all symbols plus benchmark
      const allSymbols = [...new Set([...this.symbols, this.benchmark])];
      const subscribeMessage = {
        action: 'subscribe',
        quotes: allSymbols,
        trades: allSymbols
      };

      this.ws.send(JSON.stringify(subscribeMessage));

      console.log(`[RSDataFetcher] Subscribed to ${allSymbols.length} symbols`);

    } catch (error) {
      console.error('[RSDataFetcher] Authentication failed:', error);
      this.handleWebSocketError(error);
    }
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);

      // Handle authentication response
      if (data.msg === 'authenticated') {
        console.log('[RSDataFetcher] WebSocket authenticated');
        return;
      }

      // Handle subscription confirmation
      if (data.msg === 'subscribed') {
        console.log(`[RSDataFetcher] Subscribed to ${data.trades?.length || 0} trades, ${data.quotes?.length || 0} quotes`);
        return;
      }

      // Handle trade data
      if (data.T === 't') { // Trade message
        this.updateRealtimeData(data, 'trade');
      }

      // Handle quote data
      if (data.T === 'q') { // Quote message
        this.updateRealtimeData(data, 'quote');
      }

    } catch (error) {
      console.error('[RSDataFetcher] WebSocket message handling error:', error);
    }
  }

  /**
   * Update real-time data storage with WebSocket data
   */
  updateRealtimeData(data, type) {
    try {
      const symbol = data.S || data.ticker;
      if (!symbol) return;

      if (!this.realtimeData.has(symbol)) {
        this.realtimeData.set(symbol, {});
      }

      const symbolData = this.realtimeData.get(symbol);

      if (type === 'trade') {
        symbolData.lastTrade = {
          price: data.p,
          size: data.s,
          timestamp: data.t
        };
        symbolData.currentPrice = data.p;
      }

      if (type === 'quote') {
        symbolData.lastQuote = {
          bid: data.bp,
          ask: data.ap,
          bidSize: data.bs,
          askSize: data.as,
          timestamp: data.t
        };
        symbolData.currentPrice = (data.bp + data.ap) / 2; // Mid price
      }

      symbolData.lastUpdate = Date.now();

      // Notify listeners of data update
      if (this.onDataUpdate) {
        this.onDataUpdate(symbol, symbolData, type);
      }

    } catch (error) {
      console.error('[RSDataFetcher] Real-time data update error:', error);
    }
  }

  /**
   * Handle WebSocket errors
   */
  handleWebSocketError(error) {
    console.error('[RSDataFetcher] WebSocket error:', error);
    this.isConnected = false;

    if (this.onDataError) {
      this.onDataError(error, 'websocket');
    }

    // Attempt to reconnect
    this.attemptReconnect();
  }

  /**
   * Handle WebSocket close
   */
  handleWebSocketClose(event) {
    console.log('[RSDataFetcher] WebSocket closed:', event.code, event.reason);
    this.isConnected = false;

    // Attempt reconnect if not intentional
    if (event.code !== 1000) {
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect WebSocket with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RSDataFetcher] Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);

    console.log(`[RSDataFetcher] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(async () => {
      try {
        this.reconnectAttempts++;
        await this.initializeWebSocket();
      } catch (error) {
        console.error('[RSDataFetcher] Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, delay);
  }

  /**
   * Initialize historical data for all symbols
   */
  async initializeHistoricalData() {
    try {
      const allSymbols = [...new Set([...this.symbols, this.benchmark])];

      console.log(`[RSDataFetcher] Loading historical data for ${allSymbols.length} symbols...`);

      // Load daily bars for moving averages (30 days)
      await this.loadDailyBars(allSymbols, 30);

      // Load previous day's data
      await this.loadPreviousDayData(allSymbols);

      console.log('[RSDataFetcher] Historical data loaded successfully');

    } catch (error) {
      console.error('[RSDataFetcher] Historical data initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load daily bars for moving averages
   */
  async loadDailyBars(symbols, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      for (const symbol of symbols) {
        const bars = await this.fetchDailyBars(symbol, startDate, endDate);

        if (bars && bars.length > 0) {
          if (!this.historicalData.has(symbol)) {
            this.historicalData.set(symbol, {});
          }

          const symbolData = this.historicalData.get(symbol);
          symbolData.dailyBars = bars;
          symbolData.lastHistoricalUpdate = Date.now();

          // Calculate technical indicators
          symbolData.technicalIndicators = this.calculateTechnicalIndicators(bars);
        }
      }

    } catch (error) {
      console.error('[RSDataFetcher] Failed to load daily bars:', error);
      throw error;
    }
  }

  /**
   * Load previous day's closing data
   */
  async loadPreviousDayData(symbols) {
    try {
      for (const symbol of symbols) {
        const quote = await this.fetchLatestQuote(symbol);

        if (quote && quote.prev_close) {
          if (!this.historicalData.has(symbol)) {
            this.historicalData.set(symbol, {});
          }

          const symbolData = this.historicalData.get(symbol);
          symbolData.previousClose = quote.prev_close;
          symbolData.currentPrice = quote.ap || quote.bp; // Use ask or bid price
          symbolData.currentVolume = quote.ac || 0; // Accumulated volume
        }
      }

    } catch (error) {
      console.error('[RSDataFetcher] Failed to load previous day data:', error);
      throw error;
    }
  }

  /**
   * Main method to fetch data for RS calculations
   */
  async fetchDataForTimeframe(timeframe) {
    try {
      const allSymbols = [...new Set([...this.symbols, this.benchmark])];

      // Fetch current data for all symbols
      const stockData = {};
      const benchmarkData = {};

      for (const symbol of allSymbols) {
        const data = await this.getSymbolData(symbol, timeframe);

        if (symbol === this.benchmark) {
          benchmarkData[symbol] = data;
        } else {
          stockData[symbol] = data;
        }

        // Also add benchmark to stockData for individual symbol calculations
        if (symbol !== this.benchmark) {
          stockData[symbol].benchmark = benchmarkData[this.benchmark];
        }
      }

      // Make sure benchmark is also available for all symbols
      Object.keys(stockData).forEach(symbol => {
        stockData[symbol].benchmark = benchmarkData[this.benchmark];
      });

      return {
        stockData,
        benchmarkData
      };

    } catch (error) {
      console.error(`[RSDataFetcher] Failed to fetch data for ${timeframe}:`, error);
      if (this.onDataError) {
        this.onDataError(error, `fetchDataForTimeframe(${timeframe})`);
      }
      throw error;
    }
  }

  /**
   * Get comprehensive data for a single symbol
   */
  async getSymbolData(symbol, timeframe) {
    try {
      // Get real-time data
      const realtimeData = this.realtimeData.get(symbol) || {};

      // Get historical data
      const historicalData = this.historicalData.get(symbol) || {};

      // Combine data sources
      const combinedData = {
        symbol,
        timeframe,
        timestamp: Date.now(),

        // Current price data (from WebSocket or latest API call)
        currentPrice: realtimeData.currentPrice || historicalData.currentPrice,
        previousClose: historicalData.previousClose,

        // Volume data
        currentVolume: realtimeData.lastTrade?.size || historicalData.currentVolume,
        averageVolume: historicalData.averageVolume,

        // Price history for momentum calculations
        priceHistory: historicalData.dailyBars?.slice(-20).map(bar => bar.close) || [],

        // Technical indicators
        technicalIndicators: historicalData.technicalIndicators || {},

        // Real-time trades and quotes
        lastTrade: realtimeData.lastTrade,
        lastQuote: realtimeData.lastQuote,

        // ORB data if available (5-minute timeframe)
        orbPerformance: timeframe === '5m' ? await this.getORBPerformance(symbol) : null,

        // Data quality indicators
        dataQuality: this.assessDataQuality(realtimeData, historicalData),
        lastUpdate: realtimeData.lastUpdate || Date.now()
      };

      return combinedData;

    } catch (error) {
      console.error(`[RSDataFetcher] Failed to get data for ${symbol}:`, error);
      return this.createFallbackData(symbol, timeframe);
    }
  }

  /**
   * Get ORB (Opening Range Breakout) performance for a symbol
   */
  async getORBPerformance(symbol) {
    try {
      // Get first 5-minute candle of the day
      const now = new Date();
      const marketOpen = new Date(now);
      marketOpen.setHours(9, 30, 0, 0);

      const marketOpenPlus5 = new Date(marketOpen);
      marketOpenPlus5.setMinutes(marketOpenPlus5.getMinutes() + 5);

      const bars = await this.fetchIntradayBars(symbol, marketOpen, marketOpenPlus5, '5Min');

      if (bars && bars.length > 0) {
        const orbHigh = Math.max(...bars.map(bar => bar.high));
        const orbLow = Math.min(...bars.map(bar => bar.low));
        const orbRange = orbHigh - orbLow;

        const currentPrice = await this.getCurrentPrice(symbol);

        if (currentPrice && orbRange > 0) {
          // Calculate ORB performance
          const orbBreakout = (currentPrice - orbHigh) / orbRange * 100;
          return Math.max(orbBreakout, -100); // Cap at -100%
        }
      }

      return 0;

    } catch (error) {
      console.error(`[RSDataFetcher] ORB performance calculation failed for ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * Asses data quality for debugging and validation
   */
  assessDataQuality(realtimeData, historicalData) {
    const quality = {
      realtimeAvailable: false,
      historicalAvailable: false,
      staleness: 0,
      completeness: 0,
      isValid: false
    };

    // Check real-time data
    if (realtimeData && realtimeData.currentPrice) {
      quality.realtimeAvailable = true;
      quality.staleness = Date.now() - (realtimeData.lastUpdate || 0);
    }

    // Check historical data
    if (historicalData && historicalData.dailyBars) {
      quality.historicalAvailable = true;
      quality.completeness = historicalData.dailyBars.length / 30; // Expected 30 days
    }

    quality.isValid = quality.realtimeAvailable && quality.historicalAvailable;

    return quality;
  }

  /**
   * Create fallback data when real data is unavailable
   */
  createFallbackData(symbol, timeframe) {
    return {
      symbol,
      timeframe,
      timestamp: Date.now(),
      currentPrice: 0,
      previousClose: 0,
      currentVolume: 0,
      averageVolume: 0,
      priceHistory: [],
      technicalIndicators: {},
      dataQuality: { isValid: false },
      error: 'Data unavailable'
    };
  }

  // API Helper Methods

  async fetchDailyBars(symbol, startDate, endDate) {
    const url = `${this.apiBase}/stocks/${symbol}/bars?timeframe=1D&start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
    return await this.makeAPIRequest(url);
  }

  async fetchLatestQuote(symbol) {
    const url = `${this.apiBase}/stocks/${symbol}/quote/latest`;
    return await this.makeAPIRequest(url);
  }

  async fetchIntradayBars(symbol, start, end, timeframe) {
    const url = `${this.apiBase}/stocks/${symbol}/bars?timeframe=${timeframe}&start=${start.toISOString()}&end=${end.toISOString()}`;
    return await this.makeAPIRequest(url);
  }

  async getCurrentPrice(symbol) {
    // Try WebSocket data first
    const realtimeData = this.realtimeData.get(symbol);
    if (realtimeData && realtimeData.currentPrice) {
      return realtimeData.currentPrice;
    }

    // Fallback to API
    const quote = await this.fetchLatestQuote(symbol);
    return quote ? (quote.ap || quote.bp || quote.c) : null;
  }

  /**
   * Make rate-limited API request
   */
  async makeAPIRequest(url) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process request queue with rate limiting
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      await this.checkRateLimit();

      const request = this.requestQueue.shift();

      try {
        const response = await fetch(request.url, {
          headers: this.getAuthHeaders()
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        request.resolve(data);

      } catch (error) {
        console.error('[RSDataFetcher] API request failed:', error);
        request.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Check rate limiting and wait if necessary
   */
  async checkRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Reset counter if more than a minute has passed
    if (timeSinceLastRequest > 60000) {
      this.requestCount = 0;
      this.lastRequestTime = now;
      return;
    }

    // If we've hit the limit, wait
    if (this.requestCount >= this.requestsPerMinute) {
      const waitTime = 60000 - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
      return;
    }

    this.requestCount++;
    this.lastRequestTime = now;

    // Add small delay between requests
    if (this.requestCount > 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Get authentication headers for API requests
   */
  getAuthHeaders() {
    const apiKeyId = import.meta.env.VITE_ALPACA_API_KEY_ID;
    const secretKey = import.meta.env.VITE_ALPACA_SECRET_KEY;

    return {
      'APCA-API-KEY-ID': apiKeyId,
      'APCA-API-SECRET-KEY': secretKey,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Calculate basic technical indicators from daily bars
   */
  calculateTechnicalIndicators(bars) {
    if (!bars || bars.length < 10) {
      return {};
    }

    const closes = bars.map(bar => bar.close);
    const volumes = bars.map(bar => bar.volume);

    return {
      sma: this.calculateSMA(closes, 10),
      ema: this.calculateEMA(closes, 10),
      rsi: this.calculateRSI(closes, 14),
      macd: this.calculateMACD(closes),
      averageVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length
    };
  }

  /**
   * Simple Moving Average
   */
  calculateSMA(prices, period) {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Exponential Moving Average
   */
  calculateEMA(prices, period) {
    if (prices.length < period) return 0;

    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  /**
   * Relative Strength Index
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    if (losses === 0) return 100;
    if (gains === 0) return 0;

    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  }

  /**
   * MACD (Moving Average Convergence Divergence)
   */
  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    return ema12 - ema26;
  }

  /**
   * Cleanup method for graceful shutdown
   */
  destroy() {
    console.log('[RSDataFetcher] Shutting down...');

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.realtimeData.clear();
    this.historicalData.clear();
    this.requestQueue = [];

    console.log('[RSDataFetcher] Shutdown complete');
  }
}