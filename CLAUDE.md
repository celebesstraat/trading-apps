# StrategyWatch Platform

**Real-time analytics platform for US stock trading with institutional-grade data architecture.**

This monorepo houses a powerful suite of trading applications built on a unified data infrastructure. The flagship StrategyWatch app delivers sub-second market analytics with advanced caching, real-time calculations, and intelligent data synchronization.

---

## Quick Start

```bash
# Install & run
npm install
npm run dev:strategywatch

# Production build
npm run build:strategywatch

# Code quality
npm run lint
npm run type-check
```

**Environment Setup** (`apps/strategywatch/.env`):
```env
VITE_ALPACA_API_KEY_ID=your_alpaca_key_id
VITE_ALPACA_SECRET_KEY=your_alpaca_secret
VITE_ALPACA_DATA_FEED=iex
```

---

## Architecture

### Unified Data Platform v2.0

StrategyWatch is built on a sophisticated **4-layer data architecture** providing instant cache access, real-time WebSocket feeds, and intelligent background synchronization:

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (React + TypeScript)                              │
│  ├─ UnifiedDataProvider (Context API)                       │
│  └─ Component Tree (Header, Table, Rows, Cells)             │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  Orchestration Layer                                         │
│  ├─ DataIngestionEngine (Event-driven coordinator)          │
│  ├─ QueryOptimizer (Multi-level caching + batching)         │
│  └─ RealTimeCalculationEngine (Accurate indicators)         │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  Data Lake (IndexedDB)                                       │
│  ├─ Ticks (1-day retention, real-time)                      │
│  ├─ Minute Candles (30-day, constructed from ticks)         │
│  ├─ 5m Candles (30-day, RVol calculations)                  │
│  ├─ Daily Candles (250-day, moving averages)                │
│  ├─ Indicators Cache (pre-computed, 2hr TTL)                │
│  └─ Strategy Results (7-day, scored outputs)                │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  Market Data Provider (Alpaca Markets)                       │
│  ├─ WebSocket: Real-time ticks (unlimited, IEX)             │
│  └─ REST API: Historical data (200 calls/min)               │
└─────────────────────────────────────────────────────────────┘
```

### Core Services

**Data Ingestion Engine** (`dataIngestionEngine.ts`)
- Event-driven coordinator for all data flows
- WebSocket connection management with exponential backoff
- Intelligent rate limiting (200 RPM with 80% safety margin)
- Background sync scheduling and maintenance tasks
- Data quality scoring and health monitoring

**Data Lake** (`dataLake.ts`)
- IndexedDB-based storage with optimized schema
- Automatic retention policies and cleanup
- Compression for tick data
- Performance analytics and query tracking
- Migration utilities for schema upgrades

**Query Optimizer** (`queryOptimizer.ts`)
- Multi-level TTL-based caching (5s quotes, 60s indicators)
- Batch query processing for efficiency
- Pre-computation of common indicators
- Cache hit rate tracking and optimization

**Real-Time Calculation Engine** (`realtimeCalculationEngine.ts`)
- Accurate tick-by-tick indicator updates
- Minute candle aggregation from raw ticks
- Real-time VRS (Volume Relative Strength) calculations
- Tick validation and anomaly detection

**Unified Data Provider** (`UnifiedDataProvider.tsx`)
- Single React Context for all market data
- Automatic migration from legacy architecture
- Status tracking (loading, connected, error states)
- Performance stats exposure for debugging

### Strategy Engine

**ORB (Opening Range Breakout)**
- Monitors first 5-minute candle (9:30-9:35 AM ET)
- Detects breakouts above/below opening range
- Outputs 0-100 score for trade setup quality

**RVol (Relative Volume)**
- Compares current volume to 30-day average
- Uses 5-minute intraday candles
- Identifies unusual volume spikes

**VRS (Volume Relative Strength)**
- Multi-timeframe analysis (1m, 5m, 15m)
- Real-time strength vs. benchmark (SPY)
- Computed from live tick data

**INMERELO (Mean Reversion)**
- 10D/21D/50D moving average confluence
- Distance from key levels
- RAG scoring for reversal probability

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 + Vite 5 |
| **Language** | TypeScript (strict mode) |
| **State** | React Context API + Event Emitters |
| **Storage** | IndexedDB (with DataLake abstraction) |
| **Data Source** | Alpaca Markets (WebSocket + REST) |
| **Styling** | CSS Modules + CSS Variables |
| **Build** | Vite (ESM, code splitting) |
| **Deploy** | Vercel (static site) |

---

## Project Structure

```
apps/strategywatch/
├── src/
│   ├── components/          # React UI components
│   │   ├── Header.tsx
│   │   ├── WatchlistTable.tsx
│   │   ├── TickerRow.tsx   # Memoized for performance
│   │   └── HeatmapCell.tsx # RAG color-coded cells
│   ├── context/
│   │   └── UnifiedDataProvider.tsx  # Main data context
│   ├── services/
│   │   ├── dataLake.ts              # IndexedDB abstraction
│   │   ├── dataIngestionEngine.ts   # Orchestrator
│   │   ├── queryOptimizer.ts        # Caching layer
│   │   ├── realtimeCalculationEngine.ts
│   │   ├── marketData.ts            # Alpaca provider
│   │   ├── calculations.ts          # Indicators
│   │   └── marketCalendar.ts        # Trading hours
│   ├── types/
│   │   └── types.ts                 # TypeScript definitions
│   ├── config/
│   │   ├── watchlist.ts             # Symbol list
│   │   └── constants.ts             # Strategy params
│   └── utils/
│       ├── rvolCalculations.ts
│       ├── marketTime.ts
│       └── voiceAlerts.ts
├── tsconfig.json
└── vite.config.js
```

---

## Key Patterns

### Event-Driven Architecture
All data flows through event emitters. Subscribers receive updates via:
```typescript
engine.on('tick', (data) => { /* handle tick */ })
engine.on('quote', (data) => { /* handle quote */ })
engine.on('indicators', (data) => { /* handle indicators */ })
engine.on('strategies', (data) => { /* handle strategies */ })
```

### Intelligent Caching
Three-tier cache strategy:
1. **Query Optimizer Cache** (in-memory, 5s-5min TTL)
2. **Data Lake Cache** (IndexedDB, hours to days)
3. **Background Refresh** (periodic sync when stale)

### Performance First
- React.memo on heavy components (TickerRow)
- Batched API calls (max 3 concurrent)
- Debounced WebSocket updates (100ms)
- CSS-based rendering (no runtime styles)
- Code splitting via Vite

### Type Safety
Full TypeScript coverage with strict mode:
- `Tick`, `Bar`, `Quote` types for market data
- `StrategyScore`, `IndicatorData` for calculations
- `TickerData` composite type for unified data structure

---

## Data Flow

**Startup Sequence:**
1. Load cached data from Data Lake (instant UI)
2. Initialize WebSocket connection
3. Start real-time calculation engine
4. Begin background data synchronization
5. Schedule maintenance tasks (cleanup every 6h)

**Real-Time Updates:**
```
WebSocket Tick → DataIngestionEngine → RealTimeCalcEngine
                       ↓
                   Store in DataLake
                       ↓
                 Update Query Cache
                       ↓
                Emit to UI Subscribers
