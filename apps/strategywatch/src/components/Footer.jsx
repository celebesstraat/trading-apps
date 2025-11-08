import { formatDateTime } from '../utils/formatters';
import './Footer.css';

/**
 * Footer Component
 * Displays last update time and ticker count
 *
 * @param {object} props
 * @param {number} props.lastUpdate Timestamp of last update (ms)
 * @param {number} props.tickerCount Number of tickers being tracked
 */
export function Footer({ lastUpdate, tickerCount }) {
  return (
    <footer className="footer">
      <div className="footer-left">
        {lastUpdate && (
          <span className="footer-text">
            Last updated: <span className="mono">{formatDateTime(lastUpdate)}</span>
          </span>
        )}
      </div>
    </footer>
  );
}

export default Footer;
