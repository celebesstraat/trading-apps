import { useEffect, useRef } from 'react';
import { getEasternTime } from '../utils/marketTime';
import { announce } from '../utils/voiceAlerts';
import { MARKET_CONFIG } from '../config/constants';

/**
 * Custom hook for market open/close voice announcements
 * Announces "US Market is now Open" at exactly 09:30:00 EST on weekdays
 * Announces "US Market is now Closed" at exactly 16:00:00 EST on weekdays
 */
export function useMarketAnnouncements() {
  const hasAnnouncedOpenRef = useRef(false);
  const hasAnnouncedCloseRef = useRef(false);
  const lastCheckedMinuteRef = useRef(null);

  useEffect(() => {
    // Check every second for exact market open/close times
    const interval = setInterval(() => {
      const et = getEasternTime();
      const day = et.getDay();
      const hour = et.getHours();
      const minute = et.getMinutes();
      const second = et.getSeconds();

      // Only announce on weekdays (Monday-Friday)
      if (day === 0 || day === 6) {
        return;
      }

      // Create a unique key for the current minute (to reset announcements each minute)
      const currentMinuteKey = `${hour}:${minute}`;

      // Reset announcement flags when we move to a different minute
      if (lastCheckedMinuteRef.current !== currentMinuteKey) {
        lastCheckedMinuteRef.current = currentMinuteKey;

        // Reset the appropriate flag based on the new minute
        if (hour !== MARKET_CONFIG.MARKET_OPEN_HOUR || minute !== MARKET_CONFIG.MARKET_OPEN_MINUTE) {
          hasAnnouncedOpenRef.current = false;
        }
        if (hour !== MARKET_CONFIG.MARKET_CLOSE_HOUR || minute !== MARKET_CONFIG.MARKET_CLOSE_MINUTE) {
          hasAnnouncedCloseRef.current = false;
        }
      }

      // Check for market open (09:30:00 EST)
      if (
        hour === MARKET_CONFIG.MARKET_OPEN_HOUR &&
        minute === MARKET_CONFIG.MARKET_OPEN_MINUTE &&
        second === 0 &&
        !hasAnnouncedOpenRef.current
      ) {
        announce('U S Market is now Open');
        hasAnnouncedOpenRef.current = true;
        console.log('🔔 Market open announcement triggered at', et.toLocaleTimeString('en-US', { timeZone: MARKET_CONFIG.TIMEZONE }));
      }

      // Check for market close (16:00:00 EST)
      if (
        hour === MARKET_CONFIG.MARKET_CLOSE_HOUR &&
        minute === MARKET_CONFIG.MARKET_CLOSE_MINUTE &&
        second === 0 &&
        !hasAnnouncedCloseRef.current
      ) {
        announce('U S Market is now Closed');
        hasAnnouncedCloseRef.current = true;
        console.log('🔔 Market close announcement triggered at', et.toLocaleTimeString('en-US', { timeZone: MARKET_CONFIG.TIMEZONE }));
      }
    }, 1000); // Check every second for precise timing

    return () => clearInterval(interval);
  }, []);
}

export default useMarketAnnouncements;