```

**Historical Data Sync:**
```
QueryOptimizer checks cache → Miss → DataIngestionEngine
                                          ↓
                                   Check rate limit
                                          ↓
                                    Fetch from API
                                          ↓
                                   Store in DataLake
                                          ↓
                                  Calculate indicators
                                          ↓
                                    Update cache
```

---

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- No `any` types without justification
- Prefer functional components with hooks
- Extract complex logic to services
- Keep components under 300 lines

### Performance
- Always memoize heavy list items
- Batch state updates where possible
- Use `useCallback` for expensive functions
- Profile with React DevTools before optimization

### Data Access
**✅ Correct:**
```typescript
const { data, getSymbolData } = useUnifiedData();
const symbolData = getSymbolData('AAPL');
```

**❌ Incorrect:**
```typescript
// Don't fetch directly from services in components
const data = await dataLake.getTickerData('AAPL');
```

### Error Handling
- All service methods should catch and log errors
- UI should show graceful degradation, never crash
- WebSocket errors trigger automatic reconnection
- API errors respect rate limits

---

## Market Data

**Alpaca Markets** (single source strategy):
- **WebSocket**: Unlimited real-time IEX feed
- **REST API**: 200 calls/min (80% safety margin = 160)
- **Data Feed**: IEX (free tier, major US stocks/ETFs)

**Typical API Usage:**
- **Startup**: ~60 calls (30 tickers × 2: daily bars + quotes)
- **Market Hours**: ~5-10 calls/min (background refresh)
- **After Hours**: ~1 call/min (status checks)

**WebSocket Handling:**
- Exponential backoff on reconnection (1s, 1.5s, 2.25s...)
- Max 5 retry attempts before error state
- Special handling for connection limit errors (60s wait)

---

## Configuration

### Watchlist (`config/watchlist.ts`)
```typescript
export const WATCHLIST = [
  'SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', // ... 25-30 symbols
];
```

### Strategy Constants (`config/constants.ts`)
```typescript
export const ORB_CONFIG = {
  BREAKOUT_THRESHOLD: 0.002, // 0.2% move
  TIME_WINDOW: 5, // minutes
};

