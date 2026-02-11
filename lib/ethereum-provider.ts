"use client";

import { useState, useEffect, useCallback } from "react";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
}

interface UseEthereumProviderReturn {
  provider: EthereumProvider | null;
  isAvailable: boolean;
  error: string | null;
  request: <T>(method: string, params?: unknown[]) => Promise<T>;
}

let cachedProvider: EthereumProvider | null = null;

export function useEthereumProvider(): UseEthereumProviderReturn {
  const [provider, setProvider] = useState<EthereumProvider | null>(cachedProvider);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkProvider = () => {
      const ethProvider = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
      if (ethProvider) {
        cachedProvider = ethProvider;
        setProvider(ethProvider);
        setError(null);
      } else {
        setError("No wallet provider found. Please install MetaMask or another wallet.");
      }
    };

    checkProvider();

    // Listen for provider injection (some wallets inject async)
    window.addEventListener("ethereum#initialized", checkProvider as EventListener);

    return () => {
      window.removeEventListener("ethereum#initialized", checkProvider as EventListener);
    };
  }, []);

  const request = useCallback(
    async <T,>(method: string, params?: unknown[]): Promise<T> => {
      if (!provider) {
        throw new Error("Ethereum provider not available");
      }
      return provider.request({ method, params }) as Promise<T>;
    },
    [provider]
  );

  return {
    provider,
    isAvailable: !!provider,
    error,
    request,
  };
}

// Utility to get provider synchronously (for non-React contexts)
export function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  if (cachedProvider) return cachedProvider;
  
  const ethProvider = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  if (ethProvider) {
    cachedProvider = ethProvider;
    return ethProvider;
  }
  return null;
}
