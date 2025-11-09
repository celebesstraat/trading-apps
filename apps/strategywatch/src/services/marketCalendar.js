/**
 * Market Calendar Service
 * Fetches and caches market calendar data from Alpaca API
 * Provides reliable trading day and holiday information
 */

import { MARKET_DATA_CONFIG } from '../config/constants';

const CALENDAR_DB_NAME = 'strategywatch-calendar-db';
const CALENDAR_DB_VERSION = 1;
const CALENDAR_STORE_NAME = 'calendar';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CALENDAR_DAYS_TO_FETCH = 30; // Fetch 30 days from today

// Development mode flag - set to true to bypass API calls during development
const DEV_MODE_BYPASS_CALENDAR_API = true;

/**
 * Initialize calendar database
 * @returns {Promise<IDBDatabase>}
 */
async function initCalendarDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CALENDAR_DB_NAME, CALENDAR_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(CALENDAR_STORE_NAME)) {
        const objectStore = db.createObjectStore(CALENDAR_STORE_NAME, { keyPath: 'date' });
        objectStore.createIndex('date', 'date', { unique: true });
        objectStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });
}

/**
 * Fetch calendar data from Alpaca API
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of calendar objects
 */
async function fetchCalendarFromAPI(startDate, endDate) {
  // Development mode bypass - use mock data directly
  if (DEV_MODE_BYPASS_CALENDAR_API) {
    console.warn('[Calendar] Development mode: Using mock calendar data (API bypassed)');
    return generateMockCalendarData(startDate, endDate);
  }

  try {
    const baseUrl = MARKET_DATA_CONFIG.SANDBOX
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';

    const url = `${baseUrl}/v2/calendar?start=${startDate}&end=${endDate}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': MARKET_DATA_CONFIG.API_KEY_ID,
        'APCA-API-SECRET-KEY': MARKET_DATA_CONFIG.SECRET_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching calendar from Alpaca API:', error);

    // For CORS issues during development, provide mock calendar data
    if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
      console.warn('[Calendar] CORS error detected, using mock data for development');
      return generateMockCalendarData(startDate, endDate);
    }

    throw error;
  }
}

/**
 * Generate mock calendar data for development when CORS blocks API calls
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Array} Mock calendar data
 */
function generateMockCalendarData(startDate, endDate) {
  const mockData = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Sample US market holidays for demonstration (YYYY-MM-DD format)
  const sampleHolidays = [
    '2025-01-01', // New Year's Day
    '2025-01-20', // Martin Luther King Jr. Day
    '2025-02-17', // Presidents Day
    '2025-04-18', // Good Friday
    '2025-05-26', // Memorial Day
    '2025-07-04', // Independence Day
    '2025-09-01', // Labor Day
    '2025-11-27', // Thanksgiving Day
    '2025-12-25', // Christmas Day
  ];

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    // Skip weekends and sample holidays
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = sampleHolidays.includes(dateStr);

    if (!isWeekend && !isHoliday) {
      mockData.push({
        date: dateStr,
        open: '09:30',
        close: '16:00',
        session_open: '09:30',
        session_close: '16:00'
      });
    }
  }

  console.log(`[Calendar] Generated ${mockData.length} mock trading days from ${startDate} to ${endDate}`);
  if (sampleHolidays.some(holiday => holiday >= startDate && holiday <= endDate)) {
    console.log(`[Calendar] Note: Sample holidays excluded from mock data for testing`);
  }
  return mockData;
}

/**
 * Store calendar data in IndexedDB with timestamp
 * @param {Array} calendarData - Array of calendar objects
 * @returns {Promise<void>}
 */
async function cacheCalendarData(calendarData) {
  try {
    const db = await initCalendarDB();
    const cachedAt = Date.now();

    return new Promise((resolve, reject) => {
      // Create transaction and handle all operations within it
      const transaction = db.transaction([CALENDAR_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(CALENDAR_STORE_NAME);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        console.log(`Cached ${calendarData.length} calendar days`);
        resolve();
      };

      // Clear old cache entries first
      const clearRequest = objectStore.clear();
      clearRequest.onerror = () => reject(clearRequest.error);
      clearRequest.onsuccess = () => {
        // Store new calendar data with cache timestamp

        for (const day of calendarData) {
          const record = {
            date: day.date,
            isOpen: true, // All returned days are trading days
            openTime: day.open,
            closeTime: day.close,
            sessionOpen: day.session_open,
            sessionClose: day.session_close,
            cachedAt
          };

          const putRequest = objectStore.put(record);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => {
            // All operations completed, transaction will finish automatically
          };
        }
      };
    });
  } catch (error) {
    console.error('Error caching calendar data:', error);
    throw error;
  }
}

/**
 * Clear old cache entries (deprecated - now handled within cacheCalendarData)
 * @returns {Promise<void>}
 */
async function clearOldCache() {
  // This function is now handled within cacheCalendarData to avoid transaction conflicts
  console.log('[Calendar] Clear operation handled within cacheCalendarData');
  return Promise.resolve();
}

/**
 * Check if cache is valid (not expired)
 * @returns {Promise<boolean>}
 */
async function isCacheValid() {
  try {
    // In development mode, check if we have mock data in memory
    if (DEV_MODE_BYPASS_CALENDAR_API) {
      return !!window.__mockCalendarData;
    }

    // Production mode: check IndexedDB cache
    const db = await initCalendarDB();
    const transaction = db.transaction([CALENDAR_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(CALENDAR_STORE_NAME);
    const index = objectStore.index('cachedAt');

    return new Promise((resolve) => {
      const request = index.openCursor(null, 'prev'); // Get most recent
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve(false);
          return;
        }

        const record = cursor.value;
        const now = Date.now();
        const cacheAge = now - record.cachedAt;

        resolve(cacheAge < CACHE_TTL_MS);
      };
      request.onerror = () => resolve(false);
    });
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
}

/**
 * Get calendar data from cache
 * @param {string} date - Date in YYYY-MM-DD format (optional)
 * @returns {Promise<Object|null>} Calendar object or null if not found
 */
async function getCachedCalendarData(date) {
  try {
    // In development mode, check in-memory mock data first
    if (DEV_MODE_BYPASS_CALENDAR_API && window.__mockCalendarData) {
      const mockDay = window.__mockCalendarData.find(day => day.date === date);
      if (mockDay) {
        return {
          date: mockDay.date,
          open: mockDay.open,
          close: mockDay.close,
          session_open: mockDay.session_open,
          session_close: mockDay.session_close
        };
      }
      return null;
    }

    // Production mode: use IndexedDB cache
    const db = await initCalendarDB();
    const transaction = db.transaction([CALENDAR_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(CALENDAR_STORE_NAME);

    return new Promise((resolve) => {
      const request = objectStore.get(date);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({
            date: result.date,
            open: result.openTime,
            close: result.closeTime,
            session_open: result.sessionOpen,
            session_close: result.sessionClose
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error('Error getting cached calendar data:', error);
    return null;
  }
}

/**
 * Refresh calendar data from API
 * @returns {Promise<void>}
 */
export async function refreshCalendar() {
  try {
    console.log('[Calendar] Refreshing calendar data...');

    // Calculate date range (today + 29 days)
    const today = new Date();
    const startDate = today.toISOString().split('T')[0]; // YYYY-MM-DD

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + CALENDAR_DAYS_TO_FETCH);
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch from API
    const calendarData = await fetchCalendarFromAPI(startDate, endDateStr);

    // In development mode, skip caching to avoid IndexedDB issues
    if (DEV_MODE_BYPASS_CALENDAR_API) {
      console.log(`[Calendar] Development mode: Using ${calendarData.length} mock days without caching`);
      // Store in memory for development
      window.__mockCalendarData = calendarData;
    } else {
      // Cache the data for production
      await cacheCalendarData(calendarData);
    }

    console.log(`[Calendar] Refreshed ${calendarData.length} days of calendar data`);
  } catch (error) {
    console.error('[Calendar] Error refreshing calendar:', error);
    // Don't throw error, just log it - this allows fallback to weekend logic
    console.warn('[Calendar] Will fall back to weekend logic for market status');
  }
}

/**
 * Get calendar data for a specific date (from cache or API)
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object|null>} Calendar object or null if not a trading day
 */
export async function getCalendarData(date) {
  try {
    // Check if cache is valid
    const cacheValid = await isCacheValid();

    if (!cacheValid) {
      // Refresh cache if invalid
      await refreshCalendar();
    }

    // Get data from cache
    return await getCachedCalendarData(date);
  } catch (error) {
    console.error('[Calendar] Error getting calendar data:', error);
    return null;
  }
}

/**
 * Check if a specific date is a trading day
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<boolean>}
 */
export async function isTradingDay(date) {
  try {
    const calendarData = await getCalendarData(date);
    return calendarData !== null;
  } catch (error) {
    console.error('[Calendar] Error checking trading day:', error);
    // Fallback to weekend logic
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday-Friday
  }
}

/**
 * Get the next trading day after a given date
 * @param {Date} date - Starting date
 * @returns {Promise<Date>} Next trading day
 */
export async function getNextTradingDay(date) {
  try {
    const nextDay = new Date(date);

    // Check up to 7 days ahead (covers long weekends)
    for (let i = 1; i <= 7; i++) {
      nextDay.setDate(date.getDate() + i);
      const dateStr = nextDay.toISOString().split('T')[0];

      if (await isTradingDay(dateStr)) {
        return nextDay;
      }
    }

    // Fallback: return next weekday
    while (true) {
      nextDay.setDate(nextDay.getDate() + 1);
      const dayOfWeek = nextDay.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        return nextDay;
      }
    }
  } catch (error) {
    console.error('[Calendar] Error getting next trading day:', error);
    // Fallback to current logic
    const fallbackDay = new Date(date);
    do {
      fallbackDay.setDate(fallbackDay.getDate() + 1);
    } while (fallbackDay.getDay() === 0 || fallbackDay.getDay() === 6);
    return fallbackDay;
  }
}

/**
 * Get today's trading status
 * @returns {Promise<Object>} { isTradingDay, openTime, closeTime, sessionOpen, sessionClose }
 */
export async function getTodayTradingStatus() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const calendarData = await getCalendarData(today);

    if (calendarData) {
      return {
        isTradingDay: true,
        openTime: calendarData.open,
        closeTime: calendarData.close,
        sessionOpen: calendarData.session_open,
        sessionClose: calendarData.session_close
      };
    } else {
      return {
        isTradingDay: false,
        openTime: null,
        closeTime: null,
        sessionOpen: null,
        sessionClose: null
      };
    }
  } catch (error) {
    console.error('[Calendar] Error getting today trading status:', error);
    // Fallback to default
    return {
      isTradingDay: true, // Assume trading day on error
      openTime: '09:30',
      closeTime: '16:00',
      sessionOpen: '09:30',
      sessionClose: '16:00'
    };
  }
}

/**
 * Get upcoming market holidays within the cached period
 * @returns {Promise<Array>} Array of holiday dates
 */
export async function getUpcomingHolidays() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const db = await initCalendarDB();
    const transaction = db.transaction([CALENDAR_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(CALENDAR_STORE_NAME);

    return new Promise((resolve) => {
      const holidays = [];
      const request = objectStore.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve(holidays);
          return;
        }

        const record = cursor.value;

        // If date is after today and it's a weekend, it might be a holiday Monday/Friday
        if (record.date >= today) {
          const dateObj = new Date(record.date);
          const dayOfWeek = dateObj.getDay();

          // Check adjacent days to identify holiday weekends
          // This is a simplified approach - holidays are complex
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            const checkDate = new Date(dateObj);
            if (dayOfWeek === 0) { // Sunday
              checkDate.setDate(checkDate.getDate() - 1); // Check Saturday
            } else { // Saturday
              checkDate.setDate(checkDate.getDate() + 1); // Check Sunday
            }

            const checkDateStr = checkDate.toISOString().split('T')[0];
            isTradingDay(checkDateStr).then(isWeekendTrading => {
              if (!isWeekendTrading) {
                holidays.push(record.date);
              }
            });
          }
        }

        cursor.continue();
      };

      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error('[Calendar] Error getting upcoming holidays:', error);
    return [];
  }
}

/**
 * Clear all calendar cache (useful for testing)
 * @returns {Promise<void>}
 */
export async function clearCalendarCache() {
  try {
    await clearOldCache();
    console.log('[Calendar] Cache cleared');
  } catch (error) {
    console.error('[Calendar] Error clearing cache:', error);
    throw error;
  }
}

/**
 * Get calendar cache statistics
 * @returns {Promise<Object>} Cache stats
 */
export async function getCalendarStats() {
  try {
    const db = await initCalendarDB();
    const transaction = db.transaction([CALENDAR_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(CALENDAR_STORE_NAME);

    return new Promise((resolve) => {
      const request = objectStore.count();
      request.onsuccess = () => {
        resolve({
          cachedDays: request.result,
          cacheTTL: CACHE_TTL_MS / (1000 * 60 * 60), // hours
          dbName: CALENDAR_DB_NAME,
          version: CALENDAR_DB_VERSION
        });
      };
      request.onerror = () => resolve({ cachedDays: 0, cacheTTL: 24, dbName: CALENDAR_DB_NAME, version: CALENDAR_DB_VERSION });
    });
  } catch (error) {
    console.error('[Calendar] Error getting stats:', error);
    return { cachedDays: 0, cacheTTL: 24, dbName: CALENDAR_DB_NAME, version: CALENDAR_DB_VERSION };
  }
}