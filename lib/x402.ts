/**
 * x402 Integration Module (V2)
 * 
 * Re-exports from x402-v2.ts for backward compatibility.
 * This file maintains the existing API while using V2 under the hood.
 */

// Re-export everything from V2
export {
  createAgentX402Client,
  createBrowserX402Client,
  getX402Network,
  getX402PaymentAddress,
  getX402PaymentConfig,
  getX402ChainId,
  X402_USDC_ADDRESS,
  type X402PaymentConfig,
} from "./x402-v2";

// Re-export approval utilities
export {
  checkApprovalStatus,
  requestApproval,
  revokeApproval,
  hasSufficientApproval,
  createPaymentSession,
  SPENDING_LIMIT_TIERS,
  getRecommendedSpendingLimit,
  type ApprovalStatus,
  type SpendingLimitTier,
  type PaymentSession,
} from "./x402-approval";

import type { TradeIntent, X402PaymentRequest } from "./types";
import { getX402PaymentConfig as getConfig } from "./x402-v2";

/**
 * Create payment request metadata (for tracking purposes)
 * @deprecated Use getX402PaymentConfig instead for V2
 */
export function createX402PaymentRequest(
  intent: TradeIntent
): X402PaymentRequest {
  const config = getConfig(intent);

  // Generate a payment request ID for tracking
  const paymentRequestId = `x402_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    paymentRequestId,
    amount: intent.expectedPaymentAmount,
    currency: "USD", // USDC is USD-pegged
    metadata: config.metadata || {},
  };
}

/**
 * Get payment address
 * @deprecated Use getX402PaymentAddress from x402-v2 instead
 */
export function getPaymentAddress(): `0x${string}` {
  const { getX402PaymentAddress } = require("./x402-v2");
  return getX402PaymentAddress();
}

/**
 * Get network
 * @deprecated Use getX402Network from x402-v2 instead
 */
export function getNetwork(): string {
  const { getX402Network } = require("./x402-v2");
  return getX402Network();
}

// Note: facilitatorConfig is no longer exported as V2 handles facilitator configuration differently
// through the x402Server and registerExactEvmScheme functions
