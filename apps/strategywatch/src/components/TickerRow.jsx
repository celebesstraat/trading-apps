import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { formatPrice, formatTime } from '../utils/formatters';
import { ORB_THRESHOLDS } from '../config/constants';
import { announce, toggleTickerMute, isTickerMuted } from '../utils/voiceAlerts';
import { formatRVol, getRVolColor, getRVolTooltip, getTodayMoveProgressWidth, formatVRS } from '../utils/rvolCalculations';
import { checkPriceProximityToMA } from '../services/calculations';
import { useData } from '../hooks/useData';
import RVolProgress from './RVolProgress';
import VRSProgress from './VRSProgress';
import './TickerRow.css';

/**
 * TickerRow Component
 * Displays a single ticker with price and % distance from moving averages
 *
 * @param {object} props
 * @param {string} props.ticker Stock symbol
 * @param {object} props.priceData Price data {price, timestamp}
 * @param {object} props.movingAverages Moving averages {sma5, ema10, ema21, sma50, sma200}
 * @param {object} props.orb5mData 5m ORB data {candle, historicalCandles, tier}
 * @param {object} props.rvolData RVol data {rvol, currentCumulative, avgCumulative, error}
 * @param {object} props.vrsData VRS data {vrs1m, vrs5m, vrs15m, timestamp}
 */
