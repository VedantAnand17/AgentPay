"use client";

// Trade Console page
import { useState, useEffect } from "react";
import { Agent, TradeIntent, ExecutedTrade } from "@/lib/types";

// x402 client integration
// NOTE: x402-fetch will be used when wallet is properly integrated
// For MVP, we'll use a wrapper that handles the x402 payment flow
// In production: import x402Fetch from "x402-fetch";

export default function TradePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("BTC");
  const [side, setSide] = useState<"long" | "short">("long");
  const [size, setSize] = useState<string>("0.01");
  const [leverage, setLeverage] = useState<string>("2");
  const [userAddress, setUserAddress] = useState<string>("");
  const [wallet, setWallet] = useState<any>(null);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [tradeIntent, setTradeIntent] = useState<TradeIntent | null>(null);
  const [executedTrade, setExecutedTrade] = useState<any>(null);
  const [recentTrades, setRecentTrades] = useState<Array<ExecutedTrade & { tradeIntent?: TradeIntent }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Load agents on mount
  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => setAgents(data))
      .catch((err) => console.error("Failed to load agents:", err));
  }, []);

  // Load recent trades on mount
  useEffect(() => {
    fetch("/api/trades")
      .then((res) => res.json())
      .then((data) => setRecentTrades(data))
      .catch((err) => console.error("Failed to load trades:", err));
  }, []);

  // Connect wallet and initialize x402 client
  const handleConnectWallet = async () => {
    try {
      // In production, use your wallet connector (e.g., wagmi, web3modal, etc.)
      // Example: const wallet = await connectWallet();
      // For MVP, we'll use the userAddress as the wallet
      if (!userAddress) {
        setError("Please enter a wallet address");
        return;
      }
      
      // Mock wallet object (in production, use real wallet from connector)
      const mockWallet = {
        address: userAddress as `0x${string}`,
        // In production, wallet would have sign methods, etc.
        // x402-fetch will use the wallet to sign payment transactions
      };
      
      setWallet(mockWallet);
    } catch (err: any) {
      setError(`Failed to connect wallet: ${err.message}`);
    }
  };

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
    if (!userAddress || !selectedAgent || !symbol || !side || !size || !leverage) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trades/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress,
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

    if (!wallet) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Use x402 protocol: make request, handle 402 Payment Required response
      // In production with x402-fetch:
      // import x402Fetch from "x402-fetch";
      // const res = await x402Fetch("/api/trades/execute", { ... });
      // x402-fetch automatically handles 402 responses and wallet payment UI
      
      let res = await fetch("/api/trades/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeIntentId: tradeIntent.id }),
      });

      // Handle 402 Payment Required (x402 protocol)
      if (res.status === 402) {
        const paymentData = await res.json();
        // In production, x402-fetch would:
        // 1. Parse payment details from 402 response
        // 2. Show wallet payment UI
        // 3. Wait for payment confirmation
        // 4. Retry original request with payment proof
        
        // For MVP, show payment info and allow retry
        throw new Error(`Payment required: ${paymentData.config?.amount || "unknown"} USDC. Please complete payment and try again.`);
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
      setRecentTrades(tradesData);
    } catch (err: any) {
      // Handle payment errors
      if (err.message.includes("Payment required") || err.message.includes("payment")) {
        setError("Payment required. Please complete the payment in your wallet.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Trade Console</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Trade Configuration */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Trade Configuration</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Wallet Address</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userAddress}
                      onChange={(e) => setUserAddress(e.target.value)}
                      placeholder="0x..."
                      className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      disabled={!!wallet}
                    />
                    {!wallet && (
                      <button
                        onClick={handleConnectWallet}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Connect
                      </button>
                    )}
                    {wallet && (
                      <button
                        onClick={() => {
                          setWallet(null);
                        }}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                  {wallet && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      ✓ Wallet connected: {formatAddress(wallet.address)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Agent</label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">Select an agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} - {agent.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Symbol</label>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="SOL">SOL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Side</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="long"
                        checked={side === "long"}
                        onChange={(e) => setSide(e.target.value as "long" | "short")}
                        className="mr-2"
                      />
                      Long
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="short"
                        checked={side === "short"}
                        onChange={(e) => setSide(e.target.value as "long" | "short")}
                        className="mr-2"
                      />
                      Short
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Size</label>
                  <input
                    type="number"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    step="0.01"
                    min="0.01"
                    max="0.05"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Leverage</label>
                  <input
                    type="number"
                    value={leverage}
                    onChange={(e) => setLeverage(e.target.value)}
                    min="2"
                    max="5"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <button
                  onClick={handleGetSuggestion}
                  disabled={loading || !selectedAgent || !symbol}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Get Agent Suggestion
                </button>

                {suggestion && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                    <p className="font-semibold">Agent Suggestion:</p>
                    <p className="text-sm mt-2">{suggestion.reason}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment & Execution */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Payment & Execution</h2>

              <div className="space-y-4">
                <button
                  onClick={handleCreatePaymentRequest}
                  disabled={loading || !userAddress || !selectedAgent}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Payment Request
                </button>

                {tradeIntent && (
                  <div className="p-4 bg-green-50 dark:bg-green-900 rounded-lg">
                    <p className="font-semibold">Payment Request Created</p>
                    <p className="text-sm mt-2">
                      Expected Payment: ${tradeIntent.expectedPaymentAmount} USD
                    </p>
                    <p className="text-sm">
                      Payment Request ID: {tradeIntent.paymentRequestId}
                    </p>
                    <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                      (In production, complete payment via x402 UI/SDK)
                    </p>
                  </div>
                )}

                <button
                  onClick={handleExecuteTrade}
                  disabled={loading || !tradeIntent || !wallet}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Execute Trade (x402 payment handled automatically)
                </button>

                {executedTrade && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900 rounded-lg">
                    <p className="font-semibold">Trade Executed!</p>
                    <div className="text-sm mt-2 space-y-1">
                      <p>Symbol: {tradeIntent?.symbol}</p>
                      <p>Side: {tradeIntent?.side}</p>
                      <p>Size: {tradeIntent?.size}</p>
                      <p>Leverage: {tradeIntent?.leverage}x</p>
                      <p>Payment Status: {executedTrade.paymentStatus}</p>
                      <p>Perp Tx Hash: <code className="text-xs">{formatAddress(executedTrade.perpTxHash)}</code></p>
                      <p>Entry Price: ${executedTrade.entryPrice.toFixed(2)}</p>
                      <p>Timestamp: {formatDate(executedTrade.timestamp)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Recent Executions */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Recent Executions</h2>

            {recentTrades.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No executions yet</p>
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
                          <code className="text-xs">{formatAddress(trade.perpTxHash)}</code>
                        </td>
                        <td className="p-2 text-xs">{formatDate(trade.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

