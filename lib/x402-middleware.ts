/**
 * x402 V2 Middleware for Next.js API Routes
 * 
 * This module provides server-side payment verification using x402 V2.
 * Uses @x402/next for native Next.js integration.
 * 
 * Key features:
 * - Payment verification via x402 facilitator
 * - Automatic payment settlement after successful operations  
 * - Native Next.js App Router support via withX402
 */

import { NextRequest, NextResponse } from "next/server";
import { withX402, RouteConfig } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { getAddress } from "viem";
import type { Network } from "@x402/core/types";
import type { TradeIntent } from "./types";
import {
  getCurrentChainId,
  getNetworkCAIP2 as getNetworkCAIP2FromConfig,
  getCurrentUsdcAddress,
} from "./config";
import { X402_CONFIG } from "./config/app";

// Environment configuration
const X402_PAYMENT_ADDRESS = (process.env.X402_PAYMENT_ADDRESS || process.env.ADDRESS) as `0x${string}`;

// Get the CAIP-2 formatted network (e.g., "eip155:84532")
function getNetworkCAIP2(): Network {
  return getNetworkCAIP2FromConfig() as Network;
}

// Get facilitator URL
function getFacilitatorUrl(): string {
  return X402_CONFIG.facilitatorUrl;
}

// Create x402 resource server (singleton)
let x402Server: x402ResourceServer | null = null;

function getX402Server(): x402ResourceServer {
  if (!x402Server) {
    const facilitatorUrl = getFacilitatorUrl();
    const client = new HTTPFacilitatorClient({ url: facilitatorUrl });
    x402Server = new x402ResourceServer(client);

    // Register EVM exact payment scheme
    registerExactEvmScheme(x402Server, {});
  }
  return x402Server;
}

/**
 * x402 payment configuration for a trade
 */
export interface X402PaymentConfig {
  price: string; // e.g., "$5.00"
  network: Network;
  payTo: `0x${string}`;
  asset?: `0x${string}`;
  description: string;
  maxTimeoutSeconds?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Generate x402 route configuration for a trade intent
 */
export function getX402RouteConfig(intent: TradeIntent): RouteConfig {
  const priceValue = parseFloat(intent.expectedPaymentAmount);

  return {
    accepts: {
      scheme: "exact",
      network: getNetworkCAIP2(),
      payTo: getAddress(X402_PAYMENT_ADDRESS),
      price: `$${priceValue.toFixed(2)}`,
      maxTimeoutSeconds: 90,
      extra: {
        tradeIntentId: intent.id,
        userAddress: intent.userAddress,
        symbol: intent.symbol,
        side: intent.side,
        size: intent.size,
      },
    },
    description: `Execute ${intent.side} trade for ${intent.symbol}`,
  };
}

/**
 * Create x402 V2 middleware for a trade intent
 * 
 * This wraps a handler with x402 payment protection using withX402.
 * Payment is verified before handler execution, and settled after success.
 */
export function createX402TradeMiddleware(
  intent: TradeIntent,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  const routeConfig = getX402RouteConfig(intent);
  const server = getX402Server();

  return withX402(handler, routeConfig, server);
}

/**
 * Create 402 Payment Required response (for manual handling)
 */
export function createPaymentRequiredResponse(
  intent: TradeIntent,
  resource: string
): NextResponse {
  const routeConfig = getX402RouteConfig(intent);
  const accepts = routeConfig.accepts;

  // Handle both single PaymentOption and array
  const paymentOption = Array.isArray(accepts) ? accepts[0] : accepts;

  const requirements = {
    scheme: paymentOption.scheme,
    network: paymentOption.network,
    payTo: paymentOption.payTo,
    price: paymentOption.price,
    description: routeConfig.description,
    maxTimeoutSeconds: paymentOption.maxTimeoutSeconds,
    resource,
    mimeType: routeConfig.mimeType || "application/json",
  };

  // Encode requirements as base64 for header
  const requirementsBase64 = Buffer.from(JSON.stringify([requirements])).toString("base64");

  return NextResponse.json(
    {
      x402Version: 2,
      error: "Payment required",
      accepts: [requirements],
    },
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-REQUIRED": requirementsBase64,
        "WWW-Authenticate": `x402 version="2"`,
      },
    }
  );
}

/**
 * Helper to check if a request has a valid x402 payment header
 */
export function hasPaymentHeader(request: NextRequest): boolean {
  return !!(request.headers.get("PAYMENT-SIGNATURE") || request.headers.get("X-PAYMENT"));
}

/**
 * Get the x402 payment address
 */
export function getX402PaymentAddress(): `0x${string}` {
  return X402_PAYMENT_ADDRESS;
}

/**
 * Get the USDC address for the current network
 */
export function getX402UsdcAddress(): `0x${string}` {
  return getCurrentUsdcAddress();
}

/**
 * Get the current network in CAIP-2 format
 */
export function getX402Network(): Network {
  return getNetworkCAIP2();
}

// Legacy export for backward compatibility
export function x402PaymentRequired(
  config: X402PaymentConfig,
  handler: (request: NextRequest, paymentInfo?: any) => Promise<NextResponse>
) {
  // Create a fake intent from config for the wrapper
  const fakeIntent: TradeIntent = {
    id: "manual",
    userAddress: "0x0",
    agentId: "manual",
    symbol: "BTC",
    side: "buy" as const,
    size: 1,
    leverage: 1,
    expectedPaymentAmount: config.price.replace("$", ""),
    status: "pending" as const,
    createdAt: Date.now(),
  };

  // Wrap handler to add paymentInfo parameter (for backward compatibility)
  const wrappedHandler = async (request: NextRequest): Promise<NextResponse> => {
    // In V2, payment info comes from headers
    const paymentHeader = request.headers.get("PAYMENT-SIGNATURE");
    return handler(request, paymentHeader ? { raw: paymentHeader } : undefined);
  };

  return createX402TradeMiddleware(fakeIntent, wrappedHandler);
}
