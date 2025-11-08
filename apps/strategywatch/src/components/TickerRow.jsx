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
 * @param {object} props.orb5mData 5m ORB data {candle, historicalCandles, tier}
 */
export function TickerRow({
  ticker,
  priceData,
  movingAverages,
  orb5mData
}) {
  const price = priceData?.price;
  const timestamp = priceData?.timestamp;

  // Calculate % distance from MA and determine color
  const getMADisplay = (maValue) => {
    if (!price || !maValue) {
      return { value: '—', text: '—', className: '' };
    }
    const percentDistance = ((price - maValue) / maValue) * 100;
    const isAbove = price >= maValue;
    return {
      value: `$${maValue.toFixed(2)}`,
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

  // Get ADR% display (raw percentage value, always white font)
  const getADRDisplay = (adrValue) => {
    if (!adrValue) {
      return { text: '—', className: '' };
    }
    // 20D ADR% always uses white font, no conditional coloring
    return {
      text: `${adrValue.toFixed(2)}%`,
      className: ''
    };
  };

  // Get 5m ORB display (blank or green background based on tier)
  const get5mORBDisplay = (orbData) => {
    if (!orbData || orbData.tier === null || orbData.tier === undefined) {
      return { text: '—', className: '', hasBorder: false };
    }

    const tier = orbData.tier;

    // Tier 0: No match (blank)
    if (tier === 0) {
      return { text: '—', className: '', hasBorder: false };
    }

    // Check if price is >= 5m ORB high for border styling
    const hasBorder = price && orbData.candle?.high && price >= orbData.candle.high;

    // Tier 1: Light green background
    if (tier === 1) {
      return { text: '', className: 'orb-tier-1', hasBorder };
    }

    // Tier 2: Dark green background
    if (tier === 2) {
      return { text: '', className: 'orb-tier-2', hasBorder };
    }

    return { text: '—', className: '', hasBorder: false };
  };

  // Get Today's % of ADR display (progress bar showing how much of 20D ADR has been covered today)
  const getTodayADRDisplay = (adr20Value) => {
    // Need: today's high, low, current price, and 20D ADR%
    const high = priceData?.high;
    const low = priceData?.low;

    if (!high || !low || !price || !adr20Value) {
      return { percentage: 0, displayText: '—', isOverADR: false };
    }

    // Calculate today's range (high - low)
    const todayRange = high - low;

    // Calculate 20D ADR in dollars
    const adr20Dollars = price * (adr20Value / 100);

    // Calculate percentage of ADR covered today
    const percentageOfADR = (todayRange / adr20Dollars) * 100;

    // Cap at 100% for display
    const displayPercentage = Math.min(percentageOfADR, 100);

    return {
      percentage: displayPercentage,
      displayText: `${percentageOfADR.toFixed(0)}%`,
      isOverADR: percentageOfADR >= 100
    };
  };

  // Get displays for all MAs
  const ema10Display = getMADisplay(movingAverages?.ema10);
  const ema21Display = getMADisplay(movingAverages?.ema21);
  const sma50Display = getMADisplay(movingAverages?.sma50);
  const sma65Display = getMADisplay(movingAverages?.sma65);
  const sma100Display = getMADisplay(movingAverages?.sma100);
  const adr20Display = getADRDisplay(movingAverages?.adr20);
  const orb5mDisplay = get5mORBDisplay(orb5mData);
  const todayADRDisplay = getTodayADRDisplay(movingAverages?.adr20);

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
      <td className="time-cell group-separator-major">
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

      {/* 20D ADR% */}
      <td className="ma-cell">
        <span className={`ma-percent mono ${adr20Display.className}`}>
          {adr20Display.text}
        </span>
      </td>

      {/* Today's % of ADR */}
      <td className="adr-progress-cell">
        {todayADRDisplay.displayText !== '—' ? (
          <div className="adr-progress-container">
            <div
              className={`adr-progress-bar ${todayADRDisplay.isOverADR ? 'over-adr' : ''}`}
              style={{ width: `${todayADRDisplay.percentage}%` }}
            />
            <span className="adr-progress-text mono">{todayADRDisplay.displayText}</span>
          </div>
        ) : (
          <span className="adr-progress-text mono">—</span>
        )}
      </td>

      {/* 5m ORB */}
      <td className={`orb-cell group-separator-major ${orb5mDisplay.className} ${orb5mDisplay.hasBorder ? 'orb-breakout-border' : ''}`}>
        <span className="orb-indicator">
          {orb5mDisplay.text}
        </span>
      </td>

      {/* 10D EMA */}
      <td className="ma-cell group-separator">
        <div className="ma-dual-display">
          <div className="ma-value mono">{ema10Display.value}</div>
          <div className={`ma-percentage mono ${ema10Display.className}`}>
            {ema10Display.text}
          </div>
        </div>
      </td>

      {/* 21D EMA */}
      <td className="ma-cell">
        <div className="ma-dual-display">
          <div className="ma-value mono">{ema21Display.value}</div>
          <div className={`ma-percentage mono ${ema21Display.className}`}>
            {ema21Display.text}
          </div>
        </div>
      </td>

      {/* 50D SMA */}
      <td className="ma-cell">
        <div className="ma-dual-display">
          <div className="ma-value mono">{sma50Display.value}</div>
          <div className={`ma-percentage mono ${sma50Display.className}`}>
            {sma50Display.text}
          </div>
        </div>
      </td>

      {/* 65D SMA */}
      <td className="ma-cell">
        <div className="ma-dual-display">
          <div className="ma-value mono">{sma65Display.value}</div>
          <div className={`ma-percentage mono ${sma65Display.className}`}>
            {sma65Display.text}
          </div>
        </div>
      </td>

      {/* 100D SMA */}
      <td className="ma-cell">
        <div className="ma-dual-display">
          <div className="ma-value mono">{sma100Display.value}</div>
          <div className={`ma-percentage mono ${sma100Display.className}`}>
            {sma100Display.text}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default TickerRow;
