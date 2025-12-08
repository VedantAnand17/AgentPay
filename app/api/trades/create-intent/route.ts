// POST /api/trades/create-intent - Create a trade intent and x402 payment request
import { NextRequest, NextResponse } from "next/server";
import { TradeIntent } from "@/lib/types";
import { tradeIntents } from "@/lib/db";
import { createX402PaymentRequest } from "@/lib/x402";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, agentId, symbol, side, size, leverage } = body;

    // Validate required fields
    if (!userAddress || !agentId || !symbol || !side || !size || !leverage) {
      return NextResponse.json(
        { error: "Missing required fields: userAddress, agentId, symbol, side, size, leverage" },
        { status: 400 }
      );
    }

    if (side !== "long" && side !== "short") {
      return NextResponse.json(
        { error: "side must be 'long' or 'short'" },
        { status: 400 }
      );
    }

    // Calculate expected payment amount (flat fee for MVP, e.g., $5 per trade)
    // In production, this could be a percentage or dynamic based on trade size
    const expectedPaymentAmount = "5.00"; // $5 flat fee

    // Create trade intent
    const intent: TradeIntent = {
      id: `intent_${Date.now()}_${randomBytes(4).toString("hex")}`,
      userAddress,
      agentId,
      symbol,
      side,
      size: parseFloat(size),
      leverage: parseInt(leverage),
      expectedPaymentAmount,
      status: "pending",
      createdAt: Date.now(),
    };

    // Create x402 payment request
    const paymentRequest = await createX402PaymentRequest(intent);

    // Store payment request ID on intent
    intent.paymentRequestId = paymentRequest.paymentRequestId;

    // Save to database
    tradeIntents.create(intent);

    return NextResponse.json({
      tradeIntent: intent,
      paymentRequest,
    });
  } catch (error: any) {
    console.error("Error creating trade intent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create trade intent" },
      { status: 500 }
    );
  }
}

