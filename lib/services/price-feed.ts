/**
 * Price Feed Service
 * 
 * Fetches real price data from on-chain sources.
 * Falls back to cached or estimated prices when live data is unavailable.
 */

import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { getCurrentRpcUrl } from "@/lib/config/networks";

// Cache for prices to reduce RPC calls
interface PriceCache {
    price: number;
    timestamp: number;
}

const priceCache = new Map<string, PriceCache>();
const CACHE_TTL = 30 * 1000; // 30 seconds

// Uniswap V3 Pool ABI for reading price
const POOL_ABI = [
    {
        name: "slot0",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "sqrtPriceX96", type: "uint160" },
            { name: "tick", type: "int24" },
            { name: "observationIndex", type: "uint16" },
            { name: "observationCardinality", type: "uint16" },
            { name: "observationCardinalityNext", type: "uint16" },
            { name: "feeProtocol", type: "uint8" },
            { name: "unlocked", type: "bool" },
        ],
    },
] as const;

// Pool addresses for price feeds (can be extended)
const PRICE_POOLS: Record<string, { address: `0x${string}`; token0Decimals: number; token1Decimals: number; invert: boolean }> = {
    "WBTC": {
        address: (process.env.UNISWAP_V3_POOL_ADDRESS || "0x657E53f847232D4b996890c6Fd11cb7396cBb0b6") as `0x${string}`,
        token0Decimals: 8, // WBTC
        token1Decimals: 6, // USDC
        invert: true, // We want USDC per WBTC
    },
    "BTC": {
        address: (process.env.UNISWAP_V3_POOL_ADDRESS || "0x657E53f847232D4b996890c6Fd11cb7396cBb0b6") as `0x${string}`,
        token0Decimals: 8,
        token1Decimals: 6,
        invert: true,
    },
};

// Fallback prices (used when on-chain fetch fails)
const FALLBACK_PRICES: Record<string, number> = {
    BTC: 45000,
    WBTC: 45000,
    ETH: 3000,
    WETH: 3000,
};

/**
 * Calculate price from Uniswap V3 sqrtPriceX96
 */
function calculatePriceFromSqrtPriceX96(
    sqrtPriceX96: bigint,
    token0Decimals: number,
    token1Decimals: number,
    invert: boolean
): number {
    const Q96 = BigInt(2) ** BigInt(96);

    // price = (sqrtPriceX96 / 2^96)^2
    const priceX192 = sqrtPriceX96 * sqrtPriceX96;
    const Q192 = Q96 * Q96;

    const rawPrice = Number(priceX192) / Number(Q192);

    // Adjust for decimal difference
    const decimalAdjustedPrice = rawPrice * (10 ** (token0Decimals - token1Decimals));

    // Invert if needed (to get quote per base)
    return invert ? (1 / decimalAdjustedPrice) : decimalAdjustedPrice;
}

/**
 * Fetch price from on-chain pool
 */
async function fetchPriceFromPool(symbol: string): Promise<number | null> {
    const poolConfig = PRICE_POOLS[symbol.toUpperCase()];
    if (!poolConfig) return null;

    try {
        const client = createPublicClient({
            chain: baseSepolia,
            transport: http(getCurrentRpcUrl()),
        });

        const slot0 = await client.readContract({
            address: poolConfig.address,
            abi: POOL_ABI,
            functionName: "slot0",
        });

        const sqrtPriceX96 = slot0[0];
        const price = calculatePriceFromSqrtPriceX96(
            sqrtPriceX96,
            poolConfig.token0Decimals,
            poolConfig.token1Decimals,
            poolConfig.invert
        );

        // Validate price is reasonable
        if (price > 0 && price < 1000000) {
            return price;
        }
    } catch (error) {
        console.warn(`Failed to fetch on-chain price for ${symbol}:`, error);
    }

    return null;
}

/**
 * Get current price for a symbol
 * Uses cache, then on-chain data, then fallback
 */
export async function getCurrentPrice(symbol: string): Promise<number> {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = upperSymbol;

    // Check cache
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.price;
    }

    // Try to fetch from on-chain
    const onChainPrice = await fetchPriceFromPool(upperSymbol);
    if (onChainPrice !== null) {
        priceCache.set(cacheKey, { price: onChainPrice, timestamp: Date.now() });
        return onChainPrice;
    }

    // Use fallback price
    const fallbackPrice = FALLBACK_PRICES[upperSymbol] || 1000;
    priceCache.set(cacheKey, { price: fallbackPrice, timestamp: Date.now() });
    return fallbackPrice;
}

/**
 * Get price history (simulated from current price)
 * In production, this would fetch from a price history API or database
 */
export async function getPriceHistory(symbol: string, periods: number = 10): Promise<number[]> {
    const currentPrice = await getCurrentPrice(symbol);

    // Generate simulated historical prices based on current price
    // This adds slight variations to simulate price movement
    const prices: number[] = [];
    let price = currentPrice;

    for (let i = 0; i < periods; i++) {
        // Add random variation (-2% to +2%)
        const variation = (Math.random() - 0.5) * 0.04;
        price = price * (1 - variation);
        prices.unshift(price); // Add to beginning (oldest first)
    }

    // Ensure last price is close to current price
    prices[prices.length - 1] = currentPrice;

    return prices;
}

/**
 * Clear price cache (useful for testing)
 */
export function clearPriceCache(): void {
    priceCache.clear();
}
