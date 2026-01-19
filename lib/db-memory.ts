// In-memory database store for serverless environments (Vercel)
// This provides the same interface as the SQLite database but stores data in memory
// Note: Data is ephemeral and will be lost on cold starts

import { TradeIntent, ExecutedTrade } from "./types";

// In-memory stores
const tradeIntentsStore = new Map<string, TradeIntent>();
const executedTradesStore = new Map<string, ExecutedTrade & { tradeIntent?: TradeIntent }>();

// Trade Intent operations (memory-based)
export const memoryTradeIntents = {
  create: (intent: TradeIntent): void => {
    tradeIntentsStore.set(intent.id, { ...intent });
  },

  getById: (id: string): TradeIntent | null => {
    const intent = tradeIntentsStore.get(id);
    return intent ? { ...intent } : null;
  },

  updateStatus: (id: string, status: "pending" | "paid" | "executed", paymentRequestId?: string): void => {
    const intent = tradeIntentsStore.get(id);
    if (intent) {
      intent.status = status;
      if (paymentRequestId) {
        intent.paymentRequestId = paymentRequestId;
      }
      tradeIntentsStore.set(id, intent);
    }
  },
};

// Executed Trade operations (memory-based)
export const memoryExecutedTrades = {
  create: (trade: ExecutedTrade): void => {
    const tradeIntent = tradeIntentsStore.get(trade.tradeIntentId);
    executedTradesStore.set(trade.id, { 
      ...trade, 
      tradeIntent: tradeIntent ? { ...tradeIntent } : undefined 
    });
  },

  getAll: (limit: number = 50): Array<ExecutedTrade & { tradeIntent?: TradeIntent }> => {
    const trades = Array.from(executedTradesStore.values());
    
    // Sort by timestamp descending and limit
    return trades
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(trade => ({ ...trade }));
  },
};

// Utility to check store sizes (for debugging)
export const memoryStats = {
  getStats: () => ({
    tradeIntents: tradeIntentsStore.size,
    executedTrades: executedTradesStore.size,
  }),
};
