/**
 * Relative Strength Engine v2.0 - Cache Manager
 *
 * Smart caching with TTL, LRU eviction, and size limits.
 * Prevents memory leaks and ensures data freshness.
 */

export class RSCacheManager {
  constructor(config = {}) {
    this.maxSize = config.maxSize || 1000;
    this.defaultTTL = config.defaultTTL || 60000; // 1 minute default
    this.ttlConfig = config.TTL || {};

    // Cache storage: Map<timeframe, CacheEntry>
    this.cache = new Map();

    // LRU tracking: Array of timeframes in order of access
    this.accessOrder = [];

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0
    };
  }

  /**
   * Cache entry structure
   * @typedef {Object} CacheEntry
   * @property {*} data - The cached data
   * @property {number} timestamp - When the entry was created
   * @property {number} ttl - Time to live in milliseconds
   * @property {number} accessCount - How many times this entry was accessed
   */

  /**
   * Set data in cache for a specific timeframe
   */
  set(timeframe, data, customTTL = null) {
    const ttl = customTTL || this.ttlConfig[timeframe] || this.defaultTTL;
    const timestamp = Date.now();

    // Create cache entry
    const entry = {
      data,
      timestamp,
      ttl,
      accessCount: 0
    };

    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize && !this.cache.has(timeframe)) {
      this._evictLRU();
    }

    // Update cache
    this.cache.set(timeframe, entry);
    this._updateAccessOrder(timeframe);

    this.stats.sets++;

    console.log(`[CacheManager] Cached data for ${timeframe}, TTL: ${ttl}ms`);
  }

  /**
   * Get data from cache for a specific timeframe
   */
  get(timeframe) {
    const entry = this.cache.get(timeframe);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry is expired
    if (this._isExpired(entry)) {
      this.cache.delete(timeframe);
      this._removeFromAccessOrder(timeframe);
      this.stats.misses++;
      console.log(`[CacheManager] Cache expired for ${timeframe}`);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    this._updateAccessOrder(timeframe);
    this.stats.hits++;

    console.log(`[CacheManager] Cache hit for ${timeframe}, accessed ${entry.accessCount} times`);
    return entry.data;
  }

  /**
   * Check if cached data exists and is not expired
   */
  has(timeframe) {
    const entry = this.cache.get(timeframe);
    return entry && !this._isExpired(entry);
  }

  /**
   * Check if cached data is expired for a timeframe
   */
  isExpired(timeframe) {
    const entry = this.cache.get(timeframe);
    return !entry || this._isExpired(entry);
  }

  /**
   * Remove data from cache for a specific timeframe
   */
  delete(timeframe) {
    const existed = this.cache.delete(timeframe);
    if (existed) {
      this._removeFromAccessOrder(timeframe);
      console.log(`[CacheManager] Removed cache entry for ${timeframe}`);
    }
    return existed;
  }

  /**
   * Clear all cached data
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    console.log(`[CacheManager] Cleared ${size} cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
      : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: this._estimateMemoryUsage()
    };
  }

  /**
   * Get all non-expired cached data
   */
  getAllValid() {
    const result = {};

    for (const [timeframe, entry] of this.cache.entries()) {
      if (!this._isExpired(entry)) {
        result[timeframe] = entry.data;
      }
    }

    return result;
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired() {
    const currentTime = Date.now();
    const expiredTimeframes = [];

    for (const [timeframe, entry] of this.cache.entries()) {
      if (currentTime - entry.timestamp > entry.ttl) {
        expiredTimeframes.push(timeframe);
      }
    }

    expiredTimeframes.forEach(timeframe => {
      this.cache.delete(timeframe);
      this._removeFromAccessOrder(timeframe);
    });

    if (expiredTimeframes.length > 0) {
      console.log(`[CacheManager] Cleaned up ${expiredTimeframes.length} expired entries`);
    }

    return expiredTimeframes.length;
  }

  /**
   * Preload cache with data to warm it up
   */
  async preload(dataMap) {
    console.log('[CacheManager] Preloading cache...');

    for (const [timeframe, data] of Object.entries(dataMap)) {
      this.set(timeframe, data);
    }

    console.log(`[CacheManager] Preloaded ${Object.keys(dataMap).length} entries`);
  }

  /**
   * Check if a cache entry is expired
   */
  _isExpired(entry) {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict least recently used entry
   */
  _evictLRU() {
    if (this.accessOrder.length === 0) return;

    const lruTimeframe = this.accessOrder.shift();
    this.cache.delete(lruTimeframe);
    this.stats.evictions++;

    console.log(`[CacheManager] Evicted LRU entry for ${lruTimeframe}`);
  }

  /**
   * Update access order (LRU tracking)
   */
  _updateAccessOrder(timeframe) {
    this._removeFromAccessOrder(timeframe);
    this.accessOrder.push(timeframe);
  }

  /**
   * Remove timeframe from access order array
   */
  _removeFromAccessOrder(timeframe) {
    const index = this.accessOrder.indexOf(timeframe);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Estimate memory usage of cache (rough approximation)
   */
  _estimateMemoryUsage() {
    let totalSize = 0;

    for (const [timeframe, entry] of this.cache.entries()) {
      // Rough estimation: JSON string size + metadata
      try {
        const dataSize = JSON.stringify(entry.data).length;
        totalSize += dataSize + 200; // Add metadata overhead
      } catch (error) {
        // Fallback if data can't be serialized
        totalSize += 1000; // Rough estimate
      }
    }

    return Math.round(totalSize / 1024) + ' KB'; // Return in KB
  }

  /**
   * Get detailed cache information for debugging
   */
  getDebugInfo() {
    const entries = [];

    for (const [timeframe, entry] of this.cache.entries()) {
      entries.push({
        timeframe,
        age: Date.now() - entry.timestamp,
        ttl: entry.ttl,
        accessCount: entry.accessCount,
        isExpired: this._isExpired(entry)
      });
    }

    return {
      entries,
      stats: this.getStats(),
      accessOrder: [...this.accessOrder]
    };
  }
}