import { useMemo, useRef, useEffect, useState } from 'react';
import { formatPrice, formatTime } from '../utils/formatters';
import { ORB_THRESHOLDS } from '../config/constants';
import { announce, toggleTickerMute, isTickerMuted } from '../utils/voiceAlerts';
import { formatRVol, getRVolColor, getRVolTooltip } from '../utils/rvolCalculations';
import { evaluate5mORB, evaluate5mORBBearish, checkPriceProximityToMA } from '../services/calculations';
import { useData } from '../context/DataContext';
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
 * @param {object} props.rvolData RVol data {rvol, currentCumulative, avgCumulative, error}
 */
export function TickerRow({
  ticker,
  priceData,
  movingAverages,
  orb5mData,
  rvolData
}) {
  const price = priceData?.price;
  const timestamp = priceData?.timestamp;
  const previousClose = priceData?.previousClose;

  // Get global mute state and news functions from context
  const { globalMuted, getUnreadNewsCountForTicker } = useData();

  // Track muted state for this ticker
  const [isTickerMutedState, setIsTickerMutedState] = useState(() => isTickerMuted(ticker));

  // Handle mute/unmute toggle
  const handleMuteToggle = () => {
    const newMutedState = toggleTickerMute(ticker);
    setIsTickerMutedState(newMutedState);
  };

  // Determine effective mute state (global mute overrides individual)
  const effectivelyMuted = globalMuted || isTickerMutedState;

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

  // Get RVol display with color highlighting
  const getRVolDisplay = () => {
    if (!rvolData || rvolData.error || rvolData.rvol === null || rvolData.rvol === undefined) {
      return {
        value: formatRVol(null),
        className: '',
        tooltip: rvolData?.error || 'RVol data unavailable'
      };
    }

    const colorCategory = getRVolColor(rvolData.rvol);
    let className = '';

    // Apply color based on RVol thresholds
    if (colorCategory === 'high') {
      className = 'rvol-high'; // Green for RVol >= 2.0x
    } else if (colorCategory === 'low') {
      className = 'rvol-low'; // Red for RVol < 0.5x
    }

    return {
      value: formatRVol(rvolData.rvol),
      className,
      tooltip: getRVolTooltip(rvolData)
    };
  };

  // Track last ORB announcements to prevent duplicate voice alerts
  const lastORBAnnouncement = useRef({
    announcedTier: null,
    announcedTime: 0,
    announcedBreakout: false,
    announcedDirection: null // 'bullish' or 'bearish'
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

  // Check if price is close to MA based on ADR% threshold
  const checkMAProximity = (maValue) => {
    if (!price || !maValue || !movingAverages?.adr20) {
      return { isClose: false, distancePercent: 0, thresholdPercent: 0 };
    }

    return checkPriceProximityToMA(price, maValue, movingAverages.adr20);
  };

  // Handle ticker click (copy to clipboard)
  const handleTickerClick = () => {
    navigator.clipboard.writeText(ticker);
  };

  // Handle price click (open TradingView)
  const handlePriceClick = () => {
    window.open(`https://www.tradingview.com/chart/?symbol=${ticker}`, '_blank');
  };

  // Get unread news count for this ticker
  const unreadNewsCount = getUnreadNewsCountForTicker(ticker);

  // Handle news icon click (open global news alert)
  const handleNewsIconClick = () => {
    // This will trigger the global news alert to open
    // We'll use a custom event to communicate with the Header component
    window.dispatchEvent(new CustomEvent('openNewsAlert', { detail: { ticker } }));
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

  // Get 5m ORB display using combined traffic light system (both bullish and bearish)
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

    // Check bullish criteria
    const openLowQ = openPos <= ORB_THRESHOLDS.LOWER_QUANTILE;  // Open ≤ 20% of range
    const closeHighQ = closePos >= ORB_THRESHOLDS.UPPER_QUANTILE; // Close ≥ 80% of range
    const bodyOK = bodyRatio >= ORB_THRESHOLDS.MIN_BODY_RATIO;  // Body ≥ 55% of range
    const greenOK = isGreenCandle;     // Require green candle

    // Check bearish criteria
    const openHighQ = openPos >= ORB_THRESHOLDS.UPPER_QUANTILE;  // Open ≥ 80% of range
    const closeLowQ = closePos <= ORB_THRESHOLDS.LOWER_QUANTILE; // Close ≤ 20% of range
    const redOK = !isGreenCandle;     // Require red candle

    // Bullish breakout: price >= ORB high
    const bullishBreakout = price && high && price >= high;
    // Bearish breakout: price <= ORB low
    const bearishBreakout = price && low && price <= low;

    // Determine traffic light color
    let className = '';
    let tooltip = '';
    let hasBorder = false;

    // Bullish Tier 2 criteria (dark green)
    const bullishPriceOK = bodyOK && greenOK && openLowQ && closeHighQ;
    const bullishTier2Met = bullishPriceOK && volumeMultiplier >= ORB_THRESHOLDS.TIER2_VOLUME_MULTIPLIER;

    // Bullish Tier 1 criteria (light green)
    const bullishTier1Met = bullishPriceOK && volumeMultiplier >= ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER;

    // Bearish Tier 2 criteria (dark red)
    const bearishPriceOK = bodyOK && redOK && openHighQ && closeLowQ;
    const bearishTier2Met = bearishPriceOK && volumeMultiplier >= ORB_THRESHOLDS.TIER2_VOLUME_MULTIPLIER;

    // Bearish Tier 1 criteria (light red)
    const bearishTier1Met = bearishPriceOK && volumeMultiplier >= ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER;

    // Priority: Bearish (red) takes precedence over bullish (green) as they're mutually exclusive
    if (bearishTier2Met) {
      // Dark red for Bearish Tier 2 (Very Bearish)
      className = 'orb-dark-red';
      hasBorder = bearishBreakout;
      tooltip = `Very Bearish: RVOL ${volumeMultiplier.toFixed(2)}x ≥ ${ORB_THRESHOLDS.TIER2_VOLUME_MULTIPLIER}x | Open ${(openPos*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.UPPER_QUANTILE*100).toFixed(0)}% | Close ${(closePos*100).toFixed(0)}% ≤ ${(ORB_THRESHOLDS.LOWER_QUANTILE*100).toFixed(0)}% | Body ${(bodyRatio*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.MIN_BODY_RATIO*100).toFixed(0)}%`;
      return {
        text: '', // No emoji - circle itself is the traffic light
        className,
        hasBorder,
        tooltip: hasBorder ? `${tooltip} - BEARISH BREAKOUT!` : tooltip,
        tier1Met: bearishTier1Met,
        tier2Met: bearishTier2Met
      };
    } else if (bearishTier1Met) {
      // Light red for Bearish Tier 1 (Bearish)
      className = 'orb-light-red';
      hasBorder = bearishBreakout;
      tooltip = `Bearish: RVOL ${volumeMultiplier.toFixed(2)}x ≥ ${ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER}x | Open ${(openPos*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.UPPER_QUANTILE*100).toFixed(0)}% | Close ${(closePos*100).toFixed(0)}% ≤ ${(ORB_THRESHOLDS.LOWER_QUANTILE*100).toFixed(0)}% | Body ${(bodyRatio*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.MIN_BODY_RATIO*100).toFixed(0)}%`;
      return {
        text: '', // No emoji - circle itself is the traffic light
        className,
        hasBorder,
        tooltip: hasBorder ? `${tooltip} - BEARISH BREAKOUT!` : tooltip,
        tier1Met: bearishTier1Met,
        tier2Met: bearishTier2Met
      };
    } else if (bullishTier2Met) {
      // Dark green for Bullish Tier 2 (Very Strong)
      className = 'orb-dark-green';
      hasBorder = bullishBreakout;
      tooltip = `Very Strong: RVOL ${volumeMultiplier.toFixed(2)}x ≥ ${ORB_THRESHOLDS.TIER2_VOLUME_MULTIPLIER}x | Open ${(openPos*100).toFixed(0)}% ≤ ${(ORB_THRESHOLDS.LOWER_QUANTILE*100).toFixed(0)}% | Close ${(closePos*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.UPPER_QUANTILE*100).toFixed(0)}% | Body ${(bodyRatio*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.MIN_BODY_RATIO*100).toFixed(0)}%`;
      return {
        text: '', // No emoji - circle itself is the traffic light
        className,
        hasBorder,
        tooltip: hasBorder ? `${tooltip} - BULLISH BREAKOUT!` : tooltip,
        tier1Met: bullishTier1Met,
        tier2Met: bullishTier2Met
      };
    } else if (bullishTier1Met) {
      // Light green for Bullish Tier 1 (Strong)
      className = 'orb-light-green';
      hasBorder = bullishBreakout;
      tooltip = `Strong: RVOL ${volumeMultiplier.toFixed(2)}x ≥ ${ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER}x | Open ${(openPos*100).toFixed(0)}% ≤ ${(ORB_THRESHOLDS.LOWER_QUANTILE*100).toFixed(0)}% | Close ${(closePos*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.UPPER_QUANTILE*100).toFixed(0)}% | Body ${(bodyRatio*100).toFixed(0)}% ≥ ${(ORB_THRESHOLDS.MIN_BODY_RATIO*100).toFixed(0)}%`;
      return {
        text: '', // No emoji - circle itself is the traffic light
        className,
        hasBorder,
        tooltip: hasBorder ? `${tooltip} - BULLISH BREAKOUT!` : tooltip,
        tier1Met: bullishTier1Met,
        tier2Met: bullishTier2Met
      };
    } else {
      // Blank - no traffic light
      const failReasons = [];
      if (!openLowQ && !openHighQ) failReasons.push(`Open position ${openPos < 0.5 ? 'too high' : 'too low'} (${(openPos*100).toFixed(0)}%)`);
      if (!closeHighQ && !closeLowQ) failReasons.push(`Close position ${closePos < 0.5 ? 'too low' : 'too high'} (${(closePos*100).toFixed(0)}%)`);
      if (!bodyOK) failReasons.push(`Body ${(bodyRatio*100).toFixed(0)}% < ${(ORB_THRESHOLDS.MIN_BODY_RATIO*100).toFixed(0)}%`);
      if (volumeMultiplier < ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER) failReasons.push(`RVOL ${volumeMultiplier.toFixed(2)}x < ${ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER}x`);

      return {
        text: '', // No display when criteria not met
        className: '',
        hasBorder: false,
        tooltip: `Failed: ${failReasons.join(', ')}`,
        tier1Met: false,
        tier2Met: false
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

    // Determine direction based on traffic light color
    const isBearish = orb5mDisplay.className.includes('red');
    const direction = isBearish ? 'bearish' : 'bullish';

    // Check for tier announcements (opening candle strength)
    if (orb5mDisplay.tier2Met &&
        (lastORBAnnouncement.current.announcedTier !== 2 || lastORBAnnouncement.current.announcedDirection !== direction) &&
        timeSinceLastAnnouncement > ANNOUNCEMENT_COOLDOWN) {
      // Very strong/very bearish opening candle
      const announcement = isBearish ?
        `${ticker} opening candle is very bearish` :
        `${ticker} opening candle is very strong`;
      announce(announcement, ticker);
      lastORBAnnouncement.current = {
        announcedTier: 2,
        announcedTime: now,
        announcedBreakout: false,
        announcedDirection: direction
      };
    } else if (orb5mDisplay.tier1Met &&
               (lastORBAnnouncement.current.announcedTier !== 1 || lastORBAnnouncement.current.announcedDirection !== direction) &&
               timeSinceLastAnnouncement > ANNOUNCEMENT_COOLDOWN) {
      // Strong/bearish opening candle
      const announcement = isBearish ?
        `${ticker} opening candle is bearish` :
        `${ticker} opening candle is strong`;
      announce(announcement, ticker);
      lastORBAnnouncement.current = {
        announcedTier: 1,
        announcedTime: now,
        announcedBreakout: false,
        announcedDirection: direction
      };
    }

    // ORB Breakout announcement (when price crosses ORB high/low)
    if (orb5mDisplay.hasBorder &&
        !lastORBAnnouncement.current.announcedBreakout &&
        timeSinceLastAnnouncement > ANNOUNCEMENT_COOLDOWN) {
      const announcement = isBearish ?
        `${ticker} ORB bearish breakout confirmed` :
        `${ticker} ORB bullish breakout confirmed`;
      announce(announcement, ticker);
      lastORBAnnouncement.current.announcedBreakout = true;
    } else if (!orb5mDisplay.hasBorder) {
      // Reset breakout flag when price moves back inside ORB range
      lastORBAnnouncement.current.announcedBreakout = false;
    }
  }, [orb5mDisplay.tier1Met, orb5mDisplay.tier2Met, orb5mDisplay.hasBorder, orb5mDisplay.className, ticker]);

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

  // ========== TOOLTIP GENERATION FUNCTIONS ==========

  // Get Change % tooltip
  const getChangePercentTooltip = () => {
    if (!price || !previousClose) {
      return 'Daily change data unavailable';
    }
    const changeDollar = price - previousClose;
    const changePercent = ((price - previousClose) / previousClose) * 100;
    const sign = changeDollar >= 0 ? '+' : '';
    return `Current: ${formatPrice(price)}\nPrev Close: ${formatPrice(previousClose)}\nChange: ${sign}${formatPrice(Math.abs(changeDollar))} (${sign}${changePercent.toFixed(2)}%)`;
  };

  // Get volatility classification for ADR
  const getVolatilityLevel = (adrPercent) => {
    if (adrPercent < 2) return 'Low';
    if (adrPercent < 4) return 'Moderate';
    return 'High';
  };

  // Get 20D ADR% tooltip
  const getADRTooltip = (adr20Value) => {
    if (!adr20Value || !price) {
      return '20-Day Average Daily Range data unavailable';
    }
    const adr20Dollars = price * (adr20Value / 100);
    const volatility = getVolatilityLevel(adr20Value);
    return `20-Day Avg Daily Range: ${formatPrice(adr20Dollars)}\nAs % of price: ${adr20Value.toFixed(2)}%\nVolatility: ${volatility}`;
  };

  // Get Today's Move tooltip
  const getTodayMoveTooltip = (adr20Value) => {
    const high = priceData?.high;
    const low = priceData?.low;

    if (!high || !low || !price || !adr20Value) {
      return "Today's range data unavailable";
    }

    const todayRange = high - low;
    const adr20Dollars = price * (adr20Value / 100);
    const percentageOfADR = (todayRange / adr20Dollars) * 100;

    return `Today: H ${formatPrice(high)} | L ${formatPrice(low)}\nRange: ${formatPrice(todayRange)} (${percentageOfADR.toFixed(0)}% of ADR)\n20D ADR: ${formatPrice(adr20Dollars)}`;
  };

  // Get MA tooltip (for EMAs and SMAs)
  const getMATooltip = (maName, maValue) => {
    if (!price || !maValue) {
      return `${maName} data unavailable`;
    }
    const distance = price - maValue;
    const percentDistance = ((price - maValue) / maValue) * 100;
    const position = price >= maValue ? 'Above' : 'Below';
    const sign = distance >= 0 ? '+' : '';

    // Check proximity for enhanced tooltip
    const proximity = checkMAProximity(maValue);
    let proximityInfo = '';
    if (proximity.isClose) {
      proximityInfo = `\n⚡ CLOSE TO MA (within ${proximity.thresholdPercent.toFixed(2)}% threshold)`;
    }

    return `Price: ${formatPrice(price)}\n${maName}: ${formatPrice(maValue)}\nDistance: ${sign}${formatPrice(Math.abs(distance))} (${sign}${percentDistance.toFixed(2)}%)\nPosition: ${position}${proximityInfo}`;
  };

  // Get displays for all MAs
  const ema10Display = getMADisplay(movingAverages?.ema10);
  const ema21Display = getMADisplay(movingAverages?.ema21);
  const sma50Display = getMADisplay(movingAverages?.sma50);
  const sma65Display = getMADisplay(movingAverages?.sma65);
  const sma100Display = getMADisplay(movingAverages?.sma100);
  const adr20Display = getADRDisplay(movingAverages?.adr20);
  const rvolDisplay = getRVolDisplay();
  // orb5mDisplay is now memoized above
  const todayADRDisplay = getTodayADRDisplay(movingAverages?.adr20);

  return (
    <tr className="ticker-row">
      {/* Ticker with control icons underneath */}
      <td className="ticker-cell">
        <div className="ticker-content-vertical">
          <div className="ticker-symbol-wrapper">
            <span
              className="ticker-symbol clickable"
              onClick={handleTickerClick}
              title="Click to copy"
            >
              {ticker}
            </span>
          </div>
          <div className="ticker-controls">
            {unreadNewsCount > 0 && (
              <button
                className="news-icon-inline"
                onClick={handleNewsIconClick}
                title={`${unreadNewsCount} unread news item${unreadNewsCount !== 1 ? 's' : ''} for ${ticker}`}
                aria-label={`${unreadNewsCount} unread news items`}
              >
                📰
                <span className="news-badge-inline">{unreadNewsCount}</span>
              </button>
            )}
            <button
              className={`mute-button-inline ${effectivelyMuted ? 'muted' : ''} ${globalMuted ? 'global-muted' : ''}`}
              onClick={handleMuteToggle}
              title={
                globalMuted
                  ? 'Global mute is active'
                  : (isTickerMutedState ? 'Unmute announcements' : 'Mute announcements')
              }
              aria-label={isTickerMutedState ? 'Unmute' : 'Mute'}
              disabled={globalMuted}
            >
              {effectivelyMuted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>
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
        <span
          className={`change-percent mono ${getChangePercentDisplay().className}`}
          title={getChangePercentTooltip()}
        >
          {getChangePercentDisplay().value}
        </span>
      </td>

      {/* RVol */}
      <td className="rvol-cell">
        <span
          className={`rvol-value mono ${rvolDisplay.className}`}
          title={rvolDisplay.tooltip}
        >
          {rvolDisplay.value}
        </span>
      </td>

      {/* 20D ADR% */}
      <td className="ma-cell group-separator-major">
        <span
          className={`ma-percent mono ${adr20Display.className}`}
          title={getADRTooltip(movingAverages?.adr20)}
        >
          {adr20Display.text}
        </span>
      </td>

      {/* Today's % of ADR */}
      <td className="adr-progress-cell">
        {todayADRDisplay.displayText !== '—' ? (
          <div
            className="adr-progress-container"
            title={getTodayMoveTooltip(movingAverages?.adr20)}
          >
            <div
              className={`adr-progress-bar ${todayADRDisplay.isOverADR ? 'over-adr' : ''}`}
              style={{ width: `${todayADRDisplay.percentage}%` }}
            />
            <span className="adr-progress-text mono">{todayADRDisplay.displayText}</span>
          </div>
        ) : (
          <span
            className="adr-progress-text mono"
            title="Today's range data unavailable"
          >—</span>
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
      <td className={`ma-cell group-separator-major ${checkMAProximity(movingAverages?.ema10).isClose ? 'ma-proximity-highlight' : ''}`}>
        <div
          className="ma-dual-display"
          title={getMATooltip('10D EMA', movingAverages?.ema10)}
        >
          <div className="ma-value mono">{ema10Display.value}</div>
          <div className={`ma-percentage mono ${ema10Display.className}`}>
            {ema10Display.text}
          </div>
        </div>
      </td>

      {/* 21D EMA */}
      <td className={`ma-cell ${checkMAProximity(movingAverages?.ema21).isClose ? 'ma-proximity-highlight' : ''}`}>
        <div
          className="ma-dual-display"
          title={getMATooltip('21D EMA', movingAverages?.ema21)}
        >
          <div className="ma-value mono">{ema21Display.value}</div>
          <div className={`ma-percentage mono ${ema21Display.className}`}>
            {ema21Display.text}
          </div>
        </div>
      </td>

      {/* 50D SMA */}
      <td className={`ma-cell ${checkMAProximity(movingAverages?.sma50).isClose ? 'ma-proximity-highlight' : ''}`}>
        <div
          className="ma-dual-display"
          title={getMATooltip('50D SMA', movingAverages?.sma50)}
        >
          <div className="ma-value mono">{sma50Display.value}</div>
          <div className={`ma-percentage mono ${sma50Display.className}`}>
            {sma50Display.text}
          </div>
        </div>
      </td>

      {/* 65D SMA */}
      <td className={`ma-cell ${checkMAProximity(movingAverages?.sma65).isClose ? 'ma-proximity-highlight' : ''}`}>
        <div
          className="ma-dual-display"
          title={getMATooltip('65D SMA', movingAverages?.sma65)}
        >
          <div className="ma-value mono">{sma65Display.value}</div>
          <div className={`ma-percentage mono ${sma65Display.className}`}>
            {sma65Display.text}
          </div>
        </div>
      </td>

      {/* 100D SMA */}
      <td className={`ma-cell ${checkMAProximity(movingAverages?.sma100).isClose ? 'ma-proximity-highlight' : ''}`}>
        <div
          className="ma-dual-display"
          title={getMATooltip('100D SMA', movingAverages?.sma100)}
        >
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
