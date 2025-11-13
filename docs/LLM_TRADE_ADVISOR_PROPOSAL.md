# LLM Trade Advisor Integration Proposal
## StrategyWatch AI Enhancement Analysis

**Date**: 2025-11-13
**Status**: Strategic Analysis & Recommendation

---

## Executive Summary

**Recommendation**: ✅ **PROCEED** with phased LLM integration, starting with high-impact, low-cost scenarios.

**Key Finding**: LLM integration can provide 10-20x ROI if it improves trade selection by just 1-2 setups per week, but costs must be carefully managed through intelligent caching and selective invocation.

**Optimal Approach**: Deploy LLM as a "second opinion advisor" for critical decision points (ORB signals, MA bounce setups) rather than continuous analysis, keeping API costs to $10-50/month while delivering $500-2000/month in improved trading outcomes.

---

## 1. Cost-Benefit Analysis

### A. Cost Structure

#### LLM API Pricing (Current Market Rates)

**Claude 3.5 Sonnet** (Recommended for trading analysis):
- Input: $3.00 per 1M tokens
- Output: $15.00 per 1M tokens
- Typical analysis: ~2,000 input tokens + ~500 output tokens
- **Cost per analysis**: ~$0.015 (1.5 cents)

**GPT-4o** (Alternative option):
- Input: $2.50 per 1M tokens
- Output: $10.00 per 1M tokens
- **Cost per analysis**: ~$0.010 (1 cent)

**GPT-4o-mini** (Budget option):
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- **Cost per analysis**: ~$0.0006 (0.06 cents)

#### Cost Scenarios (Based on Usage Pattern)

**Scenario 1: Conservative Usage** (Recommended for MVP)
- 10 ORB analyses per day (morning open setups)
- 5 MA proximity analyses per day
- 1 market regime analysis per day
- **Daily**: 16 analyses × $0.015 = **$0.24/day**
- **Monthly**: $0.24 × 20 trading days = **$4.80/month**

**Scenario 2: Moderate Usage** (Full feature set)
- 30 ORB analyses per day (all tier 1/2 signals)
- 20 MA proximity analyses per day
- 3 watchlist prioritizations per day
- 3 market regime analyses per day
- **Daily**: 56 analyses × $0.015 = **$0.84/day**
- **Monthly**: $0.84 × 20 trading days = **$16.80/month**

**Scenario 3: Heavy Usage** (With aggressive caching)
- 100 setup analyses per day
- 10 watchlist prioritizations per day
- 6 market regime analyses per day
- **Daily**: 116 analyses × $0.015 = **$1.74/day**
- **Monthly**: $1.74 × 20 trading days = **$34.80/month**

**Scenario 4: Excessive/Unoptimized** (What to avoid)
- Continuous real-time analysis without caching
- Duplicate analyses for same setup
- Overly verbose prompts (5K+ tokens)
- **Monthly**: $200-500/month ❌ AVOID

### B. Benefit Quantification

#### Direct Trading Value

**Baseline Trading Economics** (Typical Day Trader):
- Account size: $25,000 - $100,000
- Daily risk: 1-2% of account = $250-2,000
- Win rate: 50-60%
- Average win: $200-800
- Average loss: $100-400
- Daily P&L range: -$500 to +$1,500

**Value Proposition**: If LLM improves decision-making on just 1-2 trades per week:

**Conservative Improvement** (1 better trade per week):
- Avoided loss: $200 (stopped out of bad setup)
- OR Better entry: $150 (improved risk/reward by 30%)
- **Monthly value**: $600-800

**Moderate Improvement** (2 better trades per week):
- 1 avoided loss: $200
- 1 improved entry: $150
- **Monthly value**: $1,400-1,600

**Aggressive Improvement** (3-4 better trades per week):
- 2 avoided losses: $400
- 2 improved entries: $300
- **Monthly value**: $2,800-3,200

#### ROI Calculation

| Usage Scenario | Monthly Cost | Conservative Benefit | ROI |
|---------------|--------------|---------------------|-----|
| **Conservative** | $5 | $700 | **140x** |
| **Moderate** | $17 | $1,500 | **88x** |
| **Heavy** | $35 | $2,800 | **80x** |

**Break-Even Analysis**: LLM pays for itself if it prevents just **ONE bad trade per month** (saved $200-400 loss vs $5-35 cost).

#### Indirect Benefits (Non-Quantifiable)

1. **Faster Learning Curve**
   - Pattern recognition guidance
   - Setup quality education
   - Contextual market understanding
   - Value: Weeks-months of screen time compressed

2. **Reduced Emotional Bias**
   - Objective second opinion
   - Prevents revenge trading
   - Encourages patience in choppy markets
   - Value: Immeasurable (emotional control is critical)

3. **Better Risk Management**
   - Clear stop/target recommendations
   - Position sizing guidance
   - Setup quality scoring
   - Value: $500-2,000/month in avoided overtrading

4. **Time Efficiency**
   - Instant multi-indicator synthesis
   - Prioritized watchlist scanning
   - Faster decision-making
   - Value: 30-60 minutes saved per trading day

### C. Risk-Adjusted Assessment

**Key Risks**:
1. **Over-Reliance**: Trader blindly follows AI recommendations
   - **Mitigation**: Position as "second opinion," not primary decision-maker

2. **API Outages**: LLM unavailable during critical moment
   - **Mitigation**: Graceful degradation, cache recent analyses

3. **Hallucination Risk**: LLM provides plausible but incorrect analysis
   - **Mitigation**: Ground all analysis in actual data points, clear disclaimers

4. **Cost Creep**: Usage spirals beyond budget
   - **Mitigation**: Hard rate limits, monitoring dashboard, aggressive caching

**Risk Mitigation Cost**: Negligible if properly architected from start.

---

## 2. Strategic Value Assessment

### What LLMs Do Well (High Value)

