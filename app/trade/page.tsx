"use client";

// Trade Console page with wagmi and x402-fetch integration

// Extend Window interface to include ethereum provider
declare global {
  interface Window {
    ethereum?: any;
  }
}
import { useState, useEffect, useMemo } from "react";
import { useAccount, useWalletClient, useDisconnect, useSwitchChain, useChainId } from "wagmi";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { createWalletClient, custom, http } from "viem";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";
import { Agent, TradeIntent, ExecutedTrade } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Info, AlertCircle, CheckCircle2, Wallet, ArrowRightLeft, TrendingUp } from "lucide-react";

export default function TradePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("BTC");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState<string>("0.01");
  const [leverage, setLeverage] = useState<string>("2");
  const [suggestion, setSuggestion] = useState<any>(null);
  const [tradeIntent, setTradeIntent] = useState<TradeIntent | null>(null);
  const [executedTrade, setExecutedTrade] = useState<any>(null);
  const [recentTrades, setRecentTrades] = useState<Array<ExecutedTrade & { tradeIntent?: TradeIntent }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentRequirements, setPaymentRequirements] = useState<any>(null);
  const [pendingRequest, setPendingRequest] = useState<{ url: string; options: RequestInit } | null>(null);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();

  // Create x402-fetch wrapper with wallet client
  const fetchWithPayment = useMemo(() => {
    if (!walletClient || !isConnected || !walletClient.account) {
      console.warn("Wallet not connected, x402-fetch will not handle payments");
      return fetch; // Fallback to regular fetch if wallet not connected
    }

    // Ensure we're on the correct chain before initializing x402-fetch
    if (chainId !== baseSepolia.id) {
      console.warn(`Wallet is on chain ${chainId}, but Base Sepolia (${baseSepolia.id}) is required`);
      return fetch; // Fallback to regular fetch if on wrong chain
    }

    // x402-fetch expects a wallet client that implements the x402 wallet interface
    // The walletClient from wagmi should work directly, but we may need to adapt it
    // For now, create a compatible wallet client
    try {
      // Wrap fetch with x402 payment handling
      // maxValue: 0.001 USD = 1,000 base units (6 decimals for USDC)
      // Setting to 10,000,000 (10 USDC) to allow for the payment
      const maxValue = BigInt(10_000_000); // 10 USDC in base units
      console.log("Initializing x402-fetch with wallet client:", {
        account: walletClient.account?.address,
        chain: walletClient.chain?.name,
        chainId: chainId,
        maxValue: maxValue.toString(),
      });
      return wrapFetchWithPayment(fetch, walletClient as any, maxValue);
    } catch (err) {
      console.error("Failed to initialize x402-fetch:", err);
      return fetch; // Fallback to regular fetch on error
    }
  }, [walletClient, isConnected, chainId]);

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

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/agents/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgent, symbol }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get suggestion");
      }

      const data = await res.json();
      setSuggestion(data);
      setSide(data.side);
      setSize(data.size.toString());
      setLeverage(data.leverage.toString());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePaymentRequest = async () => {
    if (!address || !selectedAgent || !symbol || !side || !size || !leverage) {
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

    setLoading(true);
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
        setLoading(false);
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
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!pendingRequest) return;

    if (!walletClient || !isConnected || !walletClient.account) {
      setError("Wallet not connected. Please connect your wallet first.");
      return;
    }

    setLoading(true);
    setShowPaymentModal(false);
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

      // Create a fresh wallet client on the correct chain using the injected provider
      // This uses window.ethereum (MetaMask/injected wallet) for signing, not the RPC endpoint
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("No wallet provider found. Please install MetaMask or another wallet.");
      }

      const freshWalletClient = createWalletClient({
        account: walletClient.account,
        chain: baseSepolia,
        transport: custom(window.ethereum),
      });

      console.log("Using fresh wallet client for payment:", {
        account: freshWalletClient.account?.address,
        chain: freshWalletClient.chain?.name,
        chainId: freshWalletClient.chain?.id,
      });

      // Create a fresh x402-fetch wrapper with the correct chain
      const maxValue = BigInt(10_000_000); // 10 USDC in base units
      const freshFetchWithPayment = wrapFetchWithPayment(fetch, freshWalletClient as any, maxValue);

      // Use the fresh x402-fetch to handle the payment
      // This will create the payment signature and retry the request
      // MetaMask will pop up for signature approval (this is normal for EIP-712 signatures)
      const resWithPayment = await freshFetchWithPayment(pendingRequest.url, pendingRequest.options);

      if (!resWithPayment.ok) {
        const data = await resWithPayment.json();
        throw new Error(data.error || "Failed to execute trade after payment");
      }

      const data = await resWithPayment.json();
      setExecutedTrade(data.executedTrade);

      // Refresh recent trades
      const tradesRes = await fetch("/api/trades");
      const tradesData = await tradesRes.json();
      setRecentTrades(Array.isArray(tradesData) ? tradesData : []);

      setPendingRequest(null);
      setPaymentRequirements(null);
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Payment failed");
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
      setLeverage(trade.tradeIntent.leverage.toString());

      // Scroll to the trade form
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background pt-24 pb-12">
      <div className="bg-grid-small-black dark:bg-grid-small-white fixed inset-0 z-0 pointer-events-none opacity-40" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Trade Console</h1>
            <p className="text-muted-foreground mt-1">Execute automated trades with AI agents.</p>
          </div>
          <div className="flex gap-3">
            {isConnected ? (
              <>
                <div className="bg-white dark:bg-card px-4 py-2 rounded-full border shadow-sm flex items-center gap-2 text-sm font-medium">
                  <div className={`w-2 h-2 rounded-full ${chainId === baseSepolia.id ? 'bg-green-500' : 'bg-red-500'}`} />
                  {chainId === baseSepolia.id ? 'Base Sepolia' : 'Wrong Network'}
                </div>
                <Button onClick={() => open()} variant="outline" className="rounded-full border-2">
                  <Wallet className="w-4 h-4 mr-2" />
                  {formatAddress(address || "")}
                </Button>
                <Button onClick={() => disconnect()} variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                  <ArrowRightLeft className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button onClick={() => open()} size="lg" className="rounded-full shadow-lg shadow-primary/20">
                Connect Wallet
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <Alert className="border-primary/20 bg-primary/5">
                <Info className="w-4 h-4 text-primary" />
                <AlertTitle>Wallet Connection Required</AlertTitle>
                <AlertDescription>
                  Please connect your wallet to access trading features and executed payments.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: Trade Form */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="glass-card overflow-hidden border-0 shadow-lg ring-1 ring-black/5">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-b pb-4">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Trade Configuration
                </CardTitle>
                <CardDescription>Configure your AI-driven trade parameters.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">

                {/* Agent & Symbol Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="agent" className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Select Agent</Label>
                    <Select
                      id="agent"
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="input-premium"
                    >
                      <option value="">Choose an Agent...</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="symbol" className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Asset</Label>
                    <Select
                      id="symbol"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className="input-premium font-mono"
                    >
                      <option value="BTC">BTC / USD</option>
                      <option value="ETH">ETH / USD</option>
                      <option value="SOL">SOL / USD</option>
                    </Select>
                  </div>
                </div>

                {/* Side Selection - Segmented Control */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Direction</Label>
                  <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button
                      onClick={() => setSide("buy")}
                      className={`py-2 text-sm font-medium rounded-md transition-all ${side === "buy"
                        ? "bg-white dark:bg-background text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Buy / Long
                    </button>
                    <button
                      onClick={() => setSide("sell")}
                      className={`py-2 text-sm font-medium rounded-md transition-all ${side === "sell"
                        ? "bg-white dark:bg-background text-destructive shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Sell / Short
                    </button>
                  </div>
                </div>

                {/* Size & Leverage Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="size" className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Size (ETH)</Label>
                    <Input
                      id="size"
                      type="number"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      step="0.01"
                      min="0.01"
                      className="input-premium font-mono text-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="leverage" className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Leverage (x)</Label>
                    <Input
                      id="leverage"
                      type="number"
                      value={leverage}
                      onChange={(e) => setLeverage(e.target.value)}
                      min="1"
                      max="10"
                      className="input-premium font-mono text-lg"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 grid gap-4">
                  <Button
                    onClick={handleGetSuggestion}
                    disabled={loading || !selectedAgent || !symbol}
                    variant="outline"
                    className="w-full h-12 border-dashed border-2 hover:border-primary hover:text-primary transition-all"
                  >
                    ✨ Ask Agent for Suggestion
                  </Button>

                  {suggestion && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-primary/5 border border-primary/20 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="bg-primary/20 p-2 rounded-full">
                          <Info className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-primary mb-1">Agent Recommendation</h4>
                          <p className="text-sm text-foreground/80">{suggestion.reason}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Execution Card */}
            <Card className="glass-card border-0 shadow-lg ring-1 ring-black/5">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-lg">Order Summary</h3>
                      {tradeIntent && tradeIntent.paymentRequestId && (
                        <p className="text-sm text-muted-foreground font-mono">
                          ID: {tradeIntent.paymentRequestId.slice(0, 12)}...
                        </p>
                      )}
                    </div>
                    {tradeIntent && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Est. Cost</p>
                        <p className="font-bold text-xl">${tradeIntent.expectedPaymentAmount} USD</p>
                      </div>
                    )}
                  </div>

                  {(!tradeIntent && !executedTrade) ? (
                    <Button
                      onClick={handleCreatePaymentRequest}
                      disabled={loading || !isConnected || !selectedAgent}
                      className="w-full h-14 text-lg font-semibold shadow-lg shadow-primary/25 rounded-xl"
                      variant="default"
                    >
                      Create Order Intent
                    </Button>
                  ) : !executedTrade ? (
                    <Button
                      onClick={handleExecuteTrade}
                      disabled={loading || !tradeIntent || !isConnected}
                      className="w-full h-14 text-lg font-semibold shadow-lg shadow-primary/25 rounded-xl bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90"
                    >
                      Pay & Execute Trade
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setExecutedTrade(null);
                        setTradeIntent(null);
                      }}
                      variant="outline"
                      className="w-full h-14"
                    >
                      Start New Trade
                    </Button>
                  )}

                  {executedTrade && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 mt-4"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                        <h3 className="font-bold text-green-700 dark:text-green-400">Trade Executed Successfully</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-background/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Execution Price</p>
                          <p className="font-mono font-medium">${executedTrade.executionPrice.toFixed(2)}</p>
                        </div>
                        <div className="bg-background/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Transaction</p>
                          <a
                            href={`https://sepolia.basescan.org/tx/${executedTrade.swapTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono font-medium text-primary hover:underline truncate block"
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

          {/* Right Column: Recent Executions */}
          <div className="lg:col-span-5">
            <Card className="h-full glass-card border-0 shadow-lg ring-1 ring-black/5 flex flex-col">
              <CardHeader className="border-b pb-4">
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-auto max-h-[600px]">
                {recentTrades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <TrendingUp className="w-12 h-12 mb-3 opacity-20" />
                    <p>No trades executed yet</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {recentTrades.map((trade) => (
                      <div key={trade.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${trade.tradeIntent?.side === 'buy'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                              {trade.tradeIntent?.side}
                            </span>
                            <span className="font-bold">{trade.tradeIntent?.symbol}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(trade.timestamp)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm text-foreground/80 mb-3">
                          <div>
                            <span className="text-muted-foreground text-xs mr-2">Size:</span>
                            <span className="font-mono">{trade.tradeIntent?.size}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs mr-2">Lev:</span>
                            <span className="font-mono">{trade.tradeIntent?.leverage}x</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <a
                            href={`https://sepolia.basescan.org/tx/${trade.swapTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            View Tx <ArrowRightLeft className="w-3 h-3" />
                          </a>

                          {trade.tradeIntent?.side === "buy" && (
                            <Button
                              onClick={() => handleSellTrade(trade)}
                              disabled={loading || !isConnected}
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs"
                            >
                              Close / Sell
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

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        {paymentRequirements && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-bold">Confirm Payment</DialogTitle>
              <DialogDescription className="text-center">
                A payment is required to execute this trade on-chain.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 my-4 space-y-4">
              <div className="flex justify-between items-end border-b pb-4">
                <span className="text-sm text-muted-foreground">Total Amount</span>
                <span className="text-2xl font-bold text-foreground">
                  {paymentRequirements.accepts[0].price ||
                    `$${(Number(paymentRequirements.accepts[0].maxAmountRequired || 0) / 1_000_000).toFixed(6)}`}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-medium">{paymentRequirements.accepts[0].network || "base-sepolia"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Asset</span>
                  <span className="font-medium">USDC</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPendingRequest(null);
                  setPaymentRequirements(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmPayment}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 text-white shadow-lg"
              >
                {loading ? "Processing..." : "Pay & Execute"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
