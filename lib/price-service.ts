// Real-time price service using CoinGecko API (free, no API key required)
// Provides accurate USD prices for portfolio valuation and PnL calculations

import { logger } from "./logger";

// CoinGecko API endpoints (free tier)
const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

// Token ID mapping for CoinGecko
const TOKEN_IDS: Record<string, string> = {
    BTC: "bitcoin",
    WBTC: "wrapped-bitcoin",
    ETH: "ethereum",
    WETH: "ethereum",
    USDC: "usd-coin",
    USDT: "tether",
};

// Cache for prices to avoid rate limiting (CoinGecko has ~10-30 calls/min limit)
interface PriceCache {
    prices: Record<string, number>;
    change24h: Record<string, number>;
    lastFetched: number;
}

let priceCache: PriceCache = {
    prices: {},
    change24h: {},
    lastFetched: 0,
};

// Cache duration: 60 seconds
const CACHE_DURATION_MS = 60 * 1000;

/**
 * Fetch real-time prices from CoinGecko
 * Returns USD prices for all supported tokens
 */
export async function fetchRealPrices(): Promise<{
    prices: Record<string, number>;
    change24h: Record<string, number>;
}> {
    const now = Date.now();

    // Return cached data if still valid
    if (now - priceCache.lastFetched < CACHE_DURATION_MS && Object.keys(priceCache.prices).length > 0) {
        return {
            prices: priceCache.prices,
            change24h: priceCache.change24h,
        };
    }

    try {
        // Get unique CoinGecko IDs
        const coinIds = [...new Set(Object.values(TOKEN_IDS))].join(",");

        const response = await fetch(
            `${COINGECKO_API_BASE}/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`,
            {
                headers: {
                    Accept: "application/json",
                },
                // 10 second timeout
                signal: AbortSignal.timeout(10000),
            }
        );

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();

        // Map back to our symbol names
        const prices: Record<string, number> = {};
        const change24h: Record<string, number> = {};

        for (const [symbol, coinId] of Object.entries(TOKEN_IDS)) {
            if (data[coinId]) {
                prices[symbol] = data[coinId].usd || 0;
                change24h[symbol] = data[coinId].usd_24h_change || 0;
            }
        }

        // Update cache
        priceCache = {
            prices,
            change24h,
            lastFetched: now,
        };

        logger.log("Fetched real prices from CoinGecko", prices);

        return { prices, change24h };
    } catch (error: any) {
        logger.error("Failed to fetch prices from CoinGecko", { error: error.message });

        // Return cached data if available, otherwise fallback prices
        if (Object.keys(priceCache.prices).length > 0) {
            return {
                prices: priceCache.prices,
                change24h: priceCache.change24h,
            };
        }

        // Last resort fallback (approximate market prices as of Jan 2026)
        return {
            prices: {
                BTC: 97000,
                WBTC: 97000,
                ETH: 3400,
                WETH: 3400,
                USDC: 1,
                USDT: 1,
            },
            change24h: {
                BTC: 0,
                WBTC: 0,
                ETH: 0,
                WETH: 0,
                USDC: 0,
                USDT: 0,
            },
        };
    }
}

/**
 * Get the current USD price for a specific token
 */
export async function getTokenPrice(symbol: string): Promise<number> {
    const { prices } = await fetchRealPrices();
    return prices[symbol.toUpperCase()] || 0;
}

/**
 * Get the 24h price change percentage for a specific token
 */
export async function getTokenChange24h(symbol: string): Promise<number> {
    const { change24h } = await fetchRealPrices();
    return change24h[symbol.toUpperCase()] || 0;
}

/**
 * Get all token prices at once (more efficient for portfolio)
 */
export async function getAllTokenPrices(): Promise<Record<string, { price: number; change24h: number }>> {
    const { prices, change24h } = await fetchRealPrices();

    const result: Record<string, { price: number; change24h: number }> = {};

    for (const symbol of Object.keys(TOKEN_IDS)) {
        result[symbol] = {
            price: prices[symbol] || 0,
            change24h: change24h[symbol] || 0,
        };
    }

    return result;
}
