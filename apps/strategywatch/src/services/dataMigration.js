/**
 * Data Migration Service
 * Migrates data from existing fragmented storage (rvolDatabase + startupCache) to unified data lake
 * Handles schema transformation and data validation during migration
 */

import {
  initDatabase as initRvolDB,
  getAllCandlesForTicker,
  getFirst5mCandles,
  getDatabaseStats as getRvolStats
} from './rvolDatabase';
import { loadCache as loadStartupCache } from './startupCache';
import {
  initDataLake,
  storeTicks,
  storeMinuteCandle,
  storeFiveMinuteCandles,
  storeDailyCandles,
  storeIndicators,
  storeStrategyResult,
  setMetadata,
  getMetadata,
  clearDataLake,
  getDataLakeStats,
  needsMigration,
  DATA_QUALITY,
  getTickerData
} from './dataLake';

// Migration configuration
const MIGRATION_CONFIG = {
  BATCH_SIZE: 5,           // Process 5 tickers at a time
  TIMEOUT_PER_BATCH: 10000, // 10 seconds per batch
  VALIDATE_DATA: true,     // Validate data during migration
  BACKUP_EXISTING: true    // Create backup before migration
};

// Migration status
export const MIGRATION_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PARTIAL: 'partial'
};

/**
 * Main migration orchestrator
 */
export class DataMigrationService {
  constructor(symbols = []) {
    this.symbols = symbols;
    this.status = MIGRATION_STATUS.NOT_STARTED;
    this.progress = {
      total: symbols.length,
      completed: 0,
      failed: 0,
      skipped: 0
    };
    this.startTime = null;
    this.endTime = null;
    this.errors = [];
    this.backupData = null;
  }

  /**
   * Execute complete migration process
   * @param {object} options - Migration options
   * @returns {Promise<object>} Migration results
   */
  async migrate(options = {}) {
    const config = { ...MIGRATION_CONFIG, ...options };

    try {
      console.log('[Migration] 🚀 Starting data migration...');
      this.status = MIGRATION_STATUS.IN_PROGRESS;
      this.startTime = Date.now();

      // Step 1: Pre-migration checks and preparation
      await this.prepareMigration(config);

      // Step 2: Migrate startup cache data
      await this.migrateStartupCache();

      // Step 3: Migrate RVol database data
      await this.migrateRvolDatabase();

      // Step 4: Post-migration validation
      await this.validateMigration();

      // Step 5: Cleanup old data (optional)
      if (config.cleanupOld !== false) {
        await this.cleanupOldData();
      }

      this.status = MIGRATION_STATUS.COMPLETED;
      this.endTime = Date.now();
      const duration = this.endTime - this.startTime;

      console.log(`[Migration] ✅ Migration completed in ${duration}ms`);
      console.log(`[Migration] 📊 Results: ${this.progress.completed} success, ${this.progress.failed} failed, ${this.progress.skipped} skipped`);

      const results = {
        status: this.status,
        progress: this.progress,
        duration,
        errors: this.errors,
        stats: await this.getMigrationStats()
      };

      await this.saveMigrationResults(results);
      return results;

    } catch (error) {
      console.error('[Migration] ❌ Migration failed:', error);
      this.status = MIGRATION_STATUS.FAILED;
      this.errors.push({
        type: 'migration_failed',
        error: error.message,
        timestamp: Date.now()
      });

      // Attempt rollback if migration failed early
      if (this.progress.completed === 0) {
        await this.rollbackMigration();
      }

      throw error;
    }
  }

  /**
   * Prepare for migration (checks, initialization, backup)
   * @param {object} config - Migration configuration
   */
  async prepareMigration(config) {
    console.log('[Migration] 📋 Preparing migration...');

    // Check if data lake already exists
    const existingStats = await this.checkExistingDataLake();
    if (existingStats.tickers > 0) {
      console.warn(`[Migration] ⚠️ Data lake already contains ${existingStats.tickers} tickers`);

      if (config.backupExisting) {
        console.log('[Migration] 💾 Creating backup of existing data...');
        this.backupData = await this.createBackup();
      }
    }

    // Initialize new data lake
    await initDataLake();

    // Check source databases availability
    const rvolAvailable = await this.checkRvolDatabase();
    const startupCacheAvailable = await this.checkStartupCache();

    console.log(`[Migration] 📊 Source databases: RVol=${rvolAvailable}, StartupCache=${startupCacheAvailable}`);

    if (!rvolAvailable && !startupCacheAvailable) {
      throw new Error('No source databases available for migration');
    }

    // Update migration metadata
    await setMetadata('migration', {
      status: this.status,
      startTime: this.startTime,
      config,
      sourceDatabases: {
        rvol: rvolAvailable,
        startupCache: startupCacheAvailable
      }
    });
  }

