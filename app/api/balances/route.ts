// GET /api/balances?address=0x...&symbol=BTC
// Returns token balance for a given address and symbol
import { NextRequest, NextResponse } from "next/server";
import { getTokenBalanceV3 } from "@/lib/uniswap-v3";
import { logger } from "@/lib/logger";

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

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing required parameter: symbol" },
        { status: 400 }
      );
    }

    const upperSymbol = symbol.toUpperCase();

    // Check if symbol is supported
    const supportedSymbols = ["BTC", "WBTC", "USDC", "WETH"];
    if (!supportedSymbols.includes(upperSymbol)) {
      return NextResponse.json(
        { error: `Unsupported token symbol: ${upperSymbol}. Supported: ${supportedSymbols.join(", ")}` },
        { status: 400 }
      );
    }

    try {
      const balance = await getTokenBalanceV3(address, upperSymbol);

      return NextResponse.json({
        address,
        symbol: upperSymbol,
        balance: balance.balance,
        formatted: balance.formatted,
      });
    } catch (balanceError: any) {
      // Log the error but return a graceful response
      logger.error("Balance fetch error", {
        address,
        symbol: upperSymbol,
        error: balanceError.message
      });

      // Return zero balance instead of erroring - the token may not exist on this network
      // or the user may not have any balance
      return NextResponse.json({
        address,
        symbol: upperSymbol,
        balance: "0",
        formatted: "0",
        warning: "Could not fetch live balance, showing zero",
      });
    }
  } catch (error: any) {
    logger.error("Unexpected error in balances route", { error: error.message });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



















