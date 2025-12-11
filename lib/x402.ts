// x402 payment integration module
// Based on x402-Learn integration pattern
import { TradeIntent, X402PaymentRequest } from "./types";
import { facilitator } from "@coinbase/x402";

// x402 configuration from environment variables
const X402_PAYMENT_ADDRESS = (process.env.X402_PAYMENT_ADDRESS || process.env.ADDRESS) as `0x${string}`;
const X402_NETWORK = process.env.X402_NETWORK || "base-sepolia";
const useMainnetFacilitator = process.env.X402_ENV === "mainnet";
const facilitatorUrl = process.env.FACILITATOR_URL || "https://x402.org/facilitator";

// USDC addresses: Base Sepolia testnet vs Base mainnet
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const BASE_MAINNET_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Use appropriate USDC address based on network, or allow override via env var
const X402_ASSET_ADDRESS = process.env.X402_ASSET_ADDRESS || 
  (useMainnetFacilitator || X402_NETWORK === "base" 
    ? BASE_MAINNET_USDC 
    : BASE_SEPOLIA_USDC);

// Validate required environment variables
if (!X402_PAYMENT_ADDRESS || X402_PAYMENT_ADDRESS === "0x0000000000000000000000000000000000000000") {
  console.warn("Warning: X402_PAYMENT_ADDRESS or ADDRESS not set. x402 payments will not work.");
}

// Facilitator configuration (matches x402-Learn pattern)
export const facilitatorConfig = useMainnetFacilitator
  ? facilitator
  : {
      url: facilitatorUrl as `${string}://${string}`,
    };

/**
 * Get x402 payment configuration for a trade intent
 * 
 * Returns payment parameters in the format expected by x402 middleware
 */
export function getX402PaymentConfig(intent: TradeIntent): {
  price: string; // Price in dollars (e.g., "$5.00")
  network: string;
  address: `0x${string}`;
  config?: Record<string, unknown>;
} {
  return {
    price: `$${intent.expectedPaymentAmount}`,
    network: useMainnetFacilitator ? "base" : "base-sepolia",
    address: X402_PAYMENT_ADDRESS,
    config: {
      description: `Execute ${intent.side} trade for ${intent.symbol} with ${intent.leverage}x leverage`,
      inputSchema: {
        type: "object",
        properties: {
          tradeIntentId: { type: "string", description: "Trade intent ID to execute" },
        },
        required: ["tradeIntentId"],
      },
      outputSchema: {
        type: "object",
        properties: {
          executedTrade: { type: "object" },
          tradeIntent: { type: "object" },
        },
      },
      maxTimeoutSeconds: 90,
      metadata: {
        tradeIntentId: intent.id,
        userAddress: intent.userAddress,
        symbol: intent.symbol,
        side: intent.side,
        size: intent.size,
        leverage: intent.leverage,
      },
    } as Record<string, unknown>,
  };
}

/**
 * Create payment request metadata (for tracking purposes)
 */
export function createX402PaymentRequest(
  intent: TradeIntent
): X402PaymentRequest {
  const config = getX402PaymentConfig(intent);
  
  // Generate a payment request ID for tracking
  const paymentRequestId = `x402_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  return {
    paymentRequestId,
    amount: intent.expectedPaymentAmount,
    currency: "USD", // USDC is USD-pegged
    metadata: config.config?.metadata as Record<string, any> || {},
  };
}

/**
 * Get payment address
 */
export function getPaymentAddress(): `0x${string}` {
  return X402_PAYMENT_ADDRESS;
}

/**
 * Get network
 */
export function getNetwork(): string {
  return useMainnetFacilitator ? "base" : "base-sepolia";
}
