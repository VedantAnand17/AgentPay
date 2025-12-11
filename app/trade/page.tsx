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
    return new Date(timestamp).toLocaleString();
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
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Trade Console</h1>
          <div className="flex gap-2">
            {isConnected ? (
              <>
                <Button onClick={() => open()} variant="default">
                  {formatAddress(address || "")}
                </Button>
                <Button onClick={() => disconnect()} variant="outline">
                  Disconnect
                </Button>
              </>
            ) : (
              <Button onClick={() => open()} variant="default">
                Connect Wallet
              </Button>
            )}
          </div>
        </div>

        {!isConnected && (
          <Alert className="mb-4">
            <AlertTitle>Wallet Not Connected</AlertTitle>
            <AlertDescription>
              Please connect your wallet to create trades and execute payments.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Trade Configuration */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Trade Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  {isConnected && (
                    <Alert variant={chainId === baseSepolia.id ? "default" : "destructive"}>
                      <AlertTitle>Wallet Connected</AlertTitle>
                      <AlertDescription>
                        <div className="space-y-1">
                          <p>✓ Wallet connected: {formatAddress(address || "")}</p>
                          <p>
                            {chainId === baseSepolia.id ? (
                              <>✓ Network: Base Sepolia (Chain ID: {chainId})</>
                            ) : (
                              <>
                                ⚠ Wrong network: Chain ID {chainId}. Please switch to Base Sepolia (Chain ID: {baseSepolia.id})
                              </>
                            )}
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="agent">Agent</Label>
                    <Select
                      id="agent"
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                    >
                      <option value="">Select an agent</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} - {agent.description}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="symbol">Symbol</Label>
                    <Select
                      id="symbol"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                    >
                      <option value="BTC">BTC</option>
                      <option value="ETH">ETH</option>
                      <option value="SOL">SOL</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Side</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="buy"
                          checked={side === "buy"}
                          onChange={(e) => setSide(e.target.value as "buy" | "sell")}
                          className="mr-2"
                        />
                        Buy
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="sell"
                          checked={side === "sell"}
                          onChange={(e) => setSide(e.target.value as "buy" | "sell")}
                          className="mr-2"
                        />
                        Sell
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="size">Size</Label>
                    <Input
                      id="size"
                      type="number"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      step="0.01"
                      min="0.01"
                      max="0.05"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="leverage">Leverage</Label>
                    <Input
                      id="leverage"
                      type="number"
                      value={leverage}
                      onChange={(e) => setLeverage(e.target.value)}
                      min="2"
                      max="5"
                    />
                  </div>

                  <Button
                    onClick={handleGetSuggestion}
                    disabled={loading || !selectedAgent || !symbol}
                    className="w-full"
                  >
                    Get Agent Suggestion
                  </Button>

                  {suggestion && (
                    <Alert>
                      <AlertTitle>Agent Suggestion</AlertTitle>
                      <AlertDescription>{suggestion.reason}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment & Execution */}
            <Card>
              <CardHeader>
                <CardTitle>Payment & Execution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    onClick={handleCreatePaymentRequest}
                    disabled={loading || !isConnected || !selectedAgent}
                    className="w-full"
                    variant="default"
                  >
                    Create Payment Request
                  </Button>

                  {tradeIntent && (
                    <Alert>
                      <AlertTitle>Payment Request Created</AlertTitle>
                      <AlertDescription>
                        <p className="mt-2">
                          Expected Payment: ${tradeIntent.expectedPaymentAmount} USD
                        </p>
                        <p>
                          Payment Request ID: {tradeIntent.paymentRequestId}
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleExecuteTrade}
                    disabled={loading || !tradeIntent || !isConnected}
                    className="w-full"
                    variant="default"
                  >
                    Execute Trade (x402 payment handled automatically)
                  </Button>

                  {executedTrade && (
                    <Alert>
                      <AlertTitle>Trade Executed!</AlertTitle>
                      <AlertDescription>
                        <div className="text-sm mt-2 space-y-1">
                          <p>Symbol: {tradeIntent?.symbol}</p>
                          <p>Side: {tradeIntent?.side}</p>
                          <p>Size: {tradeIntent?.size}</p>
                          <p>Leverage: {tradeIntent?.leverage}x</p>
                          <p>Payment Status: {executedTrade.paymentStatus}</p>
                          <p>Swap Tx Hash: <code className="text-xs">{formatAddress(executedTrade.swapTxHash)}</code></p>
                          <p>Execution Price: ${executedTrade.executionPrice.toFixed(2)}</p>
                          <p>Timestamp: {formatDate(executedTrade.timestamp)}</p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Recent Executions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
            </CardHeader>
            <CardContent>
              {recentTrades.length === 0 ? (
                <p className="text-muted-foreground">No executions yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Symbol</th>
                        <th className="text-left p-2">Side</th>
                        <th className="text-left p-2">Size</th>
                        <th className="text-left p-2">Leverage</th>
                        <th className="text-left p-2">Payment</th>
                        <th className="text-left p-2">Tx Hash</th>
                        <th className="text-left p-2">Time</th>
                        <th className="text-left p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTrades.map((trade) => (
                        <tr key={trade.id} className="border-b">
                          <td className="p-2">{trade.tradeIntent?.symbol || "N/A"}</td>
                          <td className="p-2">{trade.tradeIntent?.side || "N/A"}</td>
                          <td className="p-2">{trade.tradeIntent?.size || "N/A"}</td>
                          <td className="p-2">{trade.tradeIntent?.leverage || "N/A"}x</td>
                          <td className="p-2">{trade.paymentStatus}</td>
                          <td className="p-2">
                            <a
                              href={`https://sepolia.basescan.org/tx/${trade.swapTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground hover:underline"
                            >
                              <code className="text-xs">{formatAddress(trade.swapTxHash)}</code>
                            </a>
                          </td>
                          <td className="p-2 text-xs">{formatDate(trade.timestamp)}</td>
                          <td className="p-2">
                            {trade.tradeIntent?.side === "buy" && (
                              <Button
                                onClick={() => handleSellTrade(trade)}
                                disabled={loading || !isConnected}
                                size="sm"
                                variant="outline"
                              >
                                Sell
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        {paymentRequirements && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payment Required</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mb-6">
              {paymentRequirements.accepts && paymentRequirements.accepts[0] && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="text-lg font-semibold">
                      {paymentRequirements.accepts[0].price || 
                       `$${(Number(paymentRequirements.accepts[0].maxAmountRequired || 0) / 1_000_000).toFixed(6)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Network</p>
                    <p className="text-lg font-semibold">
                      {paymentRequirements.accepts[0].network || "base-sepolia"}
                    </p>
                  </div>
                  {paymentRequirements.accepts[0].description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="text-sm">{paymentRequirements.accepts[0].description}</p>
                    </div>
                  )}
                </>
              )}
              <Alert>
                <AlertDescription>
                  💡 You&apos;ll be asked to sign a payment message in MetaMask. This is required for x402 payments.
                </AlertDescription>
              </Alert>
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
                variant="default"
                className="flex-1"
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
