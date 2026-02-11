"use client";

// Wagmi and Web3Modal providers
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { wagmiConfig } from "@/lib/wagmi-config";
import { useState, useEffect } from "react";

// Initialize Web3Modal synchronously on client side (before any hooks are used)
// This must be called at module level to ensure it's initialized before useWeb3Modal hook is called
if (typeof window !== "undefined") {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "your-project-id";

  createWeb3Modal({
    wagmiConfig,
    projectId,
    enableAnalytics: false,
    enableOnramp: false,
  });
}

// Component to suppress console errors for known harmless issues
function ConsoleErrorSuppressor() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Store original console methods
    const originalError = console.error;
    const originalWarn = console.warn;

    // List of error patterns to suppress (known harmless errors)
    const suppressedErrors = [
      // WalletConnect reverse ENS lookup 404s
      "rpc.walletconnect.com/v1/profile/reverse",
      // Web3Modal disconnect compatibility issue with certain wallets
      "disconnect is not a function",
      "this.provider.disconnect",
      // Balance fetch errors for testnet (non-critical)
      "Failed to fetch BTC balance",
      "Failed to fetch USDC balance",
      "Failed to fetch ETH balance",
      // Empty error objects from WalletConnect
      "{}",
    ];

    // Override console.error to filter out known harmless errors
    console.error = (...args: any[]) => {
      // Convert all arguments to string for checking
      const message = args
        .map((arg) => {
          if (typeof arg === "string") return arg;
          if (arg instanceof Error) return arg.message + " " + arg.stack;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(" ");

      // Check if this error should be suppressed
      const shouldSuppress = suppressedErrors.some(pattern =>
        message.includes(pattern)
      ) || (
          message.includes("404") && message.includes("walletconnect")
        ) || (
          message.includes("GET") &&
          message.includes("rpc.walletconnect.com") &&
          message.includes("404")
        );

      if (shouldSuppress) {
        // Log to debug level for development troubleshooting
        if (process.env.NODE_ENV === "development") {
          console.debug("[Suppressed Error]", ...args);
        }
        return;
      }
      originalError.apply(console, args);
    };

    // Override console.warn for similar filtering if needed
    console.warn = (...args: any[]) => {
      const message = args
        .map((arg) => {
          if (typeof arg === "string") return arg;
          if (arg instanceof Error) return arg.message + " " + arg.stack;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(" ");

      const shouldSuppress = suppressedErrors.some(pattern =>
        message.includes(pattern)
      ) || (
          message.includes("404") && message.includes("walletconnect")
        );

      if (shouldSuppress) {
        return;
      }
      originalWarn.apply(console, args);
    };

    // Cleanup: restore original console methods on unmount
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient inside the component via lazy useState initializer.
  // This avoids SSR cross-request cache pollution (module-level singletons are
  // shared across all requests on the server) while remaining stable across re-renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Prevent aggressive refetching — wagmi queries are wallet-driven
            staleTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConsoleErrorSuppressor />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

