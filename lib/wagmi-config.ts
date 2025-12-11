// Wagmi configuration for wallet connection
import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { walletConnect, injected, coinbaseWallet } from "@wagmi/connectors";

// Get WalletConnect project ID from environment
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "your-project-id";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    walletConnect({ projectId }),
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: "AgentPay Relay" }),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: false, // Disable SSR to avoid indexedDB errors - Providers are loaded client-side only
});

