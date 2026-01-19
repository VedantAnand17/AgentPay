"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Wallet,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Coins,
    Eye,
    EyeOff,
    ArrowUpRight,
    ArrowDownRight,
    Sparkles,
    Shield
} from "lucide-react";
import { Button } from "./button";

interface TokenBalance {
    symbol: string;
    name: string;
    balance: string;
    formatted: string;
    icon: string;
    color: string;
    usdValue?: number;
    change24h?: number;
    hasWarning?: boolean;
}

interface PortfolioBalanceProps {
    address: string | undefined;
    isConnected: boolean;
}

// Token metadata for display
const TOKEN_META: Record<string, { name: string; icon: string; color: string }> = {
    BTC: { name: "Bitcoin", icon: "₿", color: "text-orange-500" },
    USDC: { name: "USD Coin", icon: "$", color: "text-green-500" },
    ETH: { name: "Ethereum", icon: "Ξ", color: "text-blue-500" },
};

export function PortfolioBalance({ address, isConnected }: PortfolioBalanceProps) {
    const [balances, setBalances] = useState<TokenBalance[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchBalances = useCallback(async () => {
        if (!address || !isConnected) {
            setBalances([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Fetch real prices from CoinGecko API
            let tokenPrices: Record<string, number> = { BTC: 97000, USDC: 1, ETH: 3400 };
            let tokenChanges: Record<string, number> = { BTC: 0, USDC: 0, ETH: 0 };

            try {
                const pricesRes = await fetch("/api/prices");
                if (pricesRes.ok) {
                    const pricesData = await pricesRes.json();
                    tokenPrices = pricesData.prices || tokenPrices;
                    tokenChanges = pricesData.change24h || tokenChanges;
                }
            } catch (priceErr) {
                console.debug("Using fallback prices:", priceErr);
            }

            // Fetch balances for supported tokens
            const symbols = ["BTC", "USDC"];
            const balancePromises = symbols.map(async (symbol) => {
                try {
                    const res = await fetch(`/api/balances?address=${address}&symbol=${symbol}`);
                    const data = await res.json();

                    // Check for API error responses
                    if (!res.ok) {
                        // Log at debug level since this is expected for testnet addresses without tokens
                        if (process.env.NODE_ENV === "development") {
                            console.debug(`Could not fetch ${symbol} balance:`, data.error || "Unknown error");
                        }
                        return null;
                    }

                    const meta = TOKEN_META[symbol] || { name: symbol, icon: "◆", color: "text-white" };
                    const price = tokenPrices[symbol] || 0;
                    const change24h = tokenChanges[symbol] || 0;
                    const formattedBalance = parseFloat(data.formatted || "0");

                    return {
                        symbol,
                        name: meta.name,
                        balance: data.balance,
                        formatted: data.formatted,
                        icon: meta.icon,
                        color: meta.color,
                        usdValue: formattedBalance * price,
                        change24h: change24h, // Real 24h change from CoinGecko
                        hasWarning: !!data.warning, // Track if this was a fallback response
                    } as TokenBalance;
                } catch (err) {
                    // Network or parsing error - log at debug level
                    if (process.env.NODE_ENV === "development") {
                        console.debug(`Network error fetching ${symbol} balance:`, err);
                    }
                    return null;
                }
            });

            const results = await Promise.all(balancePromises);
            const validBalances = results.filter((b): b is TokenBalance => b !== null);

            setBalances(validBalances);
            setLastUpdated(new Date());
        } catch (err: any) {
            // Only show error for unexpected failures
            console.error("Unexpected error fetching balances:", err);
            setError("Could not load balances");
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [address, isConnected]);

    useEffect(() => {
        fetchBalances();
        // Refresh every 30 seconds
        const interval = setInterval(fetchBalances, 30000);
        return () => clearInterval(interval);
    }, [fetchBalances]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchBalances();
    };

    const totalUsdValue = balances.reduce((sum, b) => sum + (b.usdValue || 0), 0);

    const formatUsd = (value: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const formatBalance = (formatted: string, symbol: string) => {
        const value = parseFloat(formatted);
        if (symbol === "USDC") {
            return value.toFixed(2);
        }
        if (value < 0.0001) {
            return value.toExponential(2);
        }
        if (value < 1) {
            return value.toFixed(6);
        }
        return value.toFixed(4);
    };

    if (!isConnected) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black border border-white/10 p-6"
            >
                <div className="flex items-center justify-center gap-3 text-muted-foreground">
                    <Wallet className="w-5 h-5" />
                    <span className="text-xs font-mono uppercase tracking-wider">
                        Connect wallet to view portfolio
                    </span>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black border border-white/10 overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-8 h-8 bg-primary/10 border border-primary/30 flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-primary" />
                        </div>
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full"
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest">Portfolio</h3>
                        <p className="text-[10px] text-muted-foreground font-mono">
                            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading..."}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsVisible(!isVisible)}
                        className="h-8 w-8 rounded-none hover:bg-white/5"
                    >
                        {isVisible ? (
                            <Eye className="w-4 h-4 text-muted-foreground" />
                        ) : (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={loading}
                        className="h-8 w-8 rounded-none hover:bg-white/5"
                    >
                        <RefreshCw className={`w-4 h-4 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>

            {/* Total Value */}
            <div className="px-5 py-5 border-b border-white/5 bg-gradient-to-b from-black to-transparent">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-1">
                            Total Value
                        </p>
                        <AnimatePresence mode="wait">
                            {loading && balances.length === 0 ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="h-8 w-32 bg-white/5 animate-pulse"
                                />
                            ) : (
                                <motion.p
                                    key="value"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-2xl md:text-3xl font-bold tracking-tight"
                                >
                                    {isVisible ? formatUsd(totalUsdValue) : "••••••"}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-1 text-xs">
                        <Shield className="w-3 h-3 text-primary" />
                        <span className="text-primary font-mono uppercase tracking-wider text-[10px]">Secure</span>
                    </div>
                </div>
            </div>

            {/* Token List */}
            <div className="divide-y divide-white/5">
                <AnimatePresence>
                    {loading && balances.length === 0 ? (
                        // Skeleton loaders
                        [...Array(2)].map((_, i) => (
                            <motion.div
                                key={`skeleton-${i}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="px-5 py-4 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/5 animate-pulse" />
                                    <div className="space-y-2">
                                        <div className="h-3 w-16 bg-white/5 animate-pulse" />
                                        <div className="h-2 w-12 bg-white/5 animate-pulse" />
                                    </div>
                                </div>
                                <div className="text-right space-y-2">
                                    <div className="h-3 w-20 bg-white/5 animate-pulse ml-auto" />
                                    <div className="h-2 w-16 bg-white/5 animate-pulse ml-auto" />
                                </div>
                            </motion.div>
                        ))
                    ) : balances.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="px-5 py-8 text-center"
                        >
                            <Coins className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground font-mono">No balances found</p>
                        </motion.div>
                    ) : (
                        balances.map((token, index) => (
                            <motion.div
                                key={token.symbol}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    {/* Token Icon */}
                                    <div className={`w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center text-lg font-bold ${token.color} group-hover:border-white/20 transition-colors`}>
                                        {token.icon}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm tracking-wide">{token.symbol}</span>
                                            {parseFloat(token.formatted) > 0 && (
                                                <Sparkles className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                                            {token.name}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="font-bold text-sm tracking-tight font-mono">
                                        {isVisible ? formatBalance(token.formatted, token.symbol) : "••••"}
                                    </p>
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            {isVisible ? formatUsd(token.usdValue || 0) : "••••"}
                                        </span>
                                        {token.change24h !== undefined && isVisible && (
                                            <span className={`text-[10px] font-mono flex items-center ${token.change24h >= 0 ? "text-green-500" : "text-red-500"
                                                }`}>
                                                {token.change24h >= 0 ? (
                                                    <ArrowUpRight className="w-3 h-3" />
                                                ) : (
                                                    <ArrowDownRight className="w-3 h-3" />
                                                )}
                                                {Math.abs(token.change24h).toFixed(2)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Footer */}
            {balances.length > 0 && (
                <div className="px-5 py-3 border-t border-white/5 bg-gradient-to-t from-primary/5 to-transparent">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                        <span>{balances.length} Assets</span>
                        <span className="flex items-center gap-1">
                            <motion.div
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-1.5 h-1.5 rounded-full bg-primary"
                            />
                            Live Data
                        </span>
                    </div>
                </div>
            )}

            {/* Error State */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-5 py-3 bg-red-950/20 border-t border-red-500/20"
                    >
                        <p className="text-xs text-red-400 font-mono">{error}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
