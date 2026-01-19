// Trading agent strategies for AgentPay Relay
import { AgentContext, AgentSuggestion, Agent } from "./types";
import { CONFIGURED_AGENTS, isValidAgentId, getAgentConfig } from "./config/agents";
import { getCurrentPrice, getPriceHistory } from "./services/price-feed";

// Re-export agents from config for backward compatibility
export const AGENTS: Agent[] = CONFIGURED_AGENTS;

// Helper to clamp values within bounds
const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

// Use real price feed service (falls back to cache/estimates if on-chain fails)
// Note: These are sync wrappers that use cached prices for the agent strategies
let cachedPrices: Map<string, { price: number; history: number[]; timestamp: number }> = new Map();
const PRICE_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Get cached price synchronously (for use in agent strategies)
 * Defaults to a reasonable estimate if cache is empty
 */
const getCachedPrice = (symbol: string): number => {
  const cached = cachedPrices.get(symbol);
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.price;
  }
  // Return estimate based on symbol (will be updated by async refresh)
  const estimates: Record<string, number> = { BTC: 45000, WBTC: 45000, ETH: 3000, WETH: 3000 };
  return estimates[symbol.toUpperCase()] || 30000;
};

/**
 * Get cached price history synchronously
 */
const getCachedPriceHistory = (symbol: string, periods: number = 10): number[] => {
  const cached = cachedPrices.get(symbol);
  if (cached && cached.history.length > 0 && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.history.slice(-periods);
  }
  // Generate simulated history from cached price
  const basePrice = getCachedPrice(symbol);
  const prices: number[] = [];
  for (let i = 0; i < periods; i++) {
    const variation = (Math.random() - 0.5) * 0.04;
    prices.push(basePrice * (1 + variation));
  }
  return prices;
};

/**
 * Refresh price cache asynchronously
 * Call this before running agent strategies for best results
 */
export async function refreshPriceCache(symbol: string): Promise<void> {
  try {
    const [price, history] = await Promise.all([
      getCurrentPrice(symbol),
      getPriceHistory(symbol, 20),
    ]);
    cachedPrices.set(symbol, { price, history, timestamp: Date.now() });
  } catch (error) {
    console.warn(`Failed to refresh price cache for ${symbol}:`, error);
  }
}

/**
 * Trend Follower Agent
 * Analyzes price momentum and suggests trades in the direction of the trend
 */
export const trendFollowerAgent: (ctx: AgentContext) => AgentSuggestion = (ctx) => {
  const prices = getCachedPriceHistory(ctx.symbol, 10);
  const recent = prices.slice(-5);
  const older = prices.slice(0, 5);

  const recentAvg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a: number, b: number) => a + b, 0) / older.length;

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
  const prices = getCachedPriceHistory(ctx.symbol, 20);
  const recent = prices.slice(-10);

  const high = Math.max(...recent);
  const low = Math.min(...recent);
  const range = high - low;
  const avgPrice = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;

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
  const prices = getCachedPriceHistory(ctx.symbol, 15);
  const recent = prices.slice(-5);
  const historical = prices.slice(0, 10);

  const recentAvg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
  const historicalAvg = historical.reduce((a: number, b: number) => a + b, 0) / historical.length;
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

