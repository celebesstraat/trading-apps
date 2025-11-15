import { MARKET_CONFIG } from '../config/constants';
import { isTradingDay, getNextTradingDay, getTodayTradingStatus } from '../services/marketCalendar';

import { MarketStatus } from '../types/types';

interface MarketStatusValues {
  openTime: string;
  closeTime: string;
  status: string;
  nextStatus?: string;
  isHoliday: boolean;
  isWeekend?: boolean;
}

interface TradingStatus {
  openTime?: string;
  closeTime?: string;
  isTradingDay: boolean;
}

/**
 * Gets current time in Eastern Time
 * @returns Current date/time in ET
 */
export function getEasternTime(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: MARKET_CONFIG.TIMEZONE }));
}

/**
 * Gets the next trading day (using calendar API for accuracy)
 * @param currentDate Current date in ET
 * @returns Next trading day date
 */
export async function getNextTradingDayFromCalendar(currentDate: Date): Promise<Date> {
  try {
    return await getNextTradingDay(currentDate);
  } catch (error) {
    console.error('Error getting next trading day from calendar, falling back to weekend logic:', error);
    return getNextTradingDayFallback(currentDate);
  }
}

/**
 * Fallback method to get next trading day (weekend logic only)
 * @param currentDate Current date in ET
 * @returns Next trading day date
 */
export function getNextTradingDayFallback(currentDate: Date): Date {
  const nextDay = new Date(currentDate);
  const daysToAdd = 1;

  // Keep adding days until we find a weekday (Monday-Friday)
  while (true) {
    nextDay.setDate(nextDay.getDate() + daysToAdd);
    const dayOfWeek = nextDay.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // 1 = Monday, 5 = Friday
      break;
    }
  }

  return nextDay;
}

/**
 * Formats date for display
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDateForDisplay(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = days[date.getDay()];
  const month = months[date.getMonth()];
  const dateNum = date.getDate();
  const year = date.getFullYear();

  return `${dayName} ${month} ${dateNum} ${year}`;
}

/**
 * Checks if the market is currently open (using calendar API for accuracy)
 * @returns True if market is open
 */
export async function isMarketOpen(): Promise<boolean> {
  try {
    const et = getEasternTime();
    const today = et.toISOString().split('T')[0];

    // Check if today is a trading day
    const isTodayTradingDay = await isTradingDay(today);
    if (!isTodayTradingDay) {
      return false;
    }

    // Check market hours
    const hour = et.getHours();
    const minute = et.getMinutes();

    // Before market open (9:30am)
    if (hour < MARKET_CONFIG.MARKET_OPEN_HOUR) {
      return false;
    }
    if (hour === MARKET_CONFIG.MARKET_OPEN_HOUR && minute < MARKET_CONFIG.MARKET_OPEN_MINUTE) {
      return false;
    }

    // After market close (4:00pm)
    if (hour >= MARKET_CONFIG.MARKET_CLOSE_HOUR) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking market open status, falling back to weekend logic:', error);
    return isMarketOpenFallback();
  }
}

/**
 * Fallback method to check if market is open (weekend logic only)
 * @returns True if market is open
 */
export function isMarketOpenFallback(): boolean {
  const et = getEasternTime();
  const day = et.getDay();
  const hour = et.getHours();
  const minute = et.getMinutes();

  // Not a weekday (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) {
    return false;
  }

  // Before market open (9:30am)
  if (hour < MARKET_CONFIG.MARKET_OPEN_HOUR) {
    return false;
  }
  if (hour === MARKET_CONFIG.MARKET_OPEN_HOUR && minute < MARKET_CONFIG.MARKET_OPEN_MINUTE) {
    return false;
  }

  // After market close (4:00pm)
  if (hour >= MARKET_CONFIG.MARKET_CLOSE_HOUR) {
    return false;
  }

  return true;
}

