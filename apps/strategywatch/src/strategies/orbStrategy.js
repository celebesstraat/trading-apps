// Re-export the classic TradingView PineScript ORB logic from calculations.js
// This maintains backward compatibility while using the simplified approach
export {
  evaluate5mORB as calculateORBScore,
  get5mORBDetails as getORBBreakdown
} from '../services/calculations';
