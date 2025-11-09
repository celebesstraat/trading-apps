import { useState, useEffect } from 'react';
import { isMarketOpen, isORBActive, formatEasternTime, getMarketStatus, isMarketOpenFallback, isORBActiveFallback, getMarketStatusFallback } from '../utils/marketTime';

/**
 * Custom hook for tracking market hours and current time
 * Updates every second to provide real-time market status using calendar API
 *
 * @returns {object} { marketOpen, orbActive, currentTime, marketStatus, isHoliday, isWeekend }
 */
export function useMarketHours() {
  const [marketOpen, setMarketOpen] = useState(isMarketOpenFallback());
  const [orbActive, setOrbActive] = useState(isORBActiveFallback());
  const [currentTime, setCurrentTime] = useState(formatEasternTime());
  const [marketStatus, setMarketStatus] = useState(getMarketStatusFallback());
  const [isHoliday, setIsHoliday] = useState(false);
  const [isWeekend, setIsWeekend] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Initial async fetch of calendar-aware status
    const updateMarketStatusAsync = async () => {
      try {
        if (!mounted) return;

        const [openStatus, orbStatus, status] = await Promise.all([
          isMarketOpen(),
          isORBActive(),
          getMarketStatus()
        ]);

        if (mounted) {
          setMarketOpen(openStatus);
          setOrbActive(orbStatus);
          setMarketStatus(status);
          setIsHoliday(status.isHoliday || false);
          setIsWeekend(status.isWeekend || false);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error updating market status async:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    updateMarketStatusAsync();

    // Update market status every second (async for calendar calls, sync for time)
    const interval = setInterval(() => {
      setCurrentTime(formatEasternTime());

      // Update async calendar data every 5 seconds to reduce API calls
      if (new Date().getSeconds() % 5 === 0) {
        updateMarketStatusAsync();
      } else {
        // Use fallback methods for immediate updates
        setMarketOpen(isMarketOpenFallback());
        setOrbActive(isORBActiveFallback());
        setMarketStatus(getMarketStatusFallback());
      }
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return {
    marketOpen,    // Boolean: Is market currently open?
    orbActive,     // Boolean: Is ORB strategy active? (after 9:35am)
    currentTime,   // String: Current ET time (HH:MM:SS ET)
    marketStatus,  // Object: { status, nextStatus, openTime, closeTime }
    isHoliday,     // Boolean: Is today a market holiday?
    isWeekend,     // Boolean: Is today a weekend?
    isLoading      // Boolean: Is calendar data still loading?
  };
}

export default useMarketHours;
