
import React from 'react';
import { formatRVol, getRVolProgressColor, getRVolProgressWidth } from '../utils/rvolCalculations';

interface RVolProgressProps {
  rvol: number | null;
  tooltip: string;
  onClick?: () => void;
  clickable?: boolean;
}

const RVolProgress: React.FC<RVolProgressProps> = ({
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
        <span className="rvol-progress-text mono"></span>
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

