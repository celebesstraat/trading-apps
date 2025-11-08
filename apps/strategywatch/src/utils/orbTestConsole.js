/**
 * Test Console for Triggering ORB Voice Announcements
 *
 * This script provides a set of functions to test the voice announcements
 * by simulating different ORB scenarios in real-time.
 */

import { evaluate5mORB } from '../services/calculations';
import { announceImmediate } from './voiceAlerts';

// Test data for different ORB scenarios based on PineScript criteria
const testScenarios = {
  // Tier-2 ORB (Dark Green) - Strong opening candle with high RVOL
  tier2ORB: {
    first5mCandle: {
      open: 100.00,  // Open at low (0% of range)
      high: 102.00,  // 2% range
      low: 100.00,
      close: 101.80, // Close at 90% of range, green candle
      volume: 2000000
    },
    historicalFirst5mCandles: Array(20).fill({ volume: 800000 }), // 2.5x RVOL
    symbol: 'AAPL'
  },

  // Tier-1 ORB (Light Green) - Good opening candle with moderate RVOL
  tier1ORB: {
    first5mCandle: {
      open: 150.00,  // Open at 10% of range
      high: 152.00,  // 1.33% range
      low: 149.00,
      close: 151.60, // Close at 80% of range, green candle
      volume: 1200000
    },
    historicalFirst5mCandles: Array(20).fill({ volume: 900000 }), // 1.33x RVOL
    symbol: 'TSLA'
  },

  // No match - Fails price criteria
  weakSetup: {
    first5mCandle: {
      open: 200.00,  // Open at 50% of range (fails <= 20% criteria)
      high: 201.00,  // 0.5% range
      low: 199.00,
      close: 199.80, // Red candle (fails green criteria)
      volume: 600000
    },
    historicalFirst5mCandles: Array(20).fill({ volume: 1000000 }),
    symbol: 'MSFT'
  },

  // No match - Fails RVOL criteria
  lowVolumeSetup: {
    first5mCandle: {
      open: 75.00,   // Open at low (meets criteria)
      high: 76.25,   // 1.67% range
      low: 75.00,
      close: 76.00,  // Close at 93% of range, green candle
      volume: 100000  // Very low volume
    },
    historicalFirst5mCandles: Array(20).fill({ volume: 700000 }), // 0.14x RVOL (fails)
    symbol: 'NVDA'
  },

  // Edge case: Perfect PineScript criteria
  perfectORB: {
    first5mCandle: {
      open: 300.00,  // Open exactly at 20% of range
      high: 301.50,  // 0.5% range
      low: 299.25,   // Open - Low = 0.75 (25% of range)
      close: 301.20, // Close exactly at 80% of range
      volume: 1400000
    },
    historicalFirst5mCandles: Array(20).fill({ volume: 600000 }), // 2.33x RVOL
    symbol: 'GOOGL'
  }
};

/**
 * Run a single test scenario
 */
export function runTestScenario(scenarioName) {
  const scenario = testScenarios[scenarioName];
  if (!scenario) {
    console.error(`❌ Scenario "${scenarioName}" not found`);
    return;
  }

  console.log(`\n🧪 Testing Scenario: ${scenarioName.toUpperCase()}`);
  console.log(`📊 Ticker: ${scenario.symbol}`);
  console.log(`📈 First 5m High: $${scenario.first5mCandle.high}`);
  console.log(`📉 First 5m Low: $${scenario.first5mCandle.low}`);
  console.log(`🔢 Volume: ${scenario.first5mCandle.volume.toLocaleString()}`);

  // Calculate ORB tier using classic PineScript logic
  const tier = evaluate5mORB({
    first5mCandle: scenario.first5mCandle,
    historicalFirst5mCandles: scenario.historicalFirst5mCandles
  });

  console.log(`🎯 ORB Tier: ${tier === 2 ? 'Tier-2 (Dark Green)' : tier === 1 ? 'Tier-1 (Light Green)' : tier === 0 ? 'No Match' : 'No Data'}`);

  // Determine what announcement should be triggered
  if (tier === 2) {
    const announcement = `${scenario.symbol} opening candle is very strong`;
    console.log(`🔊 Voice Announcement: "${announcement}" (Immediate for testing)`);
    announceImmediate(announcement);
  } else if (tier === 1) {
    const announcement = `${scenario.symbol} opening candle is strong`;
    console.log(`🔊 Voice Announcement: "${announcement}" (Immediate for testing)`);
    announceImmediate(announcement);
  } else {
    console.log(`🔇 No voice announcement expected for this scenario`);
  }
}

/**
 * Run all test scenarios in sequence
 */
export function runAllTests() {
  console.log('🚀 Starting ORB Voice Announcement Tests...');
  console.log('=' .repeat(50));

  const scenarios = Object.keys(testScenarios);
  scenarios.forEach((scenarioName, index) => {
    setTimeout(() => {
      runTestScenario(scenarioName);

      if (index === scenarios.length - 1) {
        console.log('\n' + '=' .repeat(50));
        console.log('✅ All tests completed!');
      }
    }, index * 2000); // 2 second delay between tests
  });
}

/**
 * Continuous random testing - simulate real-time data updates
 */
export function startRandomTesting(intervalMs = 5000) {
  console.log(`🎲 Starting random ORB testing every ${intervalMs}ms...`);
  console.log('Press Ctrl+C to stop');

  const scenarios = Object.keys(testScenarios);

  const runRandomTest = () => {
    const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    runTestScenario(randomScenario);
  };

  // Run first test immediately
  runRandomTest();

  // Then run at specified interval
  return setInterval(runRandomTest, intervalMs);
}

/**
 * Stop random testing
 */
export function stopRandomTesting(intervalId) {
  clearInterval(intervalId);
  console.log('\n⏹️ Random testing stopped');
}

// Export test scenarios for manual inspection
export { testScenarios };

// Auto-run all tests if this script is imported
if (typeof window !== 'undefined') {
  console.log('📢 ORB Voice Test Console loaded!');
  console.log('Available functions:');
  console.log('  runTestScenario("tier2ORB")');
  console.log('  runTestScenario("tier1ORB")');
  console.log('  runTestScenario("weakSetup")');
  console.log('  runTestScenario("lowVolumeSetup")');
  console.log('  runTestScenario("perfectORB")');
  console.log('  runAllTests()');
  console.log('  startRandomTesting()');

  // Auto-run all tests after 2 seconds
  setTimeout(() => {
    console.log('\n🚀 Auto-running all ORB voice tests...');
    runAllTests();
  }, 2000);
}