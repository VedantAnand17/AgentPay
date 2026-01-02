/**
 * x402 Token Approval Manager
 * 
 * Handles ERC20 token approvals for x402 payments:
 * - Check existing allowances
 * - Request one-time approval for spending limit
 * - Track approval status per user
 * 
 * With smart contract approvals, users approve ONCE and all subsequent
 * payments within that limit are automatic (no MetaMask popups).
 */

import { createPublicClient, createWalletClient, http, formatUnits, parseUnits, custom } from "viem";
import { baseSepolia, base } from "viem/chains";
import type { WalletClient, PublicClient, Address } from "viem";
import { getX402Network, X402_USDC_ADDRESS, getX402PaymentAddress } from "./x402-v2";

// ERC20 ABI for approval operations
const ERC20_APPROVAL_ABI = [
    {
        name: "allowance",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "decimals",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
    },
    {
        name: "symbol",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
] as const;

// Get the chain configuration
function getChain() {
    return getX402Network() === "base" ? base : baseSepolia;
}

// Create public client for reading blockchain state
function getPublicClient() {
    const chain = getChain();
    return createPublicClient({
        chain,
        transport: http(),
    }) as any;
}

/**
 * Spending limit tiers for user convenience
 */
export const SPENDING_LIMIT_TIERS = {
    small: { amount: 10, label: "$10" },
    medium: { amount: 50, label: "$50" },
    large: { amount: 100, label: "$100" },
    unlimited: { amount: 1000000, label: "Unlimited" }, // Max approval
} as const;

export type SpendingLimitTier = keyof typeof SPENDING_LIMIT_TIERS;

/**
 * Approval status for a user
 */
export interface ApprovalStatus {
    isApproved: boolean;
    currentAllowance: bigint;
    formattedAllowance: string;
    sufficientForPayment: boolean;
    userBalance: bigint;
    formattedBalance: string;
    hasSufficientBalance: boolean;
    tokenSymbol: string;
    tokenDecimals: number;
    spenderAddress: `0x${string}`;
    tokenAddress: `0x${string}`;
}

/**
 * Check the current approval status for a user
 */
export async function checkApprovalStatus(
    userAddress: `0x${string}`,
    requiredAmount: number = 5 // Default $5 payment
): Promise<ApprovalStatus> {
    const spenderAddress = getX402PaymentAddress();
    const tokenAddress = X402_USDC_ADDRESS;

    // Validate addresses
    if (!userAddress || !userAddress.startsWith('0x') || userAddress.length !== 42) {
        throw new Error(`Invalid user address: ${userAddress}`);
    }
    if (!tokenAddress || !tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
        throw new Error(`Invalid token address: ${tokenAddress}. Check your environment variables.`);
    }
    if (!spenderAddress || !spenderAddress.startsWith('0x') || spenderAddress.length !== 42) {
        throw new Error(`Invalid spender address: ${spenderAddress}. Check your environment variables.`);
    }

    const publicClient = getPublicClient();

    // Get token info
    const [decimals, symbol] = await Promise.all([
        publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_APPROVAL_ABI,
            functionName: "decimals",
        }),
        publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_APPROVAL_ABI,
            functionName: "symbol",
        }),
    ]);

    // Get allowance and balance
    const [allowance, balance] = await Promise.all([
        publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_APPROVAL_ABI,
            functionName: "allowance",
            args: [userAddress, spenderAddress],
        }),
        publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_APPROVAL_ABI,
            functionName: "balanceOf",
            args: [userAddress],
        }),
    ]);

    const requiredAmountWei = parseUnits(requiredAmount.toString(), decimals);

    return {
        isApproved: allowance > 0n,
        currentAllowance: allowance,
        formattedAllowance: formatUnits(allowance, decimals),
        sufficientForPayment: allowance >= requiredAmountWei,
        userBalance: balance,
        formattedBalance: formatUnits(balance, decimals),
        hasSufficientBalance: balance >= requiredAmountWei,
        tokenSymbol: symbol,
        tokenDecimals: decimals,
        spenderAddress,
        tokenAddress,
    };
}

