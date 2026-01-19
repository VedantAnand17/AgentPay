"use client";

// Trade Console page with wagmi and x402 V2 integration
// Supports smart contract approvals for automatic payments

// Extend Window interface to include ethereum provider
declare global {
  interface Window {
    ethereum?: any;
  }
}
import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAccount, useWalletClient, useDisconnect, useSwitchChain, useChainId } from "wagmi";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { createWalletClient, custom, http } from "viem";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { Agent, TradeIntent, ExecutedTrade } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import { Info, AlertCircle, CheckCircle2, Wallet, ArrowRightLeft, ArrowRight, TrendingUp, Loader2, Zap, ShieldCheck, Activity, Terminal, Lock, Key, Cpu, Radio, Network, Unlock } from "lucide-react";
import {
  checkApprovalStatus,
  requestApproval,
  revokeApproval,
  type SpendingLimitTier,
} from "@/lib/x402-approval";
import { APP_VERSION } from "@/lib/config/app";

// Dynamic imports for heavy components - loads after initial render
// This reduces main bundle size and improves Time to Interactive (TTI)
const PaymentCheckout = dynamic(
  () => import("@/components/ui/payment-checkout").then((m) => m.PaymentCheckout),
  { ssr: false }
);

const PortfolioBalance = dynamic(
  () => import("@/components/ui/portfolio-balance").then((m) => m.PortfolioBalance),
  { ssr: false }
);

const SpendingLimitApproval = dynamic(
  () => import("@/components/ui/spending-limit-approval").then((m) => m.SpendingLimitApproval),
  { ssr: false }
);

