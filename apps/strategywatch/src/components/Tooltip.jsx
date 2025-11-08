import { useState } from 'react';
import './Tooltip.css';

/**
 * Tooltip Component
 * Shows additional information on hover
 *
 * @param {object} props
 * @param {React.ReactNode} props.children Element to wrap with tooltip
 * @param {object} props.content Tooltip content (can include formatted data)
 * @param {string} props.position Tooltip position ('top', 'bottom', 'left', 'right')
 */
export function Tooltip({ children, content, position = 'top' }) {
  const [visible, setVisible] = useState(false);

  if (!content) {
    return children;
  }

  return (
    <div
      className="tooltip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className={`tooltip tooltip-${position}`}>
          {typeof content === 'object' ? (
            <div className="tooltip-content">
              {Object.entries(content).map(([key, value]) => (
                <div key={key} className="tooltip-row">
                  <span className="tooltip-label">{key}:</span>
                  <span className="tooltip-value">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="tooltip-content">{content}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default Tooltip;
