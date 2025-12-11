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

    // Validate required fields (leverage is optional, defaults to 1 for spot trades)
    if (!userAddress || !agentId || !symbol || !side || !size) {
      return NextResponse.json(
        { error: "Missing required fields: userAddress, agentId, symbol, side, size" },
        { status: 400 }
      );
    }

    if (side !== "buy" && side !== "sell") {
      return NextResponse.json(
        { error: "side must be 'buy' or 'sell'" },
        { status: 400 }
      );
    }

    // Validate symbol - only BTC (WBTC) is supported
    const supportedSymbols = ["BTC", "WBTC"];
    if (!supportedSymbols.includes(symbol.toUpperCase())) {
      return NextResponse.json(
        { error: `Symbol '${symbol}' is not supported. Only BTC (WBTC) is supported via the deployed Uniswap V3 pool.` },
        { status: 400 }
      );
    }

    // Calculate expected payment amount based on trade size
    // Fee structure: 0.1% of trade size, minimum $0.001, maximum $1.00
    const tradeSize = parseFloat(size);
    const feePercentage = 0.001; // 0.1%
    const calculatedFee = tradeSize * feePercentage;
    const minFee = 0.001;
    const maxFee = 1.0;
    const expectedPaymentAmount = Math.max(minFee, Math.min(maxFee, calculatedFee)).toFixed(6);

    // Create trade intent
    const intent: TradeIntent = {
      id: `intent_${Date.now()}_${randomBytes(4).toString("hex")}`,
      userAddress,
      agentId,
      symbol,
      side,
      size: parseFloat(size),
      leverage: leverage ? parseInt(leverage) : 1, // Default to 1x for spot trades
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
  } catch (error: any) {
    console.error("Error creating trade intent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create trade intent" },
      { status: 500 }
    );
  }
}