/**
 * Checks if ORB strategy is active (market open + after 9:35am ET)
 * ORB only becomes relevant after the first 5-minute candle is complete
 * @returns True if ORB should be displayed
 */
export async function isORBActive(): Promise<boolean> {
  try {
    if (!(await isMarketOpen())) {
      return false;
    }

    const et = getEasternTime();
    const hour = et.getHours();
    const minute = et.getMinutes();

    // ORB active from 9:35am onwards
    if (hour > MARKET_CONFIG.ORB_START_HOUR) {
      return true;
    }
    if (hour === MARKET_CONFIG.ORB_START_HOUR && minute >= MARKET_CONFIG.ORB_START_MINUTE) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking ORB active status, falling back to weekend logic:', error);
    return isORBActiveFallback();
  }
}

/**
 * Fallback method to check if ORB is active (weekend logic only)
 * @returns True if ORB should be displayed
 */
export function isORBActiveFallback(): boolean {
  if (!isMarketOpenFallback()) {
    return false;
  }

  const et = getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();

  // ORB active from 9:35am onwards
  if (hour > MARKET_CONFIG.ORB_START_HOUR) {
    return true;
  }
  if (hour === MARKET_CONFIG.ORB_START_HOUR && minute >= MARKET_CONFIG.ORB_START_MINUTE) {
    return true;
  }

  return false;
}

/**
 * Checks if it's time to fetch the first 5-minute candle (at 9:35am ET)
 * @returns True if it's exactly 9:35am ET
 */
export function shouldFetchFirst5mCandle(): boolean {
  const et = getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();

  return hour === MARKET_CONFIG.ORB_START_HOUR &&
         minute === MARKET_CONFIG.ORB_START_MINUTE;
}

/**
 * Formats current time as HH:MM:SS ET
 * @returns Formatted time string
 */
export function formatEasternTime(): string {
  const et = getEasternTime();
  const hours = et.getHours().toString().padStart(2, '0');
  const minutes = et.getMinutes().toString().padStart(2, '0');
  const seconds = et.getSeconds().toString().padStart(2, '0');

  return `${hours}:${minutes}:${seconds} ET`;
}

/**
 * Gets Unix timestamp for X days ago (for API calls)
 * @param daysAgo Number of days to go back
 * @returns Unix timestamp in seconds
 */
export function getUnixTimestamp(daysAgo: number = 0): number {
  const now = Date.now();
  const millisAgo = daysAgo * 24 * 60 * 60 * 1000;
  return Math.floor((now - millisAgo) / 1000);
}

/**
 * Converts Unix timestamp to readable date
 * @param timestamp Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    timeZone: MARKET_CONFIG.TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Gets market opening and closing times for today (using calendar API)
 * @returns { openTime, closeTime, status, isHoliday } with formatted times and status
 */
