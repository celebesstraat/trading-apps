/**
 * Formats a price value with appropriate decimal places
 * @param {number} price Price value
 * @param {number} decimals Number of decimal places (default: 2)
 * @returns {string} Formatted price string
 */
export function formatPrice(price, decimals = 2) {
  if (price === null || price === undefined || isNaN(price)) {
    return 'N/A';
  }
  return price.toFixed(decimals);
}

/**
 * Formats a percentage value
 * @param {number} value Percentage value (e.g., 0.5 for 0.5%)
 * @param {number} decimals Number of decimal places (default: 2)
 * @returns {string} Formatted percentage string
 */
export function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Formats a large number with appropriate suffix (K, M, B)
 * @param {number} num Number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
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
 * @param {number} volume Volume value
 * @returns {string} Formatted volume string
 */
export function formatVolume(volume) {
  return formatNumber(volume);
}

/**
 * Formats a timestamp to time only (HH:MM:SS) in US Eastern time
 * @param {number} timestamp Unix timestamp in milliseconds
 * @returns {string} Formatted time string
 */
export function formatTime(timestamp) {
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
 * @param {number} timestamp Unix timestamp in milliseconds
 * @returns {string} Formatted date/time string
 */
export function formatDateTime(timestamp) {
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
 * @param {string} ticker Ticker symbol
 * @returns {string} Formatted ticker
 */
export function formatTicker(ticker) {
  return ticker?.toUpperCase() || 'N/A';
}

/**
 * Truncates a string to a maximum length
 * @param {string} str String to truncate
 * @param {number} maxLength Maximum length
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength = 50) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
