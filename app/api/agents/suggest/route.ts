// POST /api/agents/suggest - Get agent trading suggestion (requires payment)
import { NextRequest, NextResponse } from "next/server";
import { executeAgent } from "@/lib/agents";
import { x402PaymentRequired } from "@/lib/x402-middleware";
import { getPaymentAddress, getNetwork } from "@/lib/x402";

// Define PaymentPayload type locally (V2 compatible)
interface PaymentPayload {
  id?: string;
  raw?: string;
  [key: string]: unknown;
}

// Consultancy fee: $0.10 USD (100,000 base units for USDC with 6 decimals)
const CONSULTANCY_FEE = "$0.10";

async function suggestHandler(request: NextRequest, paymentInfo?: PaymentPayload) {
  try {
    const body = await request.json();
    const { agentId, symbol } = body;

    if (!agentId || !symbol) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, symbol" },
        { status: 400 }
      );
    }

    // Execute agent to get suggestion (payment already verified by middleware)
    const suggestion = executeAgent(agentId, { symbol });

    // Include payment ID in response for tracking
    const paymentId = paymentInfo && typeof paymentInfo === "object" && "id" in paymentInfo
      ? (paymentInfo as any).id
      : undefined;

    return NextResponse.json({
      ...suggestion,
      paymentId, // Include payment ID for tracking
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get agent suggestion" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Wrap handler with x402 payment requirement
  const handler = x402PaymentRequired(
    {
      price: CONSULTANCY_FEE,
      network: getNetwork() as any,
      payTo: getPaymentAddress(),
      description: "AI Trading Consultancy - Get expert trading recommendation from AI agent",
      maxTimeoutSeconds: 60,
      metadata: {
        service: "ai-consultancy",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "ID of the trading agent to consult" },
            symbol: { type: "string", description: "Trading symbol (e.g., BTC)" },
          },
          required: ["agentId", "symbol"],
        },
        outputSchema: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            side: { type: "string", enum: ["buy", "sell"] },
            size: { type: "number" },
            leverage: { type: "number" },
            reason: { type: "string" },
            paymentId: { type: "string" },
          },
        },
      },
    },
    suggestHandler
  );

  return handler(request);
}
