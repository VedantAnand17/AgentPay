// GET /api/trades - Returns list of recent executed trades with PnL
import { NextRequest, NextResponse } from "next/server";
import { executedTrades } from "@/lib/db";
import { getCurrentPriceV3 } from "@/lib/uniswap-v3";
import { logger } from "@/lib/logger";

// Sanitize error message for client response
const sanitizeErrorMessage = (error: unknown): string => {
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    return error.message;
  }
  return "An error occurred while processing your request";
};

// Calculate PnL for trades
async function calculatePnLForTrades(
  trades: Array<any>
): Promise<Array<any>> {
  // Get current price for all symbols
  const symbolSet = new Set<string>();
  trades.forEach((trade) => {
    if (trade.tradeIntent?.symbol) {
      symbolSet.add(trade.tradeIntent.symbol);
    }
  });

  const currentPrices: Record<string, number> = {};

  // Fetch all prices in parallel using Promise.all instead of sequential loop
  // This eliminates waterfall: N symbols fetched in 1 round trip instead of N
  const pricePromises = Array.from(symbolSet).map(async (symbol) => {
    try {
      const price = await getCurrentPriceV3(symbol);
      return { symbol, price };
    } catch (error) {
      logger.error(`Failed to get current price for ${symbol}:`, error);
      // Use execution price as fallback
      const tradeWithSymbol = trades.find((t) => t.tradeIntent?.symbol === symbol);
      return { symbol, price: tradeWithSymbol?.executionPrice || 45000 };
    }
  });

  const priceResults = await Promise.all(pricePromises);
  priceResults.forEach(({ symbol, price }) => {
    currentPrices[symbol] = price;
  });

  // Separate buy and sell trades
  const buyTrades: Array<any> = [];
  const sellTrades: Array<any> = [];

  trades.forEach((trade) => {
    if (trade.tradeIntent?.side === "buy") {
      buyTrades.push(trade);
    } else if (trade.tradeIntent?.side === "sell") {
      sellTrades.push(trade);
    }
  });

  // First pass: Match sell trades with buy trades
  const matchedBuyIds = new Set<string>();
  const sellTradeMatches: Map<string, any> = new Map();

  sellTrades.forEach((sellTrade) => {
    const tradeIntent = sellTrade.tradeIntent;
    if (!tradeIntent) return;

    const symbol = tradeIntent.symbol;
    const size = tradeIntent.size;

    // Find the most recent unmatched buy trade for the same symbol and user
    const matchingBuy = buyTrades
      .filter(
        (bt) =>
          bt.tradeIntent?.symbol === symbol &&
          bt.tradeIntent?.userAddress === tradeIntent.userAddress &&
          bt.timestamp < sellTrade.timestamp &&
          !matchedBuyIds.has(bt.id) &&
          Math.abs(bt.tradeIntent.size - size) / Math.max(bt.tradeIntent.size, size) < 0.2 // Within 20% size difference
      )
      .sort((a, b) => b.timestamp - a.timestamp)[0]; // Most recent first

    if (matchingBuy) {
      matchedBuyIds.add(matchingBuy.id);
      sellTradeMatches.set(sellTrade.id, matchingBuy);
    }
  });

  // Second pass: Calculate PnL for all trades
  const tradesWithPnL = trades.map((trade) => {
    const tradeIntent = trade.tradeIntent;
    if (!tradeIntent) {
      return { ...trade, isOpen: false };
    }

    const symbol = tradeIntent.symbol;
    const currentPrice = currentPrices[symbol] || trade.executionPrice;
    const size = tradeIntent.size;
    const executionPrice = trade.executionPrice;

    // For sell trades, check if they have a matching buy
    if (tradeIntent.side === "sell") {
      const matchingBuy = sellTradeMatches.get(trade.id);

      if (matchingBuy) {
        // Calculate realized PnL
        const buyPrice = matchingBuy.executionPrice;
        const sellPrice = executionPrice;
        const pnlValue = (sellPrice - buyPrice) * size;
        const pnlPercentage = ((sellPrice - buyPrice) / buyPrice) * 100;

        return {
          ...trade,
          isOpen: false,
          matchedTradeId: matchingBuy.id,
          pnl: {
            value: pnlValue,
            percentage: pnlPercentage,
            type: "realized" as const,
            isProfit: pnlValue > 0,
          },
        };
      } else {
        // Sell trade without matching buy (shouldn't happen normally, but handle it)
        return {
          ...trade,
          isOpen: false,
        };
      }
    } else {
      // For buy trades, check if they're closed
      const isClosed = matchedBuyIds.has(trade.id);

      if (isClosed) {
        // This buy was matched with a sell, PnL already calculated on the sell
        return {
          ...trade,
          isOpen: false,
        };
      } else {
        // Open buy trade - calculate unrealized PnL
        const pnlValue = (currentPrice - executionPrice) * size;
        const pnlPercentage = ((currentPrice - executionPrice) / executionPrice) * 100;

        return {
          ...trade,
          isOpen: true,
          pnl: {
            value: pnlValue,
            percentage: pnlPercentage,
            type: "unrealized" as const,
            isProfit: pnlValue > 0,
          },
        };
      }
    }
  });

  return tradesWithPnL;
}

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : 50;

    const trades = executedTrades.getAll(limit);
    const tradesWithPnL = await calculatePnLForTrades(trades);

    return NextResponse.json(tradesWithPnL);
  } catch (error) {
    logger.error("Error fetching trades:", error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}




















