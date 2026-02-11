"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TradeError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Trade page error:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 font-mono">
            <div className="max-w-md w-full bg-black border border-red-500/30 overflow-hidden">
                <div className="h-1 w-full bg-red-500/50" />
                <div className="p-8 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold uppercase tracking-widest text-red-500">
                                Trade System Error
                            </h2>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                The trading console encountered an error
                            </p>
                        </div>
                    </div>

                    <div className="bg-red-950/20 border border-red-500/20 p-4">
                        <p className="text-xs text-red-400 font-mono break-all">
                            {error.message || "Unknown error"}
                        </p>
                        {error.digest && (
                            <p className="text-[10px] text-red-500/60 mt-2 uppercase">
                                Error ID: {error.digest}
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <Link
                            href="/"
                            className="flex-1 h-12 bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 transition-all font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Home
                        </Link>
                        <button
                            onClick={reset}
                            className="flex-1 h-12 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
