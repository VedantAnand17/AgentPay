// GET /api/trades - Returns list of recent executed trades
import { NextRequest, NextResponse } from "next/server";
import { executedTrades } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : 50;

    const trades = executedTrades.getAll(limit);

    return NextResponse.json(trades);
  } catch (error: any) {
    console.error("Error fetching trades:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch trades" },
      { status: 500 }
    );
  }
}

