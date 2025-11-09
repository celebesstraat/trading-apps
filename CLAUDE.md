# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo for financial trading applications using npm workspaces:

- `apps/strategywatch/` - Main trading strategy monitoring application
- `packages/` - Shared packages (currently empty, planned for future shared utilities)

## Development Commands

### Root Level Commands
```bash
# Install dependencies for all apps
npm install

# Run StrategyWatch development server
npm run dev:strategywatch

# Build StrategyWatch for production
npm run build:strategywatch

# Preview StrategyWatch build
npm run preview:strategywatch
```

### StrategyWatch App Commands
Navigate to `apps/strategywatch/` first, then use:

```bash
# Development
npm run dev                    # Start Vite dev server (localhost:5173)
npm run build                  # Build for production
npm run preview                # Preview production build
npm run build:prod            # Clean + lint + build

# Code Quality
npm run lint                   # ESLint check (max 0 warnings)
npm run lint:fix              # Auto-fix ESLint issues
npm run type-check            # TypeScript type checking without emit

# Utilities
npm run clean                 # Remove dist/ folder
npm run build:analyze         # Build + analyze bundle size
```

## Architecture Overview

### StrategyWatch Application
A React 18 + Vite real-time trading strategy monitor with the following key architectural patterns:

**Data Flow:**
- `DataContext.jsx` provides centralized state management for all market data
- Uses shared `@trading-apps/market-data` package with Alpaca Markets provider
- WebSocket provides real-time price updates (hybrid mode: WebSocket + REST fallback)
- REST API loads historical data on startup
- Strategy calculations (`orbStrategy.js`, `inmereloStrategy.js`) process data into scoring

**Component Structure:**
- `App.jsx` - Main application with market hours detection
- `WatchlistTable.jsx` - Table container with sorting functionality
- `TickerRow.jsx` - Individual stock row (memoized for performance)
- `HeatmapCell.jsx` - Color-coded strategy score cells with tooltips
- `Header/Footer.jsx` - Layout components
- `ErrorBoundary.jsx` - React error boundary

**Strategy System:**
- **ORB Strategy**: Opening Range Breakout detection using first 5-minute candle
- **INMERELO Strategy**: Mean reversion signals using 10D/21D/50D moving averages
- Both return 0-100 scores that map to RAG (Red-Amber-Green) color gradient

**Key Services:**
- `marketData.js` - Centralized market data management
- `calculations.js` - Price change and technical indicator calculations
- `newsService.js` - Market news and announcements
- `voiceAlerts.js` - Text-to-speech alert system

## Configuration

### Environment Variables
Required in `apps/strategywatch/.env`:
```
VITE_ALPACA_API_KEY_ID=your_alpaca_api_key_id
VITE_ALPACA_SECRET_KEY=your_alpaca_secret_key
VITE_ALPACA_DATA_FEED=iex
VITE_ALPACA_SANDBOX=true
```

### Key Configuration Files
- `src/config/watchlist.js` - Stock symbols to monitor (20-30 tickers)
- `src/config/constants.js` - Strategy thresholds and parameters
- `src/styles/variables.css` - CSS color scheme and design tokens

## Data Sources

**Alpaca Markets API:**
- WebSocket: Real-time price updates (excellent reliability)
- REST: Historical data (200 calls/minute rate limit on free tier)
- Data feeds: IEX (free) or SIP (paid)
- Usage pattern: Hybrid mode with WebSocket + REST fallback
- Better rate limits and WebSocket support compared to Finnhub

## Development Notes

**Performance Optimizations:**
- React.memo on TickerRow components to prevent unnecessary re-renders
- Debounced WebSocket updates (100ms) for smooth UI
- Efficient color calculations using utility functions
- CSS-based styling for better performance than styled-components

**Market Hours Awareness:**
- Application detects market open/closed status
- Different display modes for pre-market, trading, and after-hours
- ORB strategy only active during market hours (needs first 5m candle)

**Browser Compatibility:**
- Requires ES6, WebSocket API, CSS Grid
- Optimized for modern browsers (Chrome/Edge 90+, Firefox 88+, Safari 14+)

## Common Issues

**API Key Problems:**
- Must start with `VITE_` prefix for Vite to expose it to client
- Restart dev server after changing `.env` file
- Verify Alpaca API credentials at alpaca.markets/dashboard
- Need both API Key ID and Secret Key for authentication

**WebSocket Connection:**
- Alpaca provides excellent WebSocket reliability
- Check browser console for connection errors
- Ensure stable internet connection
- Hybrid mode falls back to REST if WebSocket fails

**Data Loading:**
- Initial load takes 10-30 seconds (historical data for all tickers)
- Scores show "—" during initial data fetch
- Alpaca has broader market coverage than Finnhub
- IEX data feed covers most major US stocks and ETFs

## Deployment

**Static Site Ready:**
- Builds to `dist/` folder
- Compatible with Vercel, Netlify, or any static hosting
- Set environment variables in hosting platform:
  - `VITE_ALPACA_API_KEY_ID`
  - `VITE_ALPACA_SECRET_KEY`
  - `VITE_ALPACA_DATA_FEED`
  - `VITE_ALPACA_SANDBOX`

**Build Process:**
```bash
npm run build:prod    # Full production pipeline
```

This creates optimized static assets with proper caching headers and minimal bundle size.