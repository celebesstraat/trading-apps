
import React from 'react';
import { formatDateTime } from '../utils/formatters';
import './Footer.css';

interface FooterProps {
  lastUpdate: number;
  _tickerCount?: number;
  tickerCount: number;
}

export function Footer({ lastUpdate, _tickerCount }: FooterProps) {
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
