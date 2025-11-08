import { useState, useMemo } from 'react';
import TickerRow from './TickerRow';
import './WatchlistTable.css';

/**
 * WatchlistTable Component
 * Displays watchlist of stocks with real-time prices and % distance from moving averages
 *
 * @param {object} props
 * @param {string[]} props.tickers Array of ticker symbols
 * @param {object} props.pricesMap Map of ticker -> price data
 * @param {object} props.movingAveragesMap Map of ticker -> moving averages
 */
export function WatchlistTable({
  tickers,
  pricesMap,
  movingAveragesMap
}) {
  const [sortColumn, setSortColumn] = useState('10d'); // Default sort by 10D EMA
  const [sortDirection, setSortDirection] = useState('desc');

  // Handle column header click for sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Calculate % distance from MA for a ticker
  const getPercentDistance = (ticker, maType) => {
    const price = pricesMap[ticker]?.price;
    const ma = movingAveragesMap[ticker]?.[maType];
    if (!price || !ma) return -Infinity; // Sort nulls to bottom
    return ((price - ma) / ma) * 100;
  };

  // Sort tickers based on current sort settings
  const sortedTickers = useMemo(() => {
    if (!sortColumn) return tickers;

    return [...tickers].sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case 'ticker':
          aValue = a;
          bValue = b;
          break;
        case 'price':
          aValue = pricesMap[a]?.price || 0;
          bValue = pricesMap[b]?.price || 0;
          break;
        case '10d':
          aValue = getPercentDistance(a, 'ema10');
          bValue = getPercentDistance(b, 'ema10');
          break;
        case '21d':
          aValue = getPercentDistance(a, 'ema21');
          bValue = getPercentDistance(b, 'ema21');
          break;
        case '50d':
          aValue = getPercentDistance(a, 'sma50');
          bValue = getPercentDistance(b, 'sma50');
          break;
        case '65d':
          aValue = getPercentDistance(a, 'sma65');
          bValue = getPercentDistance(b, 'sma65');
          break;
        case '100d':
          aValue = getPercentDistance(a, 'sma100');
          bValue = getPercentDistance(b, 'sma100');
          break;
        case '200d':
          aValue = getPercentDistance(a, 'sma200');
          bValue = getPercentDistance(b, 'sma200');
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [tickers, sortColumn, sortDirection, pricesMap, movingAveragesMap]);

  // Get sort indicator
  const getSortIndicator = (column) => {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="watchlist-container">
      <table className="watchlist-table">
        <thead>
          <tr>
            <th
              className="sortable"
              onClick={() => handleSort('ticker')}
            >
              Ticker{getSortIndicator('ticker')}
            </th>
            <th>Time</th>
            <th
              className="sortable"
              onClick={() => handleSort('price')}
            >
              Price{getSortIndicator('price')}
            </th>
            <th
              className="sortable"
              onClick={() => handleSort('10d')}
              title="% Distance from 10-Day EMA"
            >
              10D EMA{getSortIndicator('10d')}
            </th>
            <th
              className="sortable"
              onClick={() => handleSort('21d')}
              title="% Distance from 21-Day EMA"
            >
              21D EMA{getSortIndicator('21d')}
            </th>
            <th
              className="sortable"
              onClick={() => handleSort('50d')}
              title="% Distance from 50-Day SMA"
            >
              50D SMA{getSortIndicator('50d')}
            </th>
            <th
              className="sortable"
              onClick={() => handleSort('65d')}
              title="% Distance from 65-Day SMA"
            >
              65D SMA{getSortIndicator('65d')}
            </th>
            <th
              className="sortable"
              onClick={() => handleSort('100d')}
              title="% Distance from 100-Day SMA"
            >
              100D SMA{getSortIndicator('100d')}
            </th>
            <th
              className="sortable"
              onClick={() => handleSort('200d')}
              title="% Distance from 200-Day SMA"
            >
              200D SMA{getSortIndicator('200d')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTickers.map((ticker) => (
            <TickerRow
              key={ticker}
              ticker={ticker}
              priceData={pricesMap[ticker]}
              movingAverages={movingAveragesMap[ticker]}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default WatchlistTable;
