
import { useEffect, useRef } from 'react';
import { getEasternTime } from '../utils/marketTime';
import { announce } from '../utils/voiceAlerts';
import { MARKET_CONFIG } from '../config/constants';

export function useMarketAnnouncements(globalMuted: boolean = false) {
  const hasAnnouncedOpenRef = useRef<boolean>(false);
  const hasAnnouncedCloseRef = useRef<boolean>(false);
  const lastCheckedMinuteRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const et = getEasternTime();
      const day = et.getDay();
      const hour = et.getHours();
      const minute = et.getMinutes();
      const second = et.getSeconds();

      if (day === 0 || day === 6) {
        return;
      }

      const currentMinuteKey = `${hour}:${minute}`;

      if (lastCheckedMinuteRef.current !== currentMinuteKey) {
        lastCheckedMinuteRef.current = currentMinuteKey;

        if (hour !== MARKET_CONFIG.MARKET_OPEN_HOUR || minute !== MARKET_CONFIG.MARKET_OPEN_MINUTE) {
          hasAnnouncedOpenRef.current = false;
        }
        if (hour !== MARKET_CONFIG.MARKET_CLOSE_HOUR || minute !== MARKET_CONFIG.MARKET_CLOSE_MINUTE) {
          hasAnnouncedCloseRef.current = false;
        }
      }

      if (
        hour === MARKET_CONFIG.MARKET_OPEN_HOUR &&
        minute === MARKET_CONFIG.MARKET_OPEN_MINUTE &&
        second === 0 &&
        !hasAnnouncedOpenRef.current
      ) {
        if (!globalMuted) {
          announce('U S Market is now Open');
        }
        hasAnnouncedOpenRef.current = true;
        console.log('🔔 Market open announcement triggered at', et.toLocaleTimeString('en-US', { timeZone: MARKET_CONFIG.TIMEZONE }), globalMuted ? '(MUTED)' : '(ANNOUNCED)');
      }

      if (
        hour === MARKET_CONFIG.MARKET_CLOSE_HOUR &&
        minute === MARKET_CONFIG.MARKET_CLOSE_MINUTE &&
        second === 0 &&
        !hasAnnouncedCloseRef.current
      ) {
        if (!globalMuted) {
          announce('U S Market is now Closed');
        }
        hasAnnouncedCloseRef.current = true;
        console.log('🔔 Market close announcement triggered at', et.toLocaleTimeString('en-US', { timeZone: MARKET_CONFIG.TIMEZONE }), globalMuted ? '(MUTED)' : '(ANNOUNCED)');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [globalMuted]);
}

export default useMarketAnnouncements;
