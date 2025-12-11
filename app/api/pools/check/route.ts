// GET /api/pools/check - Check available Uniswap pools for token pairs
import { NextRequest, NextResponse } from "next/server";
import { checkAvailablePools } from "@/lib/uniswap";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenA = searchParams.get("tokenA");
    const tokenB = searchParams.get("tokenB");

    if (!tokenA || !tokenB) {
      return NextResponse.json(
        { error: "Missing required parameters: tokenA and tokenB" },
        { status: 400 }
      );
    }

    const pools = await checkAvailablePools(tokenA, tokenB);

    return NextResponse.json({
      tokenA,
      tokenB,
      availablePools: pools,
      message: pools.length > 0
        ? `Found ${pools.length} available pool(s)`
        : "No pools found for this token pair",
    });
  } catch (error: any) {
    console.error("Error checking pools:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check pools" },
      { status: 500 }
    );
  }
}


