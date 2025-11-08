import { useState, useEffect } from 'react';
import { isMarketOpen, isORBActive, formatEasternTime, getMarketStatus } from '../utils/marketTime';

/**
 * Custom hook for tracking market hours and current time
 * Updates every second to provide real-time market status
 *
 * @returns {object} { marketOpen, orbActive, currentTime, marketStatus }
 */
export function useMarketHours() {
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());
  const [orbActive, setOrbActive] = useState(isORBActive());
  const [currentTime, setCurrentTime] = useState(formatEasternTime());
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());

  useEffect(() => {
    // Update market status every second
    const interval = setInterval(() => {
      setMarketOpen(isMarketOpen());
      setOrbActive(isORBActive());
      setCurrentTime(formatEasternTime());
      setMarketStatus(getMarketStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    marketOpen,    // Boolean: Is market currently open?
    orbActive,     // Boolean: Is ORB strategy active? (after 9:35am)
    currentTime,   // String: Current ET time (HH:MM:SS ET)
    marketStatus   // Object: { status, nextStatus, openTime, closeTime }
  };
}

export default useMarketHours;
