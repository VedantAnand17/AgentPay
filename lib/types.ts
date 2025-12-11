// Core entity types for AgentPay Relay

export type Agent = {
  id: string;
  name: string;
  description: string;
};

export type TradeIntent = {
  id: string;
  userAddress: string;
  agentId: string;
  symbol: string;
  side: "buy" | "sell";
  size: number;
  leverage: number;
  expectedPaymentAmount: string;
  status: "pending" | "paid" | "executed";
  paymentRequestId?: string;
  createdAt: number;
};

export type ExecutedTrade = {
  id: string;
  tradeIntentId: string;
  paymentRequestId?: string;
  paymentStatus: "paid" | "failed";
  swapTxHash: string;
  executionPrice: number;
  timestamp: number;
  status: "executed";
  pnl?: {
    value: number;
    percentage: number;
    type: "realized" | "unrealized";
    isProfit: boolean;
  };
  isOpen?: boolean;
  matchedTradeId?: string; // For closed trades, the ID of the matched buy/sell trade
};

export type AgentContext = {
  symbol: string;
};

export type AgentSuggestion = {
  symbol: string;
  side: "buy" | "sell";
  size: number;
  leverage: number;
  reason: string;
};

export type X402PaymentRequest = {
  paymentRequestId: string;
  amount: string;
  currency: string;
  metadata: Record<string, any>;
  paymentUrl?: string;
};

export type X402PaymentStatus = "pending" | "paid" | "failed";