export function TickerRow({
  ticker,
  priceData,
  movingAverages,
  orb5mData,
  rvolData,
  vrsData
}) {
  const price = priceData?.price;
  const timestamp = priceData?.timestamp;
  const previousClose = priceData?.previousClose;

  // Get global mute state and market status from context
  const { globalMuted, loading, marketOpen } = useData();

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
      return { isClose: false, isModeratelyClose: false, distancePercent: 0, greenThreshold: 0, amberThreshold: 0 };
    }

    return checkPriceProximityToMA(price, maValue, movingAverages.adr20);
  };

  // Get CSS class for MA proximity highlighting (green takes priority over amber)
  const getMAProximityClass = (maValue) => {
    const proximity = checkMAProximity(maValue);
    if (proximity.isClose) {
      return 'ma-proximity-highlight'; // Green box (±5% of ADR%)
    } else if (proximity.isModeratelyClose) {
      return 'ma-proximity-amber'; // Amber box (±10% of ADR%)
    }
    return ''; // No box
  };

  // Handle ticker click (open TradingView)
  const handleTickerClick = () => {
    window.open(`https://www.tradingview.com/chart/?symbol=${ticker}`, '_blank');
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

    // Bullish breakout: price >= ORB high (only during market hours for real-time relevance)
    const bullishBreakout = marketOpen && price && high && price >= high;
    // Bearish breakout: price <= ORB low (only during market hours for real-time relevance)
    const bearishBreakout = marketOpen && price && low && price <= low;

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
        text: 'T2',
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
        text: 'T1',
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
        text: 'T2',
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
        text: 'T1',
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
        text: '',
        className: '',
        hasBorder: false,
        tooltip: `Failed: ${failReasons.join(', ')}`,
        tier1Met: false,
        tier2Met: false
      };
    }
  }, [orb5mData, price, marketOpen]); // Dependencies for memoization

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

  // Get Today's Move ratio (progress bar showing today's range as multiple of 20D ADR)
  const getTodayADRDisplay = (adr20Value) => {
    // Need: today's high, low, current price, and 20D ADR%
    const high = priceData?.high;
    const low = priceData?.low;

    if (!high || !low || !price || !adr20Value) {
      return { ratio: 0, displayText: '', isOverADR: false };
    }

    // Calculate today's range (high - low)
    const todayRange = high - low;

    // Calculate 20D ADR in dollars
    const adr20Dollars = price * (adr20Value / 100);

    // Calculate today's move as ratio of ADR (1.0 = 100% of ADR)
    const todayMoveRatio = todayRange / adr20Dollars;

    // Get color based on ratio
    const getColorClass = (ratio) => {
      if (ratio < 0.5) {
        return 'adr-very-low'; // Red - less than half ADR
      } else if (ratio < 0.8) {
        return 'adr-low'; // Amber - less than 80% of ADR
      } else if (ratio < 1.2) {
        return 'adr-normal'; // White - around normal ADR
      } else if (ratio < 1.5) {
        return 'adr-high'; // Light green - 120-150% of ADR
      } else {
        return 'adr-very-high'; // Dark green - 150%+ of ADR
      }
    };

    return {
      ratio: todayMoveRatio,
      displayText: `${todayMoveRatio.toFixed(1)}x`,
      isOverADR: todayMoveRatio >= 1.0,
      colorClass: getColorClass(todayMoveRatio)
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
      proximityInfo = `\n🟢 CLOSE TO MA (within ±${proximity.greenThreshold.toFixed(2)}% - Green box)`;
    } else if (proximity.isModeratelyClose) {
      proximityInfo = `\n🟠 MODERATELY CLOSE TO MA (within ±${proximity.amberThreshold.toFixed(2)}% - Amber box)`;
    }

    return `Price: ${formatPrice(price)}\n${maName}: ${formatPrice(maValue)}\nDistance: ${sign}${formatPrice(Math.abs(distance))} (${sign}${percentDistance.toFixed(2)}%)\nPosition: ${position}${proximityInfo}`;
  };

  // Get displays for all MAs
  const sma5Display = getMADisplay(movingAverages?.sma5);
  const ema10Display = getMADisplay(movingAverages?.ema10);
  const ema21Display = getMADisplay(movingAverages?.ema21);
  const sma50Display = getMADisplay(movingAverages?.sma50);
  const adr20Display = getADRDisplay(movingAverages?.adr20);
  const rvolDisplay = getRVolDisplay();
  // orb5mDisplay is now memoized above
  const todayADRDisplay = getTodayADRDisplay(movingAverages?.adr20);

  // Hook for current time to avoid impure function calls during render
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Modern stale detection: Check if data is actually old (more than 30 seconds)
  const isStale = (() => {
    if (!priceData?.timestamp) return false;

    try {
      const dataAge = currentTime - new Date(priceData.timestamp).getTime();
      const STALE_THRESHOLD_MS = 30000; // 30 seconds

      // Guard against negative ages (invalid timestamps)
      if (dataAge < 0) return false;

      // During initial loading, don't mark as stale unless data is very old
      if (loading) {
        return dataAge > STALE_THRESHOLD_MS * 2; // 60 seconds during loading
      }

      // After loading, mark as stale if data is older than threshold
      return dataAge > STALE_THRESHOLD_MS;
    } catch (error) {
      console.warn(`Invalid timestamp for ${ticker}:`, priceData.timestamp);
      return false;
    }
  })();

  return (
    <tr className="ticker-row" data-stale={isStale} data-loading={loading}>
      {/* Ticker with control icons underneath */}
      <td className="ticker-cell">
        <div className="ticker-content-vertical">
          <div className="ticker-symbol-wrapper">
            <span
              className="ticker-symbol clickable"
              onClick={handleTickerClick}
              title="Click to open in TradingView"
            >
              {ticker}
            </span>
          </div>
          <div className="ticker-controls">
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
          className={`change-percent mono clickable ${getChangePercentDisplay().className}`}
          onClick={handlePriceClick}
          title={`${getChangePercentTooltip()}\n\nClick to open in TradingView`}
        >
          {getChangePercentDisplay().value}
        </span>
      </td>

      {/* VRS 1m */}
      <td className="vrs-progress-cell group-separator">
        <VRSProgress
          vrs={vrsData?.vrs1m !== null && vrsData?.vrs1m !== undefined ? vrsData.vrs1m * 100 : null}
          tooltip={vrsData?.vrs1m !== null && vrsData?.vrs1m !== undefined
            ? `VRS (1m): ${formatVRS(vrsData.vrs1m * 100)}\n${vrsData.vrs1m * 100 > 0 ? 'Outperforming' : 'Underperforming'} QQQ (1-min granularity)\n\nClick to open in TradingView`
            : 'VRS (1m) data unavailable (waiting for 1m candle data)\n\nClick to open in TradingView'
          }
          onClick={handlePriceClick}
          clickable={true}
        />
      </td>

      {/* VRS 5m */}
      <td className="vrs-progress-cell">
        <VRSProgress
          vrs={vrsData?.vrs5m !== null && vrsData?.vrs5m !== undefined ? vrsData.vrs5m * 100 : null}
          tooltip={vrsData?.vrs5m !== null && vrsData?.vrs5m !== undefined
            ? `VRS (5m): ${formatVRS(vrsData.vrs5m * 100)}\n${vrsData.vrs5m * 100 > 0 ? 'Outperforming' : 'Underperforming'} QQQ (ADR%-normalized)\n\nClick to open in TradingView`
            : 'VRS data unavailable (waiting for 5m candle data)\n\nClick to open in TradingView'
          }
          onClick={handlePriceClick}
          clickable={true}
        />
      </td>

      {/* VRS 15m */}
      <td className="vrs-progress-cell">
        <VRSProgress
          vrs={vrsData?.vrs15m !== null && vrsData?.vrs15m !== undefined ? vrsData.vrs15m * 100 : null}
          tooltip={vrsData?.vrs15m !== null && vrsData?.vrs15m !== undefined
            ? `VRS (15m): ${formatVRS(vrsData.vrs15m * 100)}\n${vrsData.vrs15m * 100 > 0 ? 'Outperforming' : 'Underperforming'} QQQ (15-min momentum)\n\nClick to open in TradingView`
            : 'VRS (15m) data unavailable (waiting for 15m candle data)\n\nClick to open in TradingView'
          }
          onClick={handlePriceClick}
          clickable={true}
        />
      </td>

      {/* RVol */}
      <td className="rvol-progress-cell group-separator-major">
        <RVolProgress
          rvol={rvolData?.rvol}
          tooltip={`${rvolDisplay.tooltip}\n\nClick to open in TradingView`}
          onClick={handlePriceClick}
          clickable={true}
        />
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

      {/* Today's Move (ratio of ADR) */}
      <td className="adr-progress-cell">
        {todayADRDisplay.displayText ? (
          <div
            className="adr-progress-container clickable"
            onClick={handlePriceClick}
            title={`${getTodayMoveTooltip(movingAverages?.adr20)}\n\nClick to open in TradingView`}
          >
            <div className="adr-progress-track" />
            <div
              className={`adr-progress-bar ${todayADRDisplay.colorClass}`}
              style={{ width: `${getTodayMoveProgressWidth(todayADRDisplay.ratio)}%` }}
            />
            <div className="adr-progress-center-line" />
            <span className="adr-progress-text mono">{todayADRDisplay.displayText}</span>
          </div>
        ) : (
          <div className="adr-progress-container">
            <div className="adr-progress-track" />
            <div className="adr-progress-center-line" />
            <span className="adr-progress-text mono"></span>
          </div>
        )}
      </td>

      {/* 5m ORB */}
      <td className={`orb-cell group-separator-major ${orb5mDisplay.className} ${orb5mDisplay.hasBorder ? 'orb-breakout-border' : ''}`}>
        <span
          className="orb-indicator clickable"
          onClick={handlePriceClick}
          title={`${orb5mDisplay.tooltip}\n\nClick to open in TradingView`}
        >
          {orb5mDisplay.text}
        </span>
      </td>

      {/* 5D SMA */}
      <td className={`ma-cell group-separator-major ${getMAProximityClass(movingAverages?.sma5)}`}>
        <div
          className="ma-dual-display clickable"
          onClick={handlePriceClick}
          title={`${getMATooltip('5D SMA', movingAverages?.sma5)}\n\nClick to open in TradingView`}
        >
          <div className="ma-value mono">{sma5Display.value}</div>
          <div className={`ma-percentage mono ${sma5Display.className}`}>
            {sma5Display.text}
          </div>
        </div>
      </td>

      {/* 10D EMA */}
      <td className={`ma-cell ${getMAProximityClass(movingAverages?.ema10)}`}>
        <div
          className="ma-dual-display clickable"
          onClick={handlePriceClick}
          title={`${getMATooltip('10D EMA', movingAverages?.ema10)}\n\nClick to open in TradingView`}
        >
          <div className="ma-value mono">{ema10Display.value}</div>
          <div className={`ma-percentage mono ${ema10Display.className}`}>
            {ema10Display.text}
          </div>
        </div>
      </td>

      {/* 21D EMA */}
      <td className={`ma-cell ${getMAProximityClass(movingAverages?.ema21)}`}>
        <div
          className="ma-dual-display clickable"
          onClick={handlePriceClick}
          title={`${getMATooltip('21D EMA', movingAverages?.ema21)}\n\nClick to open in TradingView`}
        >
          <div className="ma-value mono">{ema21Display.value}</div>
          <div className={`ma-percentage mono ${ema21Display.className}`}>
            {ema21Display.text}
          </div>
        </div>
      </td>

      {/* 50D SMA */}
      <td className={`ma-cell ${getMAProximityClass(movingAverages?.sma50)}`}>
        <div
          className="ma-dual-display clickable"
          onClick={handlePriceClick}
          title={`${getMATooltip('50D SMA', movingAverages?.sma50)}\n\nClick to open in TradingView`}
        >
          <div className="ma-value mono">{sma50Display.value}</div>
          <div className={`ma-percentage mono ${sma50Display.className}`}>
            {sma50Display.text}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default TickerRow;
