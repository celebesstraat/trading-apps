import { useMemo, useRef, useEffect } from 'react';
import { formatPrice, formatTime } from '../utils/formatters';
import { ORB_THRESHOLDS } from '../config/constants';
import { announce } from '../utils/voiceAlerts';
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
  const previousClose = priceData?.previousClose;

  // Calculate percentage change from previous close
  const getChangePercentDisplay = () => {
    if (!price || !previousClose) {
      return { value: '—', className: '' };
    }
    const changePercent = ((price - previousClose) / previousClose) * 100;
    const isPositive = changePercent >= 0;
    return {
      value: `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`,
      className: isPositive ? 'change-green' : 'change-red'
    };
  };

  // Track last ORB announcements to prevent duplicate voice alerts
  const lastORBAnnouncement = useRef({
    announcedTier: null,
    announcedTime: 0,
    announcedBreakout: false
  });

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

  // Get 5m ORB display using simple traffic light system
  const orb5mDisplay = useMemo(() => {
    if (!orb5mData || !orb5mData.candle) {
      return { text: '', className: '', hasBorder: false, tooltip: 'Waiting for first 5m candle...', tier1Met: false, tier2Met: false };
    }

    // Check criteria for traffic light system
    const { open, high, low, close, volume } = orb5mData.candle;
    const avgVolume = orb5mData.avgVolume;

    // Calculate criteria - EXACTLY matching Pine Script
    const range = high - low;
    const body = Math.abs(close - open);
    const bodyRatio = range > 0 ? body / range : 0;
    const volumeMultiplier = avgVolume ? volume / avgVolume : 0;
    const isGreenCandle = close > open;

    // Pine Script position calculations
    const openPos = range > 0 ? (open - low) / range : 0;
    const closePos = range > 0 ? (close - low) / range : 0;

    // Pine Script criteria (exact match using constants)
    const openLowQ = openPos <= ORB_THRESHOLDS.LOWER_QUANTILE;  // Open ≤ 20% of range
    const closeHighQ = closePos >= ORB_THRESHOLDS.UPPER_QUANTILE; // Close ≥ 80% of range
    const bodyOK = bodyRatio >= ORB_THRESHOLDS.MIN_BODY_RATIO;  // Body ≥ 55% of range
    const greenOK = isGreenCandle;     // Require green candle

    // Check if price is >= 5m ORB high for luminous border
    const hasBorder = price && high && price >= high;

    // Determine traffic light color
    let className = '';
    let tooltip = '';

    // Pine Script Tier 1 criteria (exact match)
    const priceOK = bodyOK && greenOK && openLowQ && closeHighQ;
    const tier1Met = priceOK && volumeMultiplier >= ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER; // 0.25x RVOL threshold

    // Pine Script Tier 2 criteria (exact match)
    const tier2Met = priceOK && volumeMultiplier >= ORB_THRESHOLDS.TIER2_VOLUME_MULTIPLIER; // 1.50x RVOL threshold

    if (tier2Met) {
      // Dark green for Tier 2 (Pine Script: RVOL ≥ 1.50x)
      className = 'orb-dark-green';
      tooltip = `Tier 2: RVOL ${volumeMultiplier.toFixed(2)}x ≥ ${ORB_THRESHOLDS.TIER2_VOLUME_MULTIPLIER}x | Open ${(openPos*100).toFixed(0)}% ≤ ${(ORB_THRESHOLDS.LOWER_QUANTILE*100).toFixed(0)}% | Close ${(closePos*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.UPPER_QUANTILE*100).toFixed(0)}% | Body ${(bodyRatio*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.MIN_BODY_RATIO*100).toFixed(0)}%`;
      return {
        text: '', // No emoji - circle itself is the traffic light
        className,
        hasBorder,
        tooltip: hasBorder ? `${tooltip} - BROKE OUT!` : tooltip,
        tier1Met,
        tier2Met
      };
    } else if (tier1Met) {
      // Light green for Tier 1 (Pine Script: RVOL ≥ 0.25x)
      className = 'orb-light-green';
      tooltip = `Tier 1: RVOL ${volumeMultiplier.toFixed(2)}x ≥ ${ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER}x | Open ${(openPos*100).toFixed(0)}% ≤ ${(ORB_THRESHOLDS.LOWER_QUANTILE*100).toFixed(0)}% | Close ${(closePos*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.UPPER_QUANTILE*100).toFixed(0)}% | Body ${(bodyRatio*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.MIN_BODY_RATIO*100).toFixed(0)}%`;
      return {
        text: '', // No emoji - circle itself is the traffic light
        className,
        hasBorder,
        tooltip: hasBorder ? `${tooltip} - BROKE OUT!` : tooltip,
        tier1Met,
        tier2Met
      };
    } else {
      // Blank - no traffic light
      const failReasons = [];
      if (!openLowQ) failReasons.push(`Open ${(openPos*100).toFixed(0)}% > ${(ORB_THRESHOLDS.LOWER_QUANTILE*100).toFixed(0)}%`);
      if (!closeHighQ) failReasons.push(`Close ${(closePos*100).toFixed(0)}% < ${(ORB_THRESHOLDS.UPPER_QUANTILE*100).toFixed(0)}%`);
      if (!bodyOK) failReasons.push(`Body ${(bodyRatio*100).toFixed(0)}% < ${(ORB_THRESHOLDS.MIN_BODY_RATIO*100).toFixed(0)}%`);
      if (!greenOK) failReasons.push('Red candle');
      if (volumeMultiplier < ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER) failReasons.push(`RVOL ${volumeMultiplier.toFixed(2)}x < ${ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER}x`);

      return {
        text: '', // No display when criteria not met
        className: '',
        hasBorder: false,
        tooltip: `Failed: ${failReasons.join(', ')}`,
        tier1Met,
        tier2Met
      };
    }
  }, [orb5mData, price]); // Dependencies for memoization

  // Handle voice announcements with debouncing (moved outside useMemo)
  useEffect(() => {
    if (!orb5mDisplay.tier1Met && !orb5mDisplay.tier2Met && !orb5mDisplay.hasBorder) {
      return;
    }

    const now = Date.now();
    const timeSinceLastAnnouncement = now - lastORBAnnouncement.current.announcedTime;
    const ANNOUNCEMENT_COOLDOWN = 30000; // 30 seconds cooldown to prevent spam

    if (orb5mDisplay.tier2Met && lastORBAnnouncement.current.announcedTier !== 2 && timeSinceLastAnnouncement > ANNOUNCEMENT_COOLDOWN) {
      // Very strong opening candle
      announce(`${ticker} opening candle is very strong`);
      lastORBAnnouncement.current = {
        announcedTier: 2,
        announcedTime: now,
        announcedBreakout: false
      };
    } else if (orb5mDisplay.tier1Met && lastORBAnnouncement.current.announcedTier !== 1 && timeSinceLastAnnouncement > ANNOUNCEMENT_COOLDOWN) {
      // Strong opening candle
      announce(`${ticker} opening candle is strong`);
      lastORBAnnouncement.current = {
        announcedTier: 1,
        announcedTime: now,
        announcedBreakout: false
      };
    }

    // ORB Breakout announcement (when price crosses above ORB high)
    if (orb5mDisplay.hasBorder && !lastORBAnnouncement.current.announcedBreakout && timeSinceLastAnnouncement > ANNOUNCEMENT_COOLDOWN) {
      announce(`${ticker} ORB is confirmed`);
      lastORBAnnouncement.current.announcedBreakout = true;
    } else if (!orb5mDisplay.hasBorder) {
      // Reset breakout flag when price drops below ORB high
      lastORBAnnouncement.current.announcedBreakout = false;
    }
  }, [orb5mDisplay.tier1Met, orb5mDisplay.tier2Met, orb5mDisplay.hasBorder, ticker]);

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
  // orb5mDisplay is now memoized above
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

      {/* Change % */}
      <td className="change-percent-cell">
        <span className={`change-percent mono ${getChangePercentDisplay().className}`}>
          {getChangePercentDisplay().value}
        </span>
      </td>

      {/* 20D ADR% */}
      <td className="ma-cell group-separator-major">
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
        <span
          className="orb-indicator"
          title={orb5mDisplay.tooltip}
        >
          {orb5mDisplay.text}
        </span>
      </td>

      {/* 10D EMA */}
      <td className="ma-cell group-separator-major">
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