✅ **Pattern Synthesis**
- Combining multiple indicators (ORB + VRS + RVol + MA proximity) into coherent narrative
- "This is a Tier 2 ORB with 2x volume, outperforming QQQ by 15%, and bouncing off 21 EMA = **high-probability long setup**"
- Human skill level: Expert trader with 5+ years experience
- LLM advantage: Instant synthesis, no cognitive fatigue

✅ **Comparative Ranking**
- "NVDA has better volume confirmation than TSLA, but TSLA has cleaner technical structure"
- Helps prioritize when 5+ signals appear simultaneously
- Human skill level: Difficult even for experienced traders
- LLM advantage: Objective, consistent criteria

✅ **Risk/Reward Calculation**
- "Based on ADR, stop at $244.50 (1% risk), target $247.20 (2% reward) = 2:1 R/R"
- Clear, actionable trade plan
- Human skill level: Intermediate trader can do this, but takes time
- LLM advantage: Instant, consistent methodology

✅ **Contextual Adaptation**
- "In choppy markets, require Tier 2 signals only"
- "During strong trends, focus on breakout continuation"
- Human skill level: Advanced/expert trader
- LLM advantage: Can encode multiple regime-based strategies

✅ **Educational Feedback**
- "This setup worked because volume confirmed the breakout"
- "This failed because it was overextended (120% of ADR already)"
- Human skill level: Requires mentor/coach
- LLM advantage: Patient, consistent teaching

### What LLMs Do Poorly (Low/Negative Value)

❌ **Real-Time Tick Prediction**
- "Price will go up in next 5 minutes"
- LLMs have no edge over random chance
- Human skill level: Nobody can do this consistently
- LLM disadvantage: Dangerous overconfidence

❌ **Sentiment Analysis Without News**
- Trying to explain price movements without catalyst information
- LLMs will confabulate explanations
- Human skill level: Also speculative
- LLM disadvantage: Plausible-sounding but fictional narratives

❌ **Backtesting / Quantitative Analysis**
- LLMs are not calculators
- Should not replace statistical validation
- Human skill level: Requires programming/quant skills
- LLM disadvantage: Hallucinated statistics

❌ **Continuous Monitoring**
- Running analysis every 100ms on every price tick
- Expensive, redundant, low signal-to-noise
- Human skill level: Nobody does this
- LLM disadvantage: Cost prohibitive

### Optimal Use Case: "Critical Decision Checkpoint"

**Best Practice**: Invoke LLM at key decision moments:
1. ORB Tier 1/2 signal appears → "Should I trade this?"
2. Price reaches MA proximity threshold → "Is this a bounce setup?"
3. Multiple signals fire simultaneously → "Which is the best trade?"
4. Market opens → "What's the regime and prioritization?"

**Avoid**: Continuous background analysis, redundant re-analysis, speculative prediction.

---

## 3. Implementation Roadmap

### Phase 1: MVP - Single Setup Analysis (Week 1-2)

**Goal**: Prove value with minimal investment

**Deliverables**:
1. `src/services/llmAdvisor.js` - API integration module
2. `src/components/AIAnalysisButton.jsx` - Trigger button
3. `src/components/AIAnalysisModal.jsx` - Results display
4. Environment variable: `VITE_ANTHROPIC_API_KEY`

**Integration Point**: ORB column in `TickerRow.jsx`
- Add 🤖 icon next to Tier 1/2 signals
- On click, send setup data to Claude API
- Display analysis in modal: Score, Key Points, Trade Plan, Risks

**Success Metrics**:
- Cost < $10/month
- Trader uses feature 5+ times per day
- Qualitative feedback: "Helpful in 80%+ of cases"

**Technical Specs**:
```javascript
// src/services/llmAdvisor.js
export async function analyzeSetup(setupData, options = {}) {
  const cacheKey = `analysis_${setupData.symbol}_${setupData.timestamp}`;

  // Check cache (5-minute TTL)
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Prepare prompt
  const prompt = buildSetupAnalysisPrompt(setupData);

  // Call Claude API
  const response = await callClaudeAPI(prompt, {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    temperature: 0.3  // Low temp for consistent analysis
  });

  // Parse structured response
  const analysis = parseAnalysisResponse(response);

  // Cache result
  setCached(cacheKey, analysis, 300); // 5 min TTL

  return analysis;
}
```

**Prompt Engineering**:
```
You are an expert day trader analyzing intraday setups. Provide structured analysis:

SETUP DATA:
{JSON data here}

ANALYSIS (respond in JSON format):
{
  "score": 7.5,  // 0-10 rating
  "bias": "bullish",  // bullish, bearish, neutral
  "quality": "high",  // high, medium, low
  "keyPoints": [
    "Strong volume confirmation (2.1x RVol)",
    "Clean ORB candle structure (Tier 2)",
    "Outperforming QQQ by 12% (VRS 5m)"
  ],
  "risks": [
    "Already moved 120% of ADR - limited upside",
    "Approaching resistance at $246.50 (5D SMA)"
  ],
  "tradePlan": {
    "entry": "245.70-246.00",
    "stop": "244.50",
    "target": "247.20",
    "riskReward": "2.1:1",
    "positionSize": "1-2% of account"
  },
  "reasoning": "High-probability bullish setup with volume confirmation..."
}
```

**UI Mockup**:
```
┌─────────────────────────────────────────┐
│ AI Analysis: TSLA                    [X]│
├─────────────────────────────────────────┤
│ Quality Score: 8.5/10 🟢                │
│ Bias: BULLISH                           │
│                                         │
│ ✓ Key Strengths:                       │
│   • Strong volume (2.1x RVol)          │
│   • Tier 2 ORB candle                  │
│   • Outperforming QQQ (+12%)           │
│                                         │
│ ⚠ Key Risks:                           │
│   • Already moved 120% of ADR          │
│   • Approaching 5D SMA resistance      │
│                                         │
│ 📋 Trade Plan:                         │
│   Entry:  $245.70-246.00               │
│   Stop:   $244.50                      │
│   Target: $247.20                      │
│   R/R:    2.1:1                        │
│   Size:   1-2% of account              │
│                                         │
│ Generated at 9:35:22 AM                │
└─────────────────────────────────────────┘
```

