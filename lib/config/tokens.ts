/**
 * Centralized Token Configuration
 * 
 * Single source of truth for all supported tokens.
 * Import SUPPORTED_SYMBOLS from here instead of hardcoding.
 */

// Token configuration interface
export interface TokenConfig {
    address: `0x${string}`;
    decimals: number;
    symbol: string;
    name: string;
}

// All supported tokens with their configurations
// These are derived from environment variables with fallbacks
export const TOKEN_CONFIGS: Record<string, TokenConfig> = {
    USDC: {
        address: (process.env.MOCK_USDC_ADDRESS || "0xB66d47e7D179695DA224D146948B55a8014Bbd6a") as `0x${string}`,
        decimals: 6,
        symbol: "USDC",
        name: "USD Coin",
    },
    WBTC: {
        address: (process.env.MOCK_WBTC_ADDRESS || "0x6FB6190cDa2ffdC1B2310Df62d5a3C0D4E1cFe29") as `0x${string}`,
        decimals: 8,
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
    },
    BTC: {
        // BTC is an alias for WBTC in our system
        address: (process.env.MOCK_WBTC_ADDRESS || "0x6FB6190cDa2ffdC1B2310Df62d5a3C0D4E1cFe29") as `0x${string}`,
        decimals: 8,
        symbol: "BTC",
        name: "Bitcoin (via WBTC)",
    },
    WETH: {
        address: (process.env.WETH_ADDRESS || "0x4200000000000000000000000000000000000006") as `0x${string}`,
        decimals: 18,
        symbol: "WETH",
        name: "Wrapped Ether",
    },
} as const;

// Supported trading symbols (derived from TOKEN_CONFIGS, excluding stablecoins)
export const SUPPORTED_TRADING_SYMBOLS = Object.keys(TOKEN_CONFIGS).filter(
    (symbol) => symbol !== "USDC" // Exclude stablecoins from trading pairs
);

// Check if a symbol is supported for trading
export function isSupportedSymbol(symbol: string): boolean {
    return SUPPORTED_TRADING_SYMBOLS.includes(symbol.toUpperCase());
}

// Get token config by symbol
export function getTokenConfig(symbol: string): TokenConfig | undefined {
    return TOKEN_CONFIGS[symbol.toUpperCase()];
}

// Get token address by symbol
export function getTokenAddress(symbol: string): `0x${string}` | undefined {
    return TOKEN_CONFIGS[symbol.toUpperCase()]?.address;
}

// Get token decimals by symbol
export function getTokenDecimals(symbol: string): number | undefined {
    return TOKEN_CONFIGS[symbol.toUpperCase()]?.decimals;
}

// Validate symbol and return error message if invalid
export function validateSymbol(symbol: string): { valid: boolean; error?: string } {
    if (!symbol) {
        return { valid: false, error: "Symbol is required" };
    }

    const upperSymbol = symbol.toUpperCase();

    if (!isSupportedSymbol(upperSymbol)) {
        const supportedList = SUPPORTED_TRADING_SYMBOLS.join(", ");
        return {
            valid: false,
            error: `Symbol '${symbol}' is not supported. Supported symbols: ${supportedList}`
        };
    }

    return { valid: true };
}

// Quote tokens (what we trade against)
export const QUOTE_TOKEN = TOKEN_CONFIGS.USDC;

// Base tokens (what we can trade)
export const BASE_TOKENS = Object.entries(TOKEN_CONFIGS)
    .filter(([symbol]) => symbol !== "USDC")
    .map(([_, config]) => config);
