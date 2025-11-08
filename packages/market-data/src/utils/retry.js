/**
 * Exponential backoff retry utility
 */

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Retry attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} maxDelay - Maximum delay in milliseconds (default: 30000)
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoff(attempt, baseDelay = 1000, maxDelay = 30000) {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

/**
 * Retry a function with exponential backoff
 * @template T
 * @param {() => Promise<T>} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} [options.maxAttempts=3] - Maximum retry attempts
 * @param {number} [options.baseDelay=1000] - Base delay in milliseconds
 * @param {number} [options.maxDelay=30000] - Maximum delay in milliseconds
 * @param {(error: Error, attempt: number) => boolean} [options.shouldRetry] - Function to determine if should retry
 * @param {(error: Error, attempt: number, delay: number) => void} [options.onRetry] - Callback before retry
 * @returns {Promise<T>}
 */
export async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === maxAttempts - 1 || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate backoff delay
      const delay = calculateBackoff(attempt, baseDelay, maxDelay);

      // Call onRetry callback
      if (onRetry) {
        onRetry(error, attempt, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Create a retry function with default options
 * @param {Object} defaultOptions - Default retry options
 * @returns {(fn: Function, options?: Object) => Promise<any>}
 */
export function createRetry(defaultOptions) {
  return (fn, options = {}) => retry(fn, { ...defaultOptions, ...options });
}
