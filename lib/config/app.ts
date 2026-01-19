/**
 * Application Configuration
 * 
 * Centralized app-level configuration including version, fees, and UI strings.
 */

import pkg from "../../package.json";

// App version from package.json
export const APP_VERSION = pkg.version || "1.0.0";

// App metadata
export const APP_NAME = "AgentPay";
export const APP_DESCRIPTION = "AI-Powered Trading Relay with x402 Payments";

// Fee configuration (from environment or defaults)
export const FEE_CONFIG = {
    // Consultancy fee for AI agent suggestions
    consultancyFee: parseFloat(process.env.CONSULTANCY_FEE || "0.10"),

    // Trade execution fee percentage (0.001 = 0.1%)
    tradeFeePercentage: parseFloat(process.env.TRADE_FEE_PERCENTAGE || "0.001"),

    // Minimum trade fee in USD
    minTradeFee: parseFloat(process.env.MIN_TRADE_FEE || "0.001"),

    // Maximum trade fee in USD
    maxTradeFee: parseFloat(process.env.MAX_TRADE_FEE || "1.00"),
} as const;

// Get formatted consultancy fee (e.g., "$0.10")
export function getConsultancyFeeFormatted(): string {
    return `$${FEE_CONFIG.consultancyFee.toFixed(2)}`;
}

// Calculate trade fee based on size
export function calculateTradeFee(tradeSize: number): number {
    const calculatedFee = tradeSize * FEE_CONFIG.tradeFeePercentage;
    return Math.max(FEE_CONFIG.minTradeFee, Math.min(FEE_CONFIG.maxTradeFee, calculatedFee));
}

// Slippage configuration
export const SLIPPAGE_CONFIG = {
    // Default slippage tolerance (0.05 = 5%)
    default: parseFloat(process.env.SLIPPAGE_TOLERANCE || "0.05"),

    // Minimum allowed slippage
    min: 0.001, // 0.1%

    // Maximum allowed slippage
    max: 0.50, // 50%
} as const;

// x402 payment configuration
export const X402_CONFIG = {
    // Payment timeout in seconds
    maxTimeoutSeconds: parseInt(process.env.X402_MAX_TIMEOUT || "90", 10),

    // Facilitator URL
    facilitatorUrl: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
} as const;

// WalletConnect configuration with validation
export function getWalletConnectProjectId(): string {
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

    // In production, require a valid project ID
    if (process.env.NODE_ENV === "production" && (!projectId || projectId === "your-project-id")) {
        throw new Error(
            "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required in production. " +
            "Get a project ID from https://cloud.walletconnect.com/"
        );
    }

    // In development, warn but allow fallback
    if (!projectId || projectId === "your-project-id") {
        console.warn(
            "⚠️  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. " +
            "WalletConnect will not work properly. " +
            "Get a project ID from https://cloud.walletconnect.com/"
        );
        return "your-project-id"; // Fallback for development only
    }

    return projectId;
}

// Database configuration
export const DB_CONFIG = {
    path: process.env.DATABASE_PATH,
} as const;

// Spending limit tiers for x402 approvals
export const SPENDING_LIMIT_TIERS = {
    small: { amount: 10, label: "$10" },
    medium: { amount: 50, label: "$50" },
    large: { amount: 100, label: "$100" },
    unlimited: { amount: 1000000, label: "Unlimited" },
} as const;

export type SpendingLimitTier = keyof typeof SPENDING_LIMIT_TIERS;
