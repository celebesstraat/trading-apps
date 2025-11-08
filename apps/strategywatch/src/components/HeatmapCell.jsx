import { getHeatmapColor, getContrastTextColor } from '../utils/colors';
import './HeatmapCell.css';

/**
 * HeatmapCell Component
 * Displays a score (0-100) with a color gradient background
 *
 * @param {object} props
 * @param {number} props.score Score value (0-100), or null
 * @param {string} props.label Optional label to display instead of score
 * @param {function} props.onClick Optional click handler
 * @param {string} props.className Additional CSS classes
 */
export function HeatmapCell({ score, label, onClick, className = '' }) {
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
}

export default HeatmapCell;
