// POST /api/trades/execute - Execute a trade after payment verification
import { NextRequest, NextResponse } from "next/server";
import { tradeIntents, executedTrades } from "@/lib/db";
import { verifyX402Payment } from "@/lib/x402";
import { openPerpPositionOnBaseSepolia } from "@/lib/perp";
import { randomBytes } from "crypto";

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

    // Load trade intent
    const intent = tradeIntents.getById(tradeIntentId);
    if (!intent) {
      return NextResponse.json(
        { error: "Trade intent not found" },
        { status: 404 }
      );
    }

    // Verify payment status
    if (!intent.paymentRequestId) {
      return NextResponse.json(
        { error: "Payment request ID not found on trade intent" },
        { status: 400 }
      );
    }

    const paymentStatus = await verifyX402Payment(intent.paymentRequestId);

    if (paymentStatus !== "paid") {
      return NextResponse.json(
        { error: `Payment not completed. Status: ${paymentStatus}` },
        { status: 400 }
      );
    }

    // Update intent status to paid
    tradeIntents.updateStatus(tradeIntentId, "paid");

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
      paymentRequestId: intent.paymentRequestId,
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

