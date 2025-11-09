# Market Calendar Service

This service provides market calendar functionality with accurate trading day and holiday detection using Alpaca's Calendar API.

## Features

- **Real-time Market Status**: Accurate detection of market holidays vs weekends
- **Smart Caching**: 24-hour IndexedDB cache to minimize API calls
- **Fallback Logic**: Weekend logic when API is unavailable
- **Development Mode**: Mock data support for development without API calls

## Development Mode

The calendar service includes a development mode that bypasses API calls and uses mock data. This is useful for:

- Development without API keys
- Testing holiday functionality
- Avoiding CORS issues during local development

### Toggle Development Mode

Edit `src/services/marketCalendar.js`:

```javascript
// Set to false to use real API calls (requires valid Alpaca API keys)
const DEV_MODE_BYPASS_CALENDAR_API = true; // Development mode (mock data)
// const DEV_MODE_BYPASS_CALENDAR_API = false; // Production mode (real API)
```

## Mock Data Features

When in development mode, the service provides:

- **Weekend Detection**: Accurate weekend day identification
- **Sample Holidays**: Includes major US market holidays for testing:
  - New Year's Day
  - Martin Luther King Jr. Day
  - Presidents Day
  - Good Friday
  - Memorial Day
  - Independence Day
  - Labor Day
  - Thanksgiving Day
  - Christmas Day

## Production Configuration

For production use:

1. Set `DEV_MODE_BYPASS_CALENDAR_API = false`
2. Configure valid Alpaca API keys in `.env`:
   ```
   VITE_ALPACA_API_KEY_ID=your_api_key_id
   VITE_ALPACA_SECRET_KEY=your_secret_key
   VITE_ALPACA_SANDBOX=false
   ```
3. Ensure CORS is properly configured for your domain

## API Usage

- **Rate Limiting**: 1 call per day after cache is established
- **Cache TTL**: 24 hours
- **Data Range**: 30 days from current date
- **Fallback**: Weekend logic if API fails

## Error Handling

The service includes robust error handling:

- **CORS Issues**: Automatic fallback to mock data
- **API Failures**: Graceful degradation to weekend logic
- **Network Errors**: Retry logic with exponential backoff
- **Cache Errors**: Fallback to real-time calculations

## Functions

### Core Functions

- `getCalendarData(date)` - Get calendar data for specific date
- `isTradingDay(date)` - Check if date is a trading day
- `getNextTradingDay(date)` - Get next trading day
- `getTodayTradingStatus()` - Get today's trading status
- `refreshCalendar()` - Refresh calendar cache

### Utility Functions

- `clearCalendarCache()` - Clear cached data
- `getCalendarStats()` - Get cache statistics
- `getUpcomingHolidays()` - Get upcoming holidays

## Storage

- **Database**: IndexedDB (`strategywatch-calendar-db`)
- **Store**: `calendar`
- **TTL**: 24 hours
- **Format**: `{ date, openTime, closeTime, cachedAt }`