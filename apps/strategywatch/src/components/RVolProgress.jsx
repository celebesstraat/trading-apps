import React from 'react';
import { formatRVol, getRVolProgressColor, getRVolProgressWidth } from '../utils/rvolCalculations';

/**
 * RVolProgress Component
 *
 * A modern progress bar for displaying Relative Volume (RVol) that:
 * - Centers on 1.0x (normal volume) at 50% width
 * - Uses color gradients from red (low) through amber/white to green (high)
 * - Scales from 0x to 4x+ mapped to 0-100% width
 * - Includes smooth animations and detailed tooltips
 *
 * @param {object} props
 * @param {number|null} props.rvol - RVol ratio value
 * @param {string} props.tooltip - Tooltip text to display on hover
 * @param {function} props.onClick - Click handler (optional)
 * @param {boolean} props.clickable - Whether the bar is clickable
 */
const RVolProgress = ({
  rvol,
  tooltip,
  onClick,
  clickable = false
}) => {
  // If no RVol data, display placeholder with center line
  if (rvol === null || rvol === undefined || isNaN(rvol)) {
    return (
      <div className="rvol-progress-container">
        <div className="rvol-progress-track" />
        <div className="rvol-progress-center-line" />
        <span className="rvol-progress-text mono">—</span>
      </div>
    );
  }

  const progressWidth = getRVolProgressWidth(rvol);
  const colorClass = getRVolProgressColor(rvol);
  const displayValue = formatRVol(rvol);

  return (
    <div
      className={`rvol-progress-container ${clickable ? 'clickable' : ''}`}
      onClick={clickable ? onClick : undefined}
      title={tooltip}
    >
      {/* Background track */}
      <div className="rvol-progress-track" />

      {/* Colored progress bar */}
      <div
        className={`rvol-progress-bar ${colorClass}`}
        style={{ width: `${progressWidth}%` }}
      />

      {/* Center line indicator for 1.0x */}
      <div className="rvol-progress-center-line" />

      {/* Text overlay */}
      <span className="rvol-progress-text mono">{displayValue}</span>
    </div>
  );
};

export default React.memo(RVolProgress);