import React from 'react';
import { formatVRS, getVRSProgressColor, getVRSProgressWidth } from '../utils/rvolCalculations';

/**
 * VRSProgress Component
 *
 * A progress bar for displaying Volume Relative Strength (VRS) that:
 * - Centers on 0% (neutral performance) at 50% width
 * - Uses color gradients from red (underperformance) through amber/white to green (outperformance)
 * - Scales from -20% to +20% mapped to 0-100% width
 * - Includes smooth animations and detailed tooltips
 *
 * @param {object} props
 * @param {number|null} props.vrs - VRS percentage value (already scaled by 100)
 * @param {string} props.tooltip - Tooltip text to display on hover
 * @param {function} props.onClick - Click handler (optional)
 * @param {boolean} props.clickable - Whether the bar is clickable
 */
const VRSProgress = ({
  vrs,
  tooltip,
  onClick,
  clickable = false
}) => {
  // If no VRS data, display placeholder with center line
  if (vrs === null || vrs === undefined || isNaN(vrs)) {
    return (
      <div className="vrs-progress-container">
        <div className="vrs-progress-track" />
        <div className="vrs-progress-center-line" />
        <span className="vrs-progress-text mono"></span>
      </div>
    );
  }

  const progressWidth = getVRSProgressWidth(vrs);
  const colorClass = getVRSProgressColor(vrs);
  const displayValue = formatVRS(vrs);

  return (
    <div
      className={`vrs-progress-container ${clickable ? 'clickable' : ''}`}
      onClick={clickable ? onClick : undefined}
      title={tooltip}
    >
      {/* Background track */}
      <div className="vrs-progress-track" />

      {/* Colored progress bar */}
      <div
        className={`vrs-progress-bar ${colorClass}`}
        style={{ width: `${progressWidth}%` }}
      />

      {/* Center line indicator for 0% */}
      <div className="vrs-progress-center-line" />

      {/* Text overlay */}
      <span className="vrs-progress-text mono">{displayValue}</span>
    </div>
  );
};

export default React.memo(VRSProgress);