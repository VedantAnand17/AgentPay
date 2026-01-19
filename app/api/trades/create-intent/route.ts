// POST /api/trades/create-intent - Create a trade intent and x402 payment request
import { NextRequest, NextResponse } from "next/server";
import { TradeIntent } from "@/lib/types";
import { tradeIntents } from "@/lib/db";
import { createX402PaymentRequest } from "@/lib/x402";
import { randomBytes } from "crypto";
import { calculateTradeFee } from "@/lib/config/app";
import { createTradeIntentSchema, validateRequest } from "@/lib/validation";
import { rateLimitCheck } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimitCheck(request, "standard");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();

    // Validate input using Zod schema
    const validation = validateRequest(createTradeIntentSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { userAddress, agentId, symbol, side, size, leverage } = validation.data;

    // Calculate expected payment amount using centralized fee config
    const expectedPaymentAmount = calculateTradeFee(size).toFixed(6);

    // Create trade intent
    const intent: TradeIntent = {
      id: `intent_${Date.now()}_${randomBytes(4).toString("hex")}`,
      userAddress,
      agentId,
      symbol,
      side,
      size,
      leverage: leverage ?? 1,
      expectedPaymentAmount,
      status: "pending",
      createdAt: Date.now(),
    };

    // Create x402 payment request
    const paymentRequest = createX402PaymentRequest(intent);

    // Store payment request ID on intent
    intent.paymentRequestId = paymentRequest.paymentRequestId;

    // Save to database
    tradeIntents.create(intent);

    return NextResponse.json({
      tradeIntent: intent,
      paymentRequest,
    });
  } catch (error: unknown) {
    logger.error("Error creating trade intent:", error);
    const message = error instanceof Error ? error.message : "Failed to create trade intent";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
