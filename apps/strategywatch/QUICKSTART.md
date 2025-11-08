# StrategyWatch - Quick Start Guide

Get up and running in 5 minutes!

## Step 1: Get Your API Key

1. Go to [https://finnhub.io/register](https://finnhub.io/register)
2. Sign up for a free account
3. Copy your API key from the dashboard

## Step 2: Configure the App

1. Open the `.env` file in this directory
2. Replace `your_api_key_here` with your actual API key:
   ```
   VITE_FINNHUB_API_KEY=abc123xyz456
   ```
3. Save the file

## Step 3: Install Dependencies

```bash
# Make sure you're in the strategywatch directory
npm install
```

## Step 4: Start the App

```bash
npm run dev
```

The app will automatically open in your browser at `http://localhost:5173`

## Step 5: Customize Your Watchlist (Optional)

Edit `src/config/watchlist.js` to track different stocks:

```javascript
export const WATCHLIST = [
  'AAPL',  // Apple
  'TSLA',  // Tesla
  'NVDA',  // NVIDIA
  // Add your favorites here
];
```

Save the file and the app will hot-reload!

## What You'll See

### Header
- **StrategyWatch** title
- **Market Status** (Open/Closed)
- **Connection Status** (green dot = connected)
- **Current Time** (Eastern Time)

### Main Table
Columns from left to right:
1. **Ticker** - Click to copy
2. **Time** - Last update time
3. **Price** - Click to open TradingView
4. **ORB** - Opening Range Breakout score (active after 9:35am ET)
5. **10D** - 10-day EMA mean reversion score
6. **21D** - 21-day EMA mean reversion score
7. **50D** - 50-day SMA mean reversion score

### Score Colors
- 🟢 **Green (80-100)**: Strong setup - consider entry
- 🟡 **Amber (50-79)**: Developing - watch closely
- 🔴 **Red (0-49)**: Weak - avoid or wait

### Tooltips
Hover over any score to see detailed breakdown:
- Score value
- Distance from target
- Criteria checklist
- Setup assessment

## Troubleshooting

### "API key not configured"
- Check that `.env` file has your actual API key
- Ensure it starts with `VITE_FINNHUB_API_KEY=`
- Restart the dev server

### WebSocket not connecting
- Check your internet connection
- Verify API key is valid at [finnhub.io/dashboard](https://finnhub.io/dashboard)
- Free tier allows 1 WebSocket connection

### No scores showing
- Wait 10-30 seconds for historical data to load
- ORB score only appears after 9:35am ET
- Check browser console for errors

## Tips

1. **Best viewing**: 1440px+ screen width
2. **Market hours**: Most useful during 9:30am-4pm ET
3. **Click headers**: Sort by any column
4. **Performance**: App uses ~50MB RAM for 30 tickers

## Next Steps

- Read the full [README.md](./README.md) for detailed docs
- Customize strategy thresholds in `src/config/constants.js`
- Adjust colors in `src/styles/variables.css`

## Need Help?

Check the main README or create an issue on GitHub.

Happy trading! 📈
