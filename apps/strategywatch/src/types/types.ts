/**
 * Core data types for the StrategyWatch application.
 */

// Represents a single real-time price update from the WebSocket.
export interface Tick {
  ticker: string;
  price: number;
  volume: number;
  timestamp: number;
}

// Represents a snapshot of a ticker's current price data.
export interface Quote {
  ticker: string;
  lastPrice: number;
  prevClose: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  timestamp: number;
  turnover: number;
  marketCap: number;
}

// Alternative Quote format from marketData service
export interface QuoteData {
  price: number;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
}

// Represents a single candlestick bar (e.g., 1-minute, 5-minute, 1-day).
export interface Bar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date?: string; // For historical candles grouped by date
}

// Represents candle data in Finnhub-compatible format
export interface FinnhubCandles {
  c: number[]; // close prices
  h: number[]; // high prices
  l: number[]; // low prices
  o: number[]; // open prices
  v: number[]; // volumes
  t: number[]; // timestamps (Unix seconds)
  s: 'ok' | 'no_data';
}

// Represents the output of a single strategy calculation.
export interface StrategyScore {
  score: number | null;
  details: Record<string, any>;
  error?: string | null;
}

// ORB strategy specific types
export interface ORBData {
  tier: number | null;
  status: string;
  rvol: number | null;
  priceOK: boolean;
  openPos?: string;
  closePos?: string;
  bodyRatio?: string;
  isGreen?: boolean;
  isRed?: boolean;
  historicalSamples: number;
  candle?: Bar; // First 5-minute candle data
  avgVolume?: number; // Average volume
}

// RVol calculation result
export interface RVolResult {
  rvol: number | null;
  error: string | null;
}

// VRS calculation result
export interface VRSResult {
  value: number | null;
  error: string | null;
  vrs1m?: { value: number; timestamp: number };
  vrs5m?: { value: number; timestamp: number };
  vrs15m?: { value: number; timestamp: number };
}

// Extended RVol result for progress tracking
export interface ExtendedRVolResult extends RVolResult {
  currentCumulative: number;
  avgCumulative: number;
  minutesSinceOpen: number;
  dataPoints: number;
}

// Represents complete data for a single ticker in the watchlist.
export interface TickerData {
  ticker: string;
  quote: Quote | null;
  dailyBar: Bar | null;
  intradayBars: Bar[];
  orbScore: StrategyScore | null;
  inmereloScore: StrategyScore | null;
  rvol: RVolResult;
  vrs: VRSResult;
  lastUpdated: number;
  isLoading: boolean;
  error: string | null;
  currentQuote?: CurrentQuote; // Current quote data
  ticks?: Tick[];
  strategies?: Record<string, any>;
}

// Market data types from API responses
export interface PriceData {
  price: number;
  timestamp: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose: number;
  volume?: number;
}

// Moving averages data structure
export interface MovingAverages {
  [key: string]: number | null | undefined;
  sma5: number | null;
  ema10: number | null;
  ema21: number | null;
  sma50: number | null;
  sma65: number | null;
  sma100: number | null;
  sma200: number | null;
  adr20?: number; // Average Daily Range 20-day
}

// Market status types
export interface MarketStatus {
  isOpen: boolean;
  isPreMarket: boolean;
  isAfterHours: boolean;
  nextOpen: Date;
  nextClose: Date;
  status?: string; // Human-readable status
  nextStatus?: string; // Next status description
}

// Header component market status props
export interface MarketStatusHeader {
  status: string;
  nextStatus: string;
}

// Loading progress tracking
export interface LoadingProgress {
  stage: string;
  completed: number;
  total: number;
}

// API configuration status
export interface APIStatus {
  configured: boolean;
  provider: string;
  capabilities: string[];
  apiKeyId: string;
}

// Connection state for WebSocket
export interface ConnectionState {
  connected: boolean;
  reconnecting: boolean;
  lastConnected: number | null;
  error: string | null;
}

// Ticker row props
export interface TickerRowProps {
  ticker: string;
  priceData: PriceData | null;
  movingAverages: MovingAverages;
  orb5mData: ORBData | null;
  rvolData: RVolResult;
  vrsData?: VRSResult;
}

// Footer component props
export interface FooterProps {
  _tickerCount?: number; // Internal ticker count
}

