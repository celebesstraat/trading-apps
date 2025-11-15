/**
 * Formats a price value with appropriate decimal places
 * @param price Price value
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted price string
 */
export function formatPrice(price: number | null | undefined, decimals: number = 2): string {
  if (price === null || price === undefined || isNaN(price)) {
    return 'N/A';
  }
  return price.toFixed(decimals);
}

/**
 * Formats a percentage value
 * @param value Percentage value (e.g., 0.5 for 0.5%)
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export function formatPercent(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Formats a large number with appropriate suffix (K, M, B)
 * @param num Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) {
    return 'N/A';
  }

  if (num >= 1e9) {
    return (num / 1e9).toFixed(2) + 'B';
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(2) + 'M';
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(2) + 'K';
  }
  return num.toFixed(0);
}

/**
 * Formats volume for display
 * @param volume Volume value
 * @returns Formatted volume string
 */
export function formatVolume(volume: number | null | undefined): string {
  return formatNumber(volume);
}

/**
 * Formats a timestamp to time only (HH:MM:SS) in US Eastern time
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted time string
 */
export function formatTime(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return 'N/A';
  }

  const date = new Date(timestamp);
  // Convert to US Eastern time
  const etString = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return etString;
}

/**
 * Formats a full date and time
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted date/time string
 */
export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return 'N/A';
  }

  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
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
 * Formats a ticker symbol (ensures uppercase)
 * @param ticker Ticker symbol
 * @returns Formatted ticker
 */
export function formatTicker(ticker: string | null | undefined): string {
  return ticker?.toUpperCase() || 'N/A';
}

/**
 * Truncates a string to a maximum length
 * @param str String to truncate
 * @param maxLength Maximum length
 * @returns Truncated string
 */
export function truncate(str: string | null | undefined, maxLength: number = 50): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}