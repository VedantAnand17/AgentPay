"use client";

// Wagmi and Web3Modal providers
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { wagmiConfig } from "@/lib/wagmi-config";
import { useEffect } from "react";

// Create a query client
const queryClient = new QueryClient();

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

// Component to suppress console errors for WalletConnect reverse lookup
function ConsoleErrorSuppressor() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Store original console methods
    const originalError = console.error;
    const originalWarn = console.warn;

    // Override console.error to filter out WalletConnect reverse lookup errors
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
      
      // Suppress 404 errors from WalletConnect reverse ENS lookup
      if (
        message.includes("rpc.walletconnect.com/v1/profile/reverse") ||
        (message.includes("404") && message.includes("walletconnect")) ||
        (message.includes("GET") && message.includes("rpc.walletconnect.com") && message.includes("404"))
      ) {
        // Silently ignore this harmless error
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
      
      if (
        message.includes("rpc.walletconnect.com/v1/profile/reverse") ||
        (message.includes("404") && message.includes("walletconnect")) ||
        (message.includes("GET") && message.includes("rpc.walletconnect.com") && message.includes("404"))
      ) {
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
  // Always wrap with WagmiProvider to avoid hook errors
  // The wagmiConfig has ssr: false, so it's safe for client-side only
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConsoleErrorSuppressor />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