// Data context type
export interface DataContextType {
  tickers: string[];
  prices: Record<string, PriceData>;
  historicalData: Record<string, FinnhubCandles>;
  movingAverages: Record<string, MovingAverages>;
  orb5mData: Record<string, ORBData>;
  rvolData: Record<string, RVolResult>;
  vrsData: Record<string, VRSResult>;
  realtimeIndicators: Record<string, any>;
  connected: boolean;
  marketOpen: boolean;
  currentTime: string;
  marketStatus: MarketStatus;
  isHoliday: boolean;
  isWeekend: boolean;
  isLoading: boolean;
  loading: boolean;
  loadingProgress: LoadingProgress;
  error: string | null;
  lastUpdate: number | null;
  apiConfigured: boolean;
  isLiveMode: boolean;
  globalMuted: boolean;
  setGlobalMuted: (muted: boolean) => void;
  toggleLiveMode: () => void;
  rsEngineData?: any;
}

// ORB Strategy configuration
export interface ORBConfig {
  lowerQuantile: number;
  upperQuantile: number;
  minBodyFrac: number;
  requireGreen: boolean;
  rvolTier1: number;
  rvolTier2: number;
  minSamples: number;
}

// ORB strategy parameters
export interface ORBParams {
  first5mCandle: Bar | null;
  historicalFirst5mCandles: Bar[];
  config?: Partial<ORBConfig>;
}

// VRS calculation parameters
export interface VRS5mParams {
  stockCurrentClose: number;
  stockPreviousClose: number;
  stockADRPercent: number;
  benchmarkCurrentClose: number;
  benchmarkPreviousClose: number;
  benchmarkADRPercent: number;
}

// ADR announcement parameters
export interface ADRAnnounceParams {
  symbol: string;
  currentPrice: number;
  dayOpen: number;
  adrPercent: number;
}

// Bar with VWAP
export interface BarWithVWAP {
  price: number;
  vwap: number | null;
  volume: number;
  timestamp: number;
}

// Historical candles grouped by date
export interface HistoricalCandlesByDate {
  date: string;
  candles: Bar[];
}

// Additional types needed for services

// News item type
export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  summary: string;
  timestamp: number;
  symbols: string[];
}

// Indicator data interface
export interface IndicatorData {
  symbol: string;
  timestamp: number;
  sma?: number[];
  ema?: number[];
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollinger?: {
    upper: number;
    middle: number;
    lower: number;
  };
  [key: string]: any;
}

// Strategy result interface
export interface StrategyResult {
  symbol: string;
  strategy: string;
  score: number | null;
  timestamp: number;
  details: Record<string, any>;
  error?: string;
}

// Enhanced Tick with validation
export interface ValidatedTick extends Tick {
  validatedAt: number;
  isValid: boolean;
}

// Enhanced Bar with additional properties
export interface EnhancedBar extends Bar {
  symbol?: string;
  trades?: number;
  vwap?: number;
}

// Data Lake query options
export interface QueryOptions {
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  timeframe?: string;
}

// Performance statistics
export interface PerformanceStats {
  engineStatus: string;
  wsConnected: boolean;
  cacheHitRate: number;
  queryCount: number;
  dataQuality: number;
  apiCallsRemaining: number;
  lastUpdate: number;
}

// VRS object with multiple timeframes
export interface VRSObject {
  vrs1m?: { value: number; timestamp: number };
  vrs5m?: { value: number; timestamp: number };
  vrs15m?: { value: number; timestamp: number };
  timestamp?: number;
}

// Current quote data
export interface CurrentQuote {
  price: number;
  size?: number;
  timestamp: number;
  exchange?: string;
}

// Window global for data lake utilities
declare global {
  interface Window {
    dataLakeUtils?: {
      getDataLakeStats: () => any;
      cleanupOldData: () => Promise<void>;
      clearDataLake: () => Promise<void>;
      forceSchemaUpgrade: () => Promise<void>;
    };
    clearStrategyWatchCache?: () => void;
  }
}

// NodeJS Timer types for browser compatibility
type Timer = ReturnType<typeof setTimeout>;

// Extended navigation for performance monitoring
interface NavigatorConnection {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

interface NavigatorExtended extends Navigator {
  connection?: NavigatorConnection;
  deviceMemory?: number;
}

// Performance entry with additional properties
interface PerformanceEntryExtended extends PerformanceEntry {
  transferSize?: number;
  decodedBodySize?: number;
}

// Data to be cached
export interface CacheData {
  historicalData: Record<string, FinnhubCandles>;
  movingAverages: Record<string, MovingAverages>;
  mergedPrices: Record<string, PriceData>;
  rvolData?: Record<string, RVolResult>;
}
