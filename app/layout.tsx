import type { Metadata } from "next";
import "./globals.css";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/ui/navbar";

// Dynamically import Providers with no SSR to avoid indexedDB errors
const Providers = dynamic(() => import("./providers").then((mod) => mod.Providers), {
  ssr: false,
});

export const metadata: Metadata = {
  title: "AgentPay Relay",
  description: "Execute AI-powered spot trades on Uniswap with one-time x402 payments. No API keys. No custody.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-background font-sans">
        <Providers>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

