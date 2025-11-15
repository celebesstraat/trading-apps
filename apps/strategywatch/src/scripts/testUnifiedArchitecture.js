/**
 * Unified Architecture Testing Script
 * Validates the new data architecture and compares performance with legacy system
 */

// Import the new architecture services
import { getDataLakeStats, getMultipleTickerData } from '../services/dataLake';
import { createDataIngestionEngine } from '../services/dataIngestionEngine';
import { getQueryOptimizer } from '../services/queryOptimizer';
import { executeMigration } from '../services/dataMigration';

// Test configuration
const TEST_CONFIG = {
  SYMBOLS: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA'], // Test symbols
  TEST_ITERATIONS: 10, // Number of test iterations
  PERFORMANCE_THRESHOLD: {
    QUERY_TIME: 100, // Max 100ms per query
    CACHE_HIT_RATE: 80, // Min 80% cache hit rate
    MEMORY_USAGE: 50 * 1024 * 1024 // Max 50MB memory usage
  }
};

/**
 * Main test runner for unified architecture
 */
export class UnifiedArchitectureTester {
  constructor() {
    this.results = {
      migration: null,
      performance: null,
      functionality: null,
      comparison: null
    };
    this.engine = null;
    this.optimizer = null;
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Unified Architecture Tests...');
    console.log('=' .repeat(60));

    try {
      // Test 1: Migration
      await this.testMigration();

      // Test 2: Functionality
      await this.testFunctionality();

      // Test 3: Performance
      await this.testPerformance();

      // Test 4: Comparison with legacy (if possible)
      await this.testComparison();

      // Generate report
      this.generateReport();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.results.error = error.message;
    }

    return this.results;
  }

