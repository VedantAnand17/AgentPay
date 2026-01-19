/**
 * x402 V2 Client Integration
 * 
 * This module provides x402 V2 payment integration with support for:
 * - Smart contract approvals (approve once, pay many)
 * - Server-side private key signing for agentic payments
 * - Browser wallet integration for user-controlled payments
 */

import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { WalletClient } from "viem";
import {
    getCurrentNetwork,
    getCurrentChainId,
    getCurrentUsdcAddress,
    type NetworkName,
} from "./config";

// Environment configuration
// Default to a test address if not set (users should set their own)
const DEFAULT_PAYMENT_ADDRESS = "0x0000000000000000000000000000000000000001" as `0x${string}`;

const X402_PAYMENT_ADDRESS = (process.env.X402_PAYMENT_ADDRESS || process.env.ADDRESS || DEFAULT_PAYMENT_ADDRESS) as `0x${string}`;

// Re-export USDC address from centralized config for backward compatibility
export const X402_USDC_ADDRESS = getCurrentUsdcAddress();

// Validate required environment variables
if (X402_PAYMENT_ADDRESS === DEFAULT_PAYMENT_ADDRESS) {
    console.warn("Warning: X402_PAYMENT_ADDRESS or ADDRESS not set. Using default test address. x402 payments may not work correctly.");
}

/**
 * Create an x402 V2 client for server-side (agentic) payments
 * Uses a private key for automatic payment signing
 */
export function createAgentX402Client(privateKey?: `0x${string}`): {
    client: x402Client;
    httpClient: x402HTTPClient;
    fetchWithPayment: typeof fetch;
} {
    const key = privateKey || process.env.AGENT_PRIVATE_KEY as `0x${string}`;

    if (!key) {
        throw new Error("Private key required for agent x402 client. Set AGENT_PRIVATE_KEY environment variable.");
    }

    // Create signer from private key
    const signer = privateKeyToAccount(key);

    // Create x402 client
    const client = new x402Client();

    // Register EVM exact payment scheme
    registerExactEvmScheme(client, { signer });

    // Create HTTP client for payment response handling
    const httpClient = new x402HTTPClient(client);

    // Create fetch wrapper with automatic payment handling
    const fetchWithPayment = wrapFetchWithPayment(fetch, client) as any as typeof fetch;

    return { client, httpClient, fetchWithPayment };
}

/**
 * Create an x402 V2 client for browser wallet integration
 * Uses the wallet client for user-controlled payment signing
 */
export function createBrowserX402Client(walletClient: WalletClient): {
    client: x402Client;
    httpClient: x402HTTPClient;
    fetchWithPayment: typeof fetch;
} | null {
    if (!walletClient?.account) {
        console.warn("Wallet client not connected");
        return null;
    }

    try {
        // Create x402 client
        const client = new x402Client();

        // Create a proper signer that wraps the walletClient
        // The signer must have both address AND signTypedData method
        const signer = {
            address: walletClient.account.address,
            signTypedData: async (message: {
                domain: Record<string, unknown>;
                types: Record<string, unknown>;
                primaryType: string;
                message: Record<string, unknown>;
            }) => {
                return await walletClient.signTypedData({
                    account: walletClient.account!,
                    domain: message.domain as any,
                    types: message.types as any,
                    primaryType: message.primaryType,
                    message: message.message,
                });
            },
        };

        // Register EVM exact payment scheme with the proper signer
        registerExactEvmScheme(client, { signer });

        // Create HTTP client
        const httpClient = new x402HTTPClient(client);

        // Create fetch wrapper
        const fetchWithPayment = wrapFetchWithPayment(fetch, client) as any as typeof fetch;

        return { client, httpClient, fetchWithPayment };
    } catch (error) {
        console.error("Failed to create browser x402 client:", error);
        return null;
    }
}

/**
 * Get the network name for x402
 */
export function getX402Network(): string {
    return getCurrentNetwork();
}

/**
 * Get the payment address
 */
export function getX402PaymentAddress(): `0x${string}` {
    return X402_PAYMENT_ADDRESS;
}

/**
 * x402 payment configuration for a trade
 */
export interface X402PaymentConfig {
    price: string; // e.g., "$5.00"
    network: string;
    payTo: `0x${string}`;
    asset: `0x${string}`;
    description: string;
    maxTimeoutSeconds?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Generate x402 payment configuration for a trade intent
 */
export function getX402PaymentConfig(intent: {
    id: string;
    userAddress: string;
    symbol: string;
    side: string;
    size: number;
    expectedPaymentAmount: string;
}): X402PaymentConfig {
    return {
        price: `$${intent.expectedPaymentAmount}`,
        network: getX402Network(),
        payTo: X402_PAYMENT_ADDRESS,
        asset: X402_USDC_ADDRESS,
        description: `Execute ${intent.side} trade for ${intent.symbol}`,
        maxTimeoutSeconds: 90,
        metadata: {
            tradeIntentId: intent.id,
            userAddress: intent.userAddress,
            symbol: intent.symbol,
            side: intent.side,
            size: intent.size,
        },
    };
}

/**
 * Get chain ID for the current network
 */
export function getX402ChainId(): number {
    return getCurrentChainId();
}

