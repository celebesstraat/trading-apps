
import React from 'react';
import { formatVRS, getVRSProgressColor, getVRSProgressWidth } from '../utils/rvolCalculations';

interface VRSProgressProps {
  vrs: number | null;
  tooltip: string;
  onClick?: () => void;
  clickable?: boolean;
}

const VRSProgress: React.FC<VRSProgressProps> = ({
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
