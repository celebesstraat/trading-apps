import { formatPrice, formatTime } from '../utils/formatters';
import './TickerRow.css';

/**
 * TickerRow Component
 * Displays a single ticker with price and % distance from moving averages
 *
 * @param {object} props
 * @param {string} props.ticker Stock symbol
 * @param {object} props.priceData Price data {price, timestamp}
 * @param {object} props.movingAverages Moving averages {ema10, ema21, sma50, sma65, sma100, sma200}
 */
export function TickerRow({
  ticker,
  priceData,
  movingAverages
}) {
  const price = priceData?.price;
  const timestamp = priceData?.timestamp;

  // Calculate % distance from MA and determine color
  const getMADisplay = (maValue) => {
    if (!price || !maValue) {
      return { text: '—', className: '' };
    }
    const percentDistance = ((price - maValue) / maValue) * 100;
    const isAbove = price >= maValue;
    return {
      text: `${percentDistance >= 0 ? '+' : ''}${percentDistance.toFixed(2)}%`,
      className: isAbove ? 'ma-green' : 'ma-red'
    };
  };

  // Handle ticker click (copy to clipboard)
  const handleTickerClick = () => {
    navigator.clipboard.writeText(ticker);
  };

  // Handle price click (open TradingView)
  const handlePriceClick = () => {
    window.open(`https://www.tradingview.com/chart/?symbol=${ticker}`, '_blank');
  };

  // Get displays for all MAs
  const ema10Display = getMADisplay(movingAverages?.ema10);
  const ema21Display = getMADisplay(movingAverages?.ema21);
  const sma50Display = getMADisplay(movingAverages?.sma50);
  const sma65Display = getMADisplay(movingAverages?.sma65);
  const sma100Display = getMADisplay(movingAverages?.sma100);
  const sma200Display = getMADisplay(movingAverages?.sma200);

  return (
    <tr className="ticker-row">
      {/* Ticker */}
      <td className="ticker-cell">
        <span
          className="ticker-symbol clickable"
          onClick={handleTickerClick}
          title="Click to copy"
        >
          {ticker}
        </span>
      </td>

      {/* Time */}
      <td className="time-cell">
        <span className="time mono">{timestamp ? formatTime(timestamp) : '—'}</span>
      </td>

      {/* Price */}
      <td className="price-cell">
        <span
          className="price mono clickable"
          onClick={handlePriceClick}
          title="Open in TradingView"
        >
          {price ? formatPrice(price) : '—'}
        </span>
      </td>

      {/* 10D EMA */}
      <td className="ma-cell">
        <span className={`ma-percent mono ${ema10Display.className}`}>
          {ema10Display.text}
        </span>
      </td>

      {/* 21D EMA */}
      <td className="ma-cell">
        <span className={`ma-percent mono ${ema21Display.className}`}>
          {ema21Display.text}
        </span>
      </td>

      {/* 50D SMA */}
      <td className="ma-cell">
        <span className={`ma-percent mono ${sma50Display.className}`}>
          {sma50Display.text}
        </span>
      </td>

      {/* 65D SMA */}
      <td className="ma-cell">
        <span className={`ma-percent mono ${sma65Display.className}`}>
          {sma65Display.text}
        </span>
      </td>

      {/* 100D SMA */}
      <td className="ma-cell">
        <span className={`ma-percent mono ${sma100Display.className}`}>
          {sma100Display.text}
        </span>
      </td>

      {/* 200D SMA */}
      <td className="ma-cell">
        <span className={`ma-percent mono ${sma200Display.className}`}>
          {sma200Display.text}
        </span>
      </td>
    </tr>
  );
}

export default TickerRow;