/**
 * Request token approval from the user
 * This is the ONE-TIME approval that unlocks automatic payments
 * 
 * @param walletClient - The user's wallet client
 * @param spendingLimit - The spending limit tier to approve
 * @returns Transaction hash of the approval
 */
export async function requestApproval(
    walletClient: WalletClient,
    spendingLimit: SpendingLimitTier = "medium"
): Promise<{ txHash: `0x${string}`; approvedAmount: string }> {
    if (!walletClient.account) {
        throw new Error("Wallet not connected");
    }

    const publicClient = getPublicClient();
    const spenderAddress = getX402PaymentAddress();
    const tokenAddress = X402_USDC_ADDRESS;

    // Get token decimals
    const decimals = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_APPROVAL_ABI,
        functionName: "decimals",
    });

    // Calculate approval amount
    const tier = SPENDING_LIMIT_TIERS[spendingLimit];
    const approvalAmount = parseUnits(tier.amount.toString(), decimals);

    // Request approval transaction
    const txHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_APPROVAL_ABI,
        functionName: "approve",
        args: [spenderAddress, approvalAmount],
        account: walletClient.account,
        chain: getChain(),
    });

    // Wait for transaction confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return {
        txHash,
        approvedAmount: tier.label,
    };
}

/**
 * Revoke token approval (set allowance to 0)
 */
export async function revokeApproval(
    walletClient: WalletClient
): Promise<{ txHash: `0x${string}` }> {
    if (!walletClient.account) {
        throw new Error("Wallet not connected");
    }

    const publicClient = getPublicClient();
    const spenderAddress = getX402PaymentAddress();
    const tokenAddress = X402_USDC_ADDRESS;

    // Set approval to 0
    const txHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_APPROVAL_ABI,
        functionName: "approve",
        args: [spenderAddress, 0n],
        account: walletClient.account,
        chain: getChain(),
    });

    // Wait for transaction confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return { txHash };
}

/**
 * Check if user has sufficient approval for a payment
 */
export async function hasSufficientApproval(
    userAddress: `0x${string}`,
    paymentAmount: number
): Promise<boolean> {
    const status = await checkApprovalStatus(userAddress, paymentAmount);
    return status.sufficientForPayment && status.hasSufficientBalance;
}

/**
 * Get recommended spending limit based on usage
 */
export function getRecommendedSpendingLimit(
    averageTradesPerDay: number = 5,
    averageTradeAmount: number = 5
): SpendingLimitTier {
    const estimatedMonthlySpend = averageTradesPerDay * averageTradeAmount * 30;

    if (estimatedMonthlySpend <= 10) return "small";
    if (estimatedMonthlySpend <= 50) return "medium";
    if (estimatedMonthlySpend <= 100) return "large";
    return "unlimited";
}

/**
 * Create a pre-approved payment session
 * Once approved, all payments within the limit require no user interaction
 */
export interface PaymentSession {
    userAddress: `0x${string}`;
    approvalStatus: ApprovalStatus;
    canMakePayment: (amount: number) => Promise<boolean>;
    remainingAllowance: () => Promise<string>;
}

export async function createPaymentSession(
    userAddress: `0x${string}`
): Promise<PaymentSession> {
    const initialStatus = await checkApprovalStatus(userAddress);

    return {
        userAddress,
        approvalStatus: initialStatus,

        async canMakePayment(amount: number): Promise<boolean> {
            const status = await checkApprovalStatus(userAddress, amount);
            return status.sufficientForPayment && status.hasSufficientBalance;
        },

        async remainingAllowance(): Promise<string> {
            const status = await checkApprovalStatus(userAddress);
            return status.formattedAllowance;
        },
    };
}