### Phase 2: Watchlist Prioritization (Week 3-4)

**Goal**: Help trader scan faster at market open

**Deliverables**:
1. "🤖 AI Prioritize" button in WatchlistTable header
2. Full watchlist analysis (10-30 stocks)
3. Ranked results modal with sortable list

**Integration Point**: `WatchlistTable.jsx` header toolbar

**Use Case**:
- Trader clicks button at 9:35 AM after ORB signals appear
- System sends all stocks with Tier 1/2 signals to LLM
- LLM ranks from best to worst with reasoning
- Trader focuses on top 3-5 setups

**Cost Management**:
- Batch analysis: 1 API call for all 10-30 stocks
- Input: ~5,000 tokens (30 stocks × ~150 tokens each)
- Output: ~1,000 tokens (ranked list)
- Cost: ~$0.03 per batch
- Frequency: 1-3 times per day = $0.60-1.80/month

### Phase 3: MA Proximity Alerts (Week 5-6)

**Goal**: Catch bounce/breakdown setups

**Deliverables**:
1. Background monitor for MA proximity events
2. AI analysis when green/amber box appears
3. Voice alert integration: "AAPL bouncing off 21 EMA - AI suggests long"

**Integration Point**: `calculations.js` MA proximity detection

**Technical Challenge**: Balance real-time monitoring vs API costs
- **Solution**: Only analyze when:
  1. Stock wasn't in proximity 5 minutes ago (event-driven, not polling)
  2. Price action shows clear direction (bounce vs breakdown)
  3. RVol > 0.8x (sufficient volume)

### Phase 4: Market Regime Banner (Week 7-8)

**Goal**: Adapt strategy to market conditions

**Deliverables**:
1. Market condition analyzer (every 30 minutes)
2. Header banner with regime description
3. Strategy recommendations based on regime

**Example Outputs**:
- 🟢 "Strong Trending Market - Focus on ORB breakouts and trend continuation"
- 🟡 "Choppy Conditions - Wait for Tier 2 signals, smaller positions"
- 🔴 "High Volatility - Reduce position sizes, tighter stops"

**Data Sent**: QQQ data + VRS distribution across watchlist

**Cost**: 12 analyses per day × $0.015 = $0.18/day = $3.60/month

### Phase 5: End-of-Day Journal (Week 9-10)

**Goal**: Accelerate learning through reflection

**Deliverables**:
1. Trade journal modal
2. Analysis of which setups worked/failed
3. Pattern recognition and lessons learned

**Cost**: 1 analysis per day × $0.05 (longer context) = $1/month

---

## 4. Technical Architecture

### A. System Design

```
┌─────────────────────────────────────────────────────────┐
│                    React UI Layer                        │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │TickerRow   │  │WatchlistTable│  │Header Banner    │ │
│  │+ AI Button │  │+ AI Prioritize│  │+ Market Regime  │ │
│  └─────┬──────┘  └──────┬───────┘  └────────┬────────┘ │
│        │                 │                    │          │
│        └─────────────────┼────────────────────┘          │
│                          │                               │
│                  ┌───────▼──────────┐                   │
│                  │ LLM Advisor       │                   │
│                  │ Service Layer     │                   │
│                  │                   │                   │
│                  │ • Prompt Builder  │                   │
│                  │ • Response Parser │                   │
│                  │ • Cache Manager   │                   │
│                  │ • Rate Limiter    │                   │
│                  └───────┬──────────┘                   │
└──────────────────────────┼───────────────────────────────┘
                           │
                  ┌────────▼──────────┐
                  │  Cache Layer       │
                  │  (IndexedDB)       │
                  │                    │
                  │  TTL: 5 minutes    │
                  │  Max: 1000 entries │
                  └────────┬──────────┘
                           │
                  ┌────────▼──────────┐
                  │  Claude API        │
                  │  (Anthropic)       │
                  │                    │
                  │  Model: Sonnet 3.5 │
                  │  Timeout: 10s      │
                  └────────────────────┘
```

### B. Key Modules

#### 1. LLM Advisor Service (`src/services/llmAdvisor.js`)

**Core Functions**:
```javascript
// Single setup analysis
export async function analyzeSetup(setupData, options)

// Batch watchlist prioritization
export async function prioritizeWatchlist(watchlistData, options)

// MA proximity analysis
export async function analyzeMAProximity(proximityData, options)

// Market regime analysis
export async function analyzeMarketRegime(marketData, options)

// Health check
export function getUsageStats()
```

**Features**:
- Automatic caching (IndexedDB)
- Rate limiting (max 100 requests/hour)
- Error handling with fallback
- Usage tracking and monitoring
- Prompt versioning

#### 2. Prompt Templates (`src/prompts/`)

**File Structure**:
```
src/prompts/
├── setupAnalysis.js      # ORB/MA setup analysis
├── watchlistRanking.js   # Morning prioritization
├── marketRegime.js       # Market condition analysis
└── common.js             # Shared prompt utilities
```

**Best Practices**:
- Structured JSON output (easy parsing)
- Few-shot examples for consistency
- Clear constraints (token limits, formatting)
- Version tracking for A/B testing

#### 3. Cache Manager (`src/services/llmCache.js`)

**Caching Strategy**:
```javascript
// Key generation
function getCacheKey(type, data) {
  return `llm_${type}_${data.symbol}_${Math.floor(Date.now() / 300000)}`;
  // 5-minute buckets (300000ms)
}

// Cache hit rate target: >70%
// Storage limit: 5MB (IndexedDB quota)
// Eviction: LRU (Least Recently Used)
```

**Why Caching is Critical**:
- Same setup analyzed multiple times → cache saves $$$
- Market regime changes slowly → cache for 30 min
- Reduce latency from 1-3s to <50ms

#### 4. Rate Limiter (`src/services/rateLimiter.js`)

