
import { MARKET_DATA_CONFIG } from '../config/constants';

const CALENDAR_DB_NAME = 'strategywatch-calendar-db';
const CALENDAR_DB_VERSION = 1;
const CALENDAR_STORE_NAME = 'calendar';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CALENDAR_DAYS_TO_FETCH = 30;

interface CalendarData {
  date: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  sessionOpen: string;
  sessionClose: string;
  cachedAt: number;
}

async function initCalendarDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CALENDAR_DB_NAME, CALENDAR_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(CALENDAR_STORE_NAME)) {
        const objectStore = db.createObjectStore(CALENDAR_STORE_NAME, { keyPath: 'date' });
        objectStore.createIndex('date', 'date', { unique: true });
        objectStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });
}

async function fetchCalendarFromAPI(startDate: string, endDate: string): Promise<any[]> {
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
    throw error;
  }
}


async function cacheCalendarData(calendarData: any[]): Promise<void> {
  try {
    const db = await initCalendarDB();
    const cachedAt = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CALENDAR_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(CALENDAR_STORE_NAME);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        console.log(`Cached ${calendarData.length} calendar days`);
        resolve();
      };

      const clearRequest = objectStore.clear();
      clearRequest.onerror = () => reject(clearRequest.error);
      clearRequest.onsuccess = () => {

        for (const day of calendarData) {
          const record: CalendarData = {
            date: day.date,
            isOpen: true,
            openTime: day.open,
            closeTime: day.close,
            sessionOpen: day.session_open,
            sessionClose: day.session_close,
            cachedAt
          };

          const putRequest = objectStore.put(record);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => {};
        }
      };
    });
  } catch (error) {
    console.error('Error caching calendar data:', error);
    throw error;
  }
}

async function clearOldCache(): Promise<void> {
  console.log('[Calendar] Clear operation handled within cacheCalendarData');
  return Promise.resolve();
}

async function isCacheValid(): Promise<boolean> {
  try {
    const db = await initCalendarDB();
    const transaction = db.transaction([CALENDAR_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(CALENDAR_STORE_NAME);
    const index = objectStore.index('cachedAt');

    return new Promise((resolve) => {
      const request = index.openCursor(null, 'prev');
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
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

async function getCachedCalendarData(date: string): Promise<any | null> {
  try {
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

export async function refreshCalendar(): Promise<void> {
  try {
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + CALENDAR_DAYS_TO_FETCH);
    const endDateStr = endDate.toISOString().split('T')[0];

    const calendarData = await fetchCalendarFromAPI(startDate, endDateStr);

    await cacheCalendarData(calendarData);
  } catch (error) {
    console.error('[Calendar] Error refreshing calendar:', error);
  }
}

export async function getCalendarData(date: string): Promise<any | null> {
  try {
    const cacheValid = await isCacheValid();

    if (!cacheValid) {
      await refreshCalendar();
    }

    return await getCachedCalendarData(date);
  } catch (error) {
    console.error('[Calendar] Error getting calendar data:', error);
    return null;
  }
}

export async function isTradingDay(date: string): Promise<boolean> {
  try {
    const calendarData = await getCalendarData(date);
    return calendarData !== null;
  } catch (error) {
    console.error('[Calendar] Error checking trading day:', error);
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }
}

export async function getNextTradingDay(date: Date): Promise<Date> {
  try {
    const nextDay = new Date(date);

    for (let i = 1; i <= 7; i++) {
      nextDay.setDate(date.getDate() + i);
      const dateStr = nextDay.toISOString().split('T')[0];

      if (await isTradingDay(dateStr)) {
        return nextDay;
      }
    }

    while (true) {
      nextDay.setDate(nextDay.getDate() + 1);
      const dayOfWeek = nextDay.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        return nextDay;
      }
    }
  } catch (error) {
    console.error('[Calendar] Error getting next trading day:', error);
    const fallbackDay = new Date(date);
    do {
      fallbackDay.setDate(fallbackDay.getDate() + 1);
    } while (fallbackDay.getDay() === 0 || fallbackDay.getDay() === 6);
    return fallbackDay;
  }
}

interface TradingStatus {
  isTradingDay: boolean;
  openTime: string | null;
  closeTime: string | null;
  sessionOpen: string | null;
  sessionClose: string | null;
}

export async function getTodayTradingStatus(): Promise<TradingStatus> {
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
    return {
      isTradingDay: true,
      openTime: '09:30',
      closeTime: '16:00',
      sessionOpen: '09:30',
      sessionClose: '16:00'
    };
  }
}

export async function getUpcomingHolidays(): Promise<string[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const db = await initCalendarDB();
    const transaction = db.transaction([CALENDAR_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(CALENDAR_STORE_NAME);

    return new Promise((resolve) => {
      const holidays: string[] = [];
      const request = objectStore.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) {
          resolve(holidays);
          return;
        }

        const record = cursor.value;

        if (record.date >= today) {
          const dateObj = new Date(record.date);
          const dayOfWeek = dateObj.getDay();

          if (dayOfWeek === 0 || dayOfWeek === 6) {
            const checkDate = new Date(dateObj);
            if (dayOfWeek === 0) {
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              checkDate.setDate(checkDate.getDate() + 1);
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

export async function clearCalendarCache(): Promise<void> {
  try {
    await clearOldCache();
    console.log('[Calendar] Cache cleared');
  } catch (error) {
    console.error('[Calendar] Error clearing cache:', error);
    throw error;
  }
}

interface CalendarStats {
    cachedDays: number;
    cacheTTL: number;
    dbName: string;
    version: number;
}

export async function getCalendarStats(): Promise<CalendarStats> {
  try {
    const db = await initCalendarDB();
    const transaction = db.transaction([CALENDAR_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(CALENDAR_STORE_NAME);

    return new Promise((resolve) => {
      const request = objectStore.count();
      request.onsuccess = () => {
        resolve({
          cachedDays: request.result,
          cacheTTL: CACHE_TTL_MS / (1000 * 60 * 60),
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
