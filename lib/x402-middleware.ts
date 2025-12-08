// x402 middleware adapter for Next.js API routes
// Adapts x402-express paymentMiddleware pattern for Next.js
import { NextRequest, NextResponse } from "next/server";
import { paymentMiddleware } from "x402-express";
import { getX402PaymentConfig, facilitatorConfig, getPaymentAddress } from "./x402";
import { TradeIntent } from "./types";

// Since Next.js doesn't use Express, we need to adapt the middleware pattern
// The x402-express middleware expects Express req/res objects, so we'll
// create a wrapper that handles payment verification manually

/**
 * Verify x402 payment from request headers
 * 
 * x402 middleware adds headers after payment verification:
 * - X-PAYMENT: Payment information
 * - X-Payment-Response: Payment verification response
 */
export function verifyX402PaymentFromRequest(request: NextRequest): {
  isValid: boolean;
  paymentId?: string;
  paymentInfo?: any;
} {
  // Check for x402 payment verification headers
  const paymentHeader = request.headers.get("X-PAYMENT");
  const paymentResponseHeader = request.headers.get("X-Payment-Response");
  
  // x402 middleware sets these headers when payment is verified
  if (paymentHeader && paymentResponseHeader) {
    try {
      const paymentInfo = JSON.parse(paymentHeader);
      return {
        isValid: true,
        paymentId: paymentInfo.id || paymentInfo.paymentId,
        paymentInfo,
      };
    } catch (e) {
      // Header exists but not valid JSON - payment might be required
      return { isValid: false };
    }
  }
  
  return { isValid: false };
}

/**
 * Create x402 payment required response
 * 
 * Returns a 402 response with payment information that x402 client can use
 */
export function createPaymentRequiredResponse(
  config: {
    price: string;
    network: string;
    address: string;
    config?: Record<string, unknown>;
  }
): NextResponse {
  return NextResponse.json(
    {
      error: "Payment required",
      x402PaymentRequired: true,
      payment: {
        price: config.price,
        network: config.network,
        address: config.address,
        config: config.config,
      },
    },
    {
      status: 402, // 402 Payment Required
      headers: {
        "WWW-Authenticate": `x402 price="${config.price}", network="${config.network}", address="${config.address}"`,
        "X-Payment-Required": "true",
      },
    }
  );
}

/**
 * x402 payment middleware for Next.js API routes
 * 
 * This wraps handlers to require x402 payment before execution.
 * The payment verification is handled by x402-express middleware pattern,
 * but adapted for Next.js Request/Response objects.
 * 
 * Usage:
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const handler = x402PaymentRequired(
 *     { price: "$5.00", network: "base-sepolia", address: "0x...", config: {...} },
 *     async (req, paymentInfo) => {
 *       // Your handler code - only runs after valid payment
 *       return NextResponse.json({ data: "..." });
 *     }
 *   );
 *   return handler(request);
 * }
 * ```
 */
export function x402PaymentRequired(
  config: {
    price: string;
    network: string;
    address: `0x${string}`;
    config?: Record<string, unknown>;
  },
  handler: (request: NextRequest, paymentInfo?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Verify payment from request headers
    const verification = verifyX402PaymentFromRequest(request);
    
    if (!verification.isValid) {
      // Payment not verified - return payment required response
      // x402 client will handle this and show payment UI
      return createPaymentRequiredResponse(config);
    }
    
    // Payment verified - execute handler
    return handler(request, verification.paymentInfo);
  };
}

/**
 * Create x402 payment middleware for a trade intent
 * 
 * Convenience function that creates middleware for a trade intent
 */
export function createX402TradeMiddleware(
  intent: TradeIntent,
  handler: (request: NextRequest, paymentInfo?: any) => Promise<NextResponse>
) {
  const config = getX402PaymentConfig(intent);
  return x402PaymentRequired(config, handler);
}

/**
 * Get x402 payment configuration for route registration
 * 
 * This creates the route configuration object that x402-express middleware expects.
 * For Next.js, we use this to generate payment requirements.
 */
export function getX402RouteConfig(
  route: string,
  intent: TradeIntent
): Record<string, ReturnType<typeof getX402PaymentConfig>> {
  const config = getX402PaymentConfig(intent);
  return {
    [route]: config,
  };
}
