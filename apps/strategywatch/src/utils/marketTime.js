import { MARKET_CONFIG } from '../config/constants';

/**
 * Gets current time in Eastern Time
 * @returns {Date} Current date/time in ET
 */
export function getEasternTime() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: MARKET_CONFIG.TIMEZONE }));
}

/**
 * Gets the next trading day (Monday-Friday)
 * @param {Date} currentDate Current date in ET
 * @returns {Date} Next trading day date
 */
export function getNextTradingDay(currentDate) {
  const nextDay = new Date(currentDate);
  let daysToAdd = 1;

  // Keep adding days until we find a weekday (Monday-Friday)
  do {
    nextDay.setDate(nextDay.getDate() + daysToAdd);
    const dayOfWeek = nextDay.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // 1 = Monday, 5 = Friday
      break;
    }
  } while (true);

  return nextDay;
}

/**
 * Formats date for display
 * @param {Date} date Date to format
 * @returns {string} Formatted date string
 */
export function formatDateForDisplay(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = days[date.getDay()];
  const month = months[date.getMonth()];
  const dateNum = date.getDate();
  const year = date.getFullYear();

  return `${dayName} ${month} ${dateNum} ${year}`;
}

/**
 * Checks if the market is currently open (Mon-Fri, 9:30am-4:00pm ET)
 * @returns {boolean} True if market is open
 */
export function isMarketOpen() {
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
 * @returns {boolean} True if ORB should be displayed
 */
export function isORBActive() {
  if (!isMarketOpen()) {
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
 * @returns {boolean} True if it's exactly 9:35am ET
 */
export function shouldFetchFirst5mCandle() {
  const et = getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();

  return hour === MARKET_CONFIG.ORB_START_HOUR &&
         minute === MARKET_CONFIG.ORB_START_MINUTE;
}

/**
 * Formats current time as HH:MM:SS ET
 * @returns {string} Formatted time string
 */
export function formatEasternTime() {
  const et = getEasternTime();
  const hours = et.getHours().toString().padStart(2, '0');
  const minutes = et.getMinutes().toString().padStart(2, '0');
  const seconds = et.getSeconds().toString().padStart(2, '0');

  return `${hours}:${minutes}:${seconds} ET`;
}

/**
 * Gets Unix timestamp for X days ago (for API calls)
 * @param {number} daysAgo Number of days to go back
 * @returns {number} Unix timestamp in seconds
 */
export function getUnixTimestamp(daysAgo = 0) {
  const now = Date.now();
  const millisAgo = daysAgo * 24 * 60 * 60 * 1000;
  return Math.floor((now - millisAgo) / 1000);
}

/**
 * Converts Unix timestamp to readable date
 * @param {number} timestamp Unix timestamp in seconds
 * @returns {string} Formatted date string
 */
export function formatTimestamp(timestamp) {
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
 * Gets market opening and closing times for today
 * @returns {object} { openTime, closeTime, status } with formatted times and status
 */
export function getMarketStatus() {
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
      const nextTradingDay = getNextTradingDay(et);
      const nextTradingDate = formatDateForDisplay(nextTradingDay);
      return {
        openTime,
        closeTime,
        status: 'Weekend',
        nextStatus: `Opens ${nextTradingDate} ${openTime}`
      };
    }

    // Check if before market open
    if (hour < MARKET_CONFIG.MARKET_OPEN_HOUR ||
        (hour === MARKET_CONFIG.MARKET_OPEN_HOUR && minute < MARKET_CONFIG.MARKET_OPEN_MINUTE)) {
      return {
        openTime,
        closeTime,
        status: 'Pre-market',
        nextStatus: `Opens today ${openTime}`
      };
    }

    // Check if after market close
    if (hour >= MARKET_CONFIG.MARKET_CLOSE_HOUR) {
      const nextTradingDay = getNextTradingDay(et);
      const nextTradingDate = formatDateForDisplay(nextTradingDay);
      return {
        openTime,
        closeTime,
        status: 'After-hours',
        nextStatus: `Opens ${nextTradingDate} ${openTime}`
      };
    }

    // Market is open
    return {
      openTime,
      closeTime,
      status: 'Regular Hours',
      nextStatus: `Closes today ${closeTime}`
    };
  } catch (error) {
    console.error('Error in getMarketStatus:', error);
    return {
      openTime: '9:30 AM ET',
      closeTime: '4:00 PM ET',
      status: 'Unknown',
      nextStatus: 'Status unavailable'
    };
  }
}
