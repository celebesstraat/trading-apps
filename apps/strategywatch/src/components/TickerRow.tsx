
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { formatPrice, formatTime } from '../utils/formatters';
import { ORB_THRESHOLDS } from '../config/constants';
import { announce, toggleTickerMute, isTickerMuted } from '../utils/voiceAlerts';
import { formatRVol, getRVolColor, getRVolTooltip, getTodayMoveProgressWidth, formatVRS } from '../utils/rvolCalculations';
import { checkPriceProximityToMA } from '../services/calculations';
import { useData } from '../hooks/useData';
import RVolProgress from './RVolProgress';
import VRSProgress from './VRSProgress';
import './TickerRow.css';
import { TickerData, PriceData, MovingAverages, ORBData, RVolResult, VRSResult, ExtendedRVolResult } from '../types/types';

interface TickerRowProps {
  ticker: string;
  priceData: PriceData;
  movingAverages: MovingAverages;
  orb5mData: ORBData;
  rvolData: RVolResult;
  vrsData: VRSResult;
}

export const TickerRow: React.FC<TickerRowProps> = ({
  ticker,
  priceData,
  movingAverages,
  orb5mData,
  rvolData
}) => {
  const price = priceData?.price;
  const timestamp = priceData?.timestamp;
  const previousClose = priceData?.previousClose;

  const { globalMuted, loading, marketOpen, vrsData } = useData();
  const [isTickerMutedState, setIsTickerMutedState] = useState(() => isTickerMuted(ticker));

  const handleMuteToggle = () => {
    const newMutedState = toggleTickerMute(ticker);
    setIsTickerMutedState(newMutedState);
  };

  const effectivelyMuted = globalMuted || isTickerMutedState;

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

    if (colorCategory === 'high') {
      className = 'rvol-high';
    } else if (colorCategory === 'low') {
      className = 'rvol-low';
    }

    return {
      value: formatRVol(rvolData.rvol),
      className,
      tooltip: getRVolTooltip(rvolData as ExtendedRVolResult)
    };
  };

  const lastORBAnnouncement = useRef<{ announcedTier: number | null, announcedTime: number, announcedBreakout: boolean, announcedDirection: 'bullish' | 'bearish' | null }>({
    announcedTier: null,
    announcedTime: 0,
    announcedBreakout: false,
    announcedDirection: null
  });

  const getMADisplay = (maValue: number | undefined) => {
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

  const checkMAProximity = (maValue: number | undefined) => {
    if (!price || !maValue || !movingAverages?.adr20) {
      return { isClose: false, isModeratelyClose: false, distancePercent: 0, greenThreshold: 0, amberThreshold: 0 };
    }
    return checkPriceProximityToMA(price, maValue, movingAverages.adr20);
  };

  const getMAProximityClass = (maValue: number | undefined) => {
    const proximity = checkMAProximity(maValue);
    if (proximity.isClose) {
      return 'ma-proximity-highlight';
    } else if (proximity.isModeratelyClose) {
      return 'ma-proximity-amber';
    }
    return '';
  };

  const handleTickerClick = () => {
    window.open(`https://www.tradingview.com/chart/?symbol=${ticker}`, '_blank');
  };

  const handlePriceClick = () => {
    window.open(`https://www.tradingview.com/chart/?symbol=${ticker}`, '_blank');
  };

  const getADRDisplay = (adrValue: number | undefined) => {
    if (!adrValue) {
      return { text: '—', className: '' };
    }
    return {
      text: `${adrValue.toFixed(2)}%`,
      className: ''
    };
  };

  const orb5mDisplay = useMemo(() => {
    if (!orb5mData || !orb5mData.candle) {
      return { text: '', className: '', hasBorder: false, tooltip: 'Waiting for first 5m candle...', tier1Met: false, tier2Met: false };
    }

    const { open, high, low, close, volume } = orb5mData.candle;
    const avgVolume = orb5mData.avgVolume;

    const range = high - low;
    const body = Math.abs(close - open);
    const bodyRatio = range > 0 ? body / range : 0;
    const volumeMultiplier = avgVolume ? volume / avgVolume : 0;
    const isGreenCandle = close > open;

    const openPos = range > 0 ? (open - low) / range : 0;
    const closePos = range > 0 ? (close - low) / range : 0;

    const openLowQ = openPos <= ORB_THRESHOLDS.LOWER_QUANTILE;
    const closeHighQ = closePos >= ORB_THRESHOLDS.UPPER_QUANTILE;
    const bodyOK = bodyRatio >= ORB_THRESHOLDS.MIN_BODY_RATIO;
    const greenOK = isGreenCandle;

    const openHighQ = openPos >= ORB_THRESHOLDS.UPPER_QUANTILE;
    const closeLowQ = closePos <= ORB_THRESHOLDS.LOWER_QUANTILE;
    const redOK = !isGreenCandle;

    const bullishBreakout = marketOpen && price && high && price >= high;
    const bearishBreakout = marketOpen && price && low && price <= low;

    let className = '';
    let tooltip = '';
    let hasBorder = false;

    const bullishPriceOK = bodyOK && greenOK && openLowQ && closeHighQ;
    const bullishTier2Met = bullishPriceOK && volumeMultiplier >= ORB_THRESHOLDS.TIER2_VOLUME_MULTIPLIER;

    const bullishTier1Met = bullishPriceOK && volumeMultiplier >= ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER;

    const bearishPriceOK = bodyOK && redOK && openHighQ && closeLowQ;
    const bearishTier2Met = bearishPriceOK && volumeMultiplier >= ORB_THRESHOLDS.TIER2_VOLUME_MULTIPLIER;

    const bearishTier1Met = bearishPriceOK && volumeMultiplier >= ORB_THRESHOLDS.TIER1_VOLUME_MULTIPLIER;

    if (bearishTier2Met) {
      className = 'orb-dark-red';
      hasBorder: !!bearishBreakout;
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
      className = 'orb-light-red';
      hasBorder: !!bearishBreakout;
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
      className = 'orb-dark-green';
      hasBorder: !!bullishBreakout;
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
      className = 'orb-light-green';
      hasBorder: !!bullishBreakout;
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
  }, [orb5mData, price, marketOpen]);

  useEffect(() => {
    if (!orb5mDisplay.tier1Met && !orb5mDisplay.tier2Met && !orb5mDisplay.hasBorder) {
      return;
    }

    const now = Date.now();
    const timeSinceLastAnnouncement = now - lastORBAnnouncement.current.announcedTime;
    const ANNOUNCEMENT_COOLDOWN = 30000;

    const isBearish = orb5mDisplay.className.includes('red');
    const direction = isBearish ? 'bearish' : 'bullish';

    if (orb5mDisplay.tier2Met &&
        (lastORBAnnouncement.current.announcedTier !== 2 || lastORBAnnouncement.current.announcedDirection !== direction) &&
        timeSinceLastAnnouncement > ANNOUNCEMENT_COOLDOWN) {
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

    if (orb5mDisplay.hasBorder &&
        !lastORBAnnouncement.current.announcedBreakout &&
        timeSinceLastAnnouncement > ANNOUNCEMENT_COOLDOWN) {
      const announcement = isBearish ?
        `${ticker} ORB bearish breakout confirmed` :
        `${ticker} ORB bullish breakout confirmed`;
      announce(announcement, ticker);
      lastORBAnnouncement.current.announcedBreakout = true;
    } else if (!orb5mDisplay.hasBorder) {
      lastORBAnnouncement.current.announcedBreakout = false;
    }
  }, [orb5mDisplay.tier1Met, orb5mDisplay.tier2Met, orb5mDisplay.hasBorder, orb5mDisplay.className, ticker]);

  const getTodayADRDisplay = (adr20Value: number | undefined) => {
    const high = priceData?.high;
    const low = priceData?.low;

    if (!high || !low || !price || !adr20Value) {
      return { ratio: 0, displayText: '', isOverADR: false, colorClass: '' };
    }

    const todayRange = high - low;
    const adr20Dollars = price * (adr20Value / 100);
    const todayMoveRatio = todayRange / adr20Dollars;

    const getColorClass = (ratio: number) => {
      if (ratio < 0.5) {
        return 'adr-very-low';
      } else if (ratio < 0.8) {
        return 'adr-low';
      } else if (ratio < 1.2) {
        return 'adr-normal';
      } else if (ratio < 1.5) {
        return 'adr-high';
      } else {
        return 'adr-very-high';
      }
    };

    return {
      ratio: todayMoveRatio,
      displayText: `${todayMoveRatio.toFixed(1)}x`,
      isOverADR: todayMoveRatio >= 1.0,
      colorClass: getColorClass(todayMoveRatio)
    };
  };

  const getChangePercentTooltip = () => {
    if (!price || !previousClose) {
      return 'Daily change data unavailable';
    }
    const changeDollar = price - previousClose;
    const changePercent = ((price - previousClose) / previousClose) * 100;
    const sign = changeDollar >= 0 ? '+' : '';
    return `Current: ${formatPrice(price)}\nPrev Close: ${formatPrice(previousClose)}\nChange: ${sign}${formatPrice(Math.abs(changeDollar))} (${sign}${changePercent.toFixed(2)}%)`;
  };

  const getVolatilityLevel = (adrPercent: number) => {
    if (adrPercent < 2) return 'Low';
    if (adrPercent < 4) return 'Moderate';
    return 'High';
  };

  const getADRTooltip = (adr20Value: number | undefined) => {
    if (!adr20Value || !price) {
      return '20-Day Average Daily Range data unavailable';
    }
    const adr20Dollars = price * (adr20Value / 100);
    const volatility = getVolatilityLevel(adr20Value);
    return `20-Day Avg Daily Range: ${formatPrice(adr20Dollars)}\nAs % of price: ${adr20Value.toFixed(2)}%\nVolatility: ${volatility}`;
  };

  const getTodayMoveTooltip = (adr20Value: number | undefined) => {
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

  const getMATooltip = (maName: string, maValue: number | undefined) => {
    if (!price || !maValue) {
      return `${maName} data unavailable`;
    }
    const distance = price - maValue;
    const percentDistance = ((price - maValue) / maValue) * 100;
    const position = price >= maValue ? 'Above' : 'Below';
    const sign = distance >= 0 ? '+' : '';

    const proximity = checkMAProximity(maValue);
    let proximityInfo = '';
    if (proximity.isClose) {
      proximityInfo = `\n🟢 CLOSE TO MA (within ±${proximity.greenThreshold.toFixed(2)}% - Green box)`
    } else if (proximity.isModeratelyClose) {
      proximityInfo = `\n🟠 MODERATELY CLOSE TO MA (within ±${proximity.amberThreshold.toFixed(2)}% - Amber box)`;
    }

    return `Price: ${formatPrice(price)}\n${maName}: ${formatPrice(maValue)}\nDistance: ${sign}${formatPrice(Math.abs(distance))} (${sign}${percentDistance.toFixed(2)}%)\nPosition: ${position}${proximityInfo}`;
  };

  const sma5Display = getMADisplay(movingAverages?.sma5 || undefined);
  const ema10Display = getMADisplay(movingAverages?.ema10 || undefined);
  const ema21Display = getMADisplay(movingAverages?.ema21 || undefined);
  const sma50Display = getMADisplay(movingAverages?.sma50 || undefined);
  const adr20Display = getADRDisplay(movingAverages?.adr20);
  const rvolDisplay = getRVolDisplay();
  const todayADRDisplay = getTodayADRDisplay(movingAverages?.adr20);

  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isStale = (() => {
    if (!priceData?.timestamp) return false;

    try {
      const dataAge = currentTime - new Date(priceData.timestamp).getTime();
      const STALE_THRESHOLD_MS = 30000;

      if (dataAge < 0) return false;

      if (loading) {
        return dataAge > STALE_THRESHOLD_MS * 2;
      }

      return dataAge > STALE_THRESHOLD_MS;
    } catch (error) {
      console.warn(`Invalid timestamp for ${ticker}:`, priceData.timestamp);
      return false;
    }
  })();

  return (
    <tr className="ticker-row" data-stale={isStale} data-loading={loading}>
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

      <td className="time-cell group-separator-major">
        <span className="time mono">{timestamp ? formatTime(timestamp) : '—'}</span>
      </td>

      <td className="price-cell">
        <span
          className="price mono clickable"
          onClick={handlePriceClick}
          title="Open in TradingView"
        >
          {price ? formatPrice(price) : '—'}
        </span>
      </td>

      <td className="change-percent-cell">
        <span
          className={`change-percent mono clickable ${getChangePercentDisplay().className}`}
          onClick={handlePriceClick}
          title={`${getChangePercentTooltip()}\n\nClick to open in TradingView`}
        >
          {getChangePercentDisplay().value}
        </span>
      </td>

      <td className="vrs-progress-cell group-separator">
        <VRSProgress
          vrs={vrsData && vrsData[ticker]?.vrs1m !== null && vrsData[ticker]?.vrs1m !== undefined ? (typeof vrsData[ticker].vrs1m === 'object' ? vrsData[ticker].vrs1m.value : vrsData[ticker].vrs1m) : null}
          tooltip={vrsData && vrsData[ticker]?.vrs1m !== null && vrsData[ticker]?.vrs1m !== undefined
            ? `VRS (1m): ${formatVRS(typeof vrsData[ticker].vrs1m === 'object' ? vrsData[ticker].vrs1m.value : vrsData[ticker].vrs1m)}\n${(typeof vrsData[ticker].vrs1m === 'object' ? vrsData[ticker].vrs1m.value : vrsData[ticker].vrs1m) > 0 ? 'Outperforming' : 'Underperforming'} QQQ (1-min granularity)\n\nClick to open in TradingView`
            : 'VRS (1m) data unavailable (waiting for 1m candle data)\n\nClick to open in TradingView'
          }
          onClick={handlePriceClick}
          clickable={true}
        />
      </td>

      <td className="vrs-progress-cell">
        <VRSProgress
          vrs={vrsData && vrsData[ticker]?.vrs5m !== null && vrsData[ticker]?.vrs5m !== undefined ? (typeof vrsData[ticker].vrs5m === 'object' ? vrsData[ticker].vrs5m.value : vrsData[ticker].vrs5m) : null}
          tooltip={vrsData && vrsData[ticker]?.vrs5m !== null && vrsData[ticker]?.vrs5m !== undefined
            ? `VRS (5m): ${formatVRS(typeof vrsData[ticker].vrs5m === 'object' ? vrsData[ticker].vrs5m.value : vrsData[ticker].vrs5m)}\n${(typeof vrsData[ticker].vrs5m === 'object' ? vrsData[ticker].vrs5m.value : vrsData[ticker].vrs5m) > 0 ? 'Outperforming' : 'Underperforming'} QQQ (ADR%-normalized)\n\nClick to open in TradingView`
            : 'VRS data unavailable (waiting for 5m candle data)\n\nClick to open in TradingView'
          }
          onClick={handlePriceClick}
          clickable={true}
        />
      </td>

      <td className="vrs-progress-cell">
        <VRSProgress
          vrs={vrsData && vrsData[ticker]?.vrs15m !== null && vrsData[ticker]?.vrs15m !== undefined ? (typeof vrsData[ticker].vrs15m === 'object' ? vrsData[ticker].vrs15m.value : vrsData[ticker].vrs15m) : null}
          tooltip={vrsData && vrsData[ticker]?.vrs15m !== null && vrsData[ticker]?.vrs15m !== undefined
            ? `VRS (15m): ${formatVRS(typeof vrsData[ticker].vrs15m === 'object' ? vrsData[ticker].vrs15m.value : vrsData[ticker].vrs15m)}\n${(typeof vrsData[ticker].vrs15m === 'object' ? vrsData[ticker].vrs15m.value : vrsData[ticker].vrs15m) > 0 ? 'Outperforming' : 'Underperforming'} QQQ (15-min momentum)\n\nClick to open in TradingView`
            : 'VRS (15m) data unavailable (waiting for 15m candle data)\n\nClick to open in TradingView'
          }
          onClick={handlePriceClick}
          clickable={true}
        />
      </td>

      <td className="rvol-progress-cell group-separator-major">
        <RVolProgress
          rvol={rvolData?.rvol}
          tooltip={`${rvolDisplay.tooltip}\n\nClick to open in TradingView`}
          onClick={handlePriceClick}
          clickable={true}
        />
      </td>

      <td className="ma-cell group-separator-major">
        <span
          className={`ma-percent mono ${adr20Display.className}`}
          title={getADRTooltip(movingAverages?.adr20)}
        >
          {adr20Display.text}
        </span>
      </td>

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

      <td className={`orb-cell group-separator-major ${orb5mDisplay.className} ${orb5mDisplay.hasBorder ? 'orb-breakout-border' : ''}`}>
        <span
          className="orb-indicator clickable"
          onClick={handlePriceClick}
          title={`${orb5mDisplay.tooltip}\n\nClick to open in TradingView`}
        >
          {orb5mDisplay.text}
        </span>
      </td>

      <td className={`ma-cell group-separator-major ${getMAProximityClass(movingAverages?.sma5 || undefined)}`}>
        <div
          className="ma-dual-display clickable"
          onClick={handlePriceClick}
          title={`${getMATooltip('5D SMA', movingAverages?.sma5 || undefined)}\n\nClick to open in TradingView`}
        >
          <div className="ma-value mono">{sma5Display.value}</div>
          <div className={`ma-percentage mono ${sma5Display.className}`}>
            {sma5Display.text}
          </div>
        </div>
      </td>

      <td className={`ma-cell ${getMAProximityClass(movingAverages?.ema10 || undefined)}`}>
        <div
          className="ma-dual-display clickable"
          onClick={handlePriceClick}
          title={`${getMATooltip('10D EMA', movingAverages?.ema10 || undefined)}\n\nClick to open in TradingView`}
        >
          <div className="ma-value mono">{ema10Display.value}</div>
          <div className={`ma-percentage mono ${ema10Display.className}`}>
            {ema10Display.text}
          </div>
        </div>
      </td>

      <td className={`ma-cell ${getMAProximityClass(movingAverages?.ema21 || undefined)}`}>
        <div
          className="ma-dual-display clickable"
          onClick={handlePriceClick}
          title={`${getMATooltip('21D EMA', movingAverages?.ema21 || undefined)}\n\nClick to open in TradingView`}
        >
          <div className="ma-value mono">{ema21Display.value}</div>
          <div className={`ma-percentage mono ${ema21Display.className}`}>
            {ema21Display.text}
          </div>
        </div>
      </td>

      <td className={`ma-cell ${getMAProximityClass(movingAverages?.sma50 || undefined)}`}>
        <div
          className="ma-dual-display clickable"
          onClick={handlePriceClick}
          title={`${getMATooltip('50D SMA', movingAverages?.sma50 || undefined)}\n\nClick to open in TradingView`}
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

export default React.memo(TickerRow);
