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
   * Execute multiple functions in parallel with turbo rate limiting
   * Allows burst requests up to maxCalls, then applies rate limiting
   * @template T
   * @param {Array<() => Promise<T>>} fns - Array of functions to execute
   * @returns {Promise<Array<T>>}
   */
  async executeParallel(fns) {
    console.time(`[RateLimiter] executeParallel(${fns.length} functions)`);
    console.log(`[RateLimiter] 🚀 Turbo parallel execution: ${fns.length} requests`);

    const results = [];
    const errors = [];

    // Strategy: Execute in bursts to maximize API usage
    const burstSize = Math.min(fns.length, this.maxCalls);
    const batches = [];

    for (let i = 0; i < fns.length; i += burstSize) {
      batches.push(fns.slice(i, i + burstSize));
    }

    console.log(`[RateLimiter] Created ${batches.length} batches of max ${burstSize} requests`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Execute current batch in parallel
      const batchPromises = batch.map(async (fn, fnIndex) => {
        try {
          // Wait for slot if this isn't the first batch or if we've exceeded the rate limit
          if (batchIndex > 0 || !this.canMakeCall()) {
            await this.waitForSlot();
          }

          const result = await fn();
          return { success: true, data: result };
        } catch (error) {
          console.error(`[RateLimiter] ❌ Request failed:`, error.message);
          return { success: false, error };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Process batch results
      batchResults.forEach(result => {
        if (result.success) {
          results.push(result.data);
        } else {
          errors.push(result.error);
        }
      });

      console.log(`[RateLimiter] ✅ Batch ${batchIndex + 1}/${batches.length} completed`);

      // If this isn't the last batch, wait before processing next batch
      if (batchIndex < batches.length - 1) {
        // Optimized wait time - shorter for better responsiveness
        const waitTime = Math.max(200, Math.ceil(this.windowMs / this.maxCalls)); // Minimum 200ms
        console.log(`[RateLimiter] ⏳ Optimized wait: ${waitTime}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    console.timeEnd(`[RateLimiter] executeParallel(${fns.length} functions)`);
    console.log(`[RateLimiter] ✅ Turbo execution complete: ${results.length} success, ${errors.length} errors`);

    // Return results in order, throwing if any failed
    if (errors.length > 0) {
      console.warn(`[RateLimiter] ⚠️ ${errors.length} requests failed`);
    }

    return results;
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
