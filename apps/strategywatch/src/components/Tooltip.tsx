
import React, { useState } from 'react';
import './Tooltip.css';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode | Record<string, any>;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  if (!content) {
    return <>{children}</>;
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
          {typeof content === 'object' && !React.isValidElement(content) ? (
            <div className="tooltip-content">
              {Object.entries(content).map(([key, value]) => (
                <div key={key} className="tooltip-row">
                  <span className="tooltip-label">{key}:</span>
                  <span className="tooltip-value">{String(value)}</span>
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
