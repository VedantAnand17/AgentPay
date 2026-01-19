// Wagmi configuration for wallet connection
import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { walletConnect, injected, coinbaseWallet } from "@wagmi/connectors";
import { getWalletConnectProjectId } from "./config/app";

// Get WalletConnect project ID with proper validation
const projectId = getWalletConnectProjectId();

// App metadata for WalletConnect
const metadata = {
  name: "AgentPay Relay",
  description: "AI-powered crypto trading with x402 payments",
  url: typeof window !== "undefined" ? window.location.origin : "https://agentpay.relay",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    walletConnect({
      projectId,
      metadata,
      showQrModal: false, // Web3Modal handles QR code display
    }),
    injected({
      shimDisconnect: true,
    }),
    coinbaseWallet({
      appName: "AgentPay Relay",
      appLogoUrl: "https://avatars.githubusercontent.com/u/37784886",
    }),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: false, // Disable SSR to avoid indexedDB errors - Providers are loaded client-side only
});