export default function TradePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("BTC");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState<string>("10");
  const [leverage] = useState<string>("1"); // Hidden - not used for spot trades
  const [suggestion, setSuggestion] = useState<any>(null);
  const [tradeIntent, setTradeIntent] = useState<TradeIntent | null>(null);
  const [executedTrade, setExecutedTrade] = useState<any>(null);
  const [recentTrades, setRecentTrades] = useState<Array<ExecutedTrade & { tradeIntent?: TradeIntent }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentRequirements, setPaymentRequirements] = useState<any>(null);
  const [pendingRequest, setPendingRequest] = useState<{ url: string; options: RequestInit } | null>(null);
  const [pendingConsultancyRequest, setPendingConsultancyRequest] = useState<{ url: string; options: RequestInit } | null>(null);
  const [isConsultancyPayment, setIsConsultancyPayment] = useState(false);

  // x402 V2 spending limit approval state
  // UI-specific type that matches what SpendingLimitApproval component expects
  interface UIApprovalStatus {
    isApproved: boolean;
    currentAllowance: string;
    formattedAllowance: string;
    formattedBalance: string;
    hasSufficientBalance: boolean;
    tokenSymbol: string;
  }
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<UIApprovalStatus | null>(null);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();

  // Check approval status when address changes
  const refreshApprovalStatus = useCallback(async () => {
    if (!address) {
      setApprovalStatus(null);
      return;
    }
    setIsCheckingApproval(true);
    setApprovalError(null);
    try {
      const status = await checkApprovalStatus(address as `0x${string}`);
      setApprovalStatus({
        isApproved: status.isApproved,
        currentAllowance: status.formattedAllowance,
        formattedAllowance: status.formattedAllowance,
        formattedBalance: status.formattedBalance,
        hasSufficientBalance: status.hasSufficientBalance,
        tokenSymbol: status.tokenSymbol,
      });
    } catch (err: any) {
      console.error("Failed to check approval status:", err);
      setApprovalError(err.message || "Failed to check approval status");
      // Set default status on error
      setApprovalStatus({
        isApproved: false,
        currentAllowance: "0",
        formattedAllowance: "0.00",
        formattedBalance: "0.00",
        hasSufficientBalance: false,
        tokenSymbol: "USDC",
      });
    } finally {
      setIsCheckingApproval(false);
    }
  }, [address]);

  useEffect(() => {
    refreshApprovalStatus();
  }, [refreshApprovalStatus]);

  // Create x402 V2 client with wallet signer
  const { fetchWithPayment, x402ClientInstance } = useMemo(() => {
    if (!walletClient || !isConnected || !walletClient.account) {
      console.warn("Wallet not connected, x402-fetch will not handle payments");
      return { fetchWithPayment: fetch, x402ClientInstance: null };
    }

    // Ensure we're on the correct chain before initializing x402-fetch
    if (chainId !== baseSepolia.id) {
      console.warn(`Wallet is on chain ${chainId}, but Base Sepolia (${baseSepolia.id}) is required`);
      return { fetchWithPayment: fetch, x402ClientInstance: null };
    }

    try {
      // Create x402 V2 client
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
            account: walletClient.account,
            domain: message.domain as any,
            types: message.types as any,
            primaryType: message.primaryType,
            message: message.message,
          });
        },
      };

      // Register EVM exact payment scheme with the proper signer
      registerExactEvmScheme(client, { signer });

      console.log("Initialized x402 V2 client:", {
        account: walletClient.account?.address,
        chain: walletClient.chain?.name,
        chainId: chainId,
        version: "V2",
      });

      // Wrap fetch with automatic payment handling
      const wrappedFetch = wrapFetchWithPayment(fetch, client);

      return { fetchWithPayment: wrappedFetch, x402ClientInstance: client };
    } catch (err) {
      console.error("Failed to initialize x402 V2 client:", err);
      return { fetchWithPayment: fetch, x402ClientInstance: null };
    }
  }, [walletClient, isConnected, chainId]);

  // Handle spending limit approval
  const handleRequestApproval = async (limit: SpendingLimitTier): Promise<{ txHash: string; approvedAmount: string }> => {
    if (!walletClient) throw new Error("Wallet not connected");
    const result = await requestApproval(walletClient, limit);
    await refreshApprovalStatus();
    return result;
  };

  const handleRevokeApproval = async (): Promise<{ txHash: string }> => {
    if (!walletClient) throw new Error("Wallet not connected");
    const result = await revokeApproval(walletClient);
    await refreshApprovalStatus();
    return result;
  };

  const handleApprovalComplete = (txHash: string, limit: string) => {
    console.log("Approval complete:", { txHash, limit });
    // Modal will close itself after showing success
  };

  // Load agents on mount
  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Failed to load agents:", err);
        setAgents([]);
      });
  }, []);

  // Load recent trades on mount
  useEffect(() => {
    fetch("/api/trades")
      .then((res) => res.json())
      .then((data) => setRecentTrades(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("Failed to load trades:", err);
        setRecentTrades([]);
      });
  }, []);

  // Update userAddress when wallet connects
  useEffect(() => {
    if (address) {
      // Address is automatically available from wagmi
    }
  }, [address]);

  const handleGetSuggestion = async () => {
    if (!selectedAgent || !symbol) {
      setError("Please select an agent and symbol");
      return;
    }

    if (!isConnected || !address) {
      setError("Please connect your wallet first to pay for AI consultancy");
      return;
    }

    // Check if wallet is on the correct chain (Base Sepolia)
    if (chainId !== baseSepolia.id) {
      try {
        await switchChain({ chainId: baseSepolia.id });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (switchError: any) {
        setError(
          `Please switch to Base Sepolia network (Chain ID: ${baseSepolia.id}) in your wallet. ` +
          `Current chain: ${chainId}. Error: ${switchError.message || "Chain switch failed"}`
        );
        return;
      }
    }

    setLoading(true);
    setError("");
    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${baseUrl}/api/agents/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgent, symbol }),
      });

      // If 402 Payment Required, show payment modal first
      if (res.status === 402) {
        const data = await res.json();
        setPaymentRequirements(data);
        setPendingConsultancyRequest({
          url: `${baseUrl}/api/agents/suggest`,
          options: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: selectedAgent, symbol }),
          },
        });
        setIsConsultancyPayment(true);
        setShowPaymentModal(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get suggestion");
      }

      const data = await res.json();
      setSuggestion(data);
      setSide(data.side);
      // Don't overwrite user's size - keep their entered value
      // setSize(data.size.toString());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePaymentRequest = async () => {
    if (!address || !selectedAgent || !symbol || !side || !size) {
      setError("Please connect wallet and fill in all fields");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trades/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          agentId: selectedAgent,
          symbol,
          side,
          size: parseFloat(size),
          leverage: parseInt(leverage),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create payment request");
      }

      const data = await res.json();
      setTradeIntent(data.tradeIntent);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteTrade = async () => {
    if (!tradeIntent) {
      setError("No trade intent found");
      return;
    }

    if (!isConnected || !address) {
      setError("Please connect your wallet first");
      return;
    }

    // Check if wallet is on the correct chain (Base Sepolia)
    if (chainId !== baseSepolia.id) {
      try {
        // Attempt to switch to Base Sepolia
        await switchChain({ chainId: baseSepolia.id });
        // Wait a bit for the chain switch to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (switchError: any) {
        setError(
          `Please switch to Base Sepolia network (Chain ID: ${baseSepolia.id}) in your wallet. ` +
          `Current chain: ${chainId}. Error: ${switchError.message || "Chain switch failed"}`
        );
        setLoading(false);
        return;
      }
    }

    setError("");
    try {
      // Make initial request to check for payment requirement
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${baseUrl}/api/trades/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeIntentId: tradeIntent.id }),
      });

      // If 402 Payment Required, show payment modal first
      if (res.status === 402) {
        const data = await res.json();
        setPaymentRequirements(data);
        setPendingRequest({
          url: `${baseUrl}/api/trades/execute`,
          options: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tradeIntentId: tradeIntent.id }),
          },
        });
        setShowPaymentModal(true);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to execute trade");
      }

      const data = await res.json();
      setExecutedTrade(data.executedTrade);

      // Refresh recent trades
      const tradesRes = await fetch("/api/trades");
      const tradesData = await tradesRes.json();
      setRecentTrades(Array.isArray(tradesData) ? tradesData : []);
    } catch (err: any) {
      console.error("Trade execution error:", err);
      setError(err.message || "Failed to execute trade");
    }
  };

  const handleConfirmPayment = async () => {
    const requestToProcess = pendingRequest || pendingConsultancyRequest;
    if (!requestToProcess) return;

    if (!walletClient || !isConnected || !walletClient.account) {
      setError("Wallet not connected. Please connect your wallet first.");
      return;
    }

    setLoading(true);
    try {
      // Check if wallet is on the correct chain (Base Sepolia)
      if (chainId !== baseSepolia.id) {
        try {
          // Attempt to switch to Base Sepolia
          await switchChain({ chainId: baseSepolia.id });
          // Wait for the chain switch to complete
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } catch (switchError: any) {
          throw new Error(
            `Please switch to Base Sepolia network (Chain ID: ${baseSepolia.id}) in your wallet. ` +
            `Current chain: ${chainId}. Error: ${switchError.message || "Chain switch failed"}`
          );
        }
      }

      // Check if user has pre-approved spending limit
      if (address) {
        await refreshApprovalStatus();

        // If user has sufficient approval, payment should be automatic
        if (approvalStatus?.isApproved && parseFloat(approvalStatus.formattedAllowance || "0") >= 5) {
          console.log("User has pre-approved spending limit, proceeding with automatic payment");
        } else {
          console.log("User needs to sign payment (no pre-approval or insufficient allowance)");
        }
      }

      // Create a fresh wallet client on the correct chain using the injected provider
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("No wallet provider found. Please install MetaMask or another wallet.");
      }

      const freshWalletClient = createWalletClient({
        account: walletClient.account,
        chain: baseSepolia,
        transport: custom(window.ethereum),
      });

      console.log("Using x402 V2 client for payment:", {
        account: freshWalletClient.account?.address,
        chain: freshWalletClient.chain?.name,
        chainId: freshWalletClient.chain?.id,
        version: "V2",
        hasApproval: approvalStatus?.isApproved,
      });

      // Create a fresh x402 V2 client with proper signer wrapper
      const freshClient = new x402Client();
      const freshSigner = {
        address: freshWalletClient.account!.address,
        signTypedData: async (message: {
          domain: Record<string, unknown>;
          types: Record<string, unknown>;
          primaryType: string;
          message: Record<string, unknown>;
        }) => {
          return await freshWalletClient.signTypedData({
            account: freshWalletClient.account!,
            domain: message.domain as any,
            types: message.types as any,
            primaryType: message.primaryType,
            message: message.message,
          });
        },
      };
      registerExactEvmScheme(freshClient, { signer: freshSigner });

      // Create x402-fetch wrapper - with pre-approval, this won't require signature popup
      const freshFetchWithPayment = wrapFetchWithPayment(fetch, freshClient);

      // Use the x402-fetch to handle the payment
      // With smart contract pre-approval, no MetaMask popup required!
      const resWithPayment = await freshFetchWithPayment(requestToProcess.url, requestToProcess.options);

      if (!resWithPayment.ok) {
        const data = await resWithPayment.json();
        throw new Error(data.error || "Failed to process request after payment");
      }

      const data = await resWithPayment.json();

      // Handle consultancy payment response
      if (isConsultancyPayment) {
        setSuggestion(data);
        setSide(data.side);
        setPendingConsultancyRequest(null);
        setIsConsultancyPayment(false);
        setPaymentRequirements(null);
        setShowPaymentModal(false);
      } else {
        // Handle trade execution response
        setExecutedTrade(data.executedTrade);

        // Refresh recent trades
        const tradesRes = await fetch("/api/trades");
        const tradesData = await tradesRes.json();
        setRecentTrades(Array.isArray(tradesData) ? tradesData : []);

        setPendingRequest(null);
        setPaymentRequirements(null);
        setShowPaymentModal(false);
      }

      // Refresh approval status after payment (allowance will decrease)
      await refreshApprovalStatus();
    } catch (err: any) {
      console.error("Payment error:", err);
      throw err; // Re-throw to let PaymentCheckout handle it
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr: string) => {
    if (!addr) return "N/A";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleSellTrade = async (trade: ExecutedTrade & { tradeIntent?: TradeIntent }) => {
    if (!address || !isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    if (!trade.tradeIntent) {
      setError("Trade intent information not available");
      return;
    }

    // Only allow selling if the original trade was a buy
    if (trade.tradeIntent.side !== "buy") {
      setError("Can only sell positions that were originally bought");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Create a sell trade intent with the same parameters but side="sell"
      const res = await fetch("/api/trades/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          agentId: trade.tradeIntent.agentId,
          symbol: trade.tradeIntent.symbol,
          side: "sell",
          size: trade.tradeIntent.size, // Sell the same amount
          leverage: trade.tradeIntent.leverage,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create sell trade intent");
      }

      const data = await res.json();
      setTradeIntent(data.tradeIntent);
      setSelectedAgent(trade.tradeIntent.agentId);
      setSymbol(trade.tradeIntent.symbol);
      setSide("sell");
      setSize(trade.tradeIntent.size.toString());

      // Scroll to the trade form
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black pt-24 pb-12 font-mono text-foreground relative">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid-small-white/[0.05]" />
        <div className="scanlines opacity-10" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">

        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 border-b border-white/10 pb-6"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-primary/80 uppercase tracking-widest mb-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              System Status: <span className="text-primary font-bold">ONLINE</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground uppercase">
              Command <span className="text-primary">Center</span>
            </h1>
            <p className="text-muted-foreground text-sm font-light flex items-center gap-2 uppercase tracking-wide">
              <ShieldCheck className="w-4 h-4" />
              Secure Uplink V{APP_VERSION} Established
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* System Status Indicator - shows real connection status */}
            <div className={`flex items-center gap-3 px-3 py-1.5 ${isConnected
                ? 'bg-green-950/30 border border-green-500/30'
                : 'bg-amber-950/30 border border-amber-500/30'
              }`}>
              <Activity className={`w-4 h-4 animate-pulse ${isConnected ? 'text-green-500' : 'text-amber-500'
                }`} />
              <span className={`text-xs font-mono font-medium uppercase tracking-widest ${isConnected ? 'text-green-500' : 'text-amber-500'
                }`}>
                {isConnected ? 'READY' : 'STANDBY'}
              </span>
            </div>

            <div className="flex gap-3">
              {isConnected ? (
                <>
                  {/* Spending Limit Status */}
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setShowApprovalModal(true)}
                    aria-label={approvalStatus?.isApproved ? `Manage spending limit: $${approvalStatus.formattedAllowance} approved` : "Set spending limit approval"}
                    className={`bg-black border px-3 py-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider transition-all hover:border-primary/50 ${approvalStatus?.isApproved
                      ? 'border-green-500/30 text-green-400'
                      : 'border-amber-500/30 text-amber-400'
                      }`}
                  >
                    {approvalStatus?.isApproved ? (
                      <>
                        <Unlock className="w-3 h-3" aria-hidden="true" />
                        <span className="hidden sm:inline">Auto-Pay:</span>
                        <span className="font-mono">${approvalStatus.formattedAllowance}</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" aria-hidden="true" />
                        <span className="hidden sm:inline">Set Limit</span>
                      </>
                    )}
                  </motion.button>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-black border border-white/10 px-4 py-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider"
                  >
                    <motion.div
                      animate={{
                        scale: chainId === baseSepolia.id ? [1, 1.2, 1] : 1,
                      }}
                      transition={{ duration: 0.5, repeat: chainId !== baseSepolia.id ? Infinity : 0, repeatDelay: 2 }}
                      className={`w-2 h-2 rounded-full ${chainId === baseSepolia.id ? 'bg-primary' : 'bg-red-500'}`}
                    />
                    {chainId === baseSepolia.id ? 'Base Sepolia' : 'Wrong Network'}
                  </motion.div>
                  <Button onClick={() => open()} variant="outline" className="border-white/10 rounded-none hover:bg-white/5 uppercase text-xs tracking-wider" aria-label={`Connected wallet: ${formatAddress(address || "")}`}>
                    <Wallet className="w-4 h-4 mr-2" aria-hidden="true" />
                    {formatAddress(address || "")}
                  </Button>
                  <Button onClick={() => disconnect()} variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500 rounded-none" aria-label="Disconnect wallet">
                    <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </>
              ) : (
                <Button onClick={() => open()} size="lg" className="rounded-none border border-primary bg-primary/10 text-primary hover:shadow-[0_0_30px_-5px_hsl(var(--primary))] hover:border-primary/80 hover:text-green-300 transition-all uppercase tracking-widest font-bold" aria-label="Connect your wallet to get started">
                  <Wallet className="w-4 h-4 mr-2" aria-hidden="true" />
                  Initialize Wallet
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {!isConnected && (
            <motion.div
              key="auth-alert"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <Alert className="border-primary/50 bg-primary/5 rounded-none">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" aria-hidden="true" />
                  <AlertTitle className="text-primary font-bold uppercase tracking-wider text-xs">Auth Required</AlertTitle>
                </div>
                <AlertDescription className="text-primary/80 text-xs font-mono mt-1">
                  Connect wallet to access secure trading execution layer.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          <motion.div
            key="supported-pair-info"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 space-y-4"
          >
            <div className="border border-blue-900/50 bg-blue-950/10 p-4 flex items-start gap-3">
              <Info className="h-4 w-4 text-blue-400 mt-1" aria-hidden="true" />
              <div>
                <h4 className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">Supported Pair</h4>
                <p className="text-blue-300/80 text-xs font-mono">
                  BTC (WBTC) / USDC [Pool: <span className="text-blue-200">0x657E…cBb0b6</span>]
                </p>
              </div>
            </div>
          </motion.div>

          {error && (
            <motion.div
              key="error-alert"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
            >
              <Alert variant="destructive" className="rounded-none border-red-500/50 bg-red-950/20">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle className="uppercase tracking-wider font-bold text-xs">System Error</AlertTitle>
                <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: Trade Form */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="bg-black border border-white/10 rounded-none shadow-none">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl uppercase tracking-widest font-bold">
                  <Terminal className="w-5 h-5 text-primary" />
                  Operation Parameters
                </CardTitle>
                <CardDescription className="text-xs font-mono uppercase text-muted-foreground mt-1">
                  Configure agent instructions. Encryption active.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">

                {/* Agent & Symbol Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="agent" className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Designated Agent</Label>
                    <Select
                      id="agent"
                      value={selectedAgent}
                      onChange={(e) => {
                        setSelectedAgent(e.target.value);
                        setTradeIntent(null);
                      }}
                      className="w-full bg-black border-white/20 rounded-none focus:border-primary text-sm font-mono h-12 px-4"
                    >
                      <option value="">[ SELECT OPERATIVE ]</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="symbol" className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Target Asset</Label>
                    <Select
                      id="symbol"
                      value={symbol}
                      onChange={(e) => {
                        setSymbol(e.target.value);
                        setTradeIntent(null);
                      }}
                      className="w-full bg-black border-white/20 rounded-none focus:border-primary text-sm font-mono h-12 px-4"
                    >
                      <option value="BTC">BTC (WBTC) / USDC</option>
                    </Select>
                  </div>
                </div>

                {/* Side Selection - Segmented Control */}
                <div className="space-y-3">
                  <Label id="strategy-mode-label" className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Strategy Mode</Label>
                  <div
                    className="grid grid-cols-2 gap-4"
                    role="radiogroup"
                    aria-labelledby="strategy-mode-label"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={side === "buy"}
                      onClick={() => {
                        setSide("buy");
                        setTradeIntent(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                          e.preventDefault();
                          setSide("sell");
                          setTradeIntent(null);
                        }
                      }}
                      className={`h-12 border flex items-center justify-center gap-2 transition-all font-mono uppercase text-xs tracking-wider font-bold focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black ${side === "buy"
                        ? "bg-green-950/30 border-green-500 text-green-500"
                        : "bg-black border-white/10 text-muted-foreground hover:border-white/30"
                        }`}
                    >
                      <Radio className={`w-3 h-3 ${side === "buy" ? "fill-current" : ""}`} aria-hidden="true" />
                      ACQUIRE (LONG)
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={side === "sell"}
                      onClick={() => {
                        setSide("sell");
                        setTradeIntent(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                          e.preventDefault();
                          setSide("buy");
                          setTradeIntent(null);
                        }
                      }}
                      className={`h-12 border flex items-center justify-center gap-2 transition-all font-mono uppercase text-xs tracking-wider font-bold focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black ${side === "sell"
                        ? "bg-red-950/30 border-red-500 text-red-500"
                        : "bg-black border-white/10 text-muted-foreground hover:border-white/30"
                        }`}
                    >
                      <Radio className={`w-3 h-3 ${side === "sell" ? "fill-current" : ""}`} aria-hidden="true" />
                      LIQUIDATE (SHORT)
                    </button>
                  </div>
                </div>

                {/* Size Input */}
                <div className="space-y-3">
                  <Label htmlFor="size" className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                    Deployment Size {side === "buy" ? "(USDC)" : "(cbBTC)"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="size"
                      type="number"
                      value={size}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                          setSize(value);
                          setTradeIntent(null);
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        const numValue = parseFloat(value);
                        if (!value || isNaN(numValue) || numValue < 0.01) {
                          setSize("0.01");
                        } else {
                          setSize(numValue.toFixed(2));
                        }
                        setTradeIntent(null);
                      }}
                      step="0.01"
                      min="0.01"
                      className="bg-black border-white/20 rounded-none h-14 text-lg font-mono pl-4 focus:border-primary focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                      {side === "buy" ? "USDC" : "WBTC"}
                    </div>
                  </div>
                  {side === "buy" && parseFloat(size) > 25 && (
                    <p className="text-[10px] text-amber-500 mt-1 font-mono uppercase">
                      ⚠️ Limit Warning: ${size} exceeds testnet pool guidelines.
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-4 grid gap-4">
                  {!suggestion && (
                    <div className="bg-blue-950/20 border border-blue-500/30 p-3 mb-2">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-mono text-blue-300/90">
                            <span className="font-bold uppercase tracking-wider">Step 1:</span> Pay $0.10 for AI Consultancy to get expert trading recommendation.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleGetSuggestion}
                    disabled={loading || !selectedAgent || !symbol || !isConnected}
                    variant="outline"
                    className="w-full h-12 rounded-none border-dashed border-white/20 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all font-mono text-xs uppercase tracking-widest"
                  >
                    <Cpu className="w-4 h-4 mr-2" />
                    {loading ? "Processing..." : suggestion ? "Get New Consultancy" : "Pay $0.10 for AI Consultancy"}
                  </Button>

                  {suggestion && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3"
                    >
                      <div className="bg-primary/5 border border-primary/20 p-4">
                        <div className="flex items-start gap-3">
                          <div className="bg-primary/10 p-2">
                            <Terminal className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-primary text-xs uppercase tracking-wider">AI Consultancy Result</h4>
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </div>
                            <p className="text-xs font-mono text-foreground/80 mb-2">{suggestion.reason}</p>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              Recommendation: <span className="text-primary font-bold">{suggestion.side.toUpperCase()}</span> {suggestion.size} {symbol}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-950/20 border border-green-500/30 p-3">
                        <div className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-mono text-green-300/90">
                              <span className="font-bold uppercase tracking-wider">Step 2:</span> Review recommendation above, adjust parameters if needed, then proceed to trade execution below.
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Execution Card */}
            <Card className="bg-black border border-white/10 rounded-none shadow-none">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Network className="w-4 h-4" />
                      Execution Manifest
                    </h3>

                    {tradeIntent && (
                      <div className="space-y-2 bg-black border border-white/10 p-4 font-mono text-sm">
                        {tradeIntent.paymentRequestId && (
                          <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-2">
                            <span className="text-muted-foreground text-[10px] uppercase">ID Reference</span>
                            <span className="text-xs">{tradeIntent.paymentRequestId.slice(0, 8)}...{tradeIntent.paymentRequestId.slice(-4)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground text-[10px] uppercase">Trade Volume</span>
                          <span className="font-bold text-primary">
                            {tradeIntent.side === "buy"
                              ? `$${tradeIntent.size.toFixed(2)} USDC`
                              : `${tradeIntent.size.toFixed(6)} ${tradeIntent.symbol}`
                            }
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground text-[10px] uppercase">Relay Fee</span>
                          <span>${parseFloat(tradeIntent.expectedPaymentAmount).toFixed(6)} USD</span>
                        </div>
                        {tradeIntent.side === "buy" && (
                          <div className="border-t border-white/10 pt-2 mt-2">
                            <div className="flex justify-between items-center text-primary">
                              <span className="uppercase tracking-wider text-[10px] font-bold">Total Cost</span>
                              <span className="font-bold">${(tradeIntent.size + parseFloat(tradeIntent.expectedPaymentAmount)).toFixed(6)} USD</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {(!tradeIntent && !executedTrade) ? (
                    <Button
                      onClick={handleCreatePaymentRequest}
                      disabled={loading || !isConnected || !selectedAgent}
                      className="w-full h-14 rounded-none bg-primary text-black hover:bg-primary/90 font-bold uppercase tracking-widest text-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Encrypting...
                        </>
                      ) : (
                        "Initialize Secure Intent"
                      )}
                    </Button>
                  ) : !executedTrade ? (
                    <Button
                      onClick={handleExecuteTrade}
                      disabled={loading || !tradeIntent || !isConnected}
                      className="w-full h-14 rounded-none bg-primary text-black hover:bg-primary/90 font-bold uppercase tracking-widest text-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Authorizing...
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5 mr-2" />
                          Authorize & Execute
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setExecutedTrade(null);
                        setTradeIntent(null);
                      }}
                      variant="outline"
                      className="w-full h-14 rounded-none border-white/20 hover:bg-white/5 uppercase tracking-widest font-bold text-sm"
                    >
                      Reset System
                    </Button>
                  )}

                  {executedTrade && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-green-950/20 border border-green-500/30 p-4 mt-4"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <h3 className="font-bold text-sm uppercase tracking-wider text-green-500">Execution Confirmed</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                        <div className="bg-black/50 p-2 border border-green-500/20">
                          <p className="text-muted-foreground mb-1 uppercase text-[10px]">Price</p>
                          <p className="font-bold text-green-400">${executedTrade.executionPrice.toFixed(2)}</p>
                        </div>
                        <div className="bg-black/50 p-2 border border-green-500/20">
                          <p className="text-muted-foreground mb-1 uppercase text-[10px]">TX Hash</p>
                          <a
                            href={`https://sepolia.basescan.org/tx/${executedTrade.swapTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate block"
                          >
                            {formatAddress(executedTrade.swapTxHash)}
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Portfolio & Recent Executions */}
          <div className="lg:col-span-5 space-y-6">
            {/* Portfolio Balance */}
            <PortfolioBalance address={address} isConnected={isConnected} />

            <Card className="bg-black border border-white/10 rounded-none shadow-none flex flex-col">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="flex items-center gap-2 font-mono uppercase tracking-widest text-xs font-bold">
                  <Activity className="w-4 h-4 text-primary animate-pulse" />
                  Live Network Feed
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-auto max-h-[600px] font-mono text-xs scrollbar-hide">
                {recentTrades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <TrendingUp className="w-8 h-8 mb-3 opacity-20" />
                    <p className="uppercase tracking-wider text-[10px]">No Data Stream</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {recentTrades.map((trade) => (
                      <div key={trade.id} className="p-4 hover:bg-white/5 transition-colors group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase border ${trade.tradeIntent?.side === 'buy'
                              ? 'border-green-500/50 text-green-500 bg-green-500/10'
                              : 'border-red-500/50 text-red-500 bg-red-500/10'
                              }`}>
                              {trade.tradeIntent?.side}
                            </span>
                            <span className="font-bold text-foreground">{trade.tradeIntent?.symbol}</span>
                            {trade.isOpen !== undefined && (
                              <span className={`text-[10px] uppercase tracking-wider ${trade.isOpen ? 'text-blue-400' : 'text-muted-foreground'
                                }`}>
                                [{trade.isOpen ? 'OPEN' : 'CLOSED'}]
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{formatDate(trade.timestamp)}</span>
                        </div>

                        <div className="text-muted-foreground/80 mb-2 space-y-1">
                          <div className="flex justify-between items-center">
                            <span>SIZE:</span>
                            <span className="text-foreground">{trade.tradeIntent?.size}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>ENTRY:</span>
                            <span className="text-foreground">${trade.executionPrice.toFixed(2)}</span>
                          </div>
                          {trade.pnl && (
                            <div className="pt-2 mt-2 border-t border-white/5">
                              <div className="flex justify-between items-center">
                                <span>PNL:</span>
                                <span className={trade.pnl.isProfit ? "text-green-500" : "text-red-500"}>
                                  {trade.pnl.isProfit ? '+' : ''}{trade.pnl.value.toFixed(2)} ({trade.pnl.percentage.toFixed(2)}%)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <a
                            href={`https://sepolia.basescan.org/tx/${trade.swapTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-1 uppercase"
                          >
                            [ VIEW TX ]
                          </a>

                          {trade.tradeIntent?.side === "buy" && trade.isOpen && (
                            <Button
                              onClick={() => handleSellTrade(trade)}
                              disabled={loading || !isConnected}
                              size="sm"
                              variant="secondary"
                              className="h-6 text-[10px] rounded-none bg-white/10 hover:bg-white/20 text-foreground border border-white/10"
                            >
                              LIQUIDATE
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Checkout Modal */}
      <PaymentCheckout
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        paymentRequirements={paymentRequirements}
        onConfirm={handleConfirmPayment}
        loading={loading}
        executedTrade={isConsultancyPayment ? undefined : executedTrade}
        tradeDetails={isConsultancyPayment ? undefined : (tradeIntent ? {
          symbol: tradeIntent.symbol,
          side: tradeIntent.side,
          size: tradeIntent.size,
          leverage: tradeIntent.leverage,
        } : undefined)}
      />

      {/* Spending Limit Approval Modal */}
      <SpendingLimitApproval
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onApprovalComplete={handleApprovalComplete}
        approvalStatus={approvalStatus}
        onRequestApproval={handleRequestApproval}
        onRevokeApproval={handleRevokeApproval}
        isLoading={isCheckingApproval}
        error={approvalError || undefined}
        chainId={chainId}
      />
    </div>
  );
}
