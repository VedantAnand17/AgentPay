// POST /api/trades/execute - Execute a trade after payment verification
// Uses x402 middleware to require payment before execution
import { NextRequest, NextResponse } from "next/server";
import { tradeIntents, executedTrades } from "@/lib/db";
import { createX402TradeMiddleware } from "@/lib/x402-middleware";
import { openPerpPositionOnBaseSepolia } from "@/lib/perp";
import { randomBytes } from "crypto";

async function executeTradeHandler(request: NextRequest, paymentInfo?: any) {
  try {
    const body = await request.json();
    const { tradeIntentId } = body;

    if (!tradeIntentId) {
      return NextResponse.json(
        { error: "Missing required field: tradeIntentId" },
        { status: 400 }
      );
    }

    // Load trade intent
    const intent = tradeIntents.getById(tradeIntentId);
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
      tradeIntents.updateStatus(tradeIntentId, "paid", paymentId);
    } else {
      tradeIntents.updateStatus(tradeIntentId, "paid");
    }

    // Open perp position on Base Sepolia
    const { txHash, entryPrice } = await openPerpPositionOnBaseSepolia({
      userAddress: intent.userAddress,
      symbol: intent.symbol,
      side: intent.side,
      size: intent.size,
      leverage: intent.leverage,
    });

    // Create executed trade record
    const executedTrade = {
      id: `trade_${Date.now()}_${randomBytes(4).toString("hex")}`,
      tradeIntentId: intent.id,
      paymentRequestId: paymentId || intent.paymentRequestId,
      paymentStatus: "paid" as const,
      perpTxHash: txHash,
      entryPrice,
      timestamp: Date.now(),
      status: "executed" as const,
    };

    executedTrades.create(executedTrade);

    // Update intent status to executed
    tradeIntents.updateStatus(tradeIntentId, "executed");

    return NextResponse.json({
      executedTrade,
      tradeIntent: intent,
    });
  } catch (error: any) {
    console.error("Error executing trade:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute trade" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tradeIntentId } = body;

    if (!tradeIntentId) {
      return NextResponse.json(
        { error: "Missing required field: tradeIntentId" },
        { status: 400 }
      );
    }

    // Load trade intent to get payment config
    const intent = tradeIntents.getById(tradeIntentId);
    if (!intent) {
      return NextResponse.json(
        { error: "Trade intent not found" },
        { status: 404 }
      );
    }

    // Create x402 middleware wrapper
    const middleware = createX402TradeMiddleware(intent, executeTradeHandler);
    
    // Execute with payment verification
    return middleware(request);
  } catch (error: any) {
    console.error("Error in execute endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute trade" },
      { status: 500 }
    );
  }
}

