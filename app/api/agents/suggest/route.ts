// POST /api/agents/suggest - Get agent trading suggestion
import { NextRequest, NextResponse } from "next/server";
import { executeAgent } from "@/lib/agents";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, symbol } = body;

    if (!agentId || !symbol) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, symbol" },
        { status: 400 }
      );
    }

    const suggestion = executeAgent(agentId, { symbol });

    return NextResponse.json(suggestion);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get agent suggestion" },
      { status: 500 }
    );
  }
}





