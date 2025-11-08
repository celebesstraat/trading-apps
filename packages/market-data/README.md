# @trading-apps/market-data

Unified market data provider abstraction for trading applications in the monorepo.

## Features

- 🔌 **Provider Agnostic** - Swap between Alpaca, Finnhub, or other providers
- 🚀 **Real-time Streaming** - WebSocket support for live market data
- 📊 **Historical Data** - Fetch quotes, candles, and bars
- 🔄 **Auto-reconnection** - Resilient WebSocket connections
- ⚡ **Rate Limiting** - Built-in throttling and backoff
- 🎣 **React Hooks** - Easy integration with React apps
- 🛡️ **Type Safe** - Normalized data structures across providers

## Installation

This is an internal package in the monorepo. Add to your app's `package.json`:

```json
{
  "dependencies": {
    "@trading-apps/market-data": "*"
  }
}
```

## Quick Start

### Environment Variables

```env
VITE_MARKET_DATA_PROVIDER=alpaca
VITE_ALPACA_API_KEY_ID=your_key_id
VITE_ALPACA_SECRET_KEY=your_secret_key
VITE_ALPACA_DATA_FEED=iex
```

### Basic Usage

```javascript
import { createProvider } from '@trading-apps/market-data';

const provider = createProvider('alpaca', {
  apiKeyId: import.meta.env.VITE_ALPACA_API_KEY_ID,
  secretKey: import.meta.env.VITE_ALPACA_SECRET_KEY,
  dataFeed: 'iex'
});

// Fetch a quote
const quote = await provider.fetchQuote('AAPL');

// Fetch historical candles
const candles = await provider.fetchCandles('AAPL', 'D', from, to);

// Subscribe to real-time data
provider.subscribeLive(['AAPL', 'TSLA'], (data) => {
  console.log('Price update:', data);
});
```

### React Hooks

```javascript
import { useRealtimePrice } from '@trading-apps/market-data/hooks';

function StockTicker({ symbol }) {
  const { price, connected, error } = useRealtimePrice([symbol]);

  return (
    <div>
      {symbol}: ${price[symbol]?.price || 'Loading...'}
    </div>
  );
}
```

## Architecture

### Provider Interface

All providers implement the same interface:

- `fetchQuote(symbol)` - Get current quote for a symbol
- `fetchQuoteBatch(symbols)` - Get quotes for multiple symbols
- `fetchCandles(symbol, resolution, from, to)` - Get historical candles
- `subscribeLive(symbols, callback)` - Subscribe to real-time updates
- `unsubscribeLive(symbols)` - Unsubscribe from symbols
- `disconnect()` - Close all connections

### Normalized Data Format

All providers return data in a consistent format:

```javascript
{
  symbol: 'AAPL',
  price: 150.25,
  timestamp: 1699384800000,
  volume: 1000,
  open: 150.00,
  high: 150.50,
  low: 149.75,
  previousClose: 149.50,
  source: 'alpaca',
  metadata: {
    exchange: 'IEX',
    conditions: []
  }
}
```

## Supported Providers

### Alpaca Markets

- **Free Tier**: Real-time IEX data, 200 API calls/min
- **Paid Tier**: SIP consolidated feed, 10,000 API calls/min
- **WebSocket**: Real-time trades, quotes, and bars
- **Data Quality**: High (official exchange data)

## Rate Limits

| Provider | REST Calls/Min | WebSocket Symbols | Latency |
|----------|----------------|-------------------|---------|
| Alpaca (IEX) | 200 | 30 | Real-time |
| Alpaca (SIP) | 10,000 | Unlimited | Real-time |

## Error Handling

The package handles common errors gracefully:

- **Network failures**: Auto-reconnection with exponential backoff
- **Rate limiting**: Built-in throttling and queuing
- **Invalid symbols**: Returns null without throwing
- **Auth errors**: Clear error messages with resolution steps

## Contributing

When adding a new provider:

1. Implement the base provider interface
2. Add normalization logic
3. Include comprehensive error handling
4. Add tests for edge cases
5. Update this README

## License

MIT