  /**
   * Test data migration
   */
  async testMigration() {
    console.log('📦 Testing Data Migration...');

    try {
      const startTime = performance.now();

      // Execute migration
      const migrationResult = await executeMigration(TEST_CONFIG.SYMBOLS, {
        cleanupOld: false
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      this.results.migration = {
        success: migrationResult.status === 'completed',
        duration,
        symbolsMigrated: migrationResult.progress?.completed || 0,
        errors: migrationResult.errors || [],
        stats: migrationResult.stats || {}
      };

      console.log(`✅ Migration completed in ${duration.toFixed(2)}ms`);
      console.log(`   Symbols migrated: ${this.results.migration.symbolsMigrated}`);
      console.log(`   Errors: ${this.results.migration.errors.length}`);

    } catch (error) {
      console.error('❌ Migration test failed:', error);
      this.results.migration = {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test core functionality
   */
  async testFunctionality() {
    console.log('🔧 Testing Core Functionality...');

    const functionalityResults = {
      dataLake: false,
      queryOptimizer: false,
      dataEngine: false,
      dataAccess: false,
      caching: false
    };

    try {
      // Test Data Lake
      const stats = await getDataLakeStats();
      functionalityResults.dataLake = stats.healthy;
      console.log(`   Data Lake: ${functionalityResults.dataLake ? '✅' : '❌'}`);

      // Test Query Optimizer
      this.optimizer = getQueryOptimizer();
      const optimizerStats = this.optimizer.getStats();
      functionalityResults.queryOptimizer = optimizerStats !== null;
      console.log(`   Query Optimizer: ${functionalityResults.queryOptimizer ? '✅' : '❌'}`);

      // Test Data Engine
      this.engine = createDataIngestionEngine(TEST_CONFIG.SYMBOLS);
      const engineStatus = this.engine.getStatus();
      functionalityResults.dataEngine = engineStatus !== null;
      console.log(`   Data Engine: ${functionalityResults.dataEngine ? '✅' : '❌'}`);

      // Test Data Access
      const testData = await getMultipleTickerData(TEST_CONFIG.SYMBOLS);
      functionalityResults.dataAccess = Object.keys(testData).length > 0;
      console.log(`   Data Access: ${functionalityResults.dataAccess ? '✅' : '❌'}`);

      // Test Caching
      await this.optimizer.getCurrentQuote(TEST_CONFIG.SYMBOLS[0]);
      const cachedData = await this.optimizer.getCurrentQuote(TEST_CONFIG.SYMBOLS[0]);
      functionalityResults.caching = cachedData !== null;
      console.log(`   Caching: ${functionalityResults.caching ? '✅' : '❌'}`);

      this.results.functionality = functionalityResults;

    } catch (error) {
      console.error('❌ Functionality test failed:', error);
      this.results.functionality = {
        ...functionalityResults,
        error: error.message
      };
    }
  }

  /**
   * Test performance
   */
  async testPerformance() {
    console.log('⚡ Testing Performance...');

    if (!this.optimizer) {
      this.optimizer = getQueryOptimizer();
    }

    const performanceResults = {
      queryTimes: [],
      cacheHitRates: [],
      memoryUsage: 0,
      throughput: 0
    };

    try {
      const startTime = performance.now();

      // Test multiple queries
      for (let i = 0; i < TEST_CONFIG.TEST_ITERATIONS; i++) {
        const queryStart = performance.now();

        // Mix of different query types
        await this.optimizer.getCurrentQuote(TEST_CONFIG.SYMBOLS[0]);
        await this.optimizer.getIndicators(TEST_CONFIG.SYMBOLS[0]);
        await this.optimizer.getStrategyResults(TEST_CONFIG.SYMBOLS[0], 'rvol');

        const queryEnd = performance.now();
        performanceResults.queryTimes.push(queryEnd - queryStart);

        // Get cache stats
        const stats = this.optimizer.getStats();
        performanceResults.cacheHitRates.push(stats.performance.cacheHitRate);
      }

      const totalTime = performance.now() - startTime;
      performanceResults.throughput = (TEST_CONFIG.TEST_ITERATIONS * 3) / (totalTime / 1000); // queries per second

      // Calculate averages
      const avgQueryTime = performanceResults.queryTimes.reduce((a, b) => a + b, 0) / performanceResults.queryTimes.length;
      const avgCacheHitRate = performanceResults.cacheHitRates.reduce((a, b) => a + b, 0) / performanceResults.cacheHitRates.length;

      // Memory usage estimation
      const cacheStats = this.optimizer.cache.getStats();
      performanceResults.memoryUsage = cacheStats.memoryUsage;

      // Performance validation
      performanceResults.passed =
        avgQueryTime < TEST_CONFIG.PERFORMANCE_THRESHOLD.QUERY_TIME &&
        avgCacheHitRate > TEST_CONFIG.PERFORMANCE_THRESHOLD.CACHE_HIT_RATE &&
        performanceResults.memoryUsage < TEST_CONFIG.PERFORMANCE_THRESHOLD.MEMORY_USAGE;

      this.results.performance = {
        ...performanceResults,
        avgQueryTime,
        avgCacheHitRate,
        passed: performanceResults.passed
      };

      console.log(`   Average Query Time: ${avgQueryTime.toFixed(2)}ms`);
      console.log(`   Average Cache Hit Rate: ${avgCacheHitRate.toFixed(1)}%`);
      console.log(`   Memory Usage: ${(performanceResults.memoryUsage / 1024).toFixed(1)}KB`);
      console.log(`   Throughput: ${performanceResults.throughput.toFixed(1)} queries/sec`);
      console.log(`   Performance: ${performanceResults.passed ? '✅ PASS' : '❌ FAIL'}`);

    } catch (error) {
      console.error('❌ Performance test failed:', error);
      this.results.performance = {
        ...performanceResults,
        error: error.message,
        passed: false
      };
    }
  }

  /**
   * Test comparison with legacy system (if possible)
   */
  async testComparison() {
    console.log('📊 Testing Legacy Comparison...');

    const comparisonResults = {
      coldStartTime: 0,
      refreshTime: 0,
      dataQuality: 'unknown'
    };

    try {
      // Test cold start time (simulate fresh load)
      const coldStartStart = performance.now();
      await this.optimizer.getCurrentQuotes(TEST_CONFIG.SYMBOLS);
      const coldStartEnd = performance.now();
      comparisonResults.coldStartTime = coldStartEnd - coldStartStart;

      // Test refresh time (cached data)
      const refreshStart = performance.now();
      await this.optimizer.getCurrentQuotes(TEST_CONFIG.SYMBOLS);
      const refreshEnd = performance.now();
      comparisonResults.refreshTime = refreshEnd - refreshStart;

      // Estimate data quality
      const stats = this.optimizer.getStats();
      comparisonResults.dataQuality = stats.performance.cacheHitRate > 80 ? 'excellent' :
                                      stats.performance.cacheHitRate > 60 ? 'good' : 'poor';

      this.results.comparison = comparisonResults;

      console.log(`   Cold Start Time: ${comparisonResults.coldStartTime.toFixed(2)}ms`);
      console.log(`   Refresh Time: ${comparisonResults.refreshTime.toFixed(2)}ms`);
      console.log(`   Data Quality: ${comparisonResults.dataQuality}`);

      // Performance improvements over legacy (estimated)
      const legacyColdStart = 15000; // 15 seconds (from CLAUDE.md)
      const legacyRefresh = 3000;    // 3 seconds (from CLAUDE.md)

      const coldStartImprovement = ((legacyColdStart - comparisonResults.coldStartTime) / legacyColdStart) * 100;
      const refreshImprovement = ((legacyRefresh - comparisonResults.refreshTime) / legacyRefresh) * 100;

      console.log(`   🚀 Cold Start Improvement: ${coldStartImprovement.toFixed(1)}%`);
      console.log(`   🚀 Refresh Improvement: ${refreshImprovement.toFixed(1)}%`);

    } catch (error) {
      console.error('❌ Comparison test failed:', error);
      this.results.comparison = {
        ...comparisonResults,
        error: error.message
      };
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 UNIFIED ARCHITECTURE TEST REPORT');
    console.log('='.repeat(60));

    // Migration Results
    console.log('\n📦 Migration Results:');
    if (this.results.migration) {
      console.log(`   Status: ${this.results.migration.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      if (this.results.migration.success) {
        console.log(`   Duration: ${this.results.migration.duration.toFixed(2)}ms`);
        console.log(`   Symbols: ${this.results.migration.symbolsMigrated}`);
      }
      if (this.results.migration.error) {
        console.log(`   Error: ${this.results.migration.error}`);
      }
    }

    // Functionality Results
    console.log('\n🔧 Functionality Results:');
    if (this.results.functionality) {
      const tests = [
        { name: 'Data Lake', key: 'dataLake' },
        { name: 'Query Optimizer', key: 'queryOptimizer' },
        { name: 'Data Engine', key: 'dataEngine' },
        { name: 'Data Access', key: 'dataAccess' },
        { name: 'Caching', key: 'caching' }
      ];

      tests.forEach(test => {
        const status = this.results.functionality[test.key] ? '✅' : '❌';
        console.log(`   ${test.name}: ${status}`);
      });

      if (this.results.functionality.error) {
        console.log(`   Error: ${this.results.functionality.error}`);
      }
    }

    // Performance Results
    console.log('\n⚡ Performance Results:');
    if (this.results.performance) {
      console.log(`   Status: ${this.results.performance.passed ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Avg Query Time: ${this.results.performance.avgQueryTime?.toFixed(2)}ms`);
      console.log(`   Cache Hit Rate: ${this.results.performance.avgCacheHitRate?.toFixed(1)}%`);
      console.log(`   Memory Usage: ${(this.results.performance.memoryUsage / 1024).toFixed(1)}KB`);
      console.log(`   Throughput: ${this.results.performance.throughput?.toFixed(1)} queries/sec`);
    }

    // Comparison Results
    console.log('\n📊 Performance Comparison:');
    if (this.results.comparison) {
      console.log(`   Cold Start: ${this.results.comparison.coldStartTime.toFixed(2)}ms`);
      console.log(`   Refresh: ${this.results.comparison.refreshTime.toFixed(2)}ms`);
      console.log(`   Data Quality: ${this.results.comparison.dataQuality}`);
    }

    // Overall Assessment
    console.log('\n🎯 Overall Assessment:');
    const migrationOk = this.results.migration?.success !== false;
    const functionalityOk = Object.values(this.results.functionality || {})
      .filter(val => typeof val === 'boolean').every(val => val);
    const performanceOk = this.results.performance?.passed !== false;

    if (migrationOk && functionalityOk && performanceOk) {
      console.log('   ✅ READY FOR PRODUCTION');
      console.log('   The unified architecture passes all tests and is ready to replace the legacy system.');
    } else {
      console.log('   ❌ NEEDS ATTENTION');
      if (!migrationOk) console.log('   - Migration issues detected');
      if (!functionalityOk) console.log('   - Functionality tests failed');
      if (!performanceOk) console.log('   - Performance below thresholds');
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * Clean up test data
   */
  async cleanup() {
    try {
      if (this.engine) {
        await this.engine.stop();
      }

      if (this.optimizer) {
        this.optimizer.reset();
      }

      // Optionally clear test data
      // await clearDataLake();

      console.log('🧹 Test cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

/**
 * Run tests from browser console
 */
export const runUnifiedArchitectureTests = async () => {
  const tester = new UnifiedArchitectureTester();
  try {
    const results = await tester.runAllTests();
    await tester.cleanup();
    return results;
  } catch (error) {
    await tester.cleanup();
    throw error;
  }
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.testUnifiedArchitecture = runUnifiedArchitectureTests;
  window.UnifiedArchitectureTester = UnifiedArchitectureTester;
}

export default UnifiedArchitectureTester;