**Limits**:
```javascript
const RATE_LIMITS = {
  setupAnalysis: {
    maxPerHour: 60,
    maxPerDay: 200
  },
  watchlistPrioritization: {
    maxPerHour: 10,
    maxPerDay: 30
  },
  marketRegime: {
    maxPerHour: 12,
    maxPerDay: 50
  }
};
```

**Enforcement**:
- Hard limits (reject requests over limit)
- Usage dashboard in UI
- Warning when approaching limit
- Daily reset at market close

### C. Error Handling & Reliability

**Error Scenarios**:

1. **API Key Invalid**
   - Error: 401 Unauthorized
   - Handling: Show clear error message, link to setup docs
   - Fallback: Disable AI features gracefully

2. **Rate Limit Exceeded** (API provider side)
   - Error: 429 Too Many Requests
   - Handling: Show "AI advisor temporarily unavailable"
   - Fallback: Use cached analysis if available

3. **Network Timeout**
   - Error: Request timeout after 10 seconds
   - Handling: Show "Analysis taking longer than expected"
   - Fallback: Retry once, then fail gracefully

4. **Invalid Response** (Parsing error)
   - Error: JSON parse failure
   - Handling: Log error, show generic message
   - Fallback: Display raw text if semi-useful

5. **Context Length Exceeded**
   - Error: 413 Request too large
   - Handling: Reduce data payload (fewer tickers, less history)
   - Fallback: Split into multiple requests

**Reliability Targets**:
- Uptime: 99%+ (dependent on Claude API SLA)
- Latency: <3 seconds for single analysis
- Cache hit rate: >70%
- Error rate: <5%

### D. Data Privacy & Security

**Good News**: All data is public market data
- No PII (Personally Identifiable Information)
- No trading account credentials
- No trade execution data
- Just tickers, prices, volumes, indicators

