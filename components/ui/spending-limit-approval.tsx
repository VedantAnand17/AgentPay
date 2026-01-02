"use client";

/**
 * Spending Limit Approval Component
 * 
 * Allows users to approve a one-time spending limit for x402 payments.
 * Once approved, all subsequent payments within the limit are automatic.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield,
    Check,
    AlertCircle,
    Loader2,
    Wallet,
    Lock,
    Unlock,
    ChevronRight,
    RefreshCw,
    ExternalLink
} from "lucide-react";
import { Button } from "./button";

interface SpendingLimitApprovalProps {
    isOpen: boolean;
    onClose: () => void;
    onApprovalComplete: (txHash: string, limit: string) => void;
    approvalStatus: {
        isApproved: boolean;
        currentAllowance: string;
        formattedAllowance: string;
        formattedBalance: string;
        hasSufficientBalance: boolean;
        tokenSymbol: string;
    } | null;
    onRequestApproval: (limit: "small" | "medium" | "large" | "unlimited") => Promise<{ txHash: string; approvedAmount: string }>;
    onRevokeApproval?: () => Promise<{ txHash: string }>;
    isLoading?: boolean;
    error?: string;
    chainId?: number;
}

const SPENDING_LIMITS = {
    small: { amount: 10, label: "$10", description: "Good for occasional trades" },
    medium: { amount: 50, label: "$50", description: "Regular trading activity" },
    large: { amount: 100, label: "$100", description: "Active trader" },
    unlimited: { amount: 1000000, label: "Unlimited", description: "Maximum flexibility" },
} as const;

export function SpendingLimitApproval({
    isOpen,
    onClose,
    onApprovalComplete,
    approvalStatus,
    onRequestApproval,
    onRevokeApproval,
    isLoading = false,
    error,
    chainId,
}: SpendingLimitApprovalProps) {
    const [selectedLimit, setSelectedLimit] = useState<keyof typeof SPENDING_LIMITS>("medium");
    const [isApproving, setIsApproving] = useState(false);
    const [isRevoking, setIsRevoking] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [successTx, setSuccessTx] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalError(null);
            setSuccessTx(null);
        }
    }, [isOpen]);

    const handleApprove = async () => {
        setIsApproving(true);
        setLocalError(null);
        try {
            const result = await onRequestApproval(selectedLimit);
            setSuccessTx(result.txHash);
            onApprovalComplete(result.txHash, result.approvedAmount);
        } catch (err: any) {
            setLocalError(err.message || "Approval failed");
        } finally {
            setIsApproving(false);
        }
    };

    const handleRevoke = async () => {
        if (!onRevokeApproval) return;
        setIsRevoking(true);
        setLocalError(null);
        try {
            await onRevokeApproval();
            onClose();
        } catch (err: any) {
            setLocalError(err.message || "Revoke failed");
        } finally {
            setIsRevoking(false);
        }
    };

    const getExplorerUrl = (txHash: string) => {
        const baseUrl = chainId === 8453
            ? "https://basescan.org/tx/"
            : "https://sepolia.basescan.org/tx/";
        return `${baseUrl}${txHash}`;
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-lg bg-black border border-white/10 overflow-hidden"
                >
                    {/* Header */}
                    <div className="border-b border-white/10 p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 border border-primary/20">
                                <Shield className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold uppercase tracking-widest">
                                    Spending Limit
                                </h2>
                                <p className="text-xs text-muted-foreground font-mono">
                                    Approve once, pay automatically
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Current Status */}
                        <div className="bg-white/5 border border-white/10 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                                    Current Allowance
                                </span>
                                <div className="flex items-center gap-2">
                                    {approvalStatus?.isApproved ? (
                                        <div className="flex items-center gap-1 text-green-500 text-xs">
                                            <Unlock className="w-3 h-3" />
                                            Approved
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-amber-500 text-xs">
                                            <Lock className="w-3 h-3" />
                                            Not Approved
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-bold font-mono">
                                        ${approvalStatus?.formattedAllowance || "0.00"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {approvalStatus?.tokenSymbol || "USDC"} remaining
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Balance</p>
                                    <p className="font-mono">
                                        ${approvalStatus?.formattedBalance || "0.00"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Success State */}
                        {successTx && (
                            <div className="bg-green-950/30 border border-green-500/30 p-4">
                                <div className="flex items-start gap-3">
                                    <Check className="w-5 h-5 text-green-500 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-green-400 font-bold text-sm uppercase tracking-wider">
                                            Approval Confirmed
                                        </p>
                                        <p className="text-green-300/80 text-xs mt-1">
                                            Your spending limit is now active. All payments within this limit will be automatic.
                                        </p>
                                        <a
                                            href={getExplorerUrl(successTx)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 mt-2"
                                        >
                                            View Transaction
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Limit Selection */}
                        {!successTx && (
                            <div className="space-y-3">
                                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                                    Select Spending Limit
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(Object.entries(SPENDING_LIMITS) as [keyof typeof SPENDING_LIMITS, typeof SPENDING_LIMITS[keyof typeof SPENDING_LIMITS]][]).map(([key, limit]) => (
                                        <button
                                            key={key}
                                            onClick={() => setSelectedLimit(key)}
                                            disabled={isApproving || isLoading}
                                            className={`p-3 border text-left transition-all ${selectedLimit === key
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-white/10 hover:border-white/20 text-foreground"
                                                } ${isApproving || isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold font-mono">{limit.label}</span>
                                                {selectedLimit === key && (
                                                    <Check className="w-4 h-4 text-primary" />
                                                )}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {limit.description}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Info Box */}
                        {!successTx && (
                            <div className="bg-blue-950/20 border border-blue-500/20 p-4">
                                <div className="flex gap-3">
                                    <Wallet className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                    <div className="text-xs text-blue-300/80 space-y-1">
                                        <p>
                                            <strong className="text-blue-400">One-time approval:</strong> You'll sign a single transaction to set your spending limit.
                                        </p>
                                        <p>
                                            <strong className="text-blue-400">After approval:</strong> All payments within this limit are automatic — no more popups!
                                        </p>
                                        <p>
                                            <strong className="text-blue-400">Full control:</strong> You can revoke or change your limit at any time.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {(error || localError) && (
                            <div className="bg-red-950/30 border border-red-500/30 p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-red-400">{error || localError}</p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="border-t border-white/10 p-4 flex gap-3">
                        {successTx ? (
                            <Button
                                onClick={onClose}
                                className="flex-1 h-12 rounded-none bg-primary text-black hover:bg-primary/90 font-bold uppercase tracking-wider"
                            >
                                Continue Trading
                            </Button>
                        ) : (
                            <>
                                <Button
                                    onClick={onClose}
                                    variant="outline"
                                    className="flex-1 h-12 rounded-none border-white/20"
                                    disabled={isApproving || isLoading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleApprove}
                                    disabled={isApproving || isLoading || !approvalStatus?.hasSufficientBalance}
                                    className="flex-1 h-12 rounded-none bg-primary text-black hover:bg-primary/90 font-bold uppercase tracking-wider"
                                >
                                    {isApproving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Approving...
                                        </>
                                    ) : (
                                        <>
                                            Approve {SPENDING_LIMITS[selectedLimit].label}
                                            <ChevronRight className="w-4 h-4 ml-1" />
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Revoke Option */}
                    {approvalStatus?.isApproved && !successTx && onRevokeApproval && (
                        <div className="border-t border-white/10 p-4">
                            <button
                                onClick={handleRevoke}
                                disabled={isRevoking}
                                className="w-full text-center text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center justify-center gap-2"
                            >
                                {isRevoking ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Revoking...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-3 h-3" />
                                        Revoke Current Approval
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