export async function getMarketStatus(): Promise<MarketStatusValues> {
  try {
    const et = getEasternTime();
    const hour = et.getHours();
    const minute = et.getMinutes();

    // Check if today is a trading day using calendar API
    const tradingStatus: TradingStatus = await getTodayTradingStatus();
    const isTodayTradingDay = tradingStatus.isTradingDay;

    // Format market hours
    const openTime = tradingStatus.openTime ? `${formatTime(tradingStatus.openTime)} ET` : '9:30 AM ET';
    const closeTime = tradingStatus.closeTime ? `${formatTime(tradingStatus.closeTime)} ET` : '4:00 PM ET';

    // Check if today is not a trading day (holiday or weekend)
    if (!isTodayTradingDay) {
      const day = et.getDay();
      const isWeekend = day === 0 || day === 6;
      const status = isWeekend ? 'Weekend' : 'Market Holiday';

      // Get next trading day
      const nextTradingDay = await getNextTradingDay(et);
      const nextTradingDate = formatDateForDisplay(nextTradingDay);

      return {
        openTime,
        closeTime,
        status,
        nextStatus: `Opens ${nextTradingDate} ${openTime}`,
        isHoliday: !isWeekend,
        isWeekend
      };
    }

    // Today is a trading day, check time-based status
    // Check if before market open
    if (hour < MARKET_CONFIG.MARKET_OPEN_HOUR ||
        (hour === MARKET_CONFIG.MARKET_OPEN_HOUR && minute < MARKET_CONFIG.MARKET_OPEN_MINUTE)) {
      return {
        openTime,
        closeTime,
        status: 'Pre-market',
        nextStatus: `Opens today ${openTime}`,
        isHoliday: false,
        isWeekend: false
      };
    }

    // Check if after market close
    if (hour >= MARKET_CONFIG.MARKET_CLOSE_HOUR) {
      const nextTradingDay = await getNextTradingDay(et);
      const nextTradingDate = formatDateForDisplay(nextTradingDay);

      return {
        openTime,
        closeTime,
        status: 'After-hours',
        nextStatus: `Opens ${nextTradingDate} ${openTime}`,
        isHoliday: false,
        isWeekend: false
      };
    }

    // Market is open
    return {
      openTime,
      closeTime,
      status: 'Regular Hours',
      nextStatus: `Closes today ${closeTime}`,
      isHoliday: false,
      isWeekend: false
    };
  } catch (error) {
    console.error('Error in getMarketStatus, falling back to weekend logic:', error);
    return getMarketStatusFallback();
  }
}

/**
 * Fallback method to get market status (weekend logic only)
 * @returns { openTime, closeTime, status, isHoliday, isWeekend } with formatted times and status
 */
export function getMarketStatusFallback(): MarketStatusValues {
  try {
    const et = getEasternTime();
    const day = et.getDay();
    const hour = et.getHours();
    const minute = et.getMinutes();

    // Format market hours (9:30 AM - 4:00 PM ET)
    const openTime = '9:30 AM ET';
    const closeTime = '4:00 PM ET';

    // Check if weekend
    if (day === 0 || day === 6) {
      const nextTradingDay = getNextTradingDayFallback(et);
      const nextTradingDate = formatDateForDisplay(nextTradingDay);
      return {
        openTime,
        closeTime,
        status: 'Weekend',
        nextStatus: `Opens ${nextTradingDate} ${openTime}`,
        isHoliday: false,
        isWeekend: true
      };
    }

    // Check if before market open
    if (hour < MARKET_CONFIG.MARKET_OPEN_HOUR ||
        (hour === MARKET_CONFIG.MARKET_OPEN_HOUR && minute < MARKET_CONFIG.MARKET_OPEN_MINUTE)) {
      return {
        openTime,
        closeTime,
        status: 'Pre-market',
        nextStatus: `Opens today ${openTime}`,
        isHoliday: false,
        isWeekend: false
      };
    }

    // Check if after market close
    if (hour >= MARKET_CONFIG.MARKET_CLOSE_HOUR) {
      const nextTradingDay = getNextTradingDayFallback(et);
      const nextTradingDate = formatDateForDisplay(nextTradingDay);
      return {
        openTime,
        closeTime,
        status: 'After-hours',
        nextStatus: `Opens ${nextTradingDate} ${openTime}`,
        isHoliday: false,
        isWeekend: false
      };
    }

    // Market is open
    return {
      openTime,
      closeTime,
      status: 'Regular Hours',
      nextStatus: `Closes today ${closeTime}`,
      isHoliday: false,
      isWeekend: false
    };
  } catch (error) {
    console.error('Error in getMarketStatusFallback:', error);
    return {
      openTime: '9:30 AM ET',
      closeTime: '4:00 PM ET',
      status: 'Unknown',
      nextStatus: 'Status unavailable',
      isHoliday: false,
      isWeekend: false
    };
  }
}

/**
 * Formats time from 24-hour HH:MM to 12-hour format
 * @param time24 - Time in HH:MM format
 * @returns Formatted time (e.g., "9:30 AM")
 */
function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}