**Security Practices**:
- API keys in `.env` (never commit)
- HTTPS only (wss:// for WebSocket)
- No logging of API keys
- Rate limiting prevents abuse

**Compliance**: No regulatory concerns (data is public, no MNPI)

---

## 5. Risk Assessment & Mitigation

### Technical Risks

**Risk 1: API Downtime**
- **Probability**: Low (Claude API has 99.9% uptime)
- **Impact**: Medium (trader can still use base app)
- **Mitigation**:
  - Cache recent analyses
  - Graceful degradation (hide AI features when unavailable)
  - Monitor Claude status page

**Risk 2: Cost Overrun**
- **Probability**: Medium (if not properly rate-limited)
- **Impact**: Low (worst case $100-200/month)
- **Mitigation**:
  - Hard rate limits at code level
  - Daily spending dashboard
  - Alert at $50/month threshold
  - Kill switch in settings

**Risk 3: Response Quality Degradation**
- **Probability**: Low-Medium (LLMs can hallucinate)
- **Impact**: High (bad trade recommendation)
- **Mitigation**:
  - Clear disclaimers ("AI is a tool, not financial advice")
  - Structured output format (forces consistency)
  - Few-shot examples in prompts
  - User feedback mechanism ("Was this helpful?")

### Trading Risks

**Risk 4: Over-Reliance on AI**
- **Probability**: Medium (traders may defer to AI)
- **Impact**: High (reduces trader's skill development)
- **Mitigation**:
  - Position as "second opinion" not "primary signal"
  - UI copy: "AI Advisor" not "AI Decision Maker"
  - Require trader to click button (not automatic)
  - Show AI reasoning so trader learns

**Risk 5: Misaligned Incentives**
- **Probability**: Low (AI has no stake in outcome)
- **Impact**: Medium (could encourage overtrading)
- **Mitigation**:
  - Prompt engineering: "Be conservative, prioritize risk management"
  - Include "no trade" as valid recommendation
  - Track AI win rate alongside trader's actual results

**Risk 6: Confirmation Bias**
- **Probability**: High (traders seek AI confirmation)
- **Impact**: Medium (reinforces existing biases)
- **Mitigation**:
  - Always show bearish case even for bullish setups
  - Encourage using AI to challenge assumptions
  - A/B test "devil's advocate" prompt variant

### Business Risks

**Risk 7: ROI Doesn't Materialize**
- **Probability**: Low-Medium (depends on trader skill level)
- **Impact**: Low (only $10-50/month wasted)
- **Mitigation**:
  - Start with MVP (Phase 1 only)
  - Track actual usage and qualitative feedback
  - Kill feature if unused after 4 weeks

**Risk 8: Regulatory Concerns**
- **Probability**: Very Low (not providing investment advice)
- **Impact**: High (legal issues)
- **Mitigation**:
  - Clear disclaimers on every AI output
  - "For educational purposes only"
  - "Not financial advice, consult licensed advisor"
  - User must acknowledge disclaimer before enabling

---

## 6. Success Metrics & KPIs

### Phase 1 (MVP) Success Criteria

**Usage Metrics** (Track in IndexedDB):
- AI button clicks per day: Target >5
- Modal open duration: Target >15 seconds (reading analysis)
- Cache hit rate: Target >70%
- Error rate: Target <5%

**Cost Metrics**:
- Daily API spend: Target <$1/day
- Cost per analysis: Target <$0.02
- Monthly total: Target <$20

**Qualitative Feedback** (In-app survey):
- "Was this analysis helpful?" → Target >80% yes
- "Would you pay $10/month for this?" → Target >50% yes
- Net Promoter Score: Target >30

**Trading Outcomes** (Self-reported):
- "Did AI help you avoid a bad trade?" → Track count
- "Did AI improve your entry?" → Track count
- Estimated $ value: Target >$500/month

### Phase 2-4 Success Criteria

**Engagement**:
- Active users (clicked AI button in last week): >80%
- Daily active usage: >10 interactions
- Feature retention (still using after 30 days): >70%

**Performance**:
- Watchlist prioritization accuracy: User ranks match AI ranks >60%
- MA proximity alert quality: >75% helpful
- Market regime accuracy: Correlates with QQQ volatility >0.7

### Long-Term North Star Metrics

**6-Month Goals**:
- Monthly cost: <$50
- Estimated monthly benefit: >$2,000 (40x ROI)
- Active daily users: >90%
- User satisfaction: >4.5/5 stars
- Feature request pipeline: >10 ideas from users

---

## 7. Competitive Landscape

### Existing AI Trading Tools

**Trade Ideas** ($99-229/month):
- AI-powered stock screener
- Real-time pattern recognition
- Focus: Broad market scanning
- **Differentiation**: We integrate with existing workflow, lower cost

**TrendSpider** ($39-99/month):
- Automated technical analysis
- Multi-timeframe analysis
- Focus: Charting and indicators
- **Differentiation**: We provide narrative analysis, not just charts

**Accuvest AI** ($49/month):
- Portfolio recommendations
- Swing trading signals
- Focus: Multi-day holdings
- **Differentiation**: We focus on intraday, high-frequency decisions

**Our Advantage**:
1. **Context-Aware**: AI sees same data trader sees (ORB, VRS, RVol)
2. **Integrated**: Built into existing workflow, not separate app
3. **Educational**: Explains reasoning, helps trader learn
4. **Cost-Effective**: $10-50/month vs $50-200/month competitors
5. **Customizable**: Can tune prompts to trader's strategy preferences

---

## 8. Technical Implementation Guide

### Phase 1 MVP: Step-by-Step

#### Step 1: Environment Setup
```bash
# Add to apps/strategywatch/.env
VITE_ANTHROPIC_API_KEY=sk-ant-api...your-key-here
VITE_LLM_ENABLED=true
VITE_LLM_MODEL=claude-3-5-sonnet-20241022
VITE_LLM_MAX_DAILY_COST=2.00  # $2/day hard limit
```

#### Step 2: Install Dependencies
```bash
cd apps/strategywatch
npm install @anthropic-ai/sdk
```

#### Step 3: Create LLM Service Module

**File**: `src/services/llmAdvisor.js`

```javascript
import Anthropic from '@anthropic-ai/sdk';
import { getCached, setCached } from './llmCache';
import { checkRateLimit, incrementUsage } from './rateLimiter';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true // Only for demo; use backend in production
});

export async function analyzeSetup(setupData, options = {}) {
  // 1. Check if feature enabled
  if (!import.meta.env.VITE_LLM_ENABLED) {
    throw new Error('LLM features not enabled');
  }

  // 2. Check rate limit
  if (!checkRateLimit('setupAnalysis')) {
    throw new Error('Rate limit exceeded. Try again later.');
  }

  // 3. Check cache (5-minute TTL)
  const cacheKey = `setup_${setupData.symbol}_${Math.floor(Date.now() / 300000)}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log('Cache hit:', cacheKey);
    return cached;
  }

  // 4. Build prompt
  const prompt = buildSetupAnalysisPrompt(setupData);

  // 5. Call API
  try {
    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model: import.meta.env.VITE_LLM_MODEL,
      max_tokens: 500,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const latency = Date.now() - startTime;
    console.log(`LLM response in ${latency}ms`);

    // 6. Parse response
    const analysis = parseAnalysisResponse(response.content[0].text);

    // 7. Track usage
    incrementUsage('setupAnalysis', {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cost: calculateCost(response.usage),
      latency
    });

    // 8. Cache result
    setCached(cacheKey, analysis, 300); // 5 min TTL

    return analysis;
  } catch (error) {
    console.error('LLM API error:', error);
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

function buildSetupAnalysisPrompt(data) {
  return `You are an expert day trader analyzing intraday setups. Provide structured analysis in JSON format.

SETUP DATA:
Symbol: ${data.symbol}
Current Price: $${data.currentPrice}
Time: ${new Date(data.timestamp).toLocaleTimeString()}

ORB Signal:
- Tier: ${data.orb5m.tier}
- Direction: ${data.orb5m.direction}
- Candle: O${data.orb5m.candle.open} H${data.orb5m.candle.high} L${data.orb5m.candle.low} C${data.orb5m.candle.close}
- RVol: ${data.orb5m.rvol.toFixed(2)}x

Momentum:
- VRS 1m: ${(data.vrs.vrs1m * 100).toFixed(1)}% vs QQQ
- VRS 5m: ${(data.vrs.vrs5m * 100).toFixed(1)}% vs QQQ
- Today's Change: ${data.todayChangePercent}

Technical Position:
- 5D SMA: $${data.movingAverages.sma5} (${data.priceDistanceFromMAs.sma5})
- 10D EMA: $${data.movingAverages.ema10} (${data.priceDistanceFromMAs.ema10})
- 21D EMA: $${data.movingAverages.ema21} (${data.priceDistanceFromMAs.ema21})
- 50D SMA: $${data.movingAverages.sma50} (${data.priceDistanceFromMAs.sma50})
- Nearest MA: ${data.maProximity.nearestMA} at ${data.maProximity.distance}

Volatility:
- ADR (20-day): ${data.adr20.toFixed(2)}%
- Today's Range: $${data.todayRange.rangeDollars} (${(data.todayRange.rangeAsADR * 100).toFixed(0)}% of ADR)

Market Context:
- QQQ: ${data.benchmarkData.changePercent}
- Minutes Since Open: ${data.minutesSinceOpen}

RESPOND IN JSON FORMAT:
{
  "score": <number 0-10>,
  "bias": "<bullish|bearish|neutral>",
  "quality": "<high|medium|low>",
  "keyPoints": ["<point 1>", "<point 2>", "<point 3>"],
  "risks": ["<risk 1>", "<risk 2>"],
  "tradePlan": {
    "entry": "<price range>",
    "stop": "<price>",
    "target": "<price>",
    "riskReward": "<ratio>",
    "positionSize": "<guidance>"
  },
  "reasoning": "<1-2 sentence summary>"
}`;
}

function parseAnalysisResponse(text) {
  try {
    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    // Fallback: return structured error
    return {
      score: 5,
      bias: 'neutral',
      quality: 'unknown',
      keyPoints: ['Analysis parsing failed'],
      risks: ['Unable to parse AI response'],
      tradePlan: null,
      reasoning: text.substring(0, 200)
    };
  }
}

function calculateCost(usage) {
  const INPUT_COST = 3.00 / 1_000_000;  // $3 per 1M tokens
  const OUTPUT_COST = 15.00 / 1_000_000; // $15 per 1M tokens
  return (usage.input_tokens * INPUT_COST) + (usage.output_tokens * OUTPUT_COST);
}
```

#### Step 4: Create Cache Module

**File**: `src/services/llmCache.js`

```javascript
const CACHE_DB_NAME = 'strategywatch_llm_cache';
const CACHE_STORE_NAME = 'analyses';
const CACHE_VERSION = 1;

let db = null;

export async function initCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        const store = db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

export function getCached(key) {
  if (!db) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
    const store = tx.objectStore(CACHE_STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const record = request.result;
      if (!record) {
        resolve(null);
        return;
      }

      // Check if expired
      if (Date.now() > record.expiresAt) {
        resolve(null);
        return;
      }

      resolve(record.data);
    };

    request.onerror = () => resolve(null);
  });
}

