# Quick Start Guide - Alpaca Markets Integration

Get up and running with the new Alpaca Markets integration in 5 minutes.

## Prerequisites

- Node.js 16+ installed
- Git repository cloned
- Text editor (VS Code recommended)

## Step 1: Get Alpaca API Keys (2 minutes)

1. Go to [Alpaca Markets](https://alpaca.markets/)
2. Click "Sign Up" (it's free!)
3. Complete registration
4. Navigate to: **Dashboard → API Keys**
5. Click **"Generate New Keys"**
6. Copy your:
   - API Key ID
   - Secret Key

💡 **Tip**: Free tier gives you real-time IEX data - no credit card needed!

## Step 2: Configure Environment (1 minute)

1. Navigate to the strategywatch app:
   ```bash
   cd apps/strategywatch
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and paste your credentials:
   ```env
   VITE_ALPACA_API_KEY_ID=PKxxxxxxxxxxxxxxxxxx
   VITE_ALPACA_SECRET_KEY=your_secret_key_here
   VITE_ALPACA_DATA_FEED=iex
   ```

4. Save the file

## Step 3: Install Dependencies (1 minute)

From the monorepo root:

```bash
npm install
```

This will:
- Install all dependencies
- Link the `@trading-apps/market-data` package
- Set up the workspace

## Step 4: Start the App (30 seconds)

```bash
npm run dev:strategywatch
```

You should see:
```
VITE v7.x.x ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## Step 5: Verify (30 seconds)

1. Open http://localhost:5173/ in your browser
2. You should see the StrategyWatch dashboard
3. Check the connection indicator (top right):
   - 🟢 Green = Connected to Alpaca WebSocket
   - 🔴 Red = Check your API keys

## Troubleshooting

### "API keys not configured" Error

**Cause**: Environment variables not set correctly

**Fix**:
1. Verify `.env` file exists in `apps/strategywatch/`
2. Check API keys are correct (no quotes, no extra spaces)
3. Restart the dev server after changing `.env`

### WebSocket Not Connecting

**Possible causes**:
- Invalid API keys
- Firewall blocking WebSocket connections
- Free tier symbol limit exceeded (30 max)

**Debug**:
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Look for Alpaca WebSocket messages

### Build Errors

**Fix**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Try building
npm run build:strategywatch
```

### Rate Limit Errors

**Fix**:
- Wait 1 minute for rate limit to reset
- App will automatically retry with backoff
- Consider using WebSocket mode (already default)

## What's Different from Finnhub?

| Feature | Old (Finnhub) | New (Alpaca) |
|---------|--------------|--------------|
| **API Keys** | Single key | Key ID + Secret |
| **Rate Limit** | 60/min | 200/min |
| **Data Latency** | 15 min delay | Real-time |
| **Cost** | Free | Free (IEX) |

## Configuration Options

### Data Mode

In `apps/strategywatch/src/config/constants.js`:

```javascript
export const DATA_MODE = 'hybrid'; // or 'rest'
```

- **'hybrid'** (default): WebSocket + REST fallback (real-time)
- **'rest'**: REST polling only (more reliable, slight delay)

### Polling Frequency

```javascript
export const UPDATE_INTERVALS = {
  REST_QUOTE_POLL_MS: 5000, // Poll every 5 seconds
  // ...
};
```

### Data Feed

In `.env`:
```env
# Free tier (real-time IEX)
VITE_ALPACA_DATA_FEED=iex

# Paid tier (consolidated tape, all exchanges)
VITE_ALPACA_DATA_FEED=sip
```

## Verification Checklist

- [ ] App loads without errors
- [ ] Connection indicator is green
- [ ] Stock prices are updating
- [ ] WebSocket messages in console (if hybrid mode)
- [ ] No rate limit errors
- [ ] Market data is recent (check timestamp)

## Next Steps

1. **Customize Watchlist**: Edit `apps/strategywatch/src/config/watchlist.js`
2. **Add Strategies**: Explore `apps/strategywatch/src/strategies/`
3. **Read Migration Guide**: See `MIGRATION.md` for details
4. **Explore Package**: Check `packages/market-data/README.md`

## Getting Help

### Common Issues

1. **No data showing**: Check market hours (9:30 AM - 4:00 PM ET)
2. **Delayed updates**: Switch to 'hybrid' mode for WebSocket
3. **Connection drops**: Auto-reconnection built-in, just wait

### Logs

Enable debug logging in browser console:
```javascript
localStorage.debug = '*';
```

### Documentation

- Package README: `packages/market-data/README.md`
- Migration Guide: `MIGRATION.md`
- Implementation Summary: `IMPLEMENTATION_SUMMARY.md`

## Success!

If you see:
- ✅ Green connection indicator
- ✅ Stock prices updating
- ✅ Heatmap colors changing
- ✅ No console errors

**You're all set!** 🎉

Enjoy your upgraded, real-time market data experience with Alpaca Markets.

---

**Total Setup Time**: ~5 minutes

**Difficulty**: Easy ⭐

**Result**: Real-time market data + better rate limits 🚀
