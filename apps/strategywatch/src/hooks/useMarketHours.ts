
import { useState, useEffect } from 'react';
import { isMarketOpen, isORBActive, formatEasternTime, getMarketStatus, isMarketOpenFallback, isORBActiveFallback, getMarketStatusFallback } from '../utils/marketTime';

interface MarketHours {
  marketOpen: boolean;
  orbActive: boolean;
  currentTime: string;
  marketStatus: MarketStatusValues;
  isHoliday: boolean;
  isWeekend: boolean;
  isLoading: boolean;
}

export function useMarketHours(): MarketHours {
  const [marketOpen, setMarketOpen] = useState(isMarketOpenFallback());
  const [orbActive, setOrbActive] = useState(isORBActiveFallback());
  const [currentTime, setCurrentTime] = useState(formatEasternTime());
  const [marketStatus, setMarketStatus] = useState<MarketStatusValues>(getMarketStatusFallback());
  const [isHoliday, setIsHoliday] = useState(false);
  const [isWeekend, setIsWeekend] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

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

    updateMarketStatusAsync();

    const interval = setInterval(() => {
      setCurrentTime(formatEasternTime());

      if (new Date().getSeconds() % 5 === 0) {
        updateMarketStatusAsync();
      } else {
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
    marketOpen,
    orbActive,
    currentTime,
    marketStatus,
    isHoliday,
    isWeekend,
    isLoading
  };
}

export default useMarketHours;