export function setCached(key, data, ttlSeconds) {
  if (!db) return;

  const record = {
    key,
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + (ttlSeconds * 1000)
  };

  const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(CACHE_STORE_NAME);
  store.put(record);
}

export async function clearExpiredCache() {
  if (!db) return;

  const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(CACHE_STORE_NAME);
  const index = store.index('timestamp');
  const request = index.openCursor();

  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      if (Date.now() > cursor.value.expiresAt) {
        cursor.delete();
      }
      cursor.continue();
    }
  };
}

// Auto-cleanup every 5 minutes
setInterval(clearExpiredCache, 5 * 60 * 1000);
```

#### Step 5: Create Rate Limiter

**File**: `src/services/rateLimiter.js`

```javascript
const RATE_LIMITS = {
  setupAnalysis: { perHour: 60, perDay: 200 },
  watchlistPrioritization: { perHour: 10, perDay: 30 },
  marketRegime: { perHour: 12, perDay: 50 }
};

const DAILY_COST_LIMIT = parseFloat(import.meta.env.VITE_LLM_MAX_DAILY_COST) || 2.00;

let usageData = {
  setupAnalysis: { hour: [], day: [], totalCost: 0 },
  watchlistPrioritization: { hour: [], day: [], totalCost: 0 },
  marketRegime: { hour: [], day: [], totalCost: 0 }
};

export function checkRateLimit(type) {
  const now = Date.now();
  const usage = usageData[type];
  if (!usage) return false;

  // Clean old entries
  usage.hour = usage.hour.filter(t => now - t < 3600000); // 1 hour
  usage.day = usage.day.filter(t => now - t < 86400000); // 24 hours

  // Check limits
  const limits = RATE_LIMITS[type];
  if (usage.hour.length >= limits.perHour) return false;
  if (usage.day.length >= limits.perDay) return false;

  // Check daily cost limit
  const totalDailyCost = Object.values(usageData).reduce((sum, u) => sum + u.totalCost, 0);
  if (totalDailyCost >= DAILY_COST_LIMIT) return false;

  return true;
}

export function incrementUsage(type, metadata) {
  const now = Date.now();
  const usage = usageData[type];

  usage.hour.push(now);
  usage.day.push(now);
  usage.totalCost += metadata.cost;

  // Store in localStorage for persistence
  localStorage.setItem('llm_usage', JSON.stringify(usageData));

  console.log(`LLM Usage: ${type}`, {
    hourly: usage.hour.length,
    daily: usage.day.length,
    cost: metadata.cost.toFixed(4),
    totalCost: usage.totalCost.toFixed(2)
  });
}

export function getUsageStats() {
  return {
    ...usageData,
    dailyCostLimit: DAILY_COST_LIMIT,
    remainingBudget: DAILY_COST_LIMIT - Object.values(usageData).reduce((sum, u) => sum + u.totalCost, 0)
  };
}

// Reset daily counters at market close (4:30 PM ET)
function scheduleReset() {
  const now = new Date();
  const resetTime = new Date(now);
  resetTime.setHours(16, 30, 0, 0); // 4:30 PM

  if (now > resetTime) {
    resetTime.setDate(resetTime.getDate() + 1);
  }

  const msUntilReset = resetTime - now;
  setTimeout(() => {
    Object.keys(usageData).forEach(key => {
      usageData[key].day = [];
      usageData[key].totalCost = 0;
    });
    localStorage.setItem('llm_usage', JSON.stringify(usageData));
    scheduleReset(); // Schedule next reset
  }, msUntilReset);
}

// Initialize from localStorage
try {
  const stored = localStorage.getItem('llm_usage');
  if (stored) {
    usageData = JSON.parse(stored);
  }
} catch (error) {
  console.warn('Failed to load LLM usage data:', error);
}

scheduleReset();
```

#### Step 6: Create UI Components

**File**: `src/components/AIAnalysisButton.jsx`

```javascript
import React, { useState } from 'react';
import { analyzeSetup } from '../services/llmAdvisor';
import AIAnalysisModal from './AIAnalysisModal';