export const RVOL_CONFIG = {
  LOOKBACK_DAYS: 30,
  THRESHOLD: 1.5, // 150% of average
};
```

### Retention Policies (`dataLake.ts`)
```typescript
const RETENTION = {
  TICKS: 24 * 60 * 60 * 1000,           // 1 day
  MINUTE_CANDLES: 30 * 24 * 60 * 60 * 1000, // 30 days
  FIVE_MIN_CANDLES: 30 * 24 * 60 * 60 * 1000, // 30 days
  DAILY_CANDLES: 250 * 24 * 60 * 60 * 1000,  // 250 days
  INDICATORS: 30 * 24 * 60 * 60 * 1000,      // 30 days
  STRATEGY_RESULTS: 7 * 24 * 60 * 60 * 1000, // 7 days
};
```

---

## Debugging

### Browser Console Utilities
```javascript
// Available in browser console
window.dataLakeUtils.getDataLakeStats()    // Storage stats
window.dataLakeUtils.cleanupOldData()      // Manual cleanup
window.dataLakeUtils.clearDataLake()       // Reset all data
window.dataLakeUtils.forceSchemaUpgrade()  // Fix corruption
```

### Performance Stats
Development mode shows live performance banner:
- Engine status
- WebSocket connection state
- Cache hit rate
- Query count
- Data quality score

### Common Debug Commands
```typescript
// In component using useUnifiedData
const { getPerformanceStats } = useUnifiedData();
console.log(getPerformanceStats());

// Engine status
engine.getStatus() // isRunning, apiCallsInWindow, dataQuality, etc.
```

---

## Deployment

**Production Build:**
```bash
npm run build:prod  # Clean + lint + type-check + build
```

**Vercel Deployment:**
1. Connect GitHub repo
2. Set environment variables (Alpaca keys)
3. Build command: `npm run build:strategywatch`
4. Output directory: `apps/strategywatch/dist`

**Environment Variables (Production):**
```
VITE_ALPACA_API_KEY_ID=pk_***
VITE_ALPACA_SECRET_KEY=***
VITE_ALPACA_DATA_FEED=iex
VITE_ALPACA_SANDBOX=false
```

---

## Troubleshooting

**WebSocket won't connect:**
- Check Alpaca API credentials
- Verify IEX subscription active
- Look for "connection limit exceeded" (close other tabs)
- Check browser console for error messages

**Data not loading:**
- Open browser DevTools → Application → IndexedDB
- Check `strategywatch-data-lake-v3` database exists
- Run `window.dataLakeUtils.getDataLakeStats()`
- If corrupted: `window.dataLakeUtils.forceSchemaUpgrade()`

**Slow performance:**
- Check cache hit rate in performance banner
- Run cleanup: `window.dataLakeUtils.cleanupOldData()`
- Profile with React DevTools
- Check API rate limit status

**TypeScript errors:**
```bash
npm run type-check  # See all type errors
npm run lint:fix    # Auto-fix linting issues
```

---

## Future Enhancements

**Planned Features:**
- [ ] Multi-symbol correlation analysis
- [ ] Advanced chart visualizations (TradingView integration)
- [ ] Custom strategy builder (visual programming)
- [ ] Alert management system (SMS/email/push)
- [ ] Portfolio tracking integration
- [ ] Options flow analysis
- [ ] News sentiment scoring
- [ ] Machine learning signal validation

**Shared Packages (Roadmap):**
- `@trading-apps/api-clients` - Reusable provider abstractions
- `@trading-apps/indicators` - Technical analysis library
- `@trading-apps/ui` - Shared component library
- `@trading-apps/types` - Common TypeScript definitions

---

## License & Disclaimer

**MIT License** - Open source for educational purposes.

**⚠️ Trading Disclaimer:**
This software is for informational and educational purposes only. It does not constitute financial advice. Trading involves substantial risk of loss. Always conduct your own research and consult licensed financial professionals before making investment decisions.