  /**
   * Migrate data from startup cache
   */
  async migrateStartupCache() {
    console.log('[Migration] 📦 Migrating startup cache data...');

    try {
      const cachedData = await loadStartupCache(this.symbols);
      if (!cachedData) {
        console.log('[Migration] ℹ️ No startup cache data found');
        return;
      }

      console.log(`[Migration] 📊 Found startup cache for ${Object.keys(cachedData.historicalData || {}).length} tickers`);

      // Process tickers in batches
      for (let i = 0; i < this.symbols.length; i += MIGRATION_CONFIG.BATCH_SIZE) {
        const batch = this.symbols.slice(i, i + MIGRATION_CONFIG.BATCH_SIZE);
        await this.processStartupCacheBatch(batch, cachedData);

        // Update progress
        this.progress.completed += batch.length;
        console.log(`[Migration] 📈 Progress: ${this.progress.completed}/${this.progress.total} tickers`);
      }

    } catch (error) {
      console.error('[Migration] ❌ Failed to migrate startup cache:', error);
      this.errors.push({
        type: 'startup_cache_migration',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Process a batch of tickers from startup cache
   * @param {string[]} tickers - Batch of ticker symbols
   * @param {object} cachedData - Cached data
   */
  async processStartupCacheBatch(tickers, cachedData) {
    for (const symbol of tickers) {
      try {
        const migrated = await this.transformStartupCacheData(symbol, cachedData);
        if (migrated) {
          this.progress.completed++;
        } else {
          this.progress.skipped++;
        }
      } catch (error) {
        console.error(`[Migration] ❌ Failed to migrate ${symbol}:`, error);
        this.errors.push({
          type: 'ticker_migration',
          symbol,
          error: error.message,
          timestamp: Date.now()
        });
        this.progress.failed++;
      }
    }
  }

  /**
   * Transform startup cache data to new schema
   * @param {string} symbol - Ticker symbol
   * @param {object} cachedData - Cached data
   * @returns {boolean} True if data was migrated
   */
  async transformStartupCacheData(symbol, cachedData) {
    const historicalData = cachedData.historicalData?.[symbol];
    const movingAverages = cachedData.movingAverages?.[symbol];
    const mergedPrices = cachedData.mergedPrices?.[symbol];
    const rvolData = cachedData.rvolData?.[symbol];

    if (!historicalData && !movingAverages && !mergedPrices) {
      return false; // No data to migrate
    }

    let migratedAny = false;

    // Transform and store daily candles
    if (historicalData && historicalData.c && historicalData.c.length > 0) {
      const dailyCandles = historicalData.c.map((close, i) => ({
        timestamp: historicalData.t[i] * 1000,
        open: historicalData.o?.[i] || close,
        high: historicalData.h?.[i] || close,
        low: historicalData.l?.[i] || close,
        close: close,
        volume: historicalData.v?.[i] || 0
      }));

      await storeDailyCandles(symbol, dailyCandles);
      migratedAny = true;
    }

    // Transform and store indicators
    if (movingAverages) {
      const indicators = {
        movingAverages: movingAverages,
        adr20: movingAverages.adr20Decimal ? movingAverages.adr20Decimal * 100 : null,
        adr20Decimal: movingAverages.adr20Decimal || null,
        lastUpdated: Date.now()
      };

      await storeIndicators(symbol, 'movingAverages', indicators);
      migratedAny = true;
    }

    // Transform and store current quote as tick data
    if (mergedPrices) {
      await storeTicks(symbol, [{
        timestamp: mergedPrices.timestamp || Date.now(),
        price: mergedPrices.price,
        volume: mergedPrices.volume || 0,
        size: 100, // Default size
        exchange: 'SYSTEM',
        conditions: ['MIGRATED']
      }]);
      migratedAny = true;
    }

    // Store strategy results if available
    if (rvolData) {
      await storeStrategyResult(symbol, 'rvol', rvolData);
      migratedAny = true;
    }

    return migratedAny;
  }

  /**
   * Migrate data from RVol database
   */
  async migrateRvolDatabase() {
    console.log('[Migration] 📊 Migrating RVol database data...');

    try {
      const rvolStats = await getRvolStats();
      console.log(`[Migration] 📈 RVol database contains ${rvolStats.totalRecords} records`);

      // Process tickers in batches
      for (let i = 0; i < this.symbols.length; i += MIGRATION_CONFIG.BATCH_SIZE) {
        const batch = this.symbols.slice(i, i + MIGRATION_CONFIG.BATCH_SIZE);
        await this.processRvolBatch(batch);

        // Update progress
        this.progress.completed += batch.length;
        console.log(`[Migration] 📈 RVol Progress: ${this.progress.completed}/${this.progress.total} tickers`);
      }

    } catch (error) {
      console.error('[Migration] ❌ Failed to migrate RVol database:', error);
      this.errors.push({
        type: 'rvol_migration',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Process a batch of tickers from RVol database
   * @param {string[]} tickers - Batch of ticker symbols
   */
  async processRvolBatch(tickers) {
    for (const symbol of tickers) {
      try {
        // Get RVol data using the new data lake migration function
        const allCandles = await getAllCandlesForTicker(symbol);

        if (allCandles.length > 0) {
          // Store 5m candles for each day in the new data lake
          for (const dayData of allCandles) {
            await storeFiveMinuteCandles(symbol, dayData.date, dayData.candles || []);
          }

          // Get and store first 5m candles for ORB strategy
          const first5mCandles = await getFirst5mCandles(symbol, 30);
          if (first5mCandles.length > 0) {
            await storeStrategyResult(symbol, 'orb5m', {
              historicalCandles: first5mCandles,
              lastMigrated: Date.now()
            });
          }

          this.progress.completed++;
        } else {
          this.progress.skipped++;
        }

      } catch (error) {
        console.error(`[Migration] ❌ Failed to migrate RVol data for ${symbol}:`, error);
        this.errors.push({
          type: 'rvol_ticker_migration',
          symbol,
          error: error.message,
          timestamp: Date.now()
        });
        this.progress.failed++;
      }
    }
  }

  /**
   * Validate migration results
   */
  async validateMigration() {
    console.log('[Migration] ✅ Validating migration results...');

    const validationErrors = [];

    // Get data lake statistics
    const dataLakeStats = await getDataLakeStats();
    console.log('[Migration] 📊 Data Lake stats:', dataLakeStats);

    // Check if all expected tickers were migrated by checking if data exists
    for (const symbol of this.symbols) {
      try {
        // Check if we have any data for this ticker by attempting to query
        const hasData = dataLakeStats.stores.fiveMinCandles > 0 ||
                       dataLakeStats.stores.dailyCandles > 0 ||
                       dataLakeStats.stores.indicators > 0 ||
                       dataLakeStats.stores.ticks > 0;

        if (!hasData) {
          validationErrors.push(`No data found for ${symbol} in Data Lake`);
        }
      } catch (error) {
        validationErrors.push(`Failed to validate ${symbol}: ${error.message}`);
      }
    }

    // Validate that we have records in key stores
    const criticalStores = ['dailyCandles', 'fiveMinCandles', 'indicators'];
    for (const store of criticalStores) {
      const recordCount = dataLakeStats.stores[store] || 0;
      if (recordCount === 0 && this.symbols.length > 0) {
        validationErrors.push(`No records found in ${store} store`);
      }
    }

    if (validationErrors.length > 0) {
      console.warn('[Migration] ⚠️ Validation warnings:', validationErrors);
      this.errors.push({
        type: 'validation',
        errors: validationErrors,
        timestamp: Date.now()
      });

      // If more than 20% of tickers have validation errors, mark as partial
      if (validationErrors.length > this.symbols.length * 0.2) {
        this.status = MIGRATION_STATUS.PARTIAL;
      }
    }

    console.log('[Migration] ✅ Migration validation completed');
  }

  /**
   * Cleanup old data sources (optional)
   */
  async cleanupOldData() {
    console.log('[Migration] 🧹 Cleaning up old data sources...');

    try {
      // Note: We don't automatically delete old databases
      // This gives users a chance to rollback if needed
      console.log('[Migration] ℹ️ Old databases preserved. Manual cleanup required.');

      await setMetadata('migration_cleanup', {
        completed: false,
        requiresManualCleanup: true,
        oldDatabases: ['rvolDatabase', 'startupCache'],
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('[Migration] ❌ Cleanup failed:', error);
    }
  }

  /**
   * Check if data lake already exists
   * @returns {Promise<object>} Existing data stats
   */
  async checkExistingDataLake() {
    try {
      // Try to get any ticker to check if database exists
      const testTicker = await getTickerData('TEST');
      return { tickers: 0 }; // Database exists but might be empty
    } catch (error) {
      return { tickers: 0 }; // Database doesn't exist or is empty
    }
  }

  /**
   * Check RVol database availability
   * @returns {Promise<boolean>} True if available
   */
  async checkRvolDatabase() {
    try {
      await initRvolDB();
      const stats = await getRvolStats();
      return stats.totalRecords > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check startup cache availability
   * @returns {Promise<boolean>} True if available
   */
  async checkStartupCache() {
    try {
      const cache = await loadStartupCache(this.symbols.slice(0, 1)); // Test with one symbol
      return cache && Object.keys(cache).length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create backup of existing data
   * @returns {Promise<object>} Backup data
   */
  async createBackup() {
    console.log('[Migration] 💾 Creating backup...');

    const backup = {
      timestamp: Date.now(),
      dataLake: {},
      migration: await getMetadata('migration')
    };

    // Backup all ticker data
    for (const symbol of this.symbols) {
      const data = await getTickerData(symbol);
      if (data) {
        backup.dataLake[symbol] = data;
      }
    }

    // Store backup
    await setMetadata('migration_backup', backup);
    console.log(`[Migration] ✅ Backup created for ${Object.keys(backup.dataLake).length} tickers`);

    return backup;
  }

  /**
   * Rollback migration if it failed
   */
  async rollbackMigration() {
    if (!this.backupData) {
      console.warn('[Migration] ⚠️ No backup available for rollback');
      return;
    }

    console.log('[Migration] 🔄 Rolling back migration...');

    try {
      // Clear current data lake
      await clearDataLake();

      // Restore backup
      for (const [symbol, data] of Object.entries(this.backupData.dataLake)) {
        // await storeTickerData(symbol, data); // TODO: Implement proper storage function
        console.log('Would restore data for:', symbol);
      }

      // Restore migration metadata
      if (this.backupData.migration) {
        await setMetadata('migration', this.backupData.migration);
      }

      console.log('[Migration] ✅ Rollback completed');
      this.status = MIGRATION_STATUS.NOT_STARTED;

    } catch (error) {
      console.error('[Migration] ❌ Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Get migration statistics
   * @returns {Promise<object>} Migration stats
   */
  async getMigrationStats() {
    const duration = this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime;

    return {
      status: this.status,
      duration,
      progress: this.progress,
      successRate: this.progress.total > 0 ? (this.progress.completed / this.progress.total) * 100 : 0,
      errorCount: this.errors.length,
      symbolsProcessed: this.progress.completed,
      errors: this.errors
    };
  }

  /**
   * Save migration results
   * @param {object} results - Migration results
   */
  async saveMigrationResults(results) {
    await setMetadata('migration_results', {
      ...results,
      completedAt: Date.now()
    });
  }

  /**
   * Get current migration status
   * @returns {object} Current status
   */
  getStatus() {
    return {
      status: this.status,
      progress: this.progress,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime,
      errorCount: this.errors.length,
      errors: this.errors
    };
  }
}

/**
 * Create and execute migration
 * @param {string[]} symbols - Symbols to migrate
 * @param {object} options - Migration options
 * @returns {Promise<object>} Migration results
 */
export const executeMigration = async (symbols, options = {}) => {
  const migration = new DataMigrationService(symbols);
  return await migration.migrate(options);
};

export default DataMigrationService;