export default function AIAnalysisButton({ setupData, disabled }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const result = await analyzeSetup(setupData);
      setAnalysis(result);
      setShowModal(true);
    } catch (err) {
      setError(err.message);
      alert(`AI Analysis Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (!import.meta.env.VITE_LLM_ENABLED) {
    return null;
  }

  return (
    <>
      <button
        className="ai-analysis-button"
        onClick={handleClick}
        disabled={disabled || loading}
        title="Get AI analysis of this setup"
      >
        {loading ? '⏳' : '🤖'}
      </button>

      {showModal && analysis && (
        <AIAnalysisModal
          analysis={analysis}
          setupData={setupData}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
```

**File**: `src/components/AIAnalysisModal.jsx`

```javascript
import React from 'react';
import './AIAnalysisModal.css';

export default function AIAnalysisModal({ analysis, setupData, onClose }) {
  const { score, bias, quality, keyPoints, risks, tradePlan, reasoning } = analysis;

  // Score color coding
  const scoreColor = score >= 7.5 ? '#00ff00' : score >= 5.5 ? '#ffaa00' : '#ff0000';

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <h3>🤖 AI Analysis: {setupData.symbol}</h3>
          <button className="ai-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="ai-modal-body">
          {/* Score */}
          <div className="ai-score-section">
            <div className="ai-score" style={{ color: scoreColor }}>
              {score.toFixed(1)}/10
            </div>
            <div className="ai-bias">
              {bias.toUpperCase()} • {quality.toUpperCase()} QUALITY
            </div>
          </div>

          {/* Key Points */}
          <div className="ai-section">
            <h4>✓ Key Strengths</h4>
            <ul>
              {keyPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>

          {/* Risks */}
          <div className="ai-section">
            <h4>⚠ Key Risks</h4>
            <ul>
              {risks.map((risk, i) => (
                <li key={i}>{risk}</li>
              ))}
            </ul>
          </div>

          {/* Trade Plan */}
          {tradePlan && (
            <div className="ai-section ai-trade-plan">
              <h4>📋 Suggested Trade Plan</h4>
              <div className="trade-plan-grid">
                <div><strong>Entry:</strong> {tradePlan.entry}</div>
                <div><strong>Stop:</strong> {tradePlan.stop}</div>
                <div><strong>Target:</strong> {tradePlan.target}</div>
                <div><strong>R/R:</strong> {tradePlan.riskReward}</div>
                <div className="trade-plan-size">
                  <strong>Position Size:</strong> {tradePlan.positionSize}
                </div>
              </div>
            </div>
          )}

          {/* Reasoning */}
          <div className="ai-section ai-reasoning">
            <p><em>{reasoning}</em></p>
          </div>

          {/* Disclaimer */}
          <div className="ai-disclaimer">
            ⚠ AI analysis is for educational purposes only. Not financial advice.
          </div>

          {/* Timestamp */}
          <div className="ai-timestamp">
            Generated at {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### Step 7: Integrate into TickerRow

**File**: `src/components/TickerRow.jsx` (add to ORB column)

```javascript
import AIAnalysisButton from './AIAnalysisButton';

// Inside ORB column rendering:
<td className={`orb5m-cell ${orbClass}`}>
  {orbIcon}
  {(orb5m?.tier === 1 || orb5m?.tier === 2) && (
    <AIAnalysisButton
      setupData={{
        symbol: tickerData.symbol,
        currentPrice: tickerData.currentPrice,
        timestamp: Date.now(),
        orb5m: tickerData.orb5m,
        vrs: tickerData.vrs,
        movingAverages: tickerData.movingAverages,
        priceDistanceFromMAs: tickerData.priceDistanceFromMAs,
        maProximity: tickerData.maProximity,
        adr20: tickerData.adr20,
        todayRange: tickerData.todayRange,
        rvol: tickerData.rvol,
        todayChangePercent: tickerData.todayChangePercent,
        minutesSinceOpen: tickerData.minutesSinceOpen,
        benchmarkData: tickerData.benchmarkData
      }}
    />
  )}
</td>
```

#### Step 8: Add CSS Styling

**File**: `src/components/AIAnalysisModal.css`

```css
.ai-analysis-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  margin-left: 4px;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.ai-analysis-button:hover {
  opacity: 1;
  transform: scale(1.1);
}

.ai-analysis-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ai-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.ai-modal {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.ai-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #333;
}

.ai-modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #fff;
}

.ai-modal-close {
  background: none;
  border: none;
  color: #999;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
}

.ai-modal-close:hover {
  color: #fff;
}

.ai-modal-body {
  padding: 20px;
}

.ai-score-section {
  text-align: center;
  padding: 20px;
  border-bottom: 1px solid #333;
  margin-bottom: 20px;
}

.ai-score {
  font-size: 48px;
  font-weight: bold;
  margin-bottom: 8px;
}

.ai-bias {
  font-size: 14px;
  color: #999;
  letter-spacing: 1px;
}

.ai-section {
  margin-bottom: 20px;
}

.ai-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.ai-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.ai-section li {
  padding: 8px 12px;
  background: #222;
  border-left: 3px solid #444;
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 1.5;
}

.ai-trade-plan {
  background: #1a2a1a;
  border: 1px solid #2a4a2a;
  padding: 16px;
  border-radius: 4px;
}

.trade-plan-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  font-size: 14px;
}

.trade-plan-size {
  grid-column: 1 / -1;
}

.ai-reasoning {
  background: #2a2a2a;
  padding: 16px;
  border-radius: 4px;
  border-left: 3px solid #666;
}

.ai-reasoning p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #ccc;
  font-style: italic;
}

.ai-disclaimer {
  margin-top: 20px;
  padding: 12px;
  background: #3a2a2a;
  border: 1px solid #5a3a3a;
  border-radius: 4px;
  font-size: 12px;
  color: #ff9999;
  text-align: center;
}

.ai-timestamp {
  margin-top: 12px;
  text-align: center;
  font-size: 11px;
  color: #666;
}
```

---

## 9. Deployment & Monitoring

### Deployment Checklist

- [ ] Add `VITE_ANTHROPIC_API_KEY` to hosting platform env vars
- [ ] Set `VITE_LLM_ENABLED=true`
- [ ] Set `VITE_LLM_MAX_DAILY_COST=2.00`
- [ ] Test API key validity
- [ ] Verify rate limits working
- [ ] Test cache functionality
- [ ] Confirm graceful error handling
- [ ] Add usage monitoring dashboard

### Monitoring Dashboard

Create simple dashboard in Settings panel:

```javascript
// src/components/LLMUsageDashboard.jsx
import { getUsageStats } from '../services/rateLimiter';

