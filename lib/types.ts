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
  side: "long" | "short";
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
  perpTxHash: string;
  entryPrice: number;
  timestamp: number;
  status: "executed";
};

export type AgentContext = {
  symbol: string;
};

export type AgentSuggestion = {
  symbol: string;
  side: "long" | "short";
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

