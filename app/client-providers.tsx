"use client";

import dynamic from "next/dynamic";

// Dynamically import Providers with no SSR to avoid indexedDB errors
const InnerProviders = dynamic(() => import("./providers").then((mod) => mod.Providers), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-screen bg-black">
            <div className="animate-pulse text-primary">Loading...</div>
        </div>
    ),
});

export function ClientProviders({ children }: { children: React.ReactNode }) {
    return <InnerProviders>{children}</InnerProviders>;
}
