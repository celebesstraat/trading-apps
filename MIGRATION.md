# Migration Guide: Finnhub → Alpaca Markets

This guide explains the migration from Finnhub.io to Alpaca Markets as the market data provider.

## Why Alpaca Markets?

### Key Improvements

| Feature | Finnhub (Free) | Alpaca (Free) |
|---------|---------------|---------------|
| **Rate Limit** | 60 calls/min | 200 calls/min (3.3x more) |
| **Real-time Data** | Delayed 15 min | Real-time IEX exchange |
| **WebSocket Quality** | Basic, delayed | Enterprise-grade, real-time |
| **Data Quality** | Mixed sources | Official IEX exchange |
| **WebSocket Symbols** | Limited | 30 symbols |
| **Upgrade Path** | Limited | SIP feed ($99/mo) |

### Benefits

✅ **3.3x more API calls** - Poll more frequently or track more stocks
✅ **Real-time data** - IEX exchange data with no delay on free tier
✅ **Better WebSocket** - Reliable real-time streaming with auto-reconnection
✅ **Modern API** - RESTful design with excellent documentation
✅ **Future-proof** - Easy upgrade to consolidated tape (SIP) if needed

## What Changed?

### Architecture

**Before (Finnhub):**
```
strategywatch/
├── services/
│   ├── finnhubAPI.js          # Finnhub-specific REST client
│   └── (other services)
└── hooks/
    └── useFinnhubWebSocket.js # Finnhub-specific WebSocket hook
```

**After (Alpaca):**
```
packages/
└── market-data/               # NEW: Shared package
    ├── src/
    │   ├── providers/
    │   │   └── alpaca/        # Alpaca implementation
    │   ├── hooks/             # React hooks
    │   └── utils/             # Utilities

strategywatch/
├── services/
│   └── marketData.js          # App wrapper (provider-agnostic)
└── hooks/
    └── useRealtimePrice.js    # App-specific hook
```

### API Changes

#### REST API

**Before (Finnhub):**
```javascript
import { fetchQuote } from '../services/finnhubAPI';

const quote = await fetchQuote('AAPL');
// Returns: { c: price, h: high, l: low, o: open, pc: prevClose, t: timestamp }
```

**After (Alpaca):**
```javascript
import { fetchQuote } from '../services/marketData';

const quote = await fetchQuote('AAPL');
// Returns: { price, high, low, open, previousClose, timestamp }
// Same data, slightly different property names (normalized)
```

#### WebSocket

**Before (Finnhub):**
```javascript
import { useFinnhubWebSocket } from '../hooks/useFinnhubWebSocket';

const { prices, connected, error } = useFinnhubWebSocket(symbols);
// Receives delayed trades
```

**After (Alpaca):**
```javascript
import { useRealtimePrice } from '../hooks/useRealtimePrice';

const { prices, connected, error } = useRealtimePrice(symbols);
// Receives real-time trades, quotes, and bars
```

### Environment Variables

**Before:**
```env
VITE_FINNHUB_API_KEY=your_api_key
```

**After:**
```env
VITE_ALPACA_API_KEY_ID=your_key_id
VITE_ALPACA_SECRET_KEY=your_secret_key
VITE_ALPACA_DATA_FEED=iex
```

## Setup Instructions

### 1. Get Alpaca API Keys

1. Sign up at [Alpaca Markets](https://alpaca.markets/)
2. Navigate to [API Keys section](https://alpaca.markets/docs/market-data/getting-started/)
3. Generate new API keys (free tier is sufficient)
4. Save your **API Key ID** and **Secret Key**

### 2. Install Dependencies

```bash
# From monorepo root
npm install

# This will link the @trading-apps/market-data package
```

### 3. Configure Environment

Create `.env` file in `apps/strategywatch/`:

```env
VITE_ALPACA_API_KEY_ID=your_key_id_here
VITE_ALPACA_SECRET_KEY=your_secret_key_here
VITE_ALPACA_DATA_FEED=iex
```

### 4. Remove Old Configuration

You can remove the old Finnhub API key from your environment:

```bash
# No longer needed
# VITE_FINNHUB_API_KEY=...
```

### 5. Start the App

```bash
npm run dev:strategywatch
```

## Migration Checklist

- [x] Shared market-data package created
- [x] Alpaca REST client implemented
- [x] Alpaca WebSocket client with reconnection
- [x] React hooks for real-time data
- [x] StrategyWatch app updated
- [x] Configuration constants updated
- [ ] Environment variables configured (user action)
- [ ] Testing with real market data

## Breaking Changes

### None for End Users!

The migration is **fully backward compatible** at the UI level. The same functionality works the same way, just with better data quality and performance.

### For Developers

If you're extending the app or adding features:

1. **Import changes**: Use `marketData.js` instead of `finnhubAPI.js`
2. **Hook changes**: Use `useRealtimePrice` instead of `useFinnhubWebSocket`
3. **Data format**: Some property names are normalized (see API Changes above)

## Troubleshooting

### "API keys not configured" Error

**Solution:** Create `.env` file with Alpaca credentials in `apps/strategywatch/`

### WebSocket Not Connecting

**Possible causes:**
1. Invalid API keys - verify on Alpaca dashboard
2. Exceeded symbol limit (30 on free tier)
3. Network/firewall blocking WebSocket connections

**Debug:** Check browser console for detailed error messages

### Rate Limiting

**Free tier:** 200 calls/minute

If you hit rate limits:
- The app will automatically retry with backoff
- Consider using WebSocket mode (DATA_MODE='hybrid') to reduce REST calls
- Reduce polling frequency in constants.js

### No Data for Symbol

**Possible causes:**
1. Symbol not available on IEX exchange
2. Market closed (pre/post-market data may be limited)
3. Invalid symbol ticker

**Solution:** Verify symbol exists and is traded on IEX

## Rollback (if needed)

If you need to rollback to Finnhub:

1. Keep the old `services/finnhubAPI.js` file
2. Revert imports in `DataContext.jsx`:
   ```javascript
   import { useFinnhubWebSocket } from '../hooks/useFinnhubWebSocket';
   import { fetchDailyCandlesBatch, fetchQuoteBatch } from '../services/finnhubAPI';
   ```
3. Restore VITE_FINNHUB_API_KEY in `.env`

## Future Enhancements

The new architecture makes it easy to:

1. **Add more providers** - Polygon.io, IEX Cloud, etc.
2. **Provider switching** - Change provider via config
3. **Multi-app support** - Share market data across all trading apps
4. **Advanced features** - Options data, crypto, news feeds

## Support

- **Alpaca Docs**: https://alpaca.markets/docs/market-data/
- **Package README**: `packages/market-data/README.md`
- **Issues**: File in the monorepo's issue tracker

---

**Migration Status**: ✅ Complete
**Recommended Action**: Configure environment variables and test
