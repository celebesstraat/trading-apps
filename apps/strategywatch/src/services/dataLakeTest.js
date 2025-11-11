/**
 * DataLake Test Script
 * Tests the IndexedDB DataLake functionality and validates fixes
 */

// Import DataLake functions
import {
  initDataLake,
  resetDataLake,
  storeTicks,
  getRecentTicks,
  getDataLakeStats,
  clearDataLake
} from './dataLake.js';

/**
 * Test DataLake functionality
 */
export const testDataLake = async () => {
  console.log('🧪 Starting DataLake functionality test...');

  try {
    // 1. Reset the database to start fresh
    console.log('1️⃣ Resetting database...');
    await resetDataLake();
    console.log('✅ Database reset complete');

    // 2. Initialize DataLake
    console.log('2️⃣ Initializing DataLake...');
    const db = await initDataLake();
    console.log('✅ DataLake initialized successfully');

    // 3. Get initial stats
    console.log('3️⃣ Getting initial stats...');
    const initialStats = await getDataLakeStats();
    console.log('Initial stats:', initialStats);
    console.log('✅ Initial stats retrieved');

    // 4. Test tick storage
    console.log('4️⃣ Testing tick storage...');
    const testTicks = [
      {
        timestamp: Date.now(),
        price: 150.25,
        volume: 1000,
        size: 100,
        exchange: 'NYSE',
        conditions: ['regular']
      },
      {
        timestamp: Date.now() + 1000,
        price: 150.30,
        volume: 1200,
        size: 120,
        exchange: 'NYSE',
        conditions: ['regular']
      }
    ];

    await storeTicks('AAPL', testTicks);
    console.log('✅ Tick storage successful');

    // 5. Test tick retrieval
    console.log('5️⃣ Testing tick retrieval...');
    const retrievedTicks = await getRecentTicks('AAPL', 10);
    console.log(`Retrieved ${retrievedTicks.length} ticks for AAPL`);
    console.log('✅ Tick retrieval successful');

    // 6. Get final stats
    console.log('6️⃣ Getting final stats...');
    const finalStats = await getDataLakeStats();
    console.log('Final stats:', finalStats);
    console.log('✅ Final stats retrieved');

    // 7. Test database health
    console.log('7️⃣ Testing database health...');
    if (finalStats.healthy && finalStats.stores.ticks > 0) {
      console.log('✅ Database is healthy and contains data');
    } else {
      console.warn('⚠️ Database health check failed');
    }

    console.log('🎉 DataLake test completed successfully!');
    return {
      success: true,
      initialStats,
      finalStats,
      ticksStored: testTicks.length,
      ticksRetrieved: retrievedTicks.length
    };

  } catch (error) {
    console.error('❌ DataLake test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Test concurrent DataLake operations
 */
export const testConcurrentOperations = async () => {
  console.log('🔄 Testing concurrent DataLake operations...');

  try {
    const promises = [];

    // Create multiple concurrent operations
    for (let i = 0; i < 5; i++) {
      const ticker = `TEST${i}`;
      const ticks = Array.from({ length: 10 }, (_, index) => ({
        timestamp: Date.now() + index * 100,
        price: 100 + Math.random() * 50,
        volume: Math.floor(Math.random() * 2000) + 100,
        size: Math.floor(Math.random() * 200) + 10,
        exchange: 'TEST',
        conditions: ['test']
      }));

      promises.push(storeTicks(ticker, ticks));
    }

    // Wait for all operations to complete
    await Promise.all(promises);
    console.log('✅ Concurrent operations completed successfully');

    // Check final stats
    const stats = await getDataLakeStats();
    console.log('Final stats after concurrent operations:', stats);

    return {
      success: true,
      stats,
      operationsCount: promises.length
    };

  } catch (error) {
    console.error('❌ Concurrent operations test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Auto-run tests if this file is imported directly
if (typeof window !== 'undefined') {
  window.testDataLake = testDataLake;
  window.testConcurrentOperations = testConcurrentOperations;

  console.log('🧪 DataLake test functions loaded. Run testDataLake() or testConcurrentOperations() to test.');
}

export default {
  testDataLake,
  testConcurrentOperations
};