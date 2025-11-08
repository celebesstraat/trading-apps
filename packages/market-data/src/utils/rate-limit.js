/**
 * Rate limiting utility for API calls
 */

export class RateLimiter {
  /**
   * @param {number} maxCalls - Maximum calls per window
   * @param {number} windowMs - Time window in milliseconds
   */
  constructor(maxCalls, windowMs = 60000) {
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
    this.calls = [];
    this.queue = [];
    this.processing = false;
  }

  /**
   * Check if we can make a call now
   * @returns {boolean}
   */
  canMakeCall() {
    const now = Date.now();
    // Remove expired calls
    this.calls = this.calls.filter(time => now - time < this.windowMs);
    return this.calls.length < this.maxCalls;
  }

  /**
   * Get time until next available slot
   * @returns {number} Milliseconds until next slot available
   */
  getTimeUntilNextSlot() {
    if (this.canMakeCall()) {
      return 0;
    }

    const now = Date.now();
    const oldestCall = this.calls[0];
    return Math.max(0, this.windowMs - (now - oldestCall));
  }

  /**
   * Record a call
   */
  recordCall() {
    this.calls.push(Date.now());
  }

  /**
   * Wait until a call can be made
   * @returns {Promise<void>}
   */
  async waitForSlot() {
    const delay = this.getTimeUntilNextSlot();
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    this.recordCall();
  }

  /**
   * Execute a function with rate limiting
   * @template T
   * @param {() => Promise<T>} fn - Function to execute
   * @returns {Promise<T>}
   */
  async execute(fn) {
    await this.waitForSlot();
    return fn();
  }

  /**
   * Queue a function for execution with rate limiting
   * @template T
   * @param {() => Promise<T>} fn - Function to execute
   * @returns {Promise<T>}
   */
  async queue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process the queue
   * @private
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();

      try {
        await this.waitForSlot();
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Get current stats
   * @returns {Object}
   */
  getStats() {
    const now = Date.now();
    this.calls = this.calls.filter(time => now - time < this.windowMs);

    return {
      callsInWindow: this.calls.length,
      maxCalls: this.maxCalls,
      remaining: Math.max(0, this.maxCalls - this.calls.length),
      queueLength: this.queue.length,
      timeUntilNextSlot: this.getTimeUntilNextSlot()
    };
  }

  /**
   * Reset the rate limiter
   */
  reset() {
    this.calls = [];
    this.queue = [];
    this.processing = false;
  }
}

/**
 * Create a simple throttle function
 * @param {number} delayMs - Minimum delay between calls in milliseconds
 * @returns {(fn: Function) => Promise<any>}
 */
export function createThrottle(delayMs) {
  let lastCall = 0;

  return async (fn) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall < delayMs) {
      await new Promise(resolve => setTimeout(resolve, delayMs - timeSinceLastCall));
    }

    lastCall = Date.now();
    return fn();
  };
}
