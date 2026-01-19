/**
 * Centralized Network Configuration
 * 
 * Single source of truth for all network-related constants.
 * Import from here instead of hardcoding chain IDs and addresses.
 */

import { baseSepolia, base } from "viem/chains";

// Network identifiers
export type NetworkName = "base-sepolia" | "base";

// Chain ID mapping
export const CHAIN_IDS: Record<NetworkName, number> = {
    "base-sepolia": 84532,
    "base": 8453,
} as const;

// Viem chain objects
export const CHAINS = {
    "base-sepolia": baseSepolia,
    "base": base,
} as const;

// RPC URLs (with fallbacks)
export const RPC_URLS: Record<NetworkName, string> = {
    "base-sepolia": process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    "base": process.env.BASE_RPC_URL || "https://mainnet.base.org",
} as const;

// USDC addresses per network
export const USDC_ADDRESSES: Record<NetworkName, `0x${string}`> = {
    "base-sepolia": (process.env.BASE_SEPOLIA_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`,
    "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
} as const;

// Block explorer URLs
export const EXPLORER_URLS: Record<NetworkName, string> = {
    "base-sepolia": "https://sepolia.basescan.org",
    "base": "https://basescan.org",
} as const;

// Get current network from environment
export function getCurrentNetwork(): NetworkName {
    const useMainnet = process.env.X402_ENV === "mainnet";
    return useMainnet ? "base" : (process.env.X402_NETWORK as NetworkName) || "base-sepolia";
}

// Get chain ID for current network
export function getCurrentChainId(): number {
    return CHAIN_IDS[getCurrentNetwork()];
}

// Get USDC address for current network
export function getCurrentUsdcAddress(): `0x${string}` {
    return USDC_ADDRESSES[getCurrentNetwork()];
}

// Get viem chain for current network
export function getCurrentChain() {
    return CHAINS[getCurrentNetwork()];
}

// Get RPC URL for current network
export function getCurrentRpcUrl(): string {
    return RPC_URLS[getCurrentNetwork()];
}

// Get explorer URL for current network
export function getExplorerUrl(): string {
    return EXPLORER_URLS[getCurrentNetwork()];
}

// Get transaction URL for explorer
export function getTransactionUrl(txHash: string): string {
    return `${getExplorerUrl()}/tx/${txHash}`;
}

// Get address URL for explorer
export function getAddressUrl(address: string): string {
    return `${getExplorerUrl()}/address/${address}`;
}

// CAIP-2 formatted network (e.g., "eip155:84532")
export function getNetworkCAIP2(): `eip155:${number}` {
    return `eip155:${getCurrentChainId()}`;
}

// Check if we're on mainnet
export function isMainnet(): boolean {
    return getCurrentNetwork() === "base";
}

// Check if we're on testnet
export function isTestnet(): boolean {
    return getCurrentNetwork() === "base-sepolia";
}
