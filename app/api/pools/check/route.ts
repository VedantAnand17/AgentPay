// GET /api/pools/check - Check available Uniswap V3 pools for token pairs
import { NextRequest, NextResponse } from "next/server";
import { checkAvailablePoolsV3, getPoolInfo, validateSwapV3 } from "@/lib/uniswap-v3";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenA = searchParams.get("tokenA");
    const tokenB = searchParams.get("tokenB");
    const swapSize = searchParams.get("swapSize");
    const swapSide = searchParams.get("side") as "buy" | "sell" | null;

    if (!tokenA || !tokenB) {
      return NextResponse.json(
        { error: "Missing required parameters: tokenA and tokenB" },
        { status: 400 }
      );
    }

    const pools = await checkAvailablePoolsV3(tokenA, tokenB);
    const liquidityInfo = await getPoolInfo();

    // If swap parameters provided, validate the swap
    let swapValidation = null;
    if (swapSize && swapSide) {
      swapValidation = await validateSwapV3({
        symbol: tokenA === "USDC" ? tokenB : tokenA,
        side: swapSide,
        size: parseFloat(swapSize),
      });
    }

    return NextResponse.json({
      tokenA,
      tokenB,
      availablePools: pools,
      liquidity: liquidityInfo,
      swapValidation,
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












