
import React, { useState, useMemo, useCallback } from 'react';
import TickerRow from './TickerRow';
import './WatchlistTable.css';
import { TickerData, Bar, PriceData, MovingAverages, ORBData, RVolResult, VRSResult } from '../types/types';

interface WatchlistTableProps {
  tickers: string[];
  pricesMap: Record<string, PriceData>;
  movingAveragesMap: Record<string, MovingAverages>;
  orb5mDataMap?: Record<string, ORBData>;
  rvolDataMap?: Record<string, RVolResult>;
  vrsDataMap?: Record<string, VRSResult>;
}

export const WatchlistTable: React.FC<WatchlistTableProps> = ({
  tickers,
  pricesMap,
  movingAveragesMap,
  orb5mDataMap = {},
  rvolDataMap = {},
  vrsDataMap = {}
}) => {
  const [sortColumn, setSortColumn] = useState('ticker');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getPercentDistance = useCallback((ticker: string, maType: string) => {
    const price = pricesMap[ticker]?.price;
    const ma = movingAveragesMap[ticker]?.[maType];
    if (!price || !ma) return -Infinity;
    return ((price - ma) / ma) * 100;
  }, [pricesMap, movingAveragesMap]);

  const getChangePercent = useCallback((ticker: string) => {
    const price = pricesMap[ticker]?.price;
    const previousClose = pricesMap[ticker]?.previousClose;
    if (!price || !previousClose) return -Infinity;
    return ((price - previousClose) / previousClose) * 100;
  }, [pricesMap]);

  const sortedTickers = useMemo(() => {
    if (!sortColumn) return tickers;

    return [...tickers].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortColumn) {
        case 'ticker':
          aValue = a;
          bValue = b;
          break;
        case 'price':
          aValue = pricesMap[a]?.price || 0;
          bValue = pricesMap[b]?.price || 0;
          break;
        case 'changePercent':
          aValue = getChangePercent(a);
          bValue = getChangePercent(b);
          break;
        case 'rvol':
          aValue = rvolDataMap[a]?.rvol ?? -Infinity;
          bValue = rvolDataMap[b]?.rvol ?? -Infinity;
          break;
        case 'vrs1m':
          aValue = vrsDataMap[a]?.vrs1m ?? -Infinity;
          bValue = vrsDataMap[b]?.vrs1m ?? -Infinity;
          break;
        case 'vrs5m':
          aValue = vrsDataMap[a]?.vrs5m ?? -Infinity;
          bValue = vrsDataMap[b]?.vrs5m ?? -Infinity;
          break;
        case 'vrs15m':
          aValue = vrsDataMap[a]?.vrs15m ?? -Infinity;
          bValue = vrsDataMap[b]?.vrs15m ?? -Infinity;
          break;
        case '5d':
          aValue = getPercentDistance(a, 'sma5');
          bValue = getPercentDistance(b, 'sma5');
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
        case 'adr':
          aValue = movingAveragesMap[a]?.adr20 || -Infinity;
          bValue = movingAveragesMap[b]?.adr20 || -Infinity;
          break;
        case 'todayADR': {
          const calculateTodayADRPercent = (ticker: string) => {
            const priceData = pricesMap[ticker];
            const adr20 = movingAveragesMap[ticker]?.adr20;
            const price = priceData?.price;
            const high = priceData?.high;
            const low = priceData?.low;

            if (!high || !low || !price || !adr20) {
              return -Infinity;
            }

            const todayRange = high - low;
            const adr20Dollars = price * (adr20 / 100);
            return (todayRange / adr20Dollars) * 100;
          };
          aValue = calculateTodayADRPercent(a);
          bValue = calculateTodayADRPercent(b);
          break;
        }
        case '5morb':
          aValue = orb5mDataMap[a]?.tier ?? -Infinity;
          bValue = orb5mDataMap[b]?.tier ?? -Infinity;
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
  }, [tickers, sortColumn, sortDirection, pricesMap, movingAveragesMap, orb5mDataMap, rvolDataMap, vrsDataMap, getPercentDistance, getChangePercent]);

  const getSortIndicator = (column: string) => {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="watchlist-container">
      <table className="watchlist-table">
        <thead>
          <tr>
            <th rowSpan={2} className="sortable" onClick={() => handleSort('ticker')}>
              Ticker{getSortIndicator('ticker')}
            </th>
            <th rowSpan={2} className="group-separator-major">Timestamp</th>
            <th rowSpan={2} className="sortable" onClick={() => handleSort('price')}>
              Price{getSortIndicator('price')}
            </th>
            <th
              rowSpan={2}
              className="sortable"
              onClick={() => handleSort('changePercent')}
              title="% Change from previous day's close"
            >
              Change %{getSortIndicator('changePercent')}
            </th>
            <th
              colSpan={3}
              className="group-header group-separator"
              title="Relative Strength vs QQQ (ADR%-normalized)"
            >
              RELATIVE STRENGTH
            </th>
            <th
              rowSpan={2}
              className="sortable group-separator-major"
              onClick={() => handleSort('rvol')}
              title="Relative Volume: Current volume vs. 20-day average at same time"
            >
              RVol{getSortIndicator('rvol')}
            </th>
            <th
              rowSpan={2}
              className="sortable group-separator-major"
              onClick={() => handleSort('adr')}
              title="20-Day Average Daily Range as % of price"
            >
              20D ADR%{getSortIndicator('adr')}
            </th>
            <th
              rowSpan={2}
              className="sortable"
              onClick={() => handleSort('todayADR')}
              title="Today's range as percentage of 20-Day ADR"
            >
              Today&apos;s Move{getSortIndicator('todayADR')}
            </th>
            <th
              rowSpan={2}
              className="sortable group-separator-major"
              onClick={() => handleSort('5morb')}
              title="5-Minute Opening Range Breakout (9:30-9:35 ET)"
            >
              5m ORB{getSortIndicator('5morb')}
            </th>
            <th
              rowSpan={2}
              className="sortable group-separator-major"
              onClick={() => handleSort('5d')}
              title="% Distance from 5-Day SMA"
            >
              5D SMA{getSortIndicator('5d')}
            </th>
            <th
              rowSpan={2}
              className="sortable"
              onClick={() => handleSort('10d')}
              title="% Distance from 10-Day EMA"
            >
              10D EMA{getSortIndicator('10d')}
            </th>
            <th
              rowSpan={2}
              className="sortable"
              onClick={() => handleSort('21d')}
              title="% Distance from 21-Day EMA"
            >
              21D EMA{getSortIndicator('21d')}
            </th>
            <th
              rowSpan={2}
              className="sortable"
              onClick={() => handleSort('50d')}
              title="% Distance from 50-Day SMA"
            >
              50D SMA{getSortIndicator('50d')}
            </th>
          </tr>
          <tr>
            <th
              className="sortable vrs-subheader"
              onClick={() => handleSort('vrs1m')}
              title="VRS 1-min: Real-time relative strength vs QQQ"
            >
              1min{getSortIndicator('vrs1m')}
            </th>
            <th
              className="sortable vrs-subheader"
              onClick={() => handleSort('vrs5m')}
              title="VRS 5-min: Intraday momentum vs QQQ"
            >
              5min{getSortIndicator('vrs5m')}
            </th>
            <th
              className="sortable vrs-subheader"
              onClick={() => handleSort('vrs15m')}
              title="VRS 15-min: Trend momentum vs QQQ"
            >
              15min{getSortIndicator('vrs15m')}
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
              orb5mData={orb5mDataMap[ticker]}
              rvolData={rvolDataMap[ticker]}
              vrsData={vrsDataMap[ticker]}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default WatchlistTable;
