// GET /api/balances?address=0x...&symbol=BTC
// Returns token balance for a given address and symbol
import { NextRequest, NextResponse } from "next/server";
import { getTokenBalanceV3 } from "@/lib/uniswap-v3";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const symbol = searchParams.get("symbol");

    if (!address) {
      return NextResponse.json(
        { error: "Missing required parameter: address" },
        { status: 400 }
      );
    }

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing required parameter: symbol" },
        { status: 400 }
      );
    }

    const balance = await getTokenBalanceV3(address, symbol.toUpperCase());

    return NextResponse.json({
      address,
      symbol: symbol.toUpperCase(),
      balance: balance.balance,
      formatted: balance.formatted,
    });
  } catch (error: any) {
    console.error("Error getting token balance:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get token balance" },
      { status: 500 }
    );
  }
}





