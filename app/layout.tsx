import type { Metadata } from "next";
import "./globals.css";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/ui/navbar";

const fontHeading = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
});

const fontBody = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

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
      <body className={`${fontBody.variable} ${fontHeading.variable} ${fontMono.variable} antialiased min-h-screen bg-background font-sans`}>
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

