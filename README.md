# Trading Apps Monorepo

A collection of financial trading applications and tools.

## Apps

### 📊 [StrategyWatch](./apps/strategywatch)

Real-time trading strategy monitor with heatmap visualization for trade setup quality.

**Features:**
- Real-time WebSocket price feeds
- Opening Range Breakout (ORB) strategy
- Mean Reversion (INMERELO) strategy across 3 timeframes
- RAG (Red-Amber-Green) heatmap scoring
- 20-30 stock watchlist

[View Documentation →](./apps/strategywatch/README.md)

## Monorepo Structure

```
trading-apps/
├── apps/                     # Individual applications
│   └── strategywatch/       # StrategyWatch app
├── packages/                # Shared packages
│   └── market-data/         # Market data provider abstraction
└── README.md               # This file
```

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Install Dependencies

From the root:

```bash
npm install
```

### Run an App

```bash
# StrategyWatch
npm run dev:strategywatch
```

## Planned Apps

Future applications in this monorepo may include:

- **Portfolio Tracker**: Track positions across multiple brokers
- **Options Scanner**: Find option opportunities based on criteria
- **Backtest Engine**: Test strategies against historical data
- **Alert Manager**: Multi-condition alert system
- **Risk Calculator**: Position sizing and risk management

## Development

### Adding a New App

1. Create app in `apps/` directory
2. Add npm scripts to root `package.json`
3. Document in this README

### Shared Packages

Future shared packages will go in `packages/`:
- `@trading-apps/api-clients` - Reusable API clients
- `@trading-apps/ui-components` - Shared React components
- `@trading-apps/utils` - Common utilities
- `@trading-apps/types` - TypeScript type definitions

## Tech Stack

- **Framework**: React + Vite
- **Language**: JavaScript (JSX)
- **Styling**: CSS Modules / Pure CSS
- **Market Data**: Alpaca Markets (real-time IEX feed)
- **Deployment**: Vercel, Netlify

## License

MIT

## Disclaimer

**These applications are for educational and informational purposes only. They are not financial advice. Trading and investing involve substantial risk of loss. Always do your own research and consult with licensed financial professionals before making investment decisions.**
