// x402 middleware adapter for Next.js API routes
// Adapts x402-express paymentMiddleware pattern for Next.js
import { NextRequest, NextResponse } from "next/server";
import { exact } from "x402/schemes";
import { useFacilitator } from "x402/verify";
import { findMatchingPaymentRequirements, processPriceToAtomicAmount } from "x402/shared";
import { getAddress } from "viem";
import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  Network,
  Price,
  ERC20TokenAmount,
} from "x402/types";
import { getX402PaymentConfig, facilitatorConfig, getPaymentAddress } from "./x402";
import { TradeIntent } from "./types";

// x402 protocol version
const X402_VERSION = 1;

/**
 * Build payment requirements from config
 * This matches the format expected by x402 protocol
 */
function buildPaymentRequirements(
  payTo: `0x${string}`,
  price: Price,
  network: Network,
  config: Record<string, unknown>,
  resource: string,
  method: string
): PaymentRequirements {
  // Process price to get atomic amount and asset
  const atomicAmountForAsset = processPriceToAtomicAmount(price, network);
  if ("error" in atomicAmountForAsset) {
    throw new Error(atomicAmountForAsset.error);
  }
  const { maxAmountRequired, asset } = atomicAmountForAsset;

  // Extract config fields
  const {
    description = "",
    mimeType = "application/json",
    maxTimeoutSeconds = 300,
    inputSchema = {},
    outputSchema = {},
    metadata = {},
  } = config;

  // Ensure inputSchema is an object
  const inputSchemaObj = typeof inputSchema === "object" && inputSchema !== null ? inputSchema : {};
  const outputSchemaObj = typeof outputSchema === "object" && outputSchema !== null ? outputSchema : {};

  return {
    scheme: "exact",
    network,
    maxAmountRequired,
    resource,
    description: description as string,
    mimeType: mimeType as string,
    payTo: getAddress(payTo),
    maxTimeoutSeconds: maxTimeoutSeconds as number,
    asset: getAddress((asset as ERC20TokenAmount["asset"]).address),
    outputSchema: {
      input: {
        type: "http",
        method,
        discoverable: true,
        ...(inputSchemaObj as Record<string, unknown>),
      },
      output: outputSchemaObj,
    },
    extra: (asset as ERC20TokenAmount["asset"]).eip712,
  } as PaymentRequirements;
}

// Note: findMatchingPaymentRequirements is imported from x402/shared

/**
 * Verify x402 payment from request headers using facilitator
 */
async function verifyX402Payment(
  request: NextRequest,
  paymentRequirements: PaymentRequirements
): Promise<{
  isValid: boolean;
  paymentId?: string;
  paymentInfo?: PaymentPayload;
  verifyResponse?: VerifyResponse;
  error?: string;
}> {
  const paymentHeader = request.headers.get("X-PAYMENT");
  
  if (!paymentHeader) {
    return { isValid: false, error: "X-PAYMENT header is required" };
  }

  try {
    // Decode payment header
    const decodedPayment = exact.evm.decodePayment(paymentHeader);
    decodedPayment.x402Version = X402_VERSION;

    // Get facilitator verify function
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { verify } = useFacilitator(facilitatorConfig);

    // Find matching requirements
    const selectedRequirements = findMatchingPaymentRequirements(
      [paymentRequirements],
      decodedPayment
    );

    if (!selectedRequirements) {
      return {
        isValid: false,
        error: "Unable to find matching payment requirements",
      };
    }

    // Verify payment with facilitator
    const verifyResponse = await verify(decodedPayment, selectedRequirements);

    if (!verifyResponse.isValid) {
      return {
        isValid: false,
        error: verifyResponse.invalidReason || "Payment verification failed",
      };
    }

    // Extract payment ID from verify response or payment payload
    const paymentId = verifyResponse.payer || 
      (decodedPayment.payload && typeof decodedPayment.payload === "object" && "id" in decodedPayment.payload 
        ? (decodedPayment.payload as any).id 
        : undefined);

    return {
      isValid: true,
      paymentId,
      paymentInfo: decodedPayment,
      verifyResponse,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Payment verification failed",
    };
  }
}

/**
 * Create x402 payment required response
 * 
 * Returns a 402 response with payment information that x402 client can use
 * Format matches x402 protocol specification
 */
export function createPaymentRequiredResponse(
  config: {
    price: string;
    network: string;
    address: `0x${string}`;
    config?: Record<string, unknown>;
  },
  resource: string,
  method: string
): NextResponse {
  const paymentRequirements: PaymentRequirements = buildPaymentRequirements(
    config.address,
    config.price as Price,
    config.network as Network,
    config.config || {},
    resource,
    method
  );

  return NextResponse.json(
    {
      x402Version: X402_VERSION,
      error: "X-PAYMENT header is required",
      accepts: [paymentRequirements],
    },
    {
      status: 402, // 402 Payment Required
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `x402 price="${config.price}", network="${config.network}", address="${config.address}"`,
      },
    }
  );
}

/**
 * x402 payment middleware for Next.js API routes
 * 
 * This wraps handlers to require x402 payment before execution.
 * Payment is verified with the facilitator before handler execution,
 * and settled after successful response.
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
  handler: (request: NextRequest, paymentInfo?: PaymentPayload) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const resource = `${request.nextUrl.protocol}//${request.nextUrl.host}${request.nextUrl.pathname}`;
    const method = request.method;

    // Build payment requirements
    const paymentRequirements = buildPaymentRequirements(
      config.address,
      config.price as Price,
      config.network as Network,
      config.config || {},
      resource,
      method
    );

    // Verify payment with facilitator
    const verification = await verifyX402Payment(request, paymentRequirements);
    
    if (!verification.isValid) {
      // Payment not verified - return payment required response
      // x402 client will handle this and show payment UI
      return createPaymentRequiredResponse(config, resource, method);
    }

    // Payment verified - execute handler
    const response = await handler(request, verification.paymentInfo);

    // Only settle payment if response is successful (2xx)
    if (response.status >= 200 && response.status < 300 && verification.paymentInfo) {
      try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { settle } = useFacilitator(facilitatorConfig);
        const selectedRequirements = findMatchingPaymentRequirements(
          [paymentRequirements],
          verification.paymentInfo
        );

        if (selectedRequirements) {
          const settleResponse: SettleResponse = await settle(
            verification.paymentInfo,
            selectedRequirements
          );
          
          if (settleResponse.success) {
            // Add settlement response to headers (base64 encoded)
            const settleResponseJson = JSON.stringify(settleResponse);
            const settleResponseBase64 = Buffer.from(settleResponseJson).toString("base64");
            response.headers.set("X-Payment-Response", settleResponseBase64);
          }
        }
      } catch (error) {
        console.error("Payment settlement failed:", error);
        // Don't fail the request if settlement fails, but log it
      }
    }
    
    return response;
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
