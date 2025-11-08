# StrategyWatch

Real-time trading strategy monitor displaying trade setup quality for watchlist stocks using proprietary strategies.

![StrategyWatch Dashboard](screenshot.png)

## Features

- **Real-Time Monitoring**: Track 20-30 stocks simultaneously via WebSocket
- **Two Trading Strategies**:
  - **ORB (Opening Range Breakout)**: Monitors first 5-minute candle for breakout opportunities
  - **INMERELO (Intraday Mean Reversion Long)**: Signals when price approaches key moving averages (10D/21D/50D)
- **RAG Heatmap**: Continuous color gradient from Red (0) → Amber (50) → Green (100)
- **Live Score Updates**: Strategy scores recalculate with each price tick
- **Market Hours Detection**: Automatically adjusts display based on market status

## Tech Stack

- **Frontend**: React 18 + Vite
- **Data Source**: Finnhub API (Free Tier)
  - WebSocket for real-time prices (unlimited)
  - REST API for historical data (60 calls/min)
- **Styling**: Pure CSS with CSS Variables
- **Deployment Ready**: Static site compatible with Vercel/Netlify

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- Finnhub API key (free at [finnhub.io](https://finnhub.io/register))

### Installation

1. **Clone the repository** (if in monorepo, navigate to the app):
   ```bash
   cd apps/strategywatch
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure API key**:
   ```bash
   # Copy the example env file
   cp .env.example .env

   # Edit .env and add your Finnhub API key
   # VITE_FINNHUB_API_KEY=your_api_key_here
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   ```
   http://localhost:5173
   ```

## Configuration

### Watchlist

Edit the watchlist in `src/config/watchlist.js`:

```javascript
export const WATCHLIST = [
  'AAPL', 'TSLA', 'NVDA', // ... add your tickers
];
```

### Strategy Thresholds

Adjust strategy parameters in `src/config/constants.js`:

```javascript
export const ORB_THRESHOLDS = {
  MIN_RANGE_PERCENT: 0.3,
  MIN_BODY_RATIO: 0.7,
  // ...
};

export const INMERELO_THRESHOLDS = {
  GREEN_MIN_DISTANCE: 0.1,
  GREEN_MAX_DISTANCE: 0.5,
  // ...
};
```

### Color Scheme

Customize colors in `src/styles/variables.css`:

```css
:root {
  --bg-primary: #0a0e27;
  --green-100: #00e676;
  /* ... */
}
```

## Strategies Explained

### ORB (Opening Range Breakout)

**Concept**: The first 5 minutes (9:30-9:35 ET) establish the day's range. Breakouts above this range with "strong" characteristics often lead to continued momentum.

**Strong Criteria**:
1. ✅ Range ≥ 0.3% of price (volatility)
2. ✅ Close in top 70% of range (bullish candle)
3. ✅ Volume ≥ 2x average first 5m volume
4. ✅ Green candle (Close > Open)

**Scoring**:
- **Green (80-100)**: All 4 criteria + price 0.1-0.5% above high
- **Amber (50-79)**: 3/4 criteria + price near high
- **Red (0-49)**: < 3 criteria OR below high

### INMERELO (Intraday Mean Reversion Long)

**Concept**: Price tends to bounce off key moving averages. Signal when price approaches these levels for potential long entries.

**Moving Averages Monitored**:
- **10D EMA**: Short-term support
- **21D EMA**: Momentum support
- **50D SMA**: Major support

**Scoring (per MA)**:
- **Green (80-100)**: Price 0.1-0.5% from MA + bouncing + volume up
- **Amber (50-79)**: Price 0.5-1.5% from MA + approaching
- **Red (0-49)**: Price > 1.5% from MA OR below MA

## Project Structure

```
src/
├── components/        # React components
│   ├── Header.jsx
│   ├── Footer.jsx
│   ├── WatchlistTable.jsx
│   ├── TickerRow.jsx
│   ├── HeatmapCell.jsx
│   └── Tooltip.jsx
├── config/           # Configuration files
│   ├── watchlist.js
│   └── constants.js
├── context/          # React context
│   └── DataContext.jsx
├── hooks/            # Custom React hooks
│   ├── useFinnhubWebSocket.js
│   └── useMarketHours.js
├── services/         # API and calculations
│   ├── finnhubAPI.js
│   └── calculations.js
├── strategies/       # Strategy logic
│   ├── orbStrategy.js
│   └── inmereloStrategy.js
├── utils/           # Utility functions
│   ├── colors.js
│   ├── formatters.js
│   └── marketTime.js
└── styles/          # CSS files
    ├── variables.css
    └── global.css
```

## Usage

### Interacting with the Dashboard

- **Click Ticker**: Copy symbol to clipboard
- **Click Price**: Open TradingView chart
- **Hover Scores**: View detailed strategy breakdown
- **Click Column Headers**: Sort by that column

### Reading the Heatmap

The heatmap uses a continuous color gradient:

```
Score:   0 ──────── 50 ──────── 100
Color:  🔴 Red    🟡 Amber    🟢 Green
```

- **Green cells (80-100)**: Strong trade setups - consider entry
- **Amber cells (50-79)**: Developing setups - watch closely
- **Red cells (0-49)**: Weak/far from ideal - avoid or wait

### Tooltips

Hover over any score cell to see:
- Current score value
- Distance from target (ORB high or MA)
- Criteria met (checkmarks)
- Volume status
- Setup quality assessment

## API Rate Limits

Finnhub Free Tier: **60 REST calls/minute** + **Unlimited WebSocket**

Our usage pattern:
- **Startup**: ~30 calls (daily candles for each ticker)
- **During trading**: ~1 call every 5 minutes (refresh data)
- **Total daily**: < 400 calls (well within 86,400 daily limit)

WebSocket provides real-time price updates with no rate limits.

## Deployment

### Build for Production

```bash
npm run build
```

Output goes to `dist/` folder.

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variable in Vercel dashboard:
# VITE_FINNHUB_API_KEY=your_api_key
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=dist

# Add environment variable in Netlify dashboard
```

## Troubleshooting

### "API key not configured" Error

1. Ensure `.env` file exists in project root
2. Check that the key is prefixed with `VITE_`
3. Restart the dev server after changing `.env`

### WebSocket Not Connecting

1. Check your internet connection
2. Verify API key is valid (test at [finnhub.io/dashboard](https://finnhub.io/dashboard))
3. Check browser console for errors
4. Free tier has WebSocket limit of 1 connection

### No Data for Ticker

Some tickers may not be available on Finnhub free tier:
- Try well-known US stocks (AAPL, MSFT, etc.)
- Check ticker symbol is correct
- View browser console for API errors

### Scores Show "—"

This is normal during:
- Initial data load (first 10-30 seconds)
- Before market open (no first 5m candle for ORB)
- If historical data failed to load

## Development

### Run Tests (if added)

```bash
npm run test
```

### Lint Code

```bash
npm run lint
```

### Format Code

```bash
npm run format
```

## Performance

- **Initial Load**: < 3 seconds
- **Price Update Latency**: < 500ms
- **Memory Usage**: < 200MB (30 tickers)
- **Frame Rate**: 60fps during updates

Optimizations:
- React.memo on TickerRow components
- Debounced WebSocket updates (100ms)
- Efficient color calculations
- Minimal re-renders

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires:
- ES6 support
- WebSocket API
- CSS Grid

## License

MIT

## Contributing

This is a personal project, but suggestions are welcome via issues.

## Acknowledgments

- Market data provided by [Finnhub](https://finnhub.io)
- Built with [Vite](https://vitejs.dev) and [React](https://react.dev)

## Disclaimer

**This software is for educational purposes only. It is not financial advice. Trading involves substantial risk of loss. Always do your own research and consult with a licensed financial advisor before making investment decisions.**
