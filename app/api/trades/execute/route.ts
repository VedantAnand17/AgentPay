// POST /api/trades/execute - Execute a trade after payment verification
// Uses x402 middleware to require payment before execution
import { NextRequest, NextResponse } from "next/server";
import { tradeIntents, executedTrades } from "@/lib/db";
import { createX402TradeMiddleware } from "@/lib/x402-middleware";
import { executeUniswapV3Swap } from "@/lib/uniswap-v3";
import { randomBytes } from "crypto";
import { logger } from "@/lib/logger";
import { executeTradeSchema, validateRequest } from "@/lib/validation";
import { rateLimitCheck } from "@/lib/rate-limit";
import { withTransactionRetry } from "@/lib/utils/retry";

// Sanitize error message for client response
const sanitizeErrorMessage = (error: unknown): string => {
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    return error.message;
  }
  return "An error occurred while executing the trade";
};

async function executeTradeHandler(request: NextRequest, paymentInfo?: any, tradeIntentId?: string) {
  try {
    // Get tradeIntentId from parameter or request body
    let intentId = tradeIntentId;
    if (!intentId) {
      const body = await request.json();
      intentId = body.tradeIntentId;
    }

    if (!intentId) {
      return NextResponse.json(
        { error: "Missing required field: tradeIntentId" },
        { status: 400 }
      );
    }

    // Load trade intent
    const intent = tradeIntents.getById(intentId);
    if (!intent) {
      return NextResponse.json(
        { error: "Trade intent not found" },
        { status: 404 }
      );
    }

    // Payment is already verified by x402 middleware (if request reaches here)
    // Extract payment ID from payment info
    const paymentId = paymentInfo?.id || paymentInfo?.paymentId || paymentInfo?.payment_id;

    // Update intent status to paid
    if (paymentId) {
      tradeIntents.updateStatus(intentId, "paid", paymentId);
    } else {
      tradeIntents.updateStatus(intentId, "paid");
    }

    // Execute Uniswap V3 spot swap on Base Sepolia with retry logic
    const { txHash, executionPrice } = await withTransactionRetry(
      () => executeUniswapV3Swap({
        userAddress: intent.userAddress,
        symbol: intent.symbol,
        side: intent.side,
        size: intent.size,
        leverage: intent.leverage,
      })
    );

    // Create executed trade record
    const executedTrade = {
      id: `trade_${Date.now()}_${randomBytes(4).toString("hex")}`,
      tradeIntentId: intent.id,
      paymentRequestId: paymentId || intent.paymentRequestId,
      paymentStatus: "paid" as const,
      swapTxHash: txHash,
      executionPrice,
      timestamp: Date.now(),
      status: "executed" as const,
    };

    executedTrades.create(executedTrade);

    // Update intent status to executed
    tradeIntents.updateStatus(intentId, "executed");

    return NextResponse.json({
      executedTrade,
      tradeIntent: intent,
    });
  } catch (error) {
    logger.error("Error executing trade:", error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Apply strict rate limiting for payment operations
  const rateLimitResponse = rateLimitCheck(request, "payment");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();

    // Validate input using Zod schema
    const validation = validateRequest(executeTradeSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { tradeIntentId } = validation.data;

    // Load trade intent to get payment config
    const intent = tradeIntents.getById(tradeIntentId);
    if (!intent) {
      return NextResponse.json(
        { error: "Trade intent not found" },
        { status: 404 }
      );
    }

    // Create x402 middleware wrapper
    // Pass tradeIntentId to handler to avoid reading body twice
    const handlerWithId = (req: NextRequest, paymentInfo?: any) =>
      executeTradeHandler(req, paymentInfo, tradeIntentId);
    const middleware = createX402TradeMiddleware(intent, handlerWithId);

    // Execute with payment verification
    return middleware(request);
  } catch (error) {
    logger.error("Error in execute endpoint:", error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}