export default function LLMUsageDashboard() {
  const stats = getUsageStats();

  return (
    <div className="llm-usage-dashboard">
      <h3>AI Advisor Usage Today</h3>

      <div className="usage-stat">
        <label>Setup Analyses:</label>
        <span>{stats.setupAnalysis.day.length} / 200</span>
      </div>

      <div className="usage-stat">
        <label>Watchlist Prioritizations:</label>
        <span>{stats.watchlistPrioritization.day.length} / 30</span>
      </div>

      <div className="usage-stat">
        <label>Market Regime Analyses:</label>
        <span>{stats.marketRegime.day.length} / 50</span>
      </div>

      <div className="usage-stat cost">
        <label>Daily Cost:</label>
        <span>${stats.totalCost.toFixed(2)} / ${stats.dailyCostLimit.toFixed(2)}</span>
      </div>

      <div className="usage-progress">
        <div
          className="usage-bar"
          style={{
            width: `${(stats.totalCost / stats.dailyCostLimit) * 100}%`,
            background: stats.remainingBudget < 0.50 ? '#ff0000' : '#00ff00'
          }}
        />
      </div>

      {stats.remainingBudget < 0.50 && (
        <div className="usage-warning">
          ⚠ Approaching daily cost limit. AI features may be disabled soon.
        </div>
      )}
    </div>
  );
}
```

### A/B Testing Framework

Track effectiveness of different prompts:

```javascript
// src/prompts/variants.js
export const PROMPT_VARIANTS = {
  setupAnalysis: {
    v1: 'default', // Conservative, risk-focused
    v2: 'aggressive', // More bullish/bearish conviction
    v3: 'educational' // More teaching, less recommendation
  }
};

// Randomly assign variant per user
const userVariant = localStorage.getItem('prompt_variant') ||
  Object.keys(PROMPT_VARIANTS.setupAnalysis)[
    Math.floor(Math.random() * 3)
  ];

localStorage.setItem('prompt_variant', userVariant);
```

Track feedback by variant to optimize prompts over time.

---

## 10. Conclusion & Recommendation

### Final Assessment

✅ **STRONG RECOMMENDATION TO PROCEED**

**Why This Makes Sense**:

1. **Exceptional ROI**: 40-140x return if AI improves just 1-2 trades per week
2. **Low Risk**: Only $5-50/month, easily reversible if ineffective
3. **Natural Fit**: Your app already has rich data and clear decision points
4. **Competitive Moat**: Integrated AI advisor is unique vs standalone tools
5. **Learning Accelerator**: Helps traders improve faster through explanations

**Key Success Factors**:
- Start with MVP (Phase 1 only)
- Aggressive caching and rate limiting
- Clear disclaimers and positioning as "second opinion"
- Track actual usage and qualitative feedback
- Kill feature if unused after 30 days

### Next Steps

**Week 1-2**:
1. Set up Anthropic API account
2. Implement Phase 1 MVP (ORB analysis button)
3. Test with 5-10 ORB signals
4. Gather initial feedback

**Week 3-4**:
5. Iterate based on feedback
6. Optimize prompts for quality
7. Add usage monitoring dashboard
8. Consider Phase 2 (watchlist prioritization)

**Month 2+**:
9. Roll out Phases 3-4 if MVP successful
10. A/B test prompt variants
11. Consider monetization ($10/month premium tier)
12. Expand to additional LLM use cases

### Open Questions

1. **Backend vs Frontend API calls?**
   - MVP: Frontend (faster to build)
   - Production: Backend (more secure, no API key exposure)

2. **Which LLM provider?**
   - Recommended: Claude 3.5 Sonnet (best reasoning)
   - Alternative: GPT-4o (slightly cheaper)
   - Budget: GPT-4o-mini (10x cheaper, 80% quality)

3. **Monetization strategy?**
   - Free tier: 10 analyses/day
   - Premium tier: $10/month for unlimited
   - Pro tier: $25/month with priority support + custom prompts

---

## Appendix: Prompt Engineering Best Practices

### Effective Prompts for Trading Analysis

**Do's**:
- ✅ Provide structured data (JSON format)
- ✅ Request structured output (JSON format)
- ✅ Include few-shot examples
- ✅ Set clear constraints (max 500 tokens)
- ✅ Use low temperature (0.2-0.4) for consistency
- ✅ Ground analysis in provided data points
- ✅ Ask for reasoning/explanation
- ✅ Include risk assessment requirements

**Don'ts**:
- ❌ Ask for price predictions ("will it go up?")
- ❌ Allow open-ended rambling (no token limit)
- ❌ Omit critical data points (missing context)
- ❌ Use high temperature (>0.7) - too creative
- ❌ Allow hallucinated data ("assume typical volume...")
- ❌ Skip risk assessment (only show upside)
- ❌ Forget disclaimers (legal liability)

### Example: Well-Crafted Prompt

```
You are an expert day trader analyzing intraday setups. You prioritize risk management and only recommend high-probability setups.

SETUP DATA:
{structured JSON here}

GUIDELINES:
1. Score setup quality 0-10 (be honest, 5 = neutral, 7+ = good, 9+ = exceptional)
2. Identify 2-3 key strengths that make this setup notable
3. Identify 1-2 key risks or red flags (always include risks)
4. If score >= 6, provide specific trade plan (entry/stop/target)
5. If score < 6, explain why to avoid this trade
6. Keep reasoning concise (1-2 sentences)

RESPOND IN JSON FORMAT:
{schema here}

CRITICAL: Base all analysis on provided data. Do not speculate about news, earnings, or events not mentioned. If data is insufficient, state "insufficient data" rather than guessing.
```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-13
**Author**: Strategic Analysis Team
**Status**: Ready for Implementation

---

*This proposal is based on current market conditions, API pricing, and software architecture as of November 2025. Actual results may vary based on implementation quality, user behavior, and market conditions.*
