// GET /api/prices - Returns real-time token prices from CoinGecko
import { NextResponse } from "next/server";
import { fetchRealPrices } from "@/lib/price-service";
import { logger } from "@/lib/logger";

export async function GET() {
    try {
        const { prices, change24h } = await fetchRealPrices();

        return NextResponse.json({
            prices,
            change24h,
            source: "coingecko",
            timestamp: Date.now(),
        });
    } catch (error: any) {
        logger.error("Error fetching prices:", error);
        return NextResponse.json(
            { error: "Failed to fetch prices" },
            { status: 500 }
        );
    }
}
