
import React from 'react';
import { getHeatmapColor, getContrastTextColor } from '../utils/colors';
import './HeatmapCell.css';

interface HeatmapCellProps {
  score: number | null | undefined;
  label?: string;
  onClick?: () => void;
  className?: string;
}

export const HeatmapCell: React.FC<HeatmapCellProps> = ({ score, label, onClick, className = '' }) => {
  // Handle null/undefined scores
  if (score === null || score === undefined) {
    return (
      <div className={`heatmap-cell heatmap-cell-empty ${className}`}>
        <span className="heatmap-score">—</span>
      </div>
    );
  }

  // Get color based on score
  const backgroundColor = getHeatmapColor(score);
  const textColor = getContrastTextColor(backgroundColor);

  return (
    <div
      className={`heatmap-cell ${onClick ? 'clickable' : ''} ${className}`}
      style={{
        backgroundColor,
        color: textColor
      }}
      onClick={onClick}
    >
      <span className="heatmap-score mono">
        {label || Math.round(score)}
      </span>
    </div>
  );
};

export default HeatmapCell;
