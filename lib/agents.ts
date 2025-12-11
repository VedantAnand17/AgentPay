// Trading agent strategies for AgentPay Relay
import { AgentContext, AgentSuggestion, Agent } from "./types";

// Available agents
export const AGENTS: Agent[] = [
  {
    id: "trend-follower",
    name: "Trend Follower",
    description: "Follows momentum and trends in the market",
  },
  {
    id: "breakout-sniper",
    name: "Breakout Sniper",
    description: "Captures breakouts from consolidation patterns",
  },
  {
    id: "mean-reversion",
    name: "Mean Reversion",
    description: "Trades against extremes, betting on price returning to average",
  },
];

// Helper to clamp values within bounds
const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

// Helper to generate deterministic "price" based on symbol and time
// In production, this would fetch real market data
const getMockPrice = (symbol: string): number => {
  const seed = symbol.charCodeAt(0) + symbol.charCodeAt(1) + symbol.charCodeAt(2) || 0;
  const base = 30000 + (seed % 10000);
  const variation = Math.sin(Date.now() / 100000) * 1000;
  return base + variation;
};

// Helper to get mock price history for trend calculation
const getMockPriceHistory = (symbol: string, periods: number = 10): number[] => {
  const prices: number[] = [];
  for (let i = 0; i < periods; i++) {
    const seed = symbol.charCodeAt(0) + symbol.charCodeAt(1) + (i * 100);
    const base = 30000 + (seed % 10000);
    prices.push(base + Math.sin((Date.now() + i * 1000) / 100000) * 1000);
  }
  return prices;
};

/**
 * Trend Follower Agent
 * Analyzes price momentum and suggests trades in the direction of the trend
 */
export const trendFollowerAgent: (ctx: AgentContext) => AgentSuggestion = (ctx) => {
  const prices = getMockPriceHistory(ctx.symbol, 10);
  const recent = prices.slice(-5);
  const older = prices.slice(0, 5);
  
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  
  const trendStrength = (recentAvg - olderAvg) / olderAvg;
  const isUptrend = trendStrength > 0.01; // 1% threshold
  const isDowntrend = trendStrength < -0.01;
  
  // Leverage not used for spot trades, set to 1
  const leverage = 1;
  const size = clamp(0.01 + Math.abs(trendStrength) * 0.1, 0.01, 0.05);
  
  const side: "buy" | "sell" = isUptrend ? "buy" : isDowntrend ? "sell" : "buy";
  const reason = isUptrend
    ? `Strong uptrend detected (${(trendStrength * 100).toFixed(2)}% momentum). Following the trend.`
    : isDowntrend
    ? `Strong downtrend detected (${(trendStrength * 100).toFixed(2)}% momentum). Following the trend.`
    : `Neutral trend, defaulting to buy position.`;
  
  return {
    symbol: ctx.symbol,
    side,
    size: Math.round(size * 100) / 100, // Round to 2 decimals
    leverage,
    reason,
  };
};

/**
 * Breakout Sniper Agent
 * Detects consolidation patterns and suggests trades on breakouts
 */
export const breakoutSniperAgent: (ctx: AgentContext) => AgentSuggestion = (ctx) => {
  const prices = getMockPriceHistory(ctx.symbol, 20);
  const recent = prices.slice(-10);
  
  const high = Math.max(...recent);
  const low = Math.min(...recent);
  const range = high - low;
  const avgPrice = recent.reduce((a, b) => a + b, 0) / recent.length;
  
  // Consolidation detected if range is small relative to price
  const consolidationRatio = range / avgPrice;
  const isConsolidating = consolidationRatio < 0.02; // Less than 2% range
  
  const currentPrice = prices[prices.length - 1];
  const isNearHigh = (currentPrice - low) / range > 0.7;
  const isNearLow = (high - currentPrice) / range > 0.7;
  
  // Breakout potential: if consolidating and near edge, expect breakout
  let side: "buy" | "sell" = "buy";
  let reason = "";
  
  if (isConsolidating) {
    if (isNearHigh) {
      side = "buy";
      reason = `Consolidation pattern detected near upper bound. Expecting bullish breakout.`;
    } else if (isNearLow) {
      side = "sell";
      reason = `Consolidation pattern detected near lower bound. Expecting bearish breakdown.`;
    } else {
      side = "buy";
      reason = `Consolidation detected, defaulting to buy breakout expectation.`;
    }
  } else {
    // Already breaking out
    const momentum = (currentPrice - avgPrice) / avgPrice;
    side = momentum > 0 ? "buy" : "sell";
    reason = `Breakout in progress. ${side === "buy" ? "Bullish" : "Bearish"} momentum detected.`;
  }
  
  // Leverage not used for spot trades, set to 1
  const leverage = 1;
  const size = clamp(0.02 + Math.random() * 0.02, 0.01, 0.05);
  
  return {
    symbol: ctx.symbol,
    side,
    size: Math.round(size * 100) / 100,
    leverage,
    reason,
  };
};

/**
 * Mean Reversion Agent
 * Trades against extremes, expecting price to revert to mean
 */
export const meanReversionAgent: (ctx: AgentContext) => AgentSuggestion = (ctx) => {
  const prices = getMockPriceHistory(ctx.symbol, 15);
  const recent = prices.slice(-5);
  const historical = prices.slice(0, 10);
  
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const historicalAvg = historical.reduce((a, b) => a + b, 0) / historical.length;
  const currentPrice = prices[prices.length - 1];
  
  // Calculate deviation from mean
  const deviation = (currentPrice - historicalAvg) / historicalAvg;
  const isOverbought = deviation > 0.03; // 3% above mean
  const isOversold = deviation < -0.03; // 3% below mean
  
  let side: "buy" | "sell" = "buy";
  let reason = "";
  
  if (isOverbought) {
    side = "sell";
    reason = `Price ${(deviation * 100).toFixed(2)}% above mean. Expecting reversion to average.`;
  } else if (isOversold) {
    side = "buy";
    reason = `Price ${(Math.abs(deviation) * 100).toFixed(2)}% below mean. Expecting reversion to average.`;
  } else {
    side = "buy";
    reason = `Price near mean. Defaulting to buy position.`;
  }
  
  // Leverage not used for spot trades, set to 1
  const leverage = 1;
  const size = clamp(0.015 + Math.abs(deviation) * 0.05, 0.01, 0.05);
  
  return {
    symbol: ctx.symbol,
    side,
    size: Math.round(size * 100) / 100,
    leverage,
    reason,
  };
};

/**
 * Get agent by ID
 */
export const getAgentById = (agentId: string): Agent | undefined => {
  return AGENTS.find((a) => a.id === agentId);
};

/**
 * Execute agent strategy
 */
export const executeAgent = (agentId: string, ctx: AgentContext): AgentSuggestion => {
  switch (agentId) {
    case "trend-follower":
      return trendFollowerAgent(ctx);
    case "breakout-sniper":
      return breakoutSniperAgent(ctx);
    case "mean-reversion":
      return meanReversionAgent(ctx);
    default:
      throw new Error(`Unknown agent: ${agentId}`);
  }